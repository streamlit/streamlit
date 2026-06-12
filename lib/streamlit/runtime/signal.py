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

from __future__ import annotations

import enum
import threading
from abc import abstractmethod
from dataclasses import dataclass, field
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    Generic,
    NoReturn,
    Protocol,
    TypeVar,
    cast,
    overload,
)

from streamlit.errors import StreamlitAPIException
from streamlit.logger import get_logger
from streamlit.runtime.fragment import _check_not_parallel_worker
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx

if TYPE_CHECKING:
    from collections.abc import Callable

    from streamlit.runtime.scriptrunner_utils.script_run_context import (
        ScriptRunContext,
    )

_LOGGER: Final = get_logger(__name__)

T = TypeVar("T")

# Scope token prefixes. A widget whose callback is a Signal or a
# fragment-decorated function carries ``Delta.scope_token = <prefix><value>``;
# the frontend echoes the token back as ``ClientState.scope_token`` and the
# server resolves it into an ordered fragment id queue at request time.
# Fragment ids are hex hashes and never contain ":", so prefixed tokens can
# safely share the frontend's fragment id plumbing.
SIGNAL_SCOPE_TOKEN_PREFIX: Final = "signal:"  # noqa: S105 (not a password)
FRAGMENT_FN_SCOPE_TOKEN_PREFIX: Final = "fragment_fn:"  # noqa: S105 (not a password)


class _Unchanged(enum.Enum):
    """Sentinel type for "fire without replacing the state" in Signal.__call__."""

    TOKEN = enum.auto()


_UNCHANGED: Final = _Unchanged.TOKEN

# Marker for "lazy initial not yet resolved" in _SignalRecord.state.
_UNINITIALIZED: Final = object()


@dataclass
class _SignalRecord:
    """A signal's stored state and watcher subscriptions."""

    # The initial state: either the value itself or a zero-arg callable that
    # produces it lazily on first access.
    initial: Any
    state: Any = _UNINITIALIZED
    # Watcher fragment ids in registration (execution) order.
    watchers: list[str] = field(default_factory=list)


class SignalStorage(Protocol):
    """A key-value store for signal state and watcher subscriptions.

    Used to implement the ``st.signal`` command. One instance exists per
    session (a sibling of ``FragmentStorage``), so signal state survives
    individual script runs and is dropped with the session.
    """

    @abstractmethod
    def declare(self, key: str, initial: Any, *, reset_watchers: bool) -> None:
        """Create or refresh the record for the given key.

        An existing record keeps its state; only its stored initial is
        updated. If ``reset_watchers`` is True (full app runs), the watcher
        list is emptied so it can be rebuilt from scratch as fragments
        re-register while the script executes.
        """
        raise NotImplementedError

    @abstractmethod
    def contains(self, key: str) -> bool:
        """Return whether a record exists for the given key."""
        raise NotImplementedError

    @abstractmethod
    def get_state(self, key: str) -> Any:
        """Return the current state, resolving a lazy initial on first access.

        Raises KeyError if the key isn't declared.
        """
        raise NotImplementedError

    @abstractmethod
    def set_state(self, key: str, value: Any) -> None:
        """Replace the state for the given key.

        Raises KeyError if the key isn't declared.
        """
        raise NotImplementedError

    @abstractmethod
    def register_watcher(self, key: str, fragment_id: str) -> None:
        """Append a fragment id to the key's watcher list.

        A fragment id that is already registered keeps its existing position
        so that re-registration during fragment-only passes doesn't corrupt
        the execution order captured when the watchers first registered.

        Raises KeyError if the key isn't declared.
        """
        raise NotImplementedError

    @abstractmethod
    def watchers(self, key: str) -> list[str]:
        """Return the watcher fragment ids in registration (execution) order.

        Returns an empty list for unknown keys.
        """
        raise NotImplementedError

    @abstractmethod
    def clear(self, keep_keys: frozenset[str] | None = None) -> None:
        """Remove all records except the ones listed in keep_keys."""
        raise NotImplementedError


