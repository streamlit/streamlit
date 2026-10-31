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

"""SessionRerunCoordinator unit tests."""

from __future__ import annotations

import threading

from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates
from streamlit.runtime.scriptrunner_utils.script_requests import RerunData
from streamlit.runtime.scriptrunner_utils.session_rerun_coordinator import (
    AcceptDecision,
    InteractionCommitLease,
    RunGenerationLease,
    SessionRerunCoordinator,
    merge_carryover_replay,
)


def _click(widget_id: str) -> WidgetStates:
    states = WidgetStates()
    state = WidgetState(id=widget_id)
    state.trigger_value = True
    states.widgets.append(state)
    return states


def _value(widget_id: str, value: int) -> WidgetStates:
    states = WidgetStates()
    state = WidgetState(id=widget_id)
    state.int_value = value
    states.widgets.append(state)
    return states


def _widget_ids(states: WidgetStates | None) -> list[str]:
    return [] if states is None else [state.id for state in states.widgets]


def _started(
    coordinator: SessionRerunCoordinator, rerun_data: RerunData | None = None
) -> RunGenerationLease:
    """Accept one interaction on an idle coordinator and return its generation."""
    result = coordinator.accept(rerun_data or RerunData(), fast_reruns=False)
    assert result.kind == AcceptDecision.START
    assert result.run_generation is not None
    return result.run_generation


def _claim(
    coordinator: SessionRerunCoordinator, generation: RunGenerationLease
) -> InteractionCommitLease:
    claim = coordinator.claim(generation)
    assert claim is not None
    return claim


class TestAccept:
    def test_seq_is_assigned_in_acceptance_order(self) -> None:
        coordinator = SessionRerunCoordinator()

        seqs = [
            coordinator.accept(
                RerunData(widget_states=_click(f"w{i}")), fast_reruns=False
            ).seq
            for i in range(3)
        ]

        assert seqs == [1, 2, 3]
        assert coordinator.snapshot()["pending_seqs"] == [(1, 1), (2, 2), (3, 3)]

    def test_first_accept_starts_a_generation(self) -> None:
        coordinator = SessionRerunCoordinator()

        result = coordinator.accept(RerunData(), fast_reruns=False)

        assert result.kind == AcceptDecision.START
        assert result.run_generation is not None
        assert result.run_generation.is_live()

    def test_accept_with_live_consumer_is_absorbed(self) -> None:
        coordinator = SessionRerunCoordinator()
        _started(coordinator)

        result = coordinator.accept(RerunData(), fast_reruns=False)

        assert result.kind == AcceptDecision.ABSORBED
        assert result.run_generation is None

    def test_fast_full_app_rerun_supersedes_and_expires_generation(self) -> None:
        coordinator = SessionRerunCoordinator()
        old_generation = _started(coordinator)

        result = coordinator.accept(RerunData(), fast_reruns=True)

        assert result.kind == AcceptDecision.SUPERSEDE
        assert result.run_generation is not None
        assert result.run_generation.generation == old_generation.generation + 1
        assert not old_generation.is_live()
        assert result.run_generation.is_live()

    def test_fast_fragment_rerun_is_absorbed(self) -> None:
        coordinator = SessionRerunCoordinator()
        generation = _started(coordinator)

        result = coordinator.accept(RerunData(fragment_id="frag"), fast_reruns=True)

        assert result.kind == AcceptDecision.ABSORBED
        assert generation.is_live()

    def test_accept_during_commit_is_deferred_not_superseded(self) -> None:
        coordinator = SessionRerunCoordinator()
        generation = _started(coordinator)
        _claim(coordinator, generation)

        result = coordinator.accept(RerunData(), fast_reruns=True)

        assert result.kind == AcceptDecision.ABSORBED_DEFERRED
        assert generation.is_live()

    def test_accept_after_consumer_retired_starts_new_generation(self) -> None:
        coordinator = SessionRerunCoordinator()
        generation = _started(coordinator)
        claim = _claim(coordinator, generation)
        coordinator.release(claim, committed=True)
        assert not coordinator.finish_or_continue(generation)

        result = coordinator.accept(RerunData(), fast_reruns=False)

        assert result.kind == AcceptDecision.START

    def test_closed_coordinator_rejects(self) -> None:
        coordinator = SessionRerunCoordinator()
        coordinator.close()

        result = coordinator.accept(RerunData(), fast_reruns=False)

        assert result.kind == AcceptDecision.REJECTED_CLOSED
        assert result.seq is None


