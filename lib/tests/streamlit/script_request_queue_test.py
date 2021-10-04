# Copyright 2018-2021 Streamlit Inc.
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

"""Tests ScriptRequestQueueTest functionality"""

import time
import unittest
from threading import Thread, Lock

from streamlit.script_request_queue import RerunData
from streamlit.script_request_queue import ScriptRequestQueue
from streamlit.script_runner import ScriptRequest
from streamlit.state.session_state import SessionState, WidgetMetadata
from streamlit.proto.WidgetStates_pb2 import WidgetStates


def _create_widget(id, states):
    states.widgets.add().id = id
    return states.widgets[-1]


class ScriptRequestQueueTest(unittest.TestCase):
    def test_dequeue(self):
        """Test that we can enqueue and dequeue on different threads"""

        queue = ScriptRequestQueue()

        # This should return immediately
        self.assertEqual((None, None), queue.dequeue())

        lock = Lock()
        dequeued_evt = [None]

        def get_event():
            with lock:
                return dequeued_evt[0]

        def set_event(value):
            with lock:
                dequeued_evt[0] = value

        def do_dequeue():
            event = None
            while event is None:
                event, _ = queue.dequeue()
            set_event(event)

        thread = Thread(target=do_dequeue, name="test_dequeue")
        thread.start()

        self.assertIsNone(get_event())

        queue.enqueue(ScriptRequest.STOP)
        time.sleep(0.1)

        self.assertEqual(ScriptRequest.STOP, get_event())

        thread.join(timeout=0.25)
        self.assertFalse(thread.is_alive())

    def test_rerun_data_coalescing(self):
        """Test that multiple RERUN requests get coalesced with
        expected values.

        (This is similar to widgets_test.test_coalesce_widget_states -
        it's testing the same thing, but through the ScriptEventQueue
        interface.)
        """
        queue = ScriptRequestQueue()
        session_state = SessionState()

        states = WidgetStates()
        _create_widget("trigger", states).trigger_value = True
        _create_widget("int", states).int_value = 123

        queue.enqueue(ScriptRequest.RERUN, RerunData(widget_states=states))

        states = WidgetStates()
        _create_widget("trigger", states).trigger_value = False
        _create_widget("int", states).int_value = 456

        session_state.set_metadata(
            WidgetMetadata("trigger", lambda x, s: x, None, "trigger_value")
        )
        session_state.set_metadata(
            WidgetMetadata("int", lambda x, s: x, lambda x: x, "int_value")
        )

        queue.enqueue(ScriptRequest.RERUN, RerunData(widget_states=states))

        event, data = queue.dequeue()
        self.assertEqual(event, ScriptRequest.RERUN)

        session_state.set_widgets_from_proto(data.widget_states)

        # Coalesced triggers should be True if either the old or
        # new value was True
        self.assertEqual(True, session_state.get("trigger"))

        # Other widgets should have their newest value
        self.assertEqual(456, session_state.get("int"))

        # We should have no more events
        self.assertEqual((None, None), queue.dequeue(), "Expected empty event queue")

        # Test that we can coalesce if previous widget state is None
        queue.enqueue(ScriptRequest.RERUN, RerunData(widget_states=None))
        queue.enqueue(ScriptRequest.RERUN, RerunData(widget_states=None))

        states = WidgetStates()
        _create_widget("int", states).int_value = 789

        queue.enqueue(ScriptRequest.RERUN, RerunData(widget_states=states))

        event, data = queue.dequeue()
        session_state.set_widgets_from_proto(data.widget_states)

        self.assertEqual(event, ScriptRequest.RERUN)
        self.assertEqual(789, session_state.get("int"))

        # We should have no more events
        self.assertEqual((None, None), queue.dequeue(), "Expected empty event queue")

        # Test that we can coalesce if our *new* widget state is None
        states = WidgetStates()
        _create_widget("int", states).int_value = 101112

        queue.enqueue(ScriptRequest.RERUN, RerunData(widget_states=states))

        queue.enqueue(ScriptRequest.RERUN, RerunData(widget_states=None))

        event, data = queue.dequeue()
        session_state.set_widgets_from_proto(data.widget_states)

        self.assertEqual(event, ScriptRequest.RERUN)
        self.assertEqual(101112, session_state.get("int"))

        # We should have no more events
        self.assertEqual((None, None), queue.dequeue(), "Expected empty event queue")
