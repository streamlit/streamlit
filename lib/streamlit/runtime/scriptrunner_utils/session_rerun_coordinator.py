# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Session-owned rerun mailbox that outlives individual ScriptRunners.

The coordinator assigns every accepted interaction a session-scoped sequence
number, keeps accepted-but-uncommitted interactions in order, and grants one
runner at a time the exclusive right to commit the next interaction (install
its widget state and dispatch its callbacks). Run-generation leases let a
superseded runner be invalidated without waiting for its script body.
"""

from __future__ import annotations

import threading
from collections import deque
from dataclasses import dataclass, replace
from enum import Enum
from typing import TYPE_CHECKING, Any, Final

from streamlit.logger import get_logger
from streamlit.runtime.scriptrunner_utils.script_requests import (
    RerunData,
    _coalesce_replay_trigger_states,
    _coalesce_replay_trigger_values,
    _has_active_trigger_value,
    _is_full_app_rerun,
    coalesce_rerun_data,
    rerun_preempts_script,
)

if TYPE_CHECKING:
    from collections.abc import Callable, Mapping

    from streamlit.proto.WidgetStates_pb2 import WidgetStates

_LOGGER: Final = get_logger(__name__)

MAX_PENDING_COMMITS: Final = 64

# Upper bound for one wait while a newer runner waits for an older runner to
# finish its in-flight callback batch. The wait loop rechecks liveness.
_COMMIT_WAIT_POLL_SECS: Final = 0.05


class AcceptDecision(Enum):
    # No live consumer: the caller must start a runner bound to the returned
    # run generation.
    START = "START"
    # The live consumer claims the record at its next run boundary or yield.
    ABSORBED = "ABSORBED"
    # Like ABSORBED, but a callback batch is committing; the record is claimed
    # after that batch releases its commit lease.
    ABSORBED_DEFERRED = "ABSORBED_DEFERRED"
    # The previous run generation expired; the caller must retire its runner
    # and start one bound to the returned run generation.
    SUPERSEDE = "SUPERSEDE"
    # The bounded mailbox is full and the interaction could not be coalesced.
    # No sequence number was assigned.
    REJECTED_OVERLOAD = "REJECTED_OVERLOAD"
    # The coordinator was closed with its session.
    REJECTED_CLOSED = "REJECTED_CLOSED"


class RunGenerationLease:
    """Liveness capability for one logical run generation.

    A runner checks its lease at Streamlit yield points and before mutating
    session state. Once expired, a lease never becomes live again.
    """

    def __init__(self, generation: int) -> None:
        self.generation: Final = generation
        self._expired = threading.Event()

    def is_live(self) -> bool:
        return not self._expired.is_set()

    def expire(self) -> None:
        self._expired.set()

    def __repr__(self) -> str:
        state = "live" if self.is_live() else "expired"
        return f"RunGenerationLease(generation={self.generation}, {state})"


@dataclass(frozen=True)
class AcceptResult:
    kind: AcceptDecision
    # Sequence number assigned to the accepted interaction.
    seq: int | None = None
    # Set for START and SUPERSEDE: the generation the new runner must bind to.
    run_generation: RunGenerationLease | None = None


@dataclass(frozen=True)
class InteractionCommitRecord:
    """One accepted interaction (or several provably callback-free ones)."""

    # Lowest and highest sequence numbers folded into this record.
    lowest_seq: int
    seq: int
    rerun_data: RerunData
    # True when committing this record cannot dispatch a callback, so a later
    # interaction may be folded into it without changing what callbacks see.
    callback_free: bool


class InteractionCommitLease:
    """Exclusive, single-use grant to commit one interaction record.

    The holder installs the record's widget state, dispatches its callbacks,
    and then releases the lease through the coordinator.
    """

    def __init__(
        self,
        *,
        claim_id: int,
        run_generation: RunGenerationLease,
        record: InteractionCommitRecord,
        carryover_replay_states: WidgetStates | None,
        carryover_replay_values: Mapping[str, Any] | None,
    ) -> None:
        self.claim_id: Final = claim_id
        self.run_generation: Final = run_generation
        self.record: Final = record
        # Triggers whose callbacks already ran in an earlier commit whose body
        # never started. The claimed body must observe them without
        # dispatching their callbacks again.
        self.carryover_replay_states: Final = carryover_replay_states
        self.carryover_replay_values: Final = carryover_replay_values
        # Guarded by the coordinator lock.
        self._released = False

    @property
    def is_active(self) -> bool:
        return not self._released

    def __repr__(self) -> str:
        return (
            f"InteractionCommitLease(claim_id={self.claim_id}, "
            f"generation={self.run_generation.generation}, "
            f"seq={self.record.lowest_seq}..{self.record.seq}, "
            f"active={self.is_active})"
        )


class SessionRerunCoordinator:
    """Session-owned, bounded rerun mailbox with generation-checked claims.

    Thread-safe. ``accept`` runs on the session's event loop; claims, releases
    and consumer lifecycle calls run on script threads.
    """

    def __init__(
        self,
        *,
        widget_has_callback: Callable[[str], bool] | None = None,
        max_pending_commits: int = MAX_PENDING_COMMITS,
    ) -> None:
        """
        Parameters
        ----------
        widget_has_callback
            Returns whether a widget may dispatch a callback when its value
            changes. Used only to decide when an interaction can be folded into
            the next one; unknown widgets must report True. Without it, any
            changed widget value is treated as callback-bearing.
        max_pending_commits
            Capacity of the pending record queue.
        """
        self._lock = threading.Lock()
        self._commit_released = threading.Condition(self._lock)
        self._widget_has_callback = widget_has_callback
        self._max_pending_commits = max_pending_commits

        self._next_seq = 0
        self._acknowledged_seq = 0
        self._pending: deque[InteractionCommitRecord] = deque()
        self._last_accepted_widget_states: WidgetStates | None = None

        self._generation_counter = 0
        self._run_generation: RunGenerationLease | None = None
        # True while a runner bound to _run_generation may still claim records.
        self._consumer_active = False

        self._claim_counter = 0
        self._active_commit: InteractionCommitLease | None = None
        self._carryover_replay_states: WidgetStates | None = None
        self._carryover_replay_values: Mapping[str, Any] | None = None

        self._closed = False

    # Event-loop side ------------------------------------------------------

    def accept(self, rerun_data: RerunData, *, fast_reruns: bool) -> AcceptResult:
        """Accept a rerun request and decide how the session should service it."""
        with self._lock:
            if self._closed:
                return AcceptResult(AcceptDecision.REJECTED_CLOSED)

            seq = self._enqueue_locked(rerun_data)
            if seq is None:
                _LOGGER.warning(
                    "Rejecting rerun request: %d interactions are already pending.",
                    len(self._pending),
                )
                return AcceptResult(AcceptDecision.REJECTED_OVERLOAD)

            if not self._consumer_active:
                lease = self._start_generation_locked()
                result = AcceptResult(AcceptDecision.START, seq, lease)
            elif self._active_commit is not None:
                # Superseding now would race the in-flight callback batch. The
                # committing runner claims this record once it releases.
                result = AcceptResult(AcceptDecision.ABSORBED_DEFERRED, seq)
            elif fast_reruns and _is_full_app_rerun(
                coalesce_rerun_data(None, rerun_data)
            ):
                lease = self._start_generation_locked()
                result = AcceptResult(AcceptDecision.SUPERSEDE, seq, lease)
            else:
                result = AcceptResult(AcceptDecision.ABSORBED, seq)

            _LOGGER.debug(
                "Accepted rerun seq=%d decision=%s pending=%d generation=%s",
                seq,
                result.kind.value,
                len(self._pending),
                self._generation_counter,
            )
            return result

    def restart_if_pending(self) -> RunGenerationLease | None:
        """Start a new generation if records are pending but no runner consumes them."""
        with self._lock:
            if self._closed or self._consumer_active or not self._pending:
                return None
            return self._start_generation_locked()

    def stop_consumer(self) -> None:
        """Expire the current generation and discard all pending interaction work."""
        with self._lock:
            self._stop_consumer_locked()

    def close(self) -> None:
        """Stop the consumer and reject every later request."""
        with self._lock:
            self._stop_consumer_locked()
            self._closed = True

    # Script-thread side ---------------------------------------------------

    def start_generation(self) -> RunGenerationLease:
        """Start a generation with no pending record, for a standalone runner."""
        with self._lock:
            return self._start_generation_locked()

    def accept_for_consumer(
        self, rerun_data: RerunData, run_generation: RunGenerationLease
    ) -> bool:
        """Queue a record only if ``run_generation`` is still the live consumer."""
        with self._lock:
            if not self._is_current_consumer_locked(run_generation):
                return False
            return self._enqueue_locked(rerun_data) is not None

    def has_preempting_work(self) -> bool:
        """Whether a pending record should interrupt the run in progress."""
        # Lock-free fast path: this runs at every Streamlit yield point.
        if not self._pending:
            return False
        with self._lock:
            return any(
                rerun_preempts_script(record.rerun_data) for record in self._pending
            )

    def finish_or_continue(self, run_generation: RunGenerationLease) -> bool:
        """Return True if records are pending for an idle consumer.

        Otherwise the consumer is retired atomically, so a later ``accept``
        starts a new runner instead of relying on this one.
        """
        with self._lock:
            if not self._is_current_consumer_locked(run_generation):
                return False
            if self._pending:
                return True
            self._consumer_active = False
            return False

    def consumer_exited(self, run_generation: RunGenerationLease) -> None:
        """Record that the runner bound to ``run_generation`` has stopped."""
        with self._lock:
            if run_generation is self._run_generation:
                self._consumer_active = False

    def claim(
        self, run_generation: RunGenerationLease
    ) -> InteractionCommitLease | None:
        """Claim the oldest pending record for ``run_generation``.

        Waits while another runner holds the commit lease, so a newer runner
        never installs widget state before an older callback batch finishes.
        Returns None if nothing is pending or the generation is no longer the
        live consumer.
        """
        with self._lock:
            while True:
                if not self._is_current_consumer_locked(run_generation):
                    return None
                if not self._pending:
                    return None
                active = self._active_commit
                if active is None:
                    break
                if active.run_generation is run_generation:
                    raise RuntimeError(
                        "A runner claimed an interaction while still holding "
                        "its previous commit lease."
                    )
                self._commit_released.wait(timeout=_COMMIT_WAIT_POLL_SECS)

            record = self._pending.popleft()
            self._claim_counter += 1
            claim = InteractionCommitLease(
                claim_id=self._claim_counter,
                run_generation=run_generation,
                record=record,
                carryover_replay_states=self._carryover_replay_states,
                carryover_replay_values=self._carryover_replay_values,
            )
            self._carryover_replay_states = None
            self._carryover_replay_values = None
            self._active_commit = claim
            _LOGGER.debug("Claimed %r", claim)
            return claim

    def release(
        self,
        claim: InteractionCommitLease,
        *,
        committed: bool,
        body_replay_states: WidgetStates | None = None,
        body_replay_values: Mapping[str, Any] | None = None,
    ) -> None:
        """Release a commit lease. Stale and duplicate releases are ignored.

        Parameters
        ----------
        claim
            The lease returned by ``claim``.
        committed
            False if no state was changed, in which case the record returns to
            the front of the queue for the next claim.
        body_replay_states, body_replay_values
            Triggers whose callbacks this commit dispatched. They are carried
            to the next claim until the claimed body starts, so a superseding
            runner's body still observes them.
        """
        with self._lock:
            if claim is not self._active_commit or not claim.is_active:
                return
            claim._released = True
            self._active_commit = None
            is_current = self._is_current_consumer_locked(claim.run_generation)

            if committed:
                self._acknowledged_seq = max(self._acknowledged_seq, claim.record.seq)
                if is_current:
                    self._carryover_replay_states, self._carryover_replay_values = (
                        _merge_replay(
                            claim.carryover_replay_states,
                            claim.carryover_replay_values,
                            body_replay_states,
                            body_replay_values,
                        )
                    )
            elif is_current:
                self._pending.appendleft(claim.record)
                self._carryover_replay_states, self._carryover_replay_values = (
                    _merge_replay(
                        claim.carryover_replay_states,
                        claim.carryover_replay_values,
                        self._carryover_replay_states,
                        self._carryover_replay_values,
                    )
                )

            _LOGGER.debug("Released %r committed=%s", claim, committed)
            self._commit_released.notify_all()

    def body_started(self, run_generation: RunGenerationLease) -> None:
        """Drop carried replay once the current generation's body observes it."""
        with self._lock:
            if run_generation is self._run_generation:
                self._carryover_replay_states = None
                self._carryover_replay_values = None

    # Introspection --------------------------------------------------------

    def snapshot(self) -> dict[str, Any]:
        """Return a debugging snapshot of the coordinator's state."""
        with self._lock:
            return {
                "next_seq": self._next_seq,
                "acknowledged_seq": self._acknowledged_seq,
                "current_run_generation": self._generation_counter,
                "consumer_active": self._consumer_active,
                "pending_commit_count": len(self._pending),
                "pending_seqs": [
                    (record.lowest_seq, record.seq) for record in self._pending
                ],
                "active_claim": repr(self._active_commit)
                if self._active_commit
                else None,
                "closed": self._closed,
            }

    # Internals ------------------------------------------------------------

    def _is_current_consumer_locked(self, run_generation: RunGenerationLease) -> bool:
        return (
            not self._closed
            and self._consumer_active
            and run_generation is self._run_generation
            and run_generation.is_live()
        )

    def _start_generation_locked(self) -> RunGenerationLease:
        if self._run_generation is not None:
            self._run_generation.expire()
        self._generation_counter += 1
        self._run_generation = RunGenerationLease(self._generation_counter)
        self._consumer_active = True
        self._commit_released.notify_all()
        return self._run_generation

    def _stop_consumer_locked(self) -> None:
        if self._run_generation is not None:
            self._run_generation.expire()
        self._consumer_active = False
        self._pending.clear()
        self._carryover_replay_states = None
        self._carryover_replay_values = None
        self._commit_released.notify_all()

    def _enqueue_locked(self, rerun_data: RerunData) -> int | None:
        """Append or fold a record and return its sequence number.

        Returns None, without assigning a sequence number, when the queue is
        full and the interaction cannot be folded into the newest record.
        """
        normalized = coalesce_rerun_data(None, rerun_data)
        callback_free = self._is_callback_free_locked(normalized.widget_states)
        tail = self._pending[-1] if self._pending else None
        can_fold = tail is not None and tail.callback_free

        if not can_fold and len(self._pending) >= self._max_pending_commits:
            return None

        self._next_seq += 1
        seq = self._next_seq
        if normalized.widget_states is not None:
            self._last_accepted_widget_states = normalized.widget_states

        if can_fold and tail is not None:
            merged = coalesce_rerun_data(tail.rerun_data, normalized)
            self._pending[-1] = InteractionCommitRecord(
                lowest_seq=tail.lowest_seq,
                seq=seq,
                rerun_data=replace(merged, batch_seq=seq),
                callback_free=callback_free,
            )
        else:
            self._pending.append(
                InteractionCommitRecord(
                    lowest_seq=seq,
                    seq=seq,
                    rerun_data=replace(normalized, batch_seq=seq),
                    callback_free=callback_free,
                )
            )
        return seq

    def _is_callback_free_locked(self, widget_states: WidgetStates | None) -> bool:
        """Whether committing ``widget_states`` provably dispatches no callback.

        Active triggers are always callback-bearing: each occurrence must
        commit separately. Other widgets count only if their value differs
        from the previously accepted snapshot.
        """
        if widget_states is None:
            return True

        previous = (
            {state.id: state for state in self._last_accepted_widget_states.widgets}
            if self._last_accepted_widget_states is not None
            else None
        )
        for state in widget_states.widgets:
            if _has_active_trigger_value(state):
                return False
            if previous is not None and previous.get(state.id) == state:
                continue
            if self._widget_has_callback is None or self._widget_has_callback(state.id):
                return False
        return True


def _merge_replay(
    old_states: WidgetStates | None,
    old_values: Mapping[str, Any] | None,
    new_states: WidgetStates | None,
    new_values: Mapping[str, Any] | None,
) -> tuple[WidgetStates | None, Mapping[str, Any] | None]:
    """Union two replay trigger sets; newer duplicate IDs win."""
    states = _coalesce_replay_trigger_states(old_states, new_states)
    values = _coalesce_replay_trigger_values(
        new_states=new_states,
        old_values=old_values,
        new_values=new_values,
        coalesced_states=states,
    )
    return states, values


def merge_carryover_replay(
    rerun_data: RerunData, claim: InteractionCommitLease
) -> RerunData:
    """Add a claim's carried replay triggers to the claimed body request."""
    if claim.carryover_replay_states is None:
        return rerun_data
    states, values = _merge_replay(
        claim.carryover_replay_states,
        claim.carryover_replay_values,
        rerun_data.replay_trigger_states,
        rerun_data.replay_trigger_values,
    )
    return replace(
        rerun_data, replay_trigger_states=states, replay_trigger_values=values
    )
