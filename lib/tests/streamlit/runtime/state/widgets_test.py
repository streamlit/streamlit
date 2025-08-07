# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import inspect
import unittest
from typing import get_args
from unittest.mock import ANY, MagicMock, call, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit import errors
from streamlit.elements.lib.utils import (
    _compute_element_id,
    compute_and_register_element_id,
)
from streamlit.proto.Common_pb2 import ChatInputValue as ChatInputValueProto
from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates
from streamlit.runtime.scriptrunner_utils.script_requests import _coalesce_widget_states
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state.common import (
    GENERATED_ELEMENT_ID_PREFIX,
    ValueFieldName,
)
from streamlit.runtime.state.session_state import SessionState, WidgetMetadata
from streamlit.runtime.state.widgets import (
    register_widget_from_metadata,
    user_key_from_element_id,
)
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.element_mocks import ELEMENT_PRODUCER, WIDGET_ELEMENTS


def _create_widget(id, states):
    states.widgets.add().id = id
    return states.widgets[-1]


def create_metadata(id, value_type):
    return WidgetMetadata(id, lambda x: x, identity, value_type)


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

        assert session_state["trigger"]
        assert session_state["bool"]
        assert session_state["float"] == pytest.approx(0.5)
        assert session_state["int"] == 123
        assert session_state["string"] == "howdy!"

    def test_get_nonexistent(self):
        session_state = SessionState()
        with pytest.raises(KeyError):
            session_state["fake_widget_id"]

    def test_get_prev_widget_value_nonexistent(self):
        session_state = SessionState()
        with pytest.raises(KeyError):
            session_state["fake_widget_id"]

    def test_set_widget_attrs_nonexistent(self):
        session_state = SessionState()
        session_state._set_widget_metadata(create_metadata("fake_widget_id", ""))

        assert isinstance(
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

        def deserializer(x):
            return x

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
            WidgetMetadata("other_widget", lambda x: x, None, "trigger_value", True)
        )

        widgets = session_state.get_widget_states()

        assert len(widgets) == 1
        assert widgets[0].id == "trigger"

    def test_reset_triggers(self):
        states = WidgetStates()
        session_state = SessionState()

        _create_widget("trigger", states).trigger_value = True
        _create_widget("int", states).int_value = 123
        session_state.set_widgets_from_proto(states)
        session_state._set_widget_metadata(
            WidgetMetadata("trigger", lambda x: x, None, "trigger_value")
        )
        session_state._set_widget_metadata(
            WidgetMetadata("int", lambda x: x, None, "int_value")
        )

        assert session_state["trigger"]
        assert session_state["int"] == 123

        session_state._reset_triggers()

        assert not session_state["trigger"]
        assert session_state["int"] == 123

    def test_reset_chat_input_triggers(self):
        states = WidgetStates()
        session_state = SessionState()

        _create_widget("chat_input", states).chat_input_value.CopyFrom(
            ChatInputValueProto(
                data="Some Value",
            )
        )
        _create_widget("int", states).int_value = 123
        session_state.set_widgets_from_proto(states)
        session_state._set_widget_metadata(
            WidgetMetadata("chat_input", lambda x: x, None, "chat_input_value")
        )
        session_state._set_widget_metadata(
            WidgetMetadata("int", lambda x: x, None, "int_value")
        )

        assert session_state["chat_input"].data == "Some Value"
        assert session_state["int"] == 123

        session_state._reset_triggers()

        assert session_state["chat_input"] is None
        assert session_state["int"] == 123

    def test_coalesce_widget_states(self):
        session_state = SessionState()

        old_states = WidgetStates()

        _create_widget("old_set_trigger", old_states).trigger_value = True
        _create_widget("old_unset_trigger", old_states).trigger_value = False
        _create_widget("old_set_chat_input", old_states).chat_input_value.CopyFrom(
            ChatInputValueProto(data="Some String")
        )
        _create_widget(
            "old_set_empty_chat_input", old_states
        ).chat_input_value.CopyFrom(ChatInputValueProto(data=""))
        _create_widget("old_unset_chat_input", old_states).chat_input_value.CopyFrom(
            ChatInputValueProto(data=None)
        )
        _create_widget("missing_in_new", old_states).int_value = 123
        _create_widget("shape_changing_trigger", old_states).trigger_value = True
        _create_widget("overwritten_chat_input", old_states).chat_input_value.CopyFrom(
            ChatInputValueProto(data="old string")
        )

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
        _create_widget(
            "old_set_empty_chat_input", new_states
        ).chat_input_value.CopyFrom(ChatInputValueProto(data=None))
        _create_widget("new_set_chat_input", new_states).chat_input_value.CopyFrom(
            ChatInputValueProto(data="Some other string")
        )
        _create_widget("added_in_new", new_states).int_value = 456
        _create_widget("shape_changing_trigger", new_states).int_value = 3
        _create_widget("overwritten_chat_input", new_states).chat_input_value.CopyFrom(
            ChatInputValueProto(data="Overwritten string")
        )

        session_state._set_widget_metadata(
            create_metadata("new_set_trigger", "trigger_value")
        )
        session_state._set_widget_metadata(create_metadata("added_in_new", "int_value"))
        session_state._set_widget_metadata(
            create_metadata("shape_changing_trigger", "int_value")
        )

        session_state.set_widgets_from_proto(
            _coalesce_widget_states(old_states, new_states)
        )

        with pytest.raises(KeyError):
            session_state["old_unset_trigger"]
        with pytest.raises(KeyError):
            session_state["missing_in_new"]
        with pytest.raises(KeyError):
            session_state["old_unset_string_trigger"]

        assert session_state["old_set_trigger"]
        assert session_state["new_set_trigger"]
        assert session_state["added_in_new"] == 456

        # Widgets that were triggers before, but no longer are, will *not*
        # be coalesced
        assert session_state["shape_changing_trigger"] == 3

    def coalesce_widget_states_returns_None_if_both_inputs_None(self):
        assert _coalesce_widget_states(None, None) is None

    def coalesce_widget_states_returns_old_states_if_new_states_None(self):
        old_states = WidgetStates()
        assert _coalesce_widget_states(old_states, None) is old_states

    def coalesce_widget_states_returns_new_states_if_old_states_None(self):
        new_states = WidgetStates()
        assert _coalesce_widget_states(None, new_states) is new_states


