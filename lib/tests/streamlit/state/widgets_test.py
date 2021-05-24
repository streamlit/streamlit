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

"""Tests widget-related functionality"""

import unittest
from unittest.mock import call, MagicMock

from streamlit.proto.Button_pb2 import Button as ButtonProto
from streamlit.proto.ClientState_pb2 import ClientState
from streamlit.proto.WidgetStates_pb2 import WidgetStates
from streamlit.state.widgets import (
    _get_widget_id,
    coalesce_widget_states,
    Widget,
    WidgetManager,
)


def _create_widget(id, states):
    states.widgets.add().id = id
    return states.widgets[-1]


class WidgetManagerTests(unittest.TestCase):
    def test_get_widget_value(self):
        states = WidgetStates()

        _create_widget("trigger", states).trigger_value = True
        _create_widget("bool", states).bool_value = True
        _create_widget("float", states).double_value = 0.5
        _create_widget("int", states).int_value = 123
        _create_widget("string", states).string_value = "howdy!"

        widget_mgr = WidgetManager()
        widget_mgr.set_widget_states(states)

        self.assertEqual(True, widget_mgr.get_widget_value("trigger"))
        self.assertEqual(True, widget_mgr.get_widget_value("bool"))
        self.assertAlmostEqual(0.5, widget_mgr.get_widget_value("float"))
        self.assertEqual(123, widget_mgr.get_widget_value("int"))
        self.assertEqual("howdy!", widget_mgr.get_widget_value("string"))

    def test_get_widget_value_nonexistent(self):
        widget_mgr = WidgetManager()
        self.assertIsNone(widget_mgr.get_widget_value("fake_widget_id"))

    def test_get_prev_widget_value(self):
        states = WidgetStates()

        _create_widget("trigger", states).trigger_value = True

        widget_mgr = WidgetManager()
        widget_mgr.set_widget_states(states)
        widget_mgr.mark_widgets_as_old()

        self.assertEqual(True, widget_mgr.get_prev_widget_value("trigger"))
        # Check that looking for our widget keys in current widget state does
        # not find anything.
        self.assertIsNone(widget_mgr.get_widget_value("trigger"))

    def test_get_keyed_widget_values(self):
        states = WidgetStates()
        _create_widget("trigger", states).trigger_value = True
        _create_widget("trigger2", states).trigger_value = True

        widget_mgr = WidgetManager()
        widget_mgr.set_widget_states(states)

        widget_mgr.set_widget_attrs("trigger", has_key=True)
        widget_mgr.set_widget_attrs("trigger2")

        self.assertEqual(widget_mgr.get_keyed_widget_values(), {"trigger": True})

    def test_get_prev_widget_value_nonexistent(self):
        widget_mgr = WidgetManager()
        self.assertIsNone(widget_mgr.get_widget_value("fake_widget_id"))

    def test_set_widget_attrs_with_callback(self):
        states = WidgetStates()
        _create_widget("bool", states).bool_value = True

        mock_callback = MagicMock()
        deserializer = lambda x: x

        widget_mgr = WidgetManager()
        widget_mgr.set_widget_states(states)
        widget_mgr.set_widget_attrs(
            "bool",
            has_key=True,
            callback=mock_callback,
            deserializer=deserializer,
            args=(1, 2),
            kwargs={"x": 3, "y": 4},
        )

        widget = widget_mgr._widgets["bool"]

        self.assertIs(widget.callback, mock_callback)
        self.assertIs(widget.deserializer, deserializer)
        self.assertEqual(widget.has_key, True)
        self.assertEqual(widget.callback_args, (1, 2))
        self.assertEqual(widget.callback_kwargs, {"x": 3, "y": 4})

    def test_set_widget_attrs_no_callback(self):
        states = WidgetStates()
        _create_widget("bool", states).bool_value = True

        deserializer = lambda x: x

        widget_mgr = WidgetManager()
        widget_mgr.set_widget_states(states)
        widget_mgr.set_widget_attrs(
            "bool",
            has_key=True,
            callback=None,
            deserializer=deserializer,
            args=(1, 2),
            kwargs={"x": 3, "y": 4},
        )

        widget = widget_mgr._widgets["bool"]

        self.assertIs(widget.deserializer, deserializer)
        self.assertEqual(widget.has_key, True)

        self.assertIsNone(widget.callback)
        # callback_args and callback_kwargs should be ignored without a
        # callback.
        self.assertIsNone(widget.callback_args)
        self.assertIsNone(widget.callback_kwargs)

    def test_set_widget_attrs_nonexistent(self):
        widget_mgr = WidgetManager()
        widget_mgr.set_widget_attrs("fake_widget_id", has_key=True)

        self.assertTrue(isinstance(widget_mgr._widgets["fake_widget_id"], Widget))

    def test_has_widget_changed(self):
        prev_states = WidgetStates()
        _create_widget("will_change", prev_states).trigger_value = True
        _create_widget("wont_change", prev_states).bool_value = True

        widget_mgr = WidgetManager()
        widget_mgr.set_widget_states(prev_states)

        for widget_id in ["will_change", "wont_change"]:
            widget_mgr.set_widget_attrs(widget_id, has_key=True)

        states = WidgetStates()
        _create_widget("will_change", states).trigger_value = False
        _create_widget("wont_change", states).bool_value = True

        widget_mgr.mark_widgets_as_old()
        widget_mgr.set_widget_states(states)

        self.assertTrue(widget_mgr._has_widget_changed("will_change"))
        self.assertFalse(widget_mgr._has_widget_changed("wont_change"))

    def test_call_callbacks(self):
        """Test the call_callbacks method in 6 possible cases:

        1. A widget does not have a callback
        2. A widget's old and new values are equal, so the callback is not
           called.
        3. A widget's callback has no args provided.
        4. A widget's callback has just args provided.
        5. A widget's callback has just kwargs provided.
        6. A widget's callback has both args and kwargs provided.
        """
        prev_states = WidgetStates()
        _create_widget("trigger", prev_states).trigger_value = True
        _create_widget("bool", prev_states).bool_value = True
        _create_widget("bool2", prev_states).bool_value = True
        _create_widget("float", prev_states).double_value = 0.5
        _create_widget("int", prev_states).int_value = 123
        _create_widget("string", prev_states).string_value = "howdy!"

        widget_mgr = WidgetManager()
        widget_mgr.set_widget_states(prev_states)

        mock_callback = MagicMock()
        deserializer = lambda x: x

        callback_cases = [
            ("trigger", None, None, None),
            ("bool", mock_callback, None, None),
            ("bool2", mock_callback, None, None),
            ("float", mock_callback, (1,), None),
            ("int", mock_callback, None, {"x": 2}),
            ("string", mock_callback, (1,), {"x": 2}),
        ]
        for widget_id, callback, args, kwargs in callback_cases:
            widget_mgr.set_widget_attrs(
                widget_id,
                has_key=True,
                callback=callback,
                deserializer=deserializer,
                args=args,
                kwargs=kwargs,
            )

        states = WidgetStates()
        _create_widget("trigger", states).trigger_value = True
        _create_widget("bool", states).bool_value = True
        _create_widget("bool2", states).bool_value = False
        _create_widget("float", states).double_value = 1.5
        _create_widget("int", states).int_value = 321
        _create_widget("string", states).string_value = "!ydwoh"

        widget_mgr.mark_widgets_as_old()
        widget_mgr.set_widget_states(states)

        widget_mgr.call_callbacks()

        mock_callback.assert_has_calls([call(), call(1), call(x=2), call(1, x=2)])

    def test_marshall_excludes_widgets_without_state(self):
        widget_states = WidgetStates()
        _create_widget("trigger", widget_states).trigger_value = True

        widget_mgr = WidgetManager()
        widget_mgr.set_widget_states(widget_states)
        widget_mgr.set_widget_attrs("other_widget", has_key=True)

        client_state = ClientState()
        widget_mgr.marshall(client_state)

        marshalled_widgets = client_state.widget_states.widgets
        self.assertEqual(len(marshalled_widgets), 1)
        self.assertEqual(marshalled_widgets[0].id, "trigger")

    def test_reset_triggers(self):
        states = WidgetStates()
        widget_mgr = WidgetManager()

        _create_widget("trigger", states).trigger_value = True
        _create_widget("int", states).int_value = 123
        widget_mgr.set_widget_states(states)

        self.assertEqual(True, widget_mgr.get_widget_value("trigger"))
        self.assertEqual(123, widget_mgr.get_widget_value("int"))

        widget_mgr.reset_triggers()

        self.assertEqual(False, widget_mgr.get_widget_value("trigger"))
        self.assertEqual(123, widget_mgr.get_widget_value("int"))

    def test_coalesce_widget_states(self):
        old_states = WidgetStates()

        _create_widget("old_set_trigger", old_states).trigger_value = True
        _create_widget("old_unset_trigger", old_states).trigger_value = False
        _create_widget("missing_in_new", old_states).int_value = 123
        _create_widget("shape_changing_trigger", old_states).trigger_value = True

        new_states = WidgetStates()

        _create_widget("old_set_trigger", new_states).trigger_value = False
        _create_widget("new_set_trigger", new_states).trigger_value = True
        _create_widget("added_in_new", new_states).int_value = 456
        _create_widget("shape_changing_trigger", new_states).int_value = 3

        widget_mgr = WidgetManager()
        widget_mgr.set_widget_states(coalesce_widget_states(old_states, new_states))

        self.assertIsNone(widget_mgr.get_widget_value("old_unset_trigger"))
        self.assertIsNone(widget_mgr.get_widget_value("missing_in_new"))

        self.assertEqual(True, widget_mgr.get_widget_value("old_set_trigger"))
        self.assertEqual(True, widget_mgr.get_widget_value("new_set_trigger"))
        self.assertEqual(456, widget_mgr.get_widget_value("added_in_new"))

        # Widgets that were triggers before, but no longer are, will *not*
        # be coalesced
        self.assertEqual(3, widget_mgr.get_widget_value("shape_changing_trigger"))


class WidgetHelperTests(unittest.TestCase):
    def test_get_widget_id_with_user_key(self):
        button_proto = ButtonProto()
        button_proto.label = "the label"
        self.assertEqual(
            _get_widget_id("button", button_proto, "don't change me"), "don't change me"
        )