class MemorySignalStorage(SignalStorage):
    """A simple, memory-backed implementation of SignalStorage.

    MemorySignalStorage is a wrapper around a plain Python dict that complies
    with the SignalStorage protocol. An RLock guards the records: reads and
    registrations may also happen on parallel fragment worker threads, and
    resolving a lazy initial can re-enter the storage (e.g. an initializer
    that reads another signal's value).
    """

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._records: dict[str, _SignalRecord] = {}

    def declare(self, key: str, initial: Any, *, reset_watchers: bool) -> None:
        with self._lock:
            record = self._records.get(key)
            if record is None:
                record = _SignalRecord(initial=initial)
                self._records[key] = record
            else:
                record.initial = initial
            if reset_watchers:
                record.watchers.clear()

    def contains(self, key: str) -> bool:
        with self._lock:
            return key in self._records

    def get_state(self, key: str) -> Any:
        with self._lock:
            record = self._records[key]
            if record.state is _UNINITIALIZED:
                initial = record.initial
                record.state = initial() if callable(initial) else initial
            return record.state

    def set_state(self, key: str, value: Any) -> None:
        with self._lock:
            self._records[key].state = value

    def register_watcher(self, key: str, fragment_id: str) -> None:
        with self._lock:
            watchers = self._records[key].watchers
            if fragment_id not in watchers:
                watchers.append(fragment_id)

    def watchers(self, key: str) -> list[str]:
        with self._lock:
            record = self._records.get(key)
            return [] if record is None else list(record.watchers)

    def clear(self, keep_keys: frozenset[str] | None = None) -> None:
        with self._lock:
            if keep_keys is None:
                keep_keys = frozenset()

            for key in list(self._records):
                if key not in keep_keys:
                    del self._records[key]

    def __deepcopy__(self, memo: dict[int, object]) -> NoReturn:
        raise TypeError(
            "MemorySignalStorage does not support deepcopy; "
            "it holds a threading.RLock and shared mutable state."
        )

    def __copy__(self) -> NoReturn:
        raise TypeError(
            "MemorySignalStorage does not support copy; "
            "it holds a threading.RLock and shared mutable state."
        )


class Signal(Generic[T]):
    """A handle to a session-scoped value that fragments can watch.

    Create signals with ``st.signal``; don't instantiate this class directly.
    A ``Signal`` is a thin, key-addressed handle: the state itself lives in
    the session's signal storage, so handles captured in closures stay valid
    across reruns.
    """

    def __init__(self, key: str, initial: T | Callable[[], T] | None = None) -> None:
        self._key = key
        self._initial = initial
        # Fallback storage for bare execution (no script run context), so the
        # handle still behaves like a stateful value in plain Python runs.
        self._detached_storage: MemorySignalStorage | None = None

    @property
    def key(self) -> str:
        """The unique key identifying this signal within the session."""
        return self._key

    @property
    def value(self) -> T:
        """The signal's current state.

        Readable anywhere, anytime. Reading never subscribes — only the
        ``watch`` parameter of ``@st.fragment`` creates a subscription. If the
        signal was created with a callable initial, it is resolved on first
        access.
        """
        storage = self._storage_for(get_script_run_ctx(suppress_warning=True))
        self._ensure_record(storage)
        return cast("T", storage.get_state(self._key))

    def send(self, value: T) -> None:
        """Replace the signal's state with ``value`` and fire the signal.

        Firing appends the signal's watching fragments to the current
        fragment pass so they rerun, in execution order, after the fragments
        that are already queued. During a full app run, ``send`` only updates the
        state since the whole page renders anyway. A signal fires at most
        once per pass; repeated sends coalesce to the last value.

        Parameters
        ----------
        value : T
            The new state. Watchers read it via ``Signal.value`` when they
            execute.
        """
        self._fire(value)

    def __call__(self, value: T | _Unchanged = _UNCHANGED) -> None:
        """Fire the signal, optionally replacing its state.

        This makes a ``Signal`` a valid widget callback (e.g.
        ``on_change=my_signal``). A bare call fires with the state unchanged;
        calling with a value is equivalent to ``Signal.send``.
        """
        self._fire(value)

    @gather_metrics("signal.send")
    def _fire(self, value: Any) -> None:
        _check_not_parallel_worker("Signal.send()")

        ctx = get_script_run_ctx(suppress_warning=True)
        storage = self._storage_for(ctx)
        self._ensure_record(storage)

        if not isinstance(value, _Unchanged):
            storage.set_state(self._key, value)

        if ctx is None or ctx.fragment_ids_this_run is None:
            # Bare execution or a full app run: the state update is the whole
            # effect. During full runs everything below renders anyway, so
            # there is no queue to join; a watcher placed above the send
            # renders with the previous value until the next pass (matching
            # session_state semantics).
            return

        _enqueue_watchers(ctx, self._key)

    def _storage_for(self, ctx: ScriptRunContext | None) -> SignalStorage:
        if ctx is not None:
            return ctx.signal_storage
        if self._detached_storage is None:
            self._detached_storage = MemorySignalStorage()
        return self._detached_storage

    def _ensure_record(self, storage: SignalStorage) -> None:
        # Self-heal handles whose record was dropped by lifecycle
        # reconciliation (state resets to the declared initial).
        if not storage.contains(self._key):
            storage.declare(self._key, self._initial, reset_watchers=False)

    def _register_watcher(self, ctx: ScriptRunContext, fragment_id: str) -> None:
        """Subscribe a fragment to this signal (used by ``@st.fragment(watch=...)``)."""
        storage = ctx.signal_storage
        self._ensure_record(storage)
        storage.register_watcher(self._key, fragment_id)