class WidgetHelperTests(unittest.TestCase):
    def test_get_widget_with_generated_key(self):
        element_id = compute_and_register_element_id(
            "button", label="the label", user_key="my_key", dg=None
        )
        assert element_id.startswith(GENERATED_ELEMENT_ID_PREFIX)


# These kwargs are not supposed to be used for element ID calculation:
EXCLUDED_KWARGS_FOR_ELEMENT_ID_COMPUTATION = {
    # Internal stuff
    "ctx",
    # Formatting/display stuff: can be changed without resetting an element.
    "disabled",
    "format_func",
    "label_visibility",
    # on_change callbacks and similar/related parameters.
    "args",
    "kwargs",
    "on_change",
    "on_click",
    "on_submit",
    # Key should be provided via `user_key` instead.
    "key",
}


class ComputeElementIdTests(DeltaGeneratorTestCase):
    """Enforce that new arguments added to the signature of a widget function are taken
    into account when computing element IDs unless explicitly excluded.
    """

    def signature_to_expected_kwargs(self, sig):
        kwargs = {
            kwarg: ANY
            for kwarg in sig.parameters
            if kwarg not in EXCLUDED_KWARGS_FOR_ELEMENT_ID_COMPUTATION
        }

        # Add some kwargs that are passed to compute element ID
        # but don't appear in widget signatures.
        for kwarg in ["user_key", "dg"]:
            kwargs[kwarg] = ANY

        return kwargs

    @parameterized.expand(WIDGET_ELEMENTS)
    def test_no_usage_of_excluded_kwargs(
        self, _element_name: str, widget_func: ELEMENT_PRODUCER
    ):
        with patch(
            "streamlit.elements.lib.utils._compute_element_id",
            wraps=_compute_element_id,
        ) as patched_compute_element_id:
            widget_func()

        # Get call kwargs from patched_compute_element_id
        call_kwargs = patched_compute_element_id.call_args[1]

        kwargs_intersection = set(call_kwargs.keys()) & set(
            EXCLUDED_KWARGS_FOR_ELEMENT_ID_COMPUTATION
        )
        assert not kwargs_intersection, (
            "These kwargs are not supposed to be used for element ID calculation: "
            + str(kwargs_intersection)
        )

    @parameterized.expand(WIDGET_ELEMENTS)
    def test_includes_essential_kwargs(self, element_name: str, widget_func):
        """Test that active_script_hash and form ID are always included in
        element ID calculation."""

        with patch(
            "streamlit.elements.lib.utils._compute_element_id",
            wraps=_compute_element_id,
        ) as patched_compute_element_id:
            widget_func()
        # Get call kwargs from patched_compute_element_id
        call_kwargs = patched_compute_element_id.call_args[1]
        assert "active_script_hash" in call_kwargs, (
            "active_script_hash is expected to always be included "
        )
        "in element ID calculation."

        # Some elements cannot be used in a form
        if element_name not in ["button", "chat_input", "download_button"]:
            # For all other check that form_id is set:
            assert call_kwargs.get("form_id") == "", (
                "form_id is expected to be included in element ID calculation."
            )

    @parameterized.expand(WIDGET_ELEMENTS)
    def test_triggers_duplicate_id_error(self, _element_name: str, widget_func):
        """
        Test that duplicate ID error is raised if the same widget is called twice.
        """
        widget_func()
        with pytest.raises(errors.DuplicateWidgetID):
            widget_func()

    @parameterized.expand(WIDGET_ELEMENTS)
    def test_not_triggers_duplicate_id_error(self, _element_name: str, widget_func):
        """
        Test that duplicate ID error is not raised if the same widget is
        both in the main and sidebar area.
        """
        with st.container():
            widget_func()
        with st.sidebar:
            widget_func()

    @parameterized.expand(
        [
            (st.camera_input, "camera_input"),
            (st.checkbox, "checkbox"),
            (st.color_picker, "color_picker"),
            (st.date_input, "time_widgets"),
            (st.file_uploader, "file_uploader"),
            (st.number_input, "number_input"),
            (st.slider, "slider"),
            (st.text_area, "text_widgets"),
            (st.text_input, "text_widgets"),
            (st.time_input, "time_widgets"),
        ]
    )
    def test_widget_id_computation(self, widget_func, module_name):
        with patch(
            f"streamlit.elements.widgets.{module_name}.compute_and_register_element_id",
            wraps=compute_and_register_element_id,
        ) as patched_compute_and_register_element_id:
            widget_func("my_widget")

        sig = inspect.signature(widget_func)
        expected_sig = self.signature_to_expected_kwargs(sig)

        patched_compute_and_register_element_id.assert_called_with(ANY, **expected_sig)

        # Double check that we get a DuplicateWidgetID error since the `disabled`
        # argument shouldn't affect a widget's ID.
        with pytest.raises(errors.DuplicateWidgetID):
            widget_func("my_widget", disabled=True)

    @parameterized.expand(
        [
            (st.button, "button"),
            (st.chat_input, "chat"),
            (st.download_button, "button"),
        ]
    )
    def test_widget_id_computation_no_form_widgets(self, widget_func, module_name):
        with patch(
            f"streamlit.elements.widgets.{module_name}.compute_and_register_element_id",
            wraps=compute_and_register_element_id,
        ) as patched_compute_and_register_element_id:
            if widget_func == st.download_button:
                widget_func("my_widget", data="")
            else:
                widget_func("my_widget")

        sig = inspect.signature(widget_func)
        expected_sig = self.signature_to_expected_kwargs(sig)

        # use_container_width is being deprecated and is not used for element ID calculation
        if "use_container_width" in expected_sig:
            del expected_sig["use_container_width"]

        if widget_func == st.button:
            expected_sig["is_form_submitter"] = ANY
        # we exclude `data` for `st.download_button` here and not
        # in `signature_to_expected_kwargs`, because `data` param is also used for
        # `st.data_editor`.
        if widget_func == st.download_button:
            del expected_sig["data"]

        patched_compute_and_register_element_id.assert_called_with(ANY, **expected_sig)

    @parameterized.expand(
        [
            (
                # define a lambda that matches the signature of what button_group is
                # passing to compute_and_register_element_id, because st.feedback does
                # not take a label and its arguments are different.
                lambda key,
                options,
                disabled=False,
                default=[],
                click_mode=0,
                style="",
                label="",
                help="",  # noqa: A006
                width="content": st.feedback("stars", disabled=disabled),
                "button_group",
            ),
            (
                # define a lambda that matches the signature of what button_group is
                # passing to compute_and_register_element_id, because st.pills does
                # not take a label and its arguments are different.
                lambda label,
                options,
                disabled=False,
                default=[],
                click_mode=0,
                style="",
                key="",
                help="",  # noqa: A006
                width="content": st.pills(label, options, disabled=disabled),
                "button_group",
            ),
            (
                # define a lambda that matches the signature of what button_group is
                # passing to compute_and_register_element_id, because st.feedback does
                # not take a label and its arguments are different.
                lambda label,
                options,
                disabled=False,
                default=[],
                click_mode=0,
                style="",
                key="",
                help="",  # noqa: A006
                width="content": st.segmented_control(
                    label, options, disabled=disabled
                ),
                "button_group",
            ),
            (st.multiselect, "multiselect"),
            (st.radio, "radio"),
            (st.select_slider, "select_slider"),
            (st.selectbox, "selectbox"),
        ]
    )
    def test_widget_id_computation_options_widgets(self, widget_func, module_name):
        options = ["a", "b", "c"]

        with patch(
            f"streamlit.elements.widgets.{module_name}.compute_and_register_element_id",
            wraps=compute_and_register_element_id,
        ) as patched_compute_and_register_element_id:
            widget_func("my_widget", options)

        sig = inspect.signature(widget_func)
        patched_compute_and_register_element_id.assert_called_with(
            ANY, **self.signature_to_expected_kwargs(sig)
        )

        # Double check that we get a DuplicateWidgetID error since the `disabled`
        # argument shouldn't affect a widget's ID.
        with pytest.raises(errors.DuplicateWidgetID):
            widget_func("my_widget", options, disabled=True)

    def test_widget_id_computation_data_editor(self):
        with patch(
            "streamlit.elements.widgets.data_editor.compute_and_register_element_id",
            wraps=compute_and_register_element_id,
        ) as patched_compute_and_register_element_id:
            st.data_editor(data=[])

        sig = inspect.signature(st.data_editor)
        expected_sig = self.signature_to_expected_kwargs(sig)

        # Make some changes to expected_sig unique to st.data_editor.
        expected_sig["column_config_mapping"] = ANY
        del expected_sig["hide_index"]
        del expected_sig["column_config"]

        patched_compute_and_register_element_id.assert_called_with(ANY, **expected_sig)

        # Double check that we get a DuplicateWidgetID error since the `disabled`
        # argument shouldn't affect a widget's ID.
        with pytest.raises(errors.DuplicateWidgetID):
            st.data_editor(data=[], disabled=True)

    def test_duplicate_id_error_uses_element_type(self) -> None:
        """Test that duplicate ID error uses element_type when style is None."""
        with pytest.raises(
            errors.StreamlitDuplicateElementId,
            match="There are multiple `button` elements with the same",
        ):
            compute_and_register_element_id(
                element_type="button", user_key=None, dg=None
            )
            compute_and_register_element_id(
                element_type="button", user_key=None, dg=None
            )


