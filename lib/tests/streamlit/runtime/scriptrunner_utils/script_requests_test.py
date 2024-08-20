# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
        self.assertEqual(ScriptRequestType.CONTINUE, reqs._state)

    def test_stop(self):
        """A stop request will unconditionally succeed regardless of the
        ScriptRequests' current state.
        """

        for state in ScriptRequestType:
            reqs = ScriptRequests()
            reqs._state = state
            reqs.request_stop()
            self.assertEqual(ScriptRequestType.STOP, reqs._state)

    def test_rerun_while_stopped(self):
        """Requesting a rerun while STOPPED will return False."""
        reqs = ScriptRequests()
        reqs.request_stop()
        success = reqs.request_rerun(RerunData())
        self.assertFalse(success)
        self.assertEqual(ScriptRequestType.STOP, reqs._state)

    def test_rerun_while_running(self):
        """Requesting a rerun while in CONTINUE state will always succeed."""
        reqs = ScriptRequests()
        rerun_data = RerunData(query_string="test_query_string")
        success = reqs.request_rerun(rerun_data)
        self.assertTrue(success)
        self.assertEqual(ScriptRequestType.RERUN, reqs._state)
        self.assertEqual(rerun_data, reqs._rerun_data)

    def test_rerun_coalesce_none_and_none(self):
        """Coalesce two null-WidgetStates rerun requests."""
        reqs = ScriptRequests()

        # Request a rerun with null WidgetStates
        success = reqs.request_rerun(RerunData(widget_states=None))
        self.assertTrue(success)
        self.assertEqual(ScriptRequestType.RERUN, reqs._state)

        # Request another
        reqs.request_rerun(RerunData(widget_states=None))
        self.assertTrue(success)
        self.assertEqual(ScriptRequestType.RERUN, reqs._state)

        # The resulting RerunData should have null widget_states
        self.assertEqual(RerunData(widget_states=None), reqs._rerun_data)

    def test_rerun_coalesce_widgets_and_widgets(self):
        """Coalesce two non-null-WidgetStates rerun requests."""
        reqs = ScriptRequests()

        # Request a rerun with non-null WidgetStates.
        states = WidgetStates()
        _create_widget("trigger", states).trigger_value = True
        _create_widget("int", states).int_value = 123
        success = reqs.request_rerun(RerunData(widget_states=states))
        self.assertTrue(success)

        # Request another rerun. It should get coalesced with the first one.
        states = WidgetStates()
        _create_widget("trigger", states).trigger_value = False
        _create_widget("int", states).int_value = 456

        success = reqs.request_rerun(RerunData(widget_states=states))
        self.assertTrue(success)
        self.assertEqual(ScriptRequestType.RERUN, reqs._state)

        result_states = reqs._rerun_data.widget_states

        # Coalesced triggers should be True if either the old *or*
        # new value was True
        self.assertEqual(True, _get_widget("trigger", result_states).trigger_value)

        # Other widgets should have their newest value
        self.assertEqual(456, _get_widget("int", result_states).int_value)

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
        self.assertTrue(success)

        # Request a rerun with null WidgetStates.
        success = reqs.request_rerun(RerunData(widget_states=None))
        self.assertTrue(success)

        # The null WidgetStates request will be dropped; our existing
        # request should have the original values.
        result_states = reqs._rerun_data.widget_states
        self.assertEqual(True, _get_widget("trigger", result_states).trigger_value)
        self.assertEqual(123, _get_widget("int", result_states).int_value)

    def test_rerun_coalesce_none_and_widgets(self):
        """Coalesce a null-WidgetStates rerun request with a
        non-null-WidgetStates request.
        """
        reqs = ScriptRequests()

        # Request a rerun with null WidgetStates.
        success = reqs.request_rerun(RerunData(widget_states=None))
        self.assertTrue(success)

        # Request a rerun with non-null WidgetStates.
        states = WidgetStates()
        _create_widget("trigger", states).trigger_value = True
        _create_widget("int", states).int_value = 123
        success = reqs.request_rerun(RerunData(widget_states=states))
        self.assertTrue(success)

        # The null WidgetStates request will be overwritten.
        result_states = reqs._rerun_data.widget_states
        self.assertEqual(True, _get_widget("trigger", result_states).trigger_value)
        self.assertEqual(123, _get_widget("int", result_states).int_value)

    def test_request_rerun_appends_new_fragment_ids_to_queue(self):
        reqs = ScriptRequests()

        reqs.request_rerun(RerunData(fragment_id="my_fragment1"))

        # Sanity check
        self.assertEqual(reqs._rerun_data.fragment_id_queue, ["my_fragment1"])

        reqs.request_rerun(RerunData(fragment_id="my_fragment2"))
        reqs.request_rerun(RerunData(fragment_id="my_fragment3"))
        # Test that duplicate fragment_id isn't appended to queue.
        reqs.request_rerun(RerunData(fragment_id="my_fragment1"))

        self.assertEqual(
            reqs._rerun_data.fragment_id_queue,
            [
                "my_fragment1",
                "my_fragment2",
                "my_fragment3",
            ],
        )

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
        self.assertEqual(
            reqs._rerun_data.fragment_id_queue,
            [
                "my_fragment1",
                "my_fragment2",
                "my_fragment3",
            ],
        )

        reqs.request_rerun(RerunData(fragment_id_queue=[]))
        self.assertEqual(reqs._rerun_data.fragment_id_queue, [])

    def test_on_script_yield_with_no_request(self):
        """Return None; remain in the CONTINUE state."""
        reqs = ScriptRequests()
        result = reqs.on_scriptrunner_yield()
        self.assertEqual(None, result)
        self.assertEqual(ScriptRequestType.CONTINUE, reqs._state)

    def test_on_script_yield_with_fragment_rerun_request(self):
        """Return None; remain in the RERUN state."""
        reqs = ScriptRequests()
        reqs.request_rerun(RerunData(fragment_id_queue=["my_fragment_id"]))

        result = reqs.on_scriptrunner_yield()
        self.assertEqual(None, result)
        self.assertEqual(ScriptRequestType.RERUN, reqs._state)
        self.assertEqual(
            reqs._rerun_data, RerunData(fragment_id_queue=["my_fragment_id"])
        )

    def test_on_script_yield_with_is_fragment_scoped_rerun(self):
        """Return RERUN; transition to the CONTINUE state."""
        rerun_data = RerunData(
            fragment_id_queue=["my_fragment_id"], is_fragment_scoped_rerun=True
        )
        reqs = ScriptRequests()
        reqs.request_rerun(rerun_data)

        result = reqs.on_scriptrunner_yield()
        self.assertEqual(ScriptRequest(ScriptRequestType.RERUN, rerun_data), result)
        self.assertEqual(ScriptRequestType.CONTINUE, reqs._state)
        self.assertEqual(
            reqs._rerun_data,
            RerunData(
                fragment_id_queue=["my_fragment_id"], is_fragment_scoped_rerun=True
            ),
        )

    def test_on_script_yield_with_stop_request(self):
        """Return STOP; remain in the STOP state."""
        reqs = ScriptRequests()
        reqs.request_stop()

        result = reqs.on_scriptrunner_yield()
        self.assertEqual(ScriptRequest(ScriptRequestType.STOP), result)
        self.assertEqual(ScriptRequestType.STOP, reqs._state)

    def test_on_script_yield_with_rerun_request(self):
        """Return RERUN; transition to the CONTINUE state."""
        reqs = ScriptRequests()
        reqs.request_rerun(RerunData())

        result = reqs.on_scriptrunner_yield()
        self.assertEqual(ScriptRequest(ScriptRequestType.RERUN, RerunData()), result)
        self.assertEqual(ScriptRequestType.CONTINUE, reqs._state)

    def test_on_script_complete_with_no_request(self):
        """Return STOP; transition to the STOP state."""
        reqs = ScriptRequests()
        result = reqs.on_scriptrunner_ready()
        self.assertEqual(ScriptRequest(ScriptRequestType.STOP), result)
        self.assertEqual(ScriptRequestType.STOP, reqs._state)

    def test_on_script_complete_with_pending_request(self):
        """Return RERUN; transition to the CONTINUE state."""
        reqs = ScriptRequests()
        reqs.request_rerun(RerunData())

        result = reqs.on_scriptrunner_ready()
        self.assertEqual(ScriptRequest(ScriptRequestType.RERUN, RerunData()), result)
        self.assertEqual(ScriptRequestType.CONTINUE, reqs._state)
