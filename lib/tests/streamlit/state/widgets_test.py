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

from streamlit.proto.Button_pb2 import Button as ButtonProto
from streamlit.proto.WidgetStates_pb2 import WidgetStates
from streamlit.state.widgets import (
    _get_widget_id,
    coalesce_widget_states,
    WidgetManager,
)


def _create_widget(id, states):
    states.widgets.add().id = id
    return states.widgets[-1]


class WidgetTest(unittest.TestCase):
    def test_values(self):
        states = WidgetStates()

        _create_widget("trigger", states).trigger_value = True
        _create_widget("bool", states).bool_value = True
        _create_widget("float", states).double_value = 0.5
        _create_widget("int", states).int_value = 123
        _create_widget("string", states).string_value = "howdy!"

        widget_mgr = WidgetManager()
        widget_mgr.set_state(states)

        self.assertEqual(True, widget_mgr.get_widget_value("trigger"))
        self.assertEqual(True, widget_mgr.get_widget_value("bool"))
        self.assertAlmostEqual(0.5, widget_mgr.get_widget_value("float"))
        self.assertEqual(123, widget_mgr.get_widget_value("int"))
        self.assertEqual("howdy!", widget_mgr.get_widget_value("string"))

    def test_reset_triggers(self):
        states = WidgetStates()
        widget_mgr = WidgetManager()

        _create_widget("trigger", states).trigger_value = True
        _create_widget("int", states).int_value = 123
        widget_mgr.set_state(states)

        self.assertEqual(True, widget_mgr.get_widget_value("trigger"))
        self.assertEqual(123, widget_mgr.get_widget_value("int"))

        widget_mgr.reset_triggers()

        self.assertEqual(None, widget_mgr.get_widget_value("trigger"))
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
        widget_mgr.set_state(coalesce_widget_states(old_states, new_states))

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
