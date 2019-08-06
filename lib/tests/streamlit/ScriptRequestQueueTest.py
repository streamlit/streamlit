# Copyright 2019 Streamlit Inc. All rights reserved.

"""Tests ScriptRequestQueueTest functionality"""

import time
import unittest
from threading import Thread, Lock

from streamlit.ScriptRequestQueue import RerunData
from streamlit.ScriptRequestQueue import ScriptRequestQueue
from streamlit.ScriptRunner import ScriptRequest
from streamlit.protobuf.BackMsg_pb2 import WidgetStates
from streamlit.widgets import Widgets


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

        thread = Thread(target=do_dequeue, name='test_dequeue')
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

        states = WidgetStates()
        _create_widget('trigger', states).trigger_value = True
        _create_widget('int', states).int_value = 123

        queue.enqueue(ScriptRequest.RERUN,
                      RerunData(argv=None, widget_state=states))

        states = WidgetStates()
        _create_widget('trigger', states).trigger_value = False
        _create_widget('int', states).int_value = 456

        queue.enqueue(ScriptRequest.RERUN,
                      RerunData(argv=None, widget_state=states))

        event, data = queue.dequeue()
        self.assertEqual(event, ScriptRequest.RERUN)

        widgets = Widgets()
        widgets.set_state(data.widget_state)

        # Coalesced triggers should be True if either the old or
        # new value was True
        self.assertEqual(True, widgets.get_widget_value('trigger'))

        # Other widgets should have their newest value
        self.assertEqual(456, widgets.get_widget_value('int'))

        # We should have no more events
        self.assertEqual((None, None), queue.dequeue(),
                         'Expected empty event queue')

        # Test that we can coalesce if previous widget state is None
        queue.enqueue(ScriptRequest.RERUN,
                      RerunData(argv=None, widget_state=None))
        queue.enqueue(ScriptRequest.RERUN,
                      RerunData(argv=None, widget_state=None))

        states = WidgetStates()
        _create_widget('int', states).int_value = 789

        queue.enqueue(ScriptRequest.RERUN,
                      RerunData(argv=None, widget_state=states))

        event, data = queue.dequeue()
        widgets = Widgets()
        widgets.set_state(data.widget_state)

        self.assertEqual(event, ScriptRequest.RERUN)
        self.assertEqual(789, widgets.get_widget_value('int'))

        # We should have no more events
        self.assertEqual((None, None), queue.dequeue(),
                         'Expected empty event queue')

        # Test that we can coalesce if our *new* widget state is None
        states = WidgetStates()
        _create_widget('int', states).int_value = 101112

        queue.enqueue(ScriptRequest.RERUN,
                      RerunData(argv=None, widget_state=states))

        queue.enqueue(ScriptRequest.RERUN,
                      RerunData(argv=None, widget_state=None))

        event, data = queue.dequeue()
        widgets = Widgets()
        widgets.set_state(data.widget_state)

        self.assertEqual(event, ScriptRequest.RERUN)
        self.assertEqual(101112, widgets.get_widget_value('int'))

        # We should have no more events
        self.assertEqual((None, None), queue.dequeue(),
                         'Expected empty event queue')



