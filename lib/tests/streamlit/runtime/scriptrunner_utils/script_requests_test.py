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

import unittest
from unittest.mock import MagicMock, patch

import pytest

from streamlit.proto.Common_pb2 import ChatInputValue, StringTriggerValue
from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates
from streamlit.runtime.scriptrunner_utils.script_requests import (
    RerunData,
    ScriptRequest,
    ScriptRequests,
    ScriptRequestType,
)


def _create_widget(id: str, states: WidgetStates) -> WidgetState:
    """Create a widget with the given ID."""
    states.widgets.add().id = id
    return states.widgets[-1]


def _get_widget(id: str, states: WidgetStates) -> WidgetState | None:
    """Return the widget with the given ID."""
    for state in states.widgets:
        if state.id == id:
            return state
    return None


class ScriptRequestsTest(unittest.TestCase):
    def test_starts_running(self):
        """ScriptRequests starts in the CONTINUE state."""
        reqs = ScriptRequests()
        assert reqs._state == ScriptRequestType.CONTINUE

    def test_stop(self):
        """A stop request will unconditionally succeed regardless of the
        ScriptRequests' current state.
        """

        for state in ScriptRequestType:
            reqs = ScriptRequests()
            reqs._state = state
            reqs.request_stop()
            assert reqs._state == ScriptRequestType.STOP

    def test_rerun_while_stopped(self):
        """Requesting a rerun while STOPPED will return False."""
        reqs = ScriptRequests()
        reqs.request_stop()
        success = reqs.request_rerun(RerunData())
        assert not success
        assert reqs._state == ScriptRequestType.STOP

    def test_rerun_while_running(self):
        """Requesting a rerun while in CONTINUE state will always succeed."""
        reqs = ScriptRequests()
        rerun_data = RerunData(query_string="test_query_string")
        success = reqs.request_rerun(rerun_data)
        assert success
        assert reqs._state == ScriptRequestType.RERUN
        assert rerun_data == reqs._rerun_data

    def test_rerun_coalesce_none_and_none(self):
        """Coalesce two null-WidgetStates rerun requests."""
        reqs = ScriptRequests()

        # Request a rerun with null WidgetStates
        success = reqs.request_rerun(RerunData(widget_states=None))
        assert success
        assert reqs._state == ScriptRequestType.RERUN

        # Request another
        reqs.request_rerun(RerunData(widget_states=None))
        assert success
        assert reqs._state == ScriptRequestType.RERUN

        # The resulting RerunData should have null widget_states
        assert RerunData(widget_states=None) == reqs._rerun_data

    def test_rerun_coalesce_widgets_and_widgets(self):
        """Coalesce two non-null-WidgetStates rerun requests."""
        reqs = ScriptRequests()

        # Request a rerun with non-null WidgetStates.
        states = WidgetStates()
        _create_widget("trigger", states).trigger_value = True
        _create_widget("int", states).int_value = 123
        success = reqs.request_rerun(RerunData(widget_states=states))
        assert success

        # Request another rerun. It should get coalesced with the first one.
        states = WidgetStates()
        _create_widget("trigger", states).trigger_value = False
        _create_widget("int", states).int_value = 456

        success = reqs.request_rerun(RerunData(widget_states=states))
        assert success
        assert reqs._state == ScriptRequestType.RERUN

        result_states = reqs._rerun_data.widget_states

        # Coalesced triggers should be True if either the old *or*
        # new value was True
        assert _get_widget("trigger", result_states).trigger_value

        # Other widgets should have their newest value
        assert _get_widget("int", result_states).int_value == 456

    def test_rerun_coalesce_widgets_and_none(self):
        """Coalesce a non-null-WidgetStates rerun request with a
        null-WidgetStates request.
        """
        reqs = ScriptRequests()

        # Request a rerun with non-null WidgetStates.
        states = WidgetStates()
        _create_widget("trigger", states).trigger_value = True
        _create_widget("int", states).int_value = 123
        success = reqs.request_rerun(RerunData(widget_states=states))
        assert success

        # Request a rerun with null WidgetStates.
        success = reqs.request_rerun(RerunData(widget_states=None))
        assert success

        # The null WidgetStates request will be dropped; our existing
        # request should have the original values.
        result_states = reqs._rerun_data.widget_states
        assert _get_widget("trigger", result_states).trigger_value
        assert _get_widget("int", result_states).int_value == 123

    def test_rerun_coalesce_none_and_widgets(self):
        """Coalesce a null-WidgetStates rerun request with a
        non-null-WidgetStates request.
        """
        reqs = ScriptRequests()

        # Request a rerun with null WidgetStates.
        success = reqs.request_rerun(RerunData(widget_states=None))
        assert success

        # Request a rerun with non-null WidgetStates.
        states = WidgetStates()
        _create_widget("trigger", states).trigger_value = True
        _create_widget("int", states).int_value = 123
        success = reqs.request_rerun(RerunData(widget_states=states))
        assert success

        # The null WidgetStates request will be overwritten.
        result_states = reqs._rerun_data.widget_states
        assert _get_widget("trigger", result_states).trigger_value
        assert _get_widget("int", result_states).int_value == 123

    def test_request_rerun_appends_new_fragment_ids_to_queue(self):
        reqs = ScriptRequests()

        reqs.request_rerun(RerunData(fragment_id="my_fragment1"))

        # Sanity check
        assert reqs._rerun_data.fragment_id_queue == ["my_fragment1"]

        reqs.request_rerun(RerunData(fragment_id="my_fragment2"))
        reqs.request_rerun(RerunData(fragment_id="my_fragment3"))
        # Test that duplicate fragment_id isn't appended to queue.
        reqs.request_rerun(RerunData(fragment_id="my_fragment1"))

        assert reqs._rerun_data.fragment_id_queue == [
            "my_fragment1",
            "my_fragment2",
            "my_fragment3",
        ]

    def test_request_rerun_appends_clears_fragment_queue_on_full_rerun(self):
        reqs = ScriptRequests()
        reqs.request_rerun(
            RerunData(
                fragment_id_queue=[
                    "my_fragment1",
                    "my_fragment2",
                    "my_fragment3",
                ]
            )
        )

        # Sanity check
        assert reqs._rerun_data.fragment_id_queue == [
            "my_fragment1",
            "my_fragment2",
            "my_fragment3",
        ]

        reqs.request_rerun(RerunData(fragment_id_queue=[]))
        assert reqs._rerun_data.fragment_id_queue == []

    def test_request_rerun_merges_fragment_id_queues(self):
        """Two targeted requests union with dedup and preserved order, staying unscoped."""
        reqs = ScriptRequests()
        reqs.request_rerun(RerunData(fragment_id_queue=["frag_a", "frag_b"]))
        reqs.request_rerun(RerunData(fragment_id_queue=["frag_b", "frag_c"]))
        assert reqs._rerun_data.fragment_id_queue == ["frag_a", "frag_b", "frag_c"]
        assert reqs._rerun_data.is_fragment_scoped_rerun is False

    def test_pending_full_app_rerun_not_downgraded_by_targeted_rerun(self):
        """A pending full-app rerun is not downgraded when a targeted rerun arrives."""
        reqs = ScriptRequests()
        reqs.request_rerun(RerunData())  # full-app: empty queue, not fragment-scoped
        reqs.request_rerun(RerunData(fragment_id_queue=["frag_x"]))  # targeted
        assert reqs._rerun_data.fragment_id_queue == []
        assert reqs._rerun_data.is_fragment_scoped_rerun is False

    def test_pending_full_app_rerun_not_downgraded_by_bare_fragment_id(self):
        """A pending full-app rerun survives a target sent as a bare fragment_id."""
        reqs = ScriptRequests()
        reqs.request_rerun(RerunData())  # full-app first
        reqs.request_rerun(RerunData(fragment_id="frag_x"))  # bare fragment_id
        assert reqs._rerun_data.fragment_id_queue == []
        assert reqs._rerun_data.is_fragment_scoped_rerun is False

    def test_targeted_then_full_collapses_to_full_app_rerun(self):
        """A targeted rerun followed by a full-app rerun collapses to full-app."""
        reqs = ScriptRequests()
        reqs.request_rerun(RerunData(fragment_id_queue=["frag_x"]))  # targeted first
        reqs.request_rerun(RerunData())  # full-app arrives second
        assert reqs._rerun_data.fragment_id_queue == []
        assert reqs._rerun_data.is_fragment_scoped_rerun is False

    def test_bare_fragment_id_then_full_collapses_to_full_app_rerun(self):
        """Bare fragment_id then full-app collapses: the id is folded in before comparing."""
        reqs = ScriptRequests()
        reqs.request_rerun(RerunData(fragment_id="frag_x"))  # bare fragment_id first
        reqs.request_rerun(RerunData())  # full-app arrives second
        assert reqs._rerun_data.fragment_id_queue == []
        assert reqs._rerun_data.is_fragment_scoped_rerun is False

    def test_union_keeps_fragment_scope_when_either_rerun_is_scoped(self):
        """Unioning targeted reruns stays fragment-scoped if either request was."""
        reqs = ScriptRequests()
        reqs.request_rerun(RerunData(fragment_id_queue=["frag_a"]))
        reqs.request_rerun(
            RerunData(fragment_id_queue=["frag_b"], is_fragment_scoped_rerun=True)
        )
        assert reqs._rerun_data.fragment_id_queue == ["frag_a", "frag_b"]
        assert reqs._rerun_data.is_fragment_scoped_rerun is True

    def test_full_app_clears_pending_fragment_scoped_rerun(self):
        """A full-app rerun drops a pending fragment-scoped rerun's scope and queue."""
        reqs = ScriptRequests()
        reqs.request_rerun(
            RerunData(fragment_id_queue=["frag_x"], is_fragment_scoped_rerun=True)
        )
        reqs.request_rerun(RerunData())  # full-app arrives second
        assert reqs._rerun_data.fragment_id_queue == []
        assert reqs._rerun_data.is_fragment_scoped_rerun is False

    def test_replay_state_survives_coalescing_with_stateless_request(self):
        reqs = ScriptRequests()
        replay = WidgetStates()
        _create_widget("btn_a", replay).trigger_value = True
        reqs.request_rerun(RerunData(replay_trigger_states=replay))
        reqs.request_rerun(RerunData(fragment_id_queue=["frag"], is_auto_rerun=True))

        result = reqs._rerun_data.replay_trigger_states
        assert result is not None
        assert _get_widget("btn_a", result).trigger_value is True

    def test_older_fresh_triggers_remain_active_when_coalesced(self):
        """The fresh channel preserves active triggers from rapid interactions."""
        reqs = ScriptRequests()

        old_states = WidgetStates()
        _create_widget("btn_a", old_states).trigger_value = True
        reqs.request_rerun(RerunData(widget_states=old_states))

        new_states = WidgetStates()
        _create_widget("btn_b", new_states).trigger_value = True
        reqs.request_rerun(RerunData(widget_states=new_states))

        result = reqs._rerun_data.widget_states
        assert _get_widget("btn_a", result).trigger_value is True
        assert _get_widget("btn_b", result).trigger_value is True

    def test_fresh_and_replay_channels_coalesce_independently(self):
        reqs = ScriptRequests()
        older_fresh_states = WidgetStates()
        _create_widget("scalar", older_fresh_states).int_value = 1
        older_replay_states = WidgetStates()
        _create_widget("bool", older_replay_states).trigger_value = True
        _create_widget("string", older_replay_states).string_trigger_value.CopyFrom(
            StringTriggerValue(data="old")
        )
        reqs.request_rerun(
            RerunData(
                widget_states=older_fresh_states,
                replay_trigger_states=older_replay_states,
            )
        )

        newer_fresh_states = WidgetStates()
        _create_widget("scalar", newer_fresh_states).int_value = 2
        newer_replay_states = WidgetStates()
        _create_widget("chat", newer_replay_states).chat_input_value.CopyFrom(
            ChatInputValue(data="hello")
        )
        _create_widget("string", newer_replay_states).string_trigger_value.CopyFrom(
            StringTriggerValue(data="new")
        )
        _create_widget(
            "json", newer_replay_states
        ).json_trigger_value = '{"event":"go"}'
        _create_widget("non_trigger", newer_replay_states).int_value = 99
        reqs.request_rerun(
            RerunData(
                widget_states=newer_fresh_states,
                replay_trigger_states=newer_replay_states,
            )
        )

        fresh = reqs._rerun_data.widget_states
        assert fresh is not None
        assert [(state.id, state.int_value) for state in fresh.widgets] == [
            ("scalar", 2)
        ]
        replay = reqs._rerun_data.replay_trigger_states
        assert replay is not None
        assert [state.id for state in replay.widgets] == [
            "bool",
            "string",
            "chat",
            "json",
        ]
        assert _get_widget("string", replay).string_trigger_value.data == "new"
        assert _get_widget("chat", replay).chat_input_value.data == "hello"
        assert _get_widget("json", replay).json_trigger_value == '{"event":"go"}'
        assert _get_widget("scalar", replay) is None

    def test_inactive_and_non_trigger_values_are_not_replayed(self):
        reqs = ScriptRequests()
        replay = WidgetStates()
        _create_widget("bool", replay).trigger_value = False
        _create_widget("string", replay).string_trigger_value.CopyFrom(
            StringTriggerValue(data="")
        )
        _create_widget("chat", replay).chat_input_value.CopyFrom(
            ChatInputValue(data=None)
        )
        _create_widget("json", replay).json_trigger_value = ""
        _create_widget("scalar", replay).int_value = 1

        reqs.request_rerun(RerunData(replay_trigger_states=replay))

        assert reqs._rerun_data.replay_trigger_states is None

    def test_request_rerun_batch_coalesces_fragment_targets(self):
        reqs = ScriptRequests()
        reqs.request_rerun_batch(
            [
                RerunData(fragment_id_queue=["frag-a"]),
                RerunData(fragment_id_queue=["frag-b"]),
            ]
        )

        assert reqs._rerun_data.fragment_id_queue == ["frag-a", "frag-b"]

    def test_request_rerun_batch_acquires_lock_once(self):
        reqs = ScriptRequests()
        lock = MagicMock()
        reqs._lock = lock

        reqs.request_rerun_batch(
            [
                RerunData(fragment_id_queue=["frag-a"]),
                RerunData(fragment_id_queue=["frag-b"]),
            ]
        )

        lock.__enter__.assert_called_once_with()
        lock.__exit__.assert_called_once()

    def test_on_script_yield_with_no_request(self):
        """Return None; remain in the CONTINUE state."""
        reqs = ScriptRequests()
        result = reqs.on_scriptrunner_yield()
        assert None is result
        assert reqs._state == ScriptRequestType.CONTINUE

    def test_on_script_yield_with_fragment_rerun_request(self):
        """Return None; remain in the RERUN state."""
        reqs = ScriptRequests()
        reqs.request_rerun(RerunData(fragment_id_queue=["my_fragment_id"]))

        result = reqs.on_scriptrunner_yield()
        assert None is result
        assert reqs._state == ScriptRequestType.RERUN
        assert reqs._rerun_data == RerunData(fragment_id_queue=["my_fragment_id"])

    def test_compose_fragment_rerun_lets_body_finish_then_serves_target(self):
        """A composing fragment rerun lets the body finish before running the target.

        on_scriptrunner_yield returns None (the runner does not preempt the body),
        and on_scriptrunner_ready returns the pending fragment rerun afterwards.
        """
        reqs = ScriptRequests()
        rerun_data = RerunData(fragment_id_queue=["target-frag"])
        reqs.request_rerun(rerun_data)

        assert reqs._rerun_data.is_fragment_scoped_rerun is False
        assert reqs.on_scriptrunner_yield() is None
        assert reqs._state == ScriptRequestType.RERUN

        result = reqs.on_scriptrunner_ready()
        assert result == ScriptRequest(ScriptRequestType.RERUN, rerun_data)
        assert reqs._state == ScriptRequestType.CONTINUE

    def test_on_script_yield_with_is_fragment_scoped_rerun(self):
        """Return RERUN; transition to the CONTINUE state."""
        rerun_data = RerunData(
            fragment_id_queue=["my_fragment_id"], is_fragment_scoped_rerun=True
        )
        reqs = ScriptRequests()
        reqs.request_rerun(rerun_data)

        result = reqs.on_scriptrunner_yield()
        assert ScriptRequest(ScriptRequestType.RERUN, rerun_data) == result
        assert reqs._state == ScriptRequestType.CONTINUE
        assert reqs._rerun_data == RerunData(
            fragment_id_queue=["my_fragment_id"], is_fragment_scoped_rerun=True
        )

    def test_on_script_yield_with_stop_request(self):
        """Return STOP; remain in the STOP state."""
        reqs = ScriptRequests()
        reqs.request_stop()

        result = reqs.on_scriptrunner_yield()
        assert ScriptRequest(ScriptRequestType.STOP) == result
        assert reqs._state == ScriptRequestType.STOP

    def test_on_script_yield_with_rerun_request(self):
        """Return RERUN; transition to the CONTINUE state."""
        reqs = ScriptRequests()
        reqs.request_rerun(RerunData())

        result = reqs.on_scriptrunner_yield()
        assert ScriptRequest(ScriptRequestType.RERUN, RerunData()) == result
        assert reqs._state == ScriptRequestType.CONTINUE

    def test_on_script_complete_with_no_request(self):
        """Return STOP; transition to the STOP state."""
        reqs = ScriptRequests()
        result = reqs.on_scriptrunner_ready()
        assert ScriptRequest(ScriptRequestType.STOP) == result
        assert reqs._state == ScriptRequestType.STOP

    def test_on_script_complete_with_pending_request(self):
        """Return RERUN; transition to the CONTINUE state."""
        reqs = ScriptRequests()
        reqs.request_rerun(RerunData())

        result = reqs.on_scriptrunner_ready()
        assert ScriptRequest(ScriptRequestType.RERUN, RerunData()) == result
        assert reqs._state == ScriptRequestType.CONTINUE


