# Copyright 2018-2022 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import unittest
from typing import Optional

from streamlit.proto.WidgetStates_pb2 import WidgetStates, WidgetState
from streamlit.scriptrunner import RerunData
from streamlit.scriptrunner.script_runner_requests import (
    ScriptRunnerRequests,
    ScriptRunnerRequestState,
)


def _create_widget(id: str, states: WidgetStates) -> WidgetState:
    """Create a widget with the given ID."""
    states.widgets.add().id = id
    return states.widgets[-1]


def _get_widget(id: str, states: WidgetStates) -> Optional[WidgetState]:
    """Return the widget with the given ID."""
    for state in states.widgets:
        if state.id == id:
            return state
    return None


class ScriptRunnerRequestsTest(unittest.TestCase):
    def test_starts_running(self):
        """ScriptRunnerRequests starts in the RUNNING state."""
        reqs = ScriptRunnerRequests()
        self.assertEqual(ScriptRunnerRequestState.RUNNING, reqs.state)

    def test_stop(self):
        """A stop request will unconditionally succeed regardless of the
        ScriptRunnerRequests' current state.
        """

        for state in ScriptRunnerRequestState:
            reqs = ScriptRunnerRequests()
            reqs._state = state
            reqs.stop()
            self.assertEqual(ScriptRunnerRequestState.STOPPED, reqs.state)

    def test_rerun_while_stopped(self):
        """Requesting a rerun while STOPPED will return False."""
        reqs = ScriptRunnerRequests()
        reqs.stop()
        success = reqs.request_rerun(RerunData())
        self.assertFalse(success)
        self.assertEqual(ScriptRunnerRequestState.STOPPED, reqs.state)

    def test_rerun_while_running(self):
        """Requesting a rerun while RUNNING will always succeed."""
        reqs = ScriptRunnerRequests()
        rerun_data = RerunData(query_string="test_query_string")
        success = reqs.request_rerun(rerun_data)
        self.assertTrue(success)
        self.assertEqual(ScriptRunnerRequestState.RERUN_REQUESTED, reqs.state)
        self.assertEqual(rerun_data, reqs._rerun_data)

    def test_rerun_coalesce_none_and_none(self):
        """Coalesce two null-WidgetStates rerun requests."""
        reqs = ScriptRunnerRequests()

        # Request a rerun with null WidgetStates
        success = reqs.request_rerun(RerunData(widget_states=None))
        self.assertTrue(success)
        self.assertEqual(ScriptRunnerRequestState.RERUN_REQUESTED, reqs.state)

        # Request another
        reqs.request_rerun(RerunData(widget_states=None))
        self.assertTrue(success)
        self.assertEqual(ScriptRunnerRequestState.RERUN_REQUESTED, reqs.state)

        # The resulting RerunData should have null widget_states
        self.assertEqual(RerunData(widget_states=None), reqs._rerun_data)

    def test_rerun_coalesce_widgets_and_widgets(self):
        """Coalesce two non-null-WidgetStates rerun requests."""
        reqs = ScriptRunnerRequests()

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
        self.assertEqual(ScriptRunnerRequestState.RERUN_REQUESTED, reqs.state)

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
        reqs = ScriptRunnerRequests()

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
        reqs = ScriptRunnerRequests()

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

    def test_pop_rerun_request_with_no_request(self):
        """If there's no request, transition to the STOPPED state."""
        reqs = ScriptRunnerRequests()
        result = reqs.pop_rerun_request_or_stop()
        self.assertIsNone(result)
        self.assertEqual(ScriptRunnerRequestState.STOPPED, reqs.state)

    def test_pop_rerun_request(self):
        """If there is a request, return it and transition to the
        RUNNING state.
        """
        reqs = ScriptRunnerRequests()
        success = reqs.request_rerun(RerunData())
        self.assertTrue(success)

        result = reqs.pop_rerun_request_or_stop()
        self.assertEqual(result, RerunData())
        self.assertEqual(ScriptRunnerRequestState.RUNNING, reqs.state)
