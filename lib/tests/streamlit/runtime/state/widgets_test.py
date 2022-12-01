# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

"""Tests widget-related functionality"""

import unittest
from unittest.mock import MagicMock, call, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit import errors
from streamlit.proto.Button_pb2 import Button as ButtonProto
from streamlit.proto.WidgetStates_pb2 import WidgetStates
from streamlit.runtime.scriptrunner.script_run_context import get_script_run_ctx
from streamlit.runtime.state import coalesce_widget_states
from streamlit.runtime.state.session_state import (
    GENERATED_WIDGET_KEY_PREFIX,
    SessionState,
    WidgetMetadata,
)
from streamlit.runtime.state.widgets import _get_widget_id, user_key_from_widget_id
from tests.delta_generator_test_case import DeltaGeneratorTestCase


def _create_widget(id, states):
    states.widgets.add().id = id
    return states.widgets[-1]


def create_metadata(id, value_type):
    return WidgetMetadata(id, lambda x, s: x, identity, value_type)


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

        session_state = SessionState()
        session_state.set_widgets_from_proto(states)

        session_state._set_widget_metadata(create_metadata("trigger", "trigger_value"))
        session_state._set_widget_metadata(create_metadata("bool", "bool_value"))
        session_state._set_widget_metadata(create_metadata("float", "double_value"))
        session_state._set_widget_metadata(create_metadata("int", "int_value"))
        session_state._set_widget_metadata(create_metadata("string", "string_value"))

        self.assertEqual(True, session_state["trigger"])
        self.assertEqual(True, session_state["bool"])
        self.assertAlmostEqual(0.5, session_state["float"])
        self.assertEqual(123, session_state["int"])
        self.assertEqual("howdy!", session_state["string"])

    def test_get_nonexistent(self):
        session_state = SessionState()
        self.assertRaises(KeyError, lambda: session_state["fake_widget_id"])

    def test_get_prev_widget_value_nonexistent(self):
        session_state = SessionState()
        self.assertRaises(KeyError, lambda: session_state["fake_widget_id"])

    def test_set_widget_attrs_nonexistent(self):
        session_state = SessionState()
        session_state._set_widget_metadata(create_metadata("fake_widget_id", ""))

        self.assertIsInstance(
            session_state._new_widget_state.widget_metadata["fake_widget_id"],
            WidgetMetadata,
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

        session_state = SessionState()
        session_state.set_widgets_from_proto(prev_states)

        mock_callback = MagicMock()
        deserializer = lambda x, s: x

        callback_cases = [
            ("trigger", "trigger_value", None, None, None),
            ("bool", "bool_value", mock_callback, None, None),
            ("bool2", "bool_value", mock_callback, None, None),
            ("float", "double_value", mock_callback, (1,), None),
            ("int", "int_value", mock_callback, None, {"x": 2}),
            ("string", "string_value", mock_callback, (1,), {"x": 2}),
        ]
        for widget_id, value_type, callback, args, kwargs in callback_cases:
            session_state._set_widget_metadata(
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

        session_state.on_script_will_rerun(states)

        mock_callback.assert_has_calls([call(), call(1), call(x=2), call(1, x=2)])

    def test_marshall_excludes_widgets_without_state(self):
        widget_states = WidgetStates()
        _create_widget("trigger", widget_states).trigger_value = True

        session_state = SessionState()
        session_state.set_widgets_from_proto(widget_states)
        session_state._set_widget_metadata(
            WidgetMetadata("other_widget", lambda x, s: x, None, "trigger_value", True)
        )

        widgets = session_state.get_widget_states()

        self.assertEqual(len(widgets), 1)
        self.assertEqual(widgets[0].id, "trigger")

    def test_reset_triggers(self):
        states = WidgetStates()
        session_state = SessionState()

        _create_widget("trigger", states).trigger_value = True
        _create_widget("int", states).int_value = 123
        session_state.set_widgets_from_proto(states)
        session_state._set_widget_metadata(
            WidgetMetadata("trigger", lambda x, s: x, None, "trigger_value")
        )
        session_state._set_widget_metadata(
            WidgetMetadata("int", lambda x, s: x, None, "int_value")
        )

        self.assertTrue(session_state["trigger"])
        self.assertEqual(123, session_state["int"])

        session_state._reset_triggers()

        self.assertFalse(session_state["trigger"])
        self.assertEqual(123, session_state["int"])

    def test_coalesce_widget_states(self):
        session_state = SessionState()

        old_states = WidgetStates()

        _create_widget("old_set_trigger", old_states).trigger_value = True
        _create_widget("old_unset_trigger", old_states).trigger_value = False
        _create_widget("missing_in_new", old_states).int_value = 123
        _create_widget("shape_changing_trigger", old_states).trigger_value = True

        session_state._set_widget_metadata(
            create_metadata("old_set_trigger", "trigger_value")
        )
        session_state._set_widget_metadata(
            create_metadata("old_unset_trigger", "trigger_value")
        )
        session_state._set_widget_metadata(
            create_metadata("missing_in_new", "int_value")
        )
        session_state._set_widget_metadata(
            create_metadata("shape changing trigger", "trigger_value")
        )

        new_states = WidgetStates()

        _create_widget("old_set_trigger", new_states).trigger_value = False
        _create_widget("new_set_trigger", new_states).trigger_value = True
        _create_widget("added_in_new", new_states).int_value = 456
        _create_widget("shape_changing_trigger", new_states).int_value = 3
        session_state._set_widget_metadata(
            create_metadata("new_set_trigger", "trigger_value")
        )
        session_state._set_widget_metadata(create_metadata("added_in_new", "int_value"))
        session_state._set_widget_metadata(
            create_metadata("shape_changing_trigger", "int_value")
        )

        session_state.set_widgets_from_proto(
            coalesce_widget_states(old_states, new_states)
        )

        self.assertRaises(KeyError, lambda: session_state["old_unset_trigger"])
        self.assertRaises(KeyError, lambda: session_state["missing_in_new"])

        self.assertEqual(True, session_state["old_set_trigger"])
        self.assertEqual(True, session_state["new_set_trigger"])
        self.assertEqual(456, session_state["added_in_new"])

        # Widgets that were triggers before, but no longer are, will *not*
        # be coalesced
        self.assertEqual(3, session_state["shape_changing_trigger"])


class WidgetHelperTests(unittest.TestCase):
    def test_get_widget_with_generated_key(self):
        button_proto = ButtonProto()
        button_proto.label = "the label"
        self.assertTrue(
            _get_widget_id("button", button_proto).startswith(
                GENERATED_WIDGET_KEY_PREFIX
            )
        )


class WidgetIdDisabledTests(DeltaGeneratorTestCase):
    @parameterized.expand(
        [
            (st.button,),
            (st.camera_input,),
            (st.checkbox,),
            (st.color_picker,),
            (st.file_uploader,),
            (st.number_input,),
            (st.slider,),
            (st.text_area,),
            (st.text_input,),
            (st.date_input,),
            (st.time_input,),
        ]
    )
    def test_disabled_parameter_id(self, widget_func):
        widget_func("my_widget")

        # The `disabled` argument shouldn't affect a widget's ID, so we
        # expect a DuplicateWidgetID error.
        with self.assertRaises(errors.DuplicateWidgetID):
            widget_func("my_widget", disabled=True)

    def test_disabled_parameter_id_download_button(self):
        st.download_button("my_widget", data="")

        with self.assertRaises(errors.DuplicateWidgetID):
            st.download_button("my_widget", data="", disabled=True)

    @parameterized.expand(
        [
            (st.multiselect,),
            (st.radio,),
            (st.select_slider,),
            (st.selectbox,),
        ]
    )
    def test_disabled_parameter_id_options_widgets(self, widget_func):
        options = ["a", "b", "c"]
        widget_func("my_widget", options)

        with self.assertRaises(errors.DuplicateWidgetID):
            widget_func("my_widget", options, disabled=True)


@patch("streamlit.runtime.Runtime.exists", new=MagicMock(return_value=True))
class WidgetUserKeyTests(DeltaGeneratorTestCase):
    def test_get_widget_user_key(self):
        state = get_script_run_ctx().session_state._state
        st.checkbox("checkbox", key="c")

        k = list(state._keys())[0]
        assert user_key_from_widget_id(k) == "c"

    def test_get_widget_user_key_none(self):
        state = get_script_run_ctx().session_state._state
        st.selectbox("selectbox", options=["foo", "bar"])

        k = list(state._keys())[0]
        # Absence of a user key is represented as None throughout our code
        assert user_key_from_widget_id(k) is None

    def test_get_widget_user_key_hyphens(self):
        state = get_script_run_ctx().session_state._state
        st.slider("slider", key="my-slider")

        k = list(state._keys())[0]
        assert user_key_from_widget_id(k) == "my-slider"

    def test_get_widget_user_key_incorrect_none(self):
        state = get_script_run_ctx().session_state._state
        st.checkbox("checkbox", key="None")

        k = list(state._keys())[0]
        # Incorrectly inidcates no user key
        assert user_key_from_widget_id(k) == None