def _enqueue_watchers(ctx: ScriptRunContext, key: str) -> None:
    """Append a fired signal's watchers to the in-flight fragment pass queue.

    ``ctx.fragment_ids_this_run`` is the live queue the ScriptRunner's
    fragment loop consumes by index, so ids appended here — from the callback
    phase or from a watcher body — are picked up within the same pass.
    Watchers that already ran or are already queued are skipped, which makes
    repeated fires coalesce and degrades send() cycles to a single round.
    """
    queue = ctx.fragment_ids_this_run
    if queue is None:  # pragma: no cover - callers guarantee a fragment pass
        return

    fired_before = key in ctx.signals_fired_this_pass
    ctx.signals_fired_this_pass.add(key)

    watcher_ids = ctx.signal_storage.watchers(key)
    if not watcher_ids:
        # Zero registered watchers: the state update is the entire effect.
        return

    queued_ids = set(queue)
    new_ids = [
        fragment_id
        for fragment_id in watcher_ids
        if fragment_id not in ctx.fragment_ids_consumed
        and fragment_id not in queued_ids
        # Skip watchers whose fragments are no longer registered (e.g. dropped
        # by a preceding full run). This mirrors the request-time filter in
        # AppSession._resolve_scope_token and avoids the pass loop's
        # missing-fragment warning for ids that are simply stale.
        and ctx.fragment_storage.contains(fragment_id)
    ]

    if new_ids:
        queue.extend(new_ids)
        _reorder_unconsumed_queue_tail(ctx, queue)
    elif fired_before and any(
        fragment_id in ctx.fragment_ids_consumed for fragment_id in watcher_ids
    ):
        _LOGGER.warning(
            "Signal with key '%s' fired again from within its own cascade. "
            "Watchers run at most once per pass to prevent infinite loops, so "
            "this fire only updated the signal's state. Check your watchers "
            "for circular send() chains.",
            key,
        )