def test_rerun_data_repr_contains_class_name() -> None:
    """RerunData.__repr__ renders a non-empty string naming the class."""
    assert "RerunData" in repr(RerunData())


def test_script_request_repr_contains_class_name() -> None:
    """ScriptRequest.__repr__ renders a non-empty string naming the class."""
    assert "ScriptRequest" in repr(ScriptRequest(type=ScriptRequestType.STOP))


def test_script_request_rerun_data_returns_data_for_rerun() -> None:
    """The rerun_data property returns the attached data for RERUN requests."""
    rerun_data = RerunData(query_string="q")
    request = ScriptRequest(type=ScriptRequestType.RERUN, _rerun_data=rerun_data)
    assert request.rerun_data is rerun_data


def test_script_request_rerun_data_raises_for_non_rerun() -> None:
    """Accessing rerun_data on a non-RERUN request raises RuntimeError."""
    request = ScriptRequest(type=ScriptRequestType.STOP)
    with pytest.raises(RuntimeError, match="only set for RERUN requests"):
        _ = request.rerun_data


def test_request_rerun_unrecognized_state_raises() -> None:
    """request_rerun raises RuntimeError when the internal state is unrecognized."""
    reqs = ScriptRequests()
    # Force an out-of-range state so none of the STOP/CONTINUE/RERUN branches
    # match and the final defensive raise is reached.
    reqs._state = "BOGUS_STATE"  # type: ignore[assignment]
    with pytest.raises(RuntimeError, match="Unrecognized ScriptRunnerState"):
        reqs.request_rerun(RerunData())


def test_on_scriptrunner_yield_returns_none_when_state_changes_under_lock() -> None:
    """on_scriptrunner_yield re-checks the preempt condition under the lock.

    The fast path avoids the lock, but the rerun data can change before the lock
    is acquired. When the re-check inside the lock reports that the fragment run
    should not preempt the script, the method returns None without consuming the
    request.
    """
    reqs = ScriptRequests()
    reqs.request_rerun(
        RerunData(fragment_id_queue=["frag"], is_fragment_scoped_rerun=True)
    )

    # First call (fast path) returns False so we skip the early return and take
    # the lock; second call (under the lock) returns True so we bail with None.
    with patch(
        "streamlit.runtime.scriptrunner_utils.script_requests._fragment_run_should_not_preempt_script",
        side_effect=[False, True],
    ):
        result = reqs.on_scriptrunner_yield()

    assert result is None
    assert reqs._state == ScriptRequestType.RERUN