class TestCoalescing:
    def test_callback_free_records_fold_into_one(self) -> None:
        coordinator = SessionRerunCoordinator()
        coordinator.accept(RerunData(query_string="a=1"), fast_reruns=False)
        coordinator.accept(RerunData(query_string="a=2"), fast_reruns=False)

        snapshot = coordinator.snapshot()
        assert snapshot["pending_seqs"] == [(1, 2)]
        generation = coordinator.start_generation()
        claim = _claim(coordinator, generation)
        assert claim.record.rerun_data.query_string == "a=2"
        assert claim.record.rerun_data.batch_seq == 2

    def test_repeated_clicks_stay_distinct(self) -> None:
        coordinator = SessionRerunCoordinator(widget_has_callback=lambda _: False)
        coordinator.accept(RerunData(widget_states=_click("btn")), fast_reruns=False)
        coordinator.accept(RerunData(widget_states=_click("btn")), fast_reruns=False)

        assert coordinator.snapshot()["pending_seqs"] == [(1, 1), (2, 2)]

    def test_changed_value_with_callback_stays_distinct(self) -> None:
        coordinator = SessionRerunCoordinator(widget_has_callback=lambda _: True)
        coordinator.accept(RerunData(widget_states=_value("w", 1)), fast_reruns=False)
        coordinator.accept(RerunData(widget_states=_value("w", 2)), fast_reruns=False)

        assert coordinator.snapshot()["pending_seqs"] == [(1, 1), (2, 2)]

    def test_changed_value_without_callback_folds(self) -> None:
        coordinator = SessionRerunCoordinator(widget_has_callback=lambda _: False)
        coordinator.accept(RerunData(widget_states=_value("w", 1)), fast_reruns=False)
        coordinator.accept(RerunData(widget_states=_value("w", 2)), fast_reruns=False)

        assert coordinator.snapshot()["pending_seqs"] == [(1, 2)]

    def test_unchanged_snapshot_folds_even_with_callbacks(self) -> None:
        coordinator = SessionRerunCoordinator(widget_has_callback=lambda _: True)
        coordinator.accept(RerunData(widget_states=_value("w", 1)), fast_reruns=False)
        # An auto-rerun resends the same widget values.
        coordinator.accept(
            RerunData(widget_states=_value("w", 1), is_auto_rerun=True),
            fast_reruns=False,
        )
        coordinator.accept(
            RerunData(widget_states=_value("w", 1), is_auto_rerun=True),
            fast_reruns=False,
        )

        assert coordinator.snapshot()["pending_seqs"] == [(1, 1), (2, 3)]

    def test_full_queue_rejects_without_assigning_seq(self) -> None:
        coordinator = SessionRerunCoordinator(max_pending_commits=2)
        coordinator.accept(RerunData(widget_states=_click("a")), fast_reruns=False)
        coordinator.accept(RerunData(widget_states=_click("b")), fast_reruns=False)

        rejected = coordinator.accept(
            RerunData(widget_states=_click("c")), fast_reruns=False
        )

        assert rejected.kind == AcceptDecision.REJECTED_OVERLOAD
        assert rejected.seq is None
        assert coordinator.snapshot()["next_seq"] == 2

    def test_full_queue_still_folds_into_callback_free_tail(self) -> None:
        coordinator = SessionRerunCoordinator(max_pending_commits=2)
        coordinator.accept(RerunData(widget_states=_click("a")), fast_reruns=False)
        coordinator.accept(RerunData(), fast_reruns=False)

        result = coordinator.accept(RerunData(), fast_reruns=False)

        assert result.kind != AcceptDecision.REJECTED_OVERLOAD
        assert coordinator.snapshot()["pending_seqs"] == [(1, 1), (2, 3)]