class RegisterWidgetsTest(DeltaGeneratorTestCase):
    @parameterized.expand(WIDGET_ELEMENTS)
    def test_register_widget_called_with_valid_value_type(
        self, _element_name: str, widget_func: ELEMENT_PRODUCER
    ):
        with patch(
            "streamlit.runtime.state.widgets.register_widget_from_metadata",
            wraps=register_widget_from_metadata,
        ) as patched_register_widget_from_metadata:
            widget_func()
        assert patched_register_widget_from_metadata.call_count == 1
        widget_metadata_arg: WidgetMetadata = (
            patched_register_widget_from_metadata.call_args[0][0]
        )
        assert widget_metadata_arg.value_type in get_args(ValueFieldName)
        # test that the value_type also maps to a protobuf field
        assert widget_metadata_arg.value_type in WidgetState.DESCRIPTOR.fields_by_name


@patch("streamlit.runtime.Runtime.exists", new=MagicMock(return_value=True))
class WidgetUserKeyTests(DeltaGeneratorTestCase):
    def test_get_widget_user_key(self):
        state = get_script_run_ctx().session_state._state
        st.checkbox("checkbox", key="c")

        k = next(iter(state._keys()))
        assert user_key_from_element_id(k) == "c"

    def test_get_widget_user_key_none(self):
        state = get_script_run_ctx().session_state._state
        st.selectbox("selectbox", options=["foo", "bar"])

        k = next(iter(state._keys()))
        # Absence of a user key is represented as None throughout our code
        assert user_key_from_element_id(k) is None

    def test_get_widget_user_key_hyphens(self):
        state = get_script_run_ctx().session_state._state
        st.slider("slider", key="my-slider")

        k = next(iter(state._keys()))
        assert user_key_from_element_id(k) == "my-slider"

    def test_get_widget_user_key_incorrect_none(self):
        state = get_script_run_ctx().session_state._state
        st.checkbox("checkbox", key="None")

        k = next(iter(state._keys()))
        # Incorrectly indicates no user key
        assert user_key_from_element_id(k) is None
