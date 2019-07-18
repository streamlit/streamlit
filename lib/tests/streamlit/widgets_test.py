# Copyright 2019 Streamlit Inc. All rights reserved.

"""Tests widget-related functionality"""

import unittest

from streamlit.protobuf.BackMsg_pb2 import WidgetStates
from streamlit.widgets import Widgets
from streamlit.widgets import coalesce_widget_states
from streamlit.widgets import reset_widget_triggers


def _create_widget(id, states):
    states.widgets.add().id = id
    return states.widgets[-1]


class WidgetTest(unittest.TestCase):
    def test_values(self):
        states = WidgetStates()

        _create_widget('trigger', states).trigger_value = True
        _create_widget('bool', states).bool_value = True
        _create_widget('float', states).float_value = 0.5
        _create_widget('int', states).int_value = 123
        _create_widget('string', states).string_value = 'howdy!'

        widgets = Widgets()
        widgets.set_state(states)

        self.assertEqual(True, widgets.get_widget_value('trigger'))
        self.assertEqual(True, widgets.get_widget_value('bool'))
        self.assertAlmostEqual(0.5, widgets.get_widget_value('float'))
        self.assertEqual(123, widgets.get_widget_value('int'))
        self.assertEqual('howdy!', widgets.get_widget_value('string'))

    def test_reset_triggers(self):
        states = WidgetStates()
        widgets = Widgets()

        _create_widget('trigger', states).trigger_value = True
        _create_widget('int', states).int_value = 123
        widgets.set_state(states)

        self.assertEqual(True, widgets.get_widget_value('trigger'))
        self.assertEqual(123, widgets.get_widget_value('int'))

        widgets.set_state(reset_widget_triggers(states))

        self.assertEqual(False, widgets.get_widget_value('trigger'))
        self.assertEqual(123, widgets.get_widget_value('int'))

    def test_coalesce_widget_states(self):
        old_states = WidgetStates()

        _create_widget('old_set_trigger', old_states).trigger_value = True
        _create_widget('old_unset_trigger', old_states).trigger_value = False
        _create_widget('missing_in_new', old_states).int_value = 123
        _create_widget('shape_changing_trigger', old_states).trigger_value = True

        new_states = WidgetStates()

        _create_widget('old_set_trigger', new_states).trigger_value = False
        _create_widget('new_set_trigger', new_states).trigger_value = True
        _create_widget('added_in_new', new_states).int_value = 456
        _create_widget('shape_changing_trigger', new_states).int_value = 3

        widgets = Widgets()
        widgets.set_state(coalesce_widget_states(old_states, new_states))

        self.assertIsNone(widgets.get_widget_value('old_unset_trigger'))
        self.assertIsNone(widgets.get_widget_value('missing_in_new'))

        self.assertEqual(True, widgets.get_widget_value('old_set_trigger'))
        self.assertEqual(True, widgets.get_widget_value('new_set_trigger'))
        self.assertEqual(456, widgets.get_widget_value('added_in_new'))

        # Widgets that were triggers before, but no longer are, will *not*
        # be coalesced
        self.assertEqual(3, widgets.get_widget_value('shape_changing_trigger'))