class TestClaims:
    def test_claims_follow_acceptance_order(self) -> None:
        coordinator = SessionRerunCoordinator()
        generation = _started(coordinator, RerunData(widget_states=_click("a")))
        coordinator.accept(RerunData(widget_states=_click("b")), fast_reruns=False)

        first = _claim(coordinator, generation)
        coordinator.release(first, committed=True)
        second = _claim(coordinator, generation)

        assert _widget_ids(first.record.rerun_data.widget_states) == ["a"]
        assert _widget_ids(second.record.rerun_data.widget_states) == ["b"]
        assert coordinator.snapshot()["active_claim"] is not None

    def test_expired_generation_cannot_claim(self) -> None:
        coordinator = SessionRerunCoordinator()
        old_generation = _started(coordinator)
        coordinator.accept(RerunData(), fast_reruns=True)

        assert coordinator.claim(old_generation) is None
        assert coordinator.snapshot()["pending_commit_count"] == 1

    def test_uncommitted_release_returns_record_to_front(self) -> None:
        coordinator = SessionRerunCoordinator()
        generation = _started(coordinator, RerunData(widget_states=_click("a")))
        coordinator.accept(RerunData(widget_states=_click("b")), fast_reruns=False)

        claim = _claim(coordinator, generation)
        coordinator.release(claim, committed=False)

        assert coordinator.snapshot()["pending_seqs"] == [(1, 1), (2, 2)]
        assert coordinator.snapshot()["acknowledged_seq"] == 0

    def test_committed_release_acknowledges_seq(self) -> None:
        coordinator = SessionRerunCoordinator()
        generation = _started(coordinator)

        claim = _claim(coordinator, generation)
        coordinator.release(claim, committed=True)

        snapshot = coordinator.snapshot()
        assert snapshot["acknowledged_seq"] == 1
        assert snapshot["active_claim"] is None

    def test_duplicate_release_is_ignored(self) -> None:
        coordinator = SessionRerunCoordinator()
        generation = _started(coordinator, RerunData(widget_states=_click("a")))
        coordinator.accept(RerunData(widget_states=_click("b")), fast_reruns=False)
        first = _claim(coordinator, generation)
        coordinator.release(first, committed=True)
        second = _claim(coordinator, generation)

        coordinator.release(first, committed=False)

        assert second.is_active
        assert coordinator.snapshot()["pending_commit_count"] == 0

    def test_newer_generation_waits_for_older_commit(self) -> None:
        coordinator = SessionRerunCoordinator()
        old_generation = _started(coordinator)
        old_claim = _claim(coordinator, old_generation)
        # The user pressed stop mid-callback, then interacted again.
        coordinator.stop_consumer()
        new_generation = _started(coordinator)

        claimed = threading.Event()
        result: list[InteractionCommitLease | None] = []

        def claim_on_new_runner() -> None:
            result.append(coordinator.claim(new_generation))
            claimed.set()

        thread = threading.Thread(target=claim_on_new_runner)
        thread.start()
        assert not claimed.wait(timeout=0.2)

        coordinator.release(old_claim, committed=True)
        assert claimed.wait(timeout=2)
        thread.join()
        assert result[0] is not None
        assert result[0].run_generation is new_generation

    def test_stop_consumer_discards_pending_and_expires(self) -> None:
        coordinator = SessionRerunCoordinator()
        generation = _started(coordinator)

        coordinator.stop_consumer()

        assert not generation.is_live()
        assert coordinator.snapshot()["pending_commit_count"] == 0
        assert coordinator.restart_if_pending() is None


class TestConsumerLifecycle:
    def test_finish_or_continue_reports_pending_work(self) -> None:
        coordinator = SessionRerunCoordinator()
        generation = _started(coordinator)

        assert coordinator.finish_or_continue(generation)
        assert coordinator.snapshot()["consumer_active"]

    def test_exited_consumer_with_pending_work_restarts(self) -> None:
        coordinator = SessionRerunCoordinator()
        generation = _started(coordinator)
        coordinator.consumer_exited(generation)

        new_generation = coordinator.restart_if_pending()

        assert new_generation is not None
        assert new_generation.generation == generation.generation + 1
        assert not generation.is_live()

    def test_has_preempting_work_ignores_plain_fragment_reruns(self) -> None:
        coordinator = SessionRerunCoordinator()
        _started(coordinator, RerunData(fragment_id="frag"))
        assert not coordinator.has_preempting_work()

        coordinator.accept(RerunData(), fast_reruns=False)
        assert coordinator.has_preempting_work()


class TestCarryover:
    def test_dispatched_triggers_carry_to_next_claim_until_body_starts(self) -> None:
        coordinator = SessionRerunCoordinator()
        generation = _started(coordinator, RerunData(widget_states=_click("a")))
        coordinator.accept(RerunData(widget_states=_click("b")), fast_reruns=False)

        first = _claim(coordinator, generation)
        coordinator.release(first, committed=True, body_replay_states=_click("a"))
        second = _claim(coordinator, generation)

        body = merge_carryover_replay(second.record.rerun_data, second)
        assert _widget_ids(body.replay_trigger_states) == ["a"]
        assert _widget_ids(body.widget_states) == ["b"]

    def test_body_start_clears_carryover(self) -> None:
        coordinator = SessionRerunCoordinator()
        generation = _started(coordinator, RerunData(widget_states=_click("a")))
        first = _claim(coordinator, generation)
        coordinator.release(first, committed=True, body_replay_states=_click("a"))
        coordinator.body_started(generation)
        coordinator.accept(RerunData(widget_states=_click("b")), fast_reruns=False)

        second = _claim(coordinator, generation)

        assert second.carryover_replay_states is None

    def test_carryover_transfers_to_superseding_generation(self) -> None:
        coordinator = SessionRerunCoordinator()
        old_generation = _started(coordinator, RerunData(widget_states=_click("a")))
        first = _claim(coordinator, old_generation)
        coordinator.release(first, committed=True, body_replay_states=_click("a"))

        superseded = coordinator.accept(
            RerunData(widget_states=_click("b")), fast_reruns=True
        )
        assert superseded.run_generation is not None
        # The old runner's late body start must not drop the carried triggers.
        coordinator.body_started(old_generation)
        claim = _claim(coordinator, superseded.run_generation)

        assert _widget_ids(claim.carryover_replay_states) == ["a"]