def _reorder_unconsumed_queue_tail(ctx: ScriptRunContext, queue: list[str]) -> None:
    """Re-apply ancestor-before-descendant ordering to the not-yet-run queue tail.

    The already-consumed prefix keeps its positions so the running loop's
    index stays valid; only the unconsumed tail is reordered.
    """
    consumed_ids = ctx.fragment_ids_consumed
    consumed_prefix = [
        fragment_id for fragment_id in queue if fragment_id in consumed_ids
    ]
    unconsumed_tail = [
        fragment_id for fragment_id in queue if fragment_id not in consumed_ids
    ]
    queue[:] = consumed_prefix + ctx.fragment_storage.order_fragment_ids(
        unconsumed_tail
    )


@overload
def signal(key: str) -> Signal[None]: ...


@overload
def signal(key: str, *, initial: Callable[[], T]) -> Signal[T]: ...


@overload
def signal(key: str, *, initial: T) -> Signal[T]: ...


@gather_metrics("signal")
def signal(key: str, *, initial: T | Callable[[], T] | None = None) -> Signal[T]:
    """Create a signal that connects widgets and fragments across your app.

    A signal is a session-scoped, stateful value with subscribers. Fragments
    subscribe with the ``watch`` parameter of ``@st.fragment``; when the
    signal fires — from a widget callback or an explicit ``Signal.send`` —
    every watching fragment reruns in place, in execution order (the order
    the watchers were called during the run that registered them), and
    nothing else runs. Reading ``Signal.value`` never subscribes.

    The signal's state persists across reruns as long as the signal is
    re-declared during each full app run. If a full app run finishes without
    declaring the signal (for example after switching to a page that doesn't
    create it), its state is reset.

    Parameters
    ----------
    key : str
        A unique identifier for the signal within the session. Unlike
        elements, signals have no position on the page to derive an identity
        from, so a key is required and positional. Creating two signals with
        the same key in one script run raises a ``StreamlitAPIException``.

    initial : T, callable, or None
        The signal's initial state, keyword-only. If this is a zero-argument
        callable, it is invoked lazily on first access (and again after the
        signal's state is reset). If this is ``None`` (default), the signal's
        value is ``None`` until its first ``Signal.send`` — omit it for
        pure-trigger signals whose watchers read their data elsewhere.

    Returns
    -------
    Signal
        The signal handle. Read the current state with ``Signal.value``,
        replace it and fire with ``Signal.send(value)``, or pass the signal
        directly as a widget callback (e.g. ``on_change=my_signal``) to fire
        it with the state unchanged.

    Example
    -------
    A sidebar widget drives two fragments anywhere on the page — and nothing
    else reruns:

    .. code-block:: python
        :filename: streamlit_app.py

        import streamlit as st

        country = st.signal("country", initial="US")

        st.sidebar.selectbox("Country", ["US", "CA", "DE"], key="c", on_change=country)


        @st.fragment(watch=country)
        def chart_panel():
            st.line_chart(load_data(st.session_state.c))


        @st.fragment(watch=country)
        def metrics_row():
            st.metric("Population", get_population(st.session_state.c))


        col1, col2 = st.columns(2)
        with col1:
            chart_panel()
        with col2:
            metrics_row()

    .. output::
        https://doc-signal.streamlit.app/
        height: 450px

    """
    if not isinstance(key, str) or not key:
        raise StreamlitAPIException(
            "`st.signal` requires a non-empty string `key` that identifies "
            "the signal within the session."
        )

    handle: Signal[T] = Signal(key, initial)

    ctx = get_script_run_ctx(suppress_warning=True)
    if ctx is None:
        # The script is run bare (e.g. `python app.py`): return a detached
        # handle that manages its own state.
        return handle

    if key in ctx.signal_keys_declared_this_run:
        raise StreamlitAPIException(
            f'A signal with `key="{key}"` was already created during this '
            "script run. Signal keys must be unique — pass a different `key` "
            "to each `st.signal` call."
        )
    ctx.signal_keys_declared_this_run.add(key)

    ctx.signal_storage.declare(
        key,
        initial,
        # Full app runs rebuild the watcher list from scratch as fragments
        # re-register while the script executes; fragment-only passes keep
        # the existing subscriptions.
        reset_watchers=ctx.fragment_ids_this_run is None,
    )

    return handle
