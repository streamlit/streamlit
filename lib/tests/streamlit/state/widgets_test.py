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
import pytest

from streamlit.proto.Button_pb2 import Button as ButtonProto
from streamlit.proto.WidgetStates_pb2 import WidgetStates
from streamlit.state.session_state import GENERATED_WIDGET_KEY_PREFIX
from streamlit.state.widgets import (
    _get_widget_id,
    coalesce_widget_states,
)
from streamlit.state.session_state import SessionState, WidgetMetadata


def _create_widget(id, states):
    states.widgets.add().id = id
    return states.widgets[-1]


def create_metadata(id, value_type, has_key=False):
    return WidgetMetadata(id, identity, identity, value_type, has_key)


def identity(x):
    return x


class WidgetManagerTests(unittest.TestCase):
    def test_get(self):
        states = WidgetStates()

        _create_widget("trigger", states).trigger_value = True
        _create_widget("bool", states).bool_value = True
        _create_widget("float", states).double_value = 0.5
        _create_widget("int", states).int_value = 123
        _create_widget("string", states).string_value = "howdy!"

        widget_mgr = SessionState()
        widget_mgr.set_from_proto(states)

        widget_mgr.set_metadata(create_metadata("trigger", "trigger_value"))
        widget_mgr.set_metadata(create_metadata("bool", "bool_value"))
        widget_mgr.set_metadata(create_metadata("float", "double_value"))
        widget_mgr.set_metadata(create_metadata("int", "int_value"))
        widget_mgr.set_metadata(create_metadata("string", "string_value"))

        self.assertEqual(True, widget_mgr.get("trigger"))
        self.assertEqual(True, widget_mgr.get("bool"))
        self.assertAlmostEqual(0.5, widget_mgr.get("float"))
        self.assertEqual(123, widget_mgr.get("int"))
        self.assertEqual("howdy!", widget_mgr.get("string"))

    def test_get_nonexistent(self):
        widget_mgr = SessionState()
        self.assertIsNone(widget_mgr.get("fake_widget_id"))

    @pytest.mark.skip
    def test_get_keyed_widget_values(self):
        states = WidgetStates()
        _create_widget("trigger", states).trigger_value = True
        _create_widget("trigger2", states).trigger_value = True

        widget_mgr = SessionState()
        widget_mgr.set_from_proto(states)

        widget_mgr.set_metadata(create_metadata("trigger", "trigger_value", True))
        widget_mgr.set_metadata(create_metadata("trigger2", "trigger_value"))

        self.assertEqual(dict(widget_mgr.values()), {"trigger": True})

    def test_get_prev_widget_value_nonexistent(self):
        widget_mgr = SessionState()
        self.assertIsNone(widget_mgr.get("fake_widget_id"))

    def test_set_widget_attrs_nonexistent(self):
        widget_mgr = SessionState()
        widget_mgr.set_metadata(create_metadata("fake_widget_id", ""))

        self.assertTrue(
            isinstance(
                widget_mgr._new_widget_state.widget_metadata["fake_widget_id"],
                WidgetMetadata,
            )
        )

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

        widget_mgr = SessionState()
        widget_mgr.set_from_proto(prev_states)

        mock_callback = MagicMock()
        deserializer = lambda x: x

        callback_cases = [
            ("trigger", "trigger_value", None, None, None),
            ("bool", "bool_value", mock_callback, None, None),
            ("bool2", "bool_value", mock_callback, None, None),
            ("float", "double_value", mock_callback, (1,), None),
            ("int", "int_value", mock_callback, None, {"x": 2}),
            ("string", "string_value", mock_callback, (1,), {"x": 2}),
        ]
        for widget_id, value_type, callback, args, kwargs in callback_cases:
            widget_mgr.set_metadata(
                WidgetMetadata(
                    widget_id,
                    deserializer,
                    lambda x: x,
                    value_type=value_type,
                    callback=callback,
                    callback_args=args,
                    callback_kwargs=kwargs,
                )
            )

        states = WidgetStates()
        _create_widget("trigger", states).trigger_value = True
        _create_widget("bool", states).bool_value = True
        _create_widget("bool2", states).bool_value = False
        _create_widget("float", states).double_value = 1.5
        _create_widget("int", states).int_value = 321
        _create_widget("string", states).string_value = "!ydwoh"

        widget_mgr.compact_state()
        widget_mgr.set_from_proto(states)

        widget_mgr.call_callbacks()

        mock_callback.assert_has_calls([call(), call(1), call(x=2), call(1, x=2)])

    def test_marshall_excludes_widgets_without_state(self):
        widget_states = WidgetStates()
        _create_widget("trigger", widget_states).trigger_value = True

        widget_mgr = SessionState()
        widget_mgr.set_from_proto(widget_states)
        widget_mgr.set_metadata(
            WidgetMetadata("other_widget", lambda x: x, None, "trigger_value", True)
        )

        widgets = widget_mgr.as_widget_states()

        self.assertEqual(len(widgets), 1)
        self.assertEqual(widgets[0].id, "trigger")

    def test_reset_triggers(self):
        states = WidgetStates()
        widget_mgr = SessionState()

        _create_widget("trigger", states).trigger_value = True
        _create_widget("int", states).int_value = 123
        widget_mgr.set_from_proto(states)
        widget_mgr.set_metadata(
            WidgetMetadata("trigger", lambda x: x, None, "trigger_value")
        )
        widget_mgr.set_metadata(WidgetMetadata("int", lambda x: x, None, "int_value"))

        self.assertTrue(widget_mgr.get("trigger"))
        self.assertEqual(123, widget_mgr.get("int"))

        widget_mgr.reset_triggers()

        self.assertFalse(widget_mgr.get("trigger"))
        self.assertEqual(123, widget_mgr.get("int"))

    def test_coalesce_widget_states(self):
        widget_mgr = SessionState()

        old_states = WidgetStates()

        _create_widget("old_set_trigger", old_states).trigger_value = True
        _create_widget("old_unset_trigger", old_states).trigger_value = False
        _create_widget("missing_in_new", old_states).int_value = 123
        _create_widget("shape_changing_trigger", old_states).trigger_value = True

        widget_mgr.set_metadata(create_metadata("old_set_trigger", "trigger_value"))
        widget_mgr.set_metadata(create_metadata("old_unset_trigger", "trigger_value"))
        widget_mgr.set_metadata(create_metadata("missing_in_new", "int_value"))
        widget_mgr.set_metadata(
            create_metadata("shape changing trigger", "trigger_value")
        )

        new_states = WidgetStates()

        _create_widget("old_set_trigger", new_states).trigger_value = False
        _create_widget("new_set_trigger", new_states).trigger_value = True
        _create_widget("added_in_new", new_states).int_value = 456
        _create_widget("shape_changing_trigger", new_states).int_value = 3
        widget_mgr.set_metadata(create_metadata("new_set_trigger", "trigger_value"))
        widget_mgr.set_metadata(create_metadata("added_in_new", "int_value"))
        widget_mgr.set_metadata(create_metadata("shape_changing_trigger", "int_value"))

        widget_mgr.set_from_proto(coalesce_widget_states(old_states, new_states))

        self.assertIsNone(widget_mgr.get("old_unset_trigger"))
        self.assertIsNone(widget_mgr.get("missing_in_new"))

        self.assertEqual(True, widget_mgr.get("old_set_trigger"))
        self.assertEqual(True, widget_mgr.get("new_set_trigger"))
        self.assertEqual(456, widget_mgr.get("added_in_new"))

        # Widgets that were triggers before, but no longer are, will *not*
        # be coalesced
        self.assertEqual(3, widget_mgr.get("shape_changing_trigger"))


class WidgetHelperTests(unittest.TestCase):
    def test_get_widget_with_generated_key(self):
        button_proto = ButtonProto()
        button_proto.label = "the label"
        self.assertTrue(
            _get_widget_id("button", button_proto).startswith(
                GENERATED_WIDGET_KEY_PREFIX
            )
        )

    def test_get_widget_id_with_user_key(self):
        button_proto = ButtonProto()
        button_proto.label = "the label"
        self.assertEqual(
            _get_widget_id("button", button_proto, "don't change me"), "don't change me"
        )
