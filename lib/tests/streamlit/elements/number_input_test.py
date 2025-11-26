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

"""number_input unit test."""

from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.lib.js_number import JSNumber
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitInvalidWidthError,
    StreamlitValueAboveMaxError,
    StreamlitValueBelowMinError,
)
from streamlit.proto.Alert_pb2 import Alert as AlertProto
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from streamlit.proto.NumberInput_pb2 import NumberInput
from streamlit.proto.WidgetStates_pb2 import WidgetState
from streamlit.testing.v1.app_test import AppTest
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class NumberInputTest(DeltaGeneratorTestCase):
    def test_data_type(self):
        """Test that NumberInput.type is set to the proper
        NumberInput.DataType value
        """
        st.number_input("Label", value=0)
        c = self.get_delta_from_queue().new_element.number_input
        assert c.data_type == NumberInput.INT
        assert c.has_min
        assert c.min == JSNumber.MIN_SAFE_INTEGER
        assert c.has_max
        assert c.max == JSNumber.MAX_SAFE_INTEGER

        st.number_input("Label", value=0.5)
        c = self.get_delta_from_queue().new_element.number_input
        assert c.data_type == NumberInput.FLOAT
        assert c.has_min
        assert c.min == JSNumber.MIN_NEGATIVE_VALUE
        assert c.has_max
        assert c.max == JSNumber.MAX_VALUE

    def test_min_value_zero_sets_default_value(self):
        st.number_input("Label", 0, 10)
        c = self.get_delta_from_queue().new_element.number_input
        assert c.default == 0  # the 0 we provided, not 0.0!

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.number_input("the label")

        c = self.get_delta_from_queue().new_element.number_input
        assert c.label == "the label"
        assert (
            c.label_visibility.value
            == LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE
        )
        assert c.default == 0.0
        assert c.HasField("default")
        assert not c.disabled
        assert c.placeholder == ""

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.number_input("the label", disabled=True)

        c = self.get_delta_from_queue().new_element.number_input
        assert c.disabled

    def test_placeholder(self):
        """Test that it can be called with placeholder param."""
        st.number_input("the label", placeholder="Type a number...")

        c = self.get_delta_from_queue().new_element.number_input
        assert c.placeholder == "Type a number..."

    def test_emoji_icon(self):
        """Test that it can be called with an emoji icon."""
        st.number_input("the label", icon="💵")

        c = self.get_delta_from_queue().new_element.number_input
        assert c.icon == "💵"

    def test_material_icon(self):
        """Test that it can be called with a material icon."""
        st.number_input("the label", icon=":material/attach_money:")

        c = self.get_delta_from_queue().new_element.number_input
        assert c.icon == ":material/attach_money:"

    def test_none_value(self):
        """Test that it can be called with None as value."""
        st.number_input("the label", value=None)

        c = self.get_delta_from_queue().new_element.number_input
        assert c.label == "the label"
        # If a proto property is null is not determined by this value,
        # but by the check via the HasField method:
        assert c.default == 0.0
        assert not c.HasField("default")

    def test_none_value_with_int_min(self):
        """Test that it can be called with None as value and
        will be interpreted as integer if min_value is set to int."""
        st.number_input("the label", value=None, min_value=1)

        c = self.get_delta_from_queue().new_element.number_input
        assert c.label == "the label"
        # If a proto property is null is not determined by this value,
        # but by the check via the HasField method:
        assert c.default == 0.0
        assert not c.HasField("default")
        assert c.has_min
        assert c.min == 1
        assert c.data_type == NumberInput.INT

    def test_default_value_when_min_is_passed(self):
        st.number_input("the label", min_value=1, max_value=10)

        c = self.get_delta_from_queue().new_element.number_input
        assert c.label == "the label"
        assert c.default == 1

    def test_value_between_range(self):
        st.number_input("the label", 0, 11, 10)

        c = self.get_delta_from_queue().new_element.number_input
        assert c.label == "the label"
        assert c.default == 10
        assert c.min == 0
        assert c.max == 11
        assert c.has_min
        assert c.has_max

    def test_default_step_when_a_value_is_int(self):
        st.number_input("the label", value=10)

        c = self.get_delta_from_queue().new_element.number_input
        assert c.step == 1.0

    def test_default_step_when_a_value_is_float(self):
        st.number_input("the label", value=10.5)

        c = self.get_delta_from_queue().new_element.number_input
        assert f"{c.step:0.2f}" == "0.01"

    def test_default_format_int(self):
        st.number_input("the label", value=10)

        c = self.get_delta_from_queue().new_element.number_input
        assert c.format == "%d"

    def test_default_format_float(self):
        st.number_input("the label", value=10.5)

        c = self.get_delta_from_queue().new_element.number_input
        assert c.format == "%0.2f"

    def test_format_int_and_default_step(self):
        st.number_input("the label", value=10, format="%d")

        c = self.get_delta_from_queue().new_element.number_input
        assert c.format == "%d"
        assert c.step == 1

    def test_format_float_and_default_step(self):
        st.number_input("the label", value=10.0, format="%f")

        c = self.get_delta_from_queue().new_element.number_input
        assert c.format == "%f"
        assert f"{c.step:0.2f}" == "0.01"

    def test_accept_valid_formats(self):
        # note: We decided to accept %u even though it is slightly problematic.
        #       See https://github.com/streamlit/streamlit/pull/943
        SUPPORTED = "adifFeEgGuXxo"
        for char in SUPPORTED:
            st.number_input("any label", format="%" + char)
            c = self.get_delta_from_queue().new_element.number_input
            assert c.format == "%" + char

    def test_warns_on_float_type_with_int_format(self):
        st.number_input("the label", value=5.0, format="%d")

        c = self.get_delta_from_queue(-2).new_element.alert
        assert c.format == AlertProto.WARNING
        assert (
            c.body
            == "Warning: NumberInput value below has type float, but format %d displays as integer."
        )

    def test_warns_on_int_type_with_float_format(self):
        st.number_input("the label", value=5, format="%0.2f")

        c = self.get_delta_from_queue(-2).new_element.alert
        assert c.format == AlertProto.WARNING
        assert (
            c.body
            == "Warning: NumberInput value below has type int so is displayed as int despite format string %0.2f."
        )

    def test_error_on_unsupported_formatters(self):
        UNSUPPORTED = "pAn"
        for char in UNSUPPORTED:
            with pytest.raises(StreamlitAPIException):
                st.number_input("any label", value=3.14, format="%" + char)

    def test_error_on_invalid_formats(self):
        BAD_FORMATS = [
            "blah",
            "a%f",
            "a%.3f",
            "%d%d",
        ]
        for fmt in BAD_FORMATS:
            with pytest.raises(StreamlitAPIException):
                st.number_input("any label", value=3.14, format=fmt)

    def test_value_out_of_bounds(self):
        # Max int
        with pytest.raises(StreamlitAPIException) as exc:
            int_value = JSNumber.MAX_SAFE_INTEGER + 1
            st.number_input("Label", value=int_value)
        assert f"`value` ({int_value}) must be <= (1 << 53) - 1" == str(exc.value)

        # Min int
        with pytest.raises(StreamlitAPIException) as exc:
            int_value = JSNumber.MIN_SAFE_INTEGER - 1
            st.number_input("Label", value=int_value)
        assert f"`value` ({int_value}) must be >= -((1 << 53) - 1)" == str(exc.value)

        # Max float
        with pytest.raises(StreamlitAPIException) as exc:
            float_val = 2e308
            st.number_input("Label", value=float_val)
        assert f"`value` ({float_val}) must be <= 1.797e+308" == str(exc.value)

        # Min float
        with pytest.raises(StreamlitAPIException) as exc:
            float_val = -2e308
            st.number_input("Label", value=float_val)
        assert f"`value` ({float_val}) must be >= -1.797e+308" == str(exc.value)

    def test_min_and_max_setting_for_integer_inputs(self):
        """Test min & max set by user respected, otherwise use defaults."""
        st.number_input("Label", value=2, step=1, min_value=0, max_value=10)
        c = self.get_delta_from_queue().new_element.number_input
        assert c.min == 0
        assert c.max == 10

        st.number_input("Label", value=2, step=1, min_value=0)
        c = self.get_delta_from_queue().new_element.number_input
        assert c.min == 0
        assert c.max == JSNumber.MAX_SAFE_INTEGER

        st.number_input("Label", value=2, step=1, max_value=10)
        c = self.get_delta_from_queue().new_element.number_input
        assert c.min == JSNumber.MIN_SAFE_INTEGER
        assert c.max == 10

        st.number_input("Label", value=2, step=1)
        c = self.get_delta_from_queue().new_element.number_input
        assert c.min == JSNumber.MIN_SAFE_INTEGER
        assert c.max == JSNumber.MAX_SAFE_INTEGER

    def test_outside_form(self):
        """Test that form id is marshalled correctly outside of a form."""

        st.number_input("foo")

        proto = self.get_delta_from_queue().new_element.number_input
        assert proto.form_id == ""

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self):
        """Test that form id is marshalled correctly inside of a form."""

        with st.form("form"):
            st.number_input("foo")

        # 2 elements will be created: form block, widget
        assert len(self.get_all_deltas_from_queue()) == 2

        form_proto = self.get_delta_from_queue(0).add_block
        number_input_proto = self.get_delta_from_queue(1).new_element.number_input
        assert number_input_proto.form_id == form_proto.form.form_id

    def test_inside_column(self):
        """Test that it works correctly inside of a column."""

        col1, _col2 = st.columns(2)
        with col1:
            st.number_input("foo", 0, 10)

        all_deltas = self.get_all_deltas_from_queue()

        # 4 elements will be created: 1 horizontal block, 2 columns, 1 widget
        assert len(all_deltas) == 4
        number_input_proto = self.get_delta_from_queue().new_element.number_input

        assert number_input_proto.label == "foo"
        assert number_input_proto.step == 1.0
        assert number_input_proto.default == 0

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    @patch("streamlit.elements.lib.policies.get_session_state")
    def test_no_warning_with_value_set_in_state(self, patched_get_session_state):
        mock_session_state = MagicMock()
        mock_session_state.is_new_state_value.return_value = True
        patched_get_session_state.return_value = mock_session_state

        st.number_input("the label", min_value=1, max_value=10, key="number_input")

        c = self.get_delta_from_queue().new_element.number_input
        assert c.label == "the label"
        assert c.default == 1

        # Assert that no warning delta is enqueued when setting the widget
        # value via st.session_state.
        assert len(self.get_all_deltas_from_queue()) == 1

    @parameterized.expand(
        [
            ("visible", LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE),
            ("hidden", LabelVisibilityMessage.LabelVisibilityOptions.HIDDEN),
            ("collapsed", LabelVisibilityMessage.LabelVisibilityOptions.COLLAPSED),
        ]
    )
    def test_label_visibility(self, label_visibility_value, proto_value):
        """Test that it can be called with label_visibility param."""
        st.number_input("the label", label_visibility=label_visibility_value)

        c = self.get_delta_from_queue().new_element.number_input
        assert c.label_visibility.value == proto_value

    def test_label_visibility_wrong_value(self):
        with pytest.raises(StreamlitAPIException) as e:
            st.number_input("the label", label_visibility="wrong_value")  # type: ignore[call-arg]
        assert (
            str(e.value)
            == "Unsupported label_visibility option 'wrong_value'. Valid values are 'visible', 'hidden' or 'collapsed'."
        )

    def test_width_config_default(self):
        """Test that default width is 'stretch'."""
        st.number_input("the label")

        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

    def test_width_config_pixel(self):
        """Test that pixel width works properly."""
        st.number_input("the label", width=100)

        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert c.width_config.pixel_width == 100

    def test_width_config_stretch(self):
        """Test that 'stretch' width works properly."""
        st.number_input("the label", width="stretch")

        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

    @parameterized.expand(
        [
            "invalid",
            -100,
            0,
            100.5,
            None,
        ]
    )
    def test_invalid_width(self, width):
        """Test that invalid width values raise exceptions."""
        with pytest.raises(StreamlitInvalidWidthError):
            st.number_input("the label", width=width)

    def test_should_keep_type_of_return_value_after_rerun(self):
        # set the initial page script hash
        self.script_run_ctx.reset(page_script_hash=self.script_run_ctx.page_script_hash)
        # Generate widget id and reset context
        st.number_input("a number", min_value=1, max_value=100, key="number")
        widget_id = self.script_run_ctx.session_state.get_widget_states()[0].id
        self.script_run_ctx.reset(page_script_hash=self.script_run_ctx.page_script_hash)

        # Set the state of the widgets to the test state
        widget_state = WidgetState()
        widget_state.id = widget_id
        widget_state.double_value = 42.0
        self.script_run_ctx.session_state._state._new_widget_state.set_widget_from_proto(
            widget_state
        )

        # Render widget again with the same parameters
        number = st.number_input("a number", min_value=1, max_value=100, key="number")

        # Assert output
        assert number == 42
        assert type(number) is int

    @parameterized.expand(
        [
            # Integer tests
            (6, -10, 0),
            (-11, -10, 0),
            # Float tests
            (-11.0, -10.0, 0.0),
            (6.0, -10.0, 0.0),
        ]
    )
    def test_should_raise_exception_when_default_out_of_bounds_min_and_max_defined(
        self, value, min_value, max_value
    ):
        with pytest.raises(StreamlitAPIException):
            st.number_input(
                "My Label", value=value, min_value=min_value, max_value=max_value
            )

    def test_should_raise_exception_when_default_lt_min_and_max_is_none(self):
        value = -11.0
        min_value = -10.0
        with pytest.raises(StreamlitAPIException):
            st.number_input("My Label", value=value, min_value=min_value)

    def test_should_raise_exception_when_default_gt_max_and_min_is_none(self):
        value = 11
        max_value = 10
        with pytest.raises(StreamlitValueAboveMaxError):
            st.number_input("My Label", value=value, max_value=max_value)

    def test_should_raise_exception_when_session_state_value_out_of_range(self):
        """Test out of range interactions by using st.session_state to set number input widget values beyond min/max."""
        with pytest.raises(StreamlitValueAboveMaxError):
            st.session_state.number_input = 10
            st.number_input(
                "number_input", min_value=1, max_value=5, key="number_input"
            )

        with pytest.raises(StreamlitValueBelowMinError):
            st.session_state.number_input_1 = 10
            st.number_input(
                "number_input_1", min_value=15, max_value=20, key="number_input_1"
            )

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.number_input("the label"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    def test_stable_id_with_key(self):
        """Test that the widget ID is stable when a stable key is provided."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First render with certain params (keep whitelisted kwargs stable)
            st.number_input(
                label="Label 1",
                key="number_input_key",
                value=3,
                help="Help 1",
                disabled=False,
                width="stretch",
                on_change=lambda: None,
                args=("arg1", "arg2"),
                kwargs={"kwarg1": "kwarg1"},
                label_visibility="visible",
                placeholder="placeholder 1",
                format="%0.2f",
                icon=":material/attach_money:",
                min_value=0,
                max_value=10,
                step=1,
            )
            c1 = self.get_delta_from_queue().new_element.number_input
            id1 = c1.id

            # Second render with different non-whitelisted params but same key
            st.number_input(
                label="Label 2",
                key="number_input_key",
                value=7,
                help="Help 2",
                disabled=True,
                width=200,
                on_change=lambda: None,
                args=("arg_1", "arg_2"),
                kwargs={"kwarg_1": "kwarg_1"},
                label_visibility="hidden",
                placeholder="placeholder 2",
                format="%d",
                icon="💵",
                # Keep whitelisted the same to ensure ID stability
                min_value=0,
                max_value=10,
                step=1,
            )
            c2 = self.get_delta_from_queue().new_element.number_input
            id2 = c2.id
            assert id1 == id2

    @parameterized.expand(
        [
            ("min_value", 0, 1),
            ("max_value", 10, 11),
            ("step", 1, 2),
        ]
    )
    def test_whitelisted_stable_key_kwargs(
        self, kwarg_name: str, value1: object, value2: object
    ):
        """Test that the widget ID changes when a whitelisted kwarg changes even when the key is provided."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            base_kwargs = {
                "label": "Label",
                "key": "number_input_key",
                # keep other whitelisted values stable to avoid type/format interactions
                "min_value": 0,
                "max_value": 10,
                "step": 1,
            }
            base_kwargs[kwarg_name] = value1

            st.number_input(**base_kwargs)
            c1 = self.get_delta_from_queue().new_element.number_input
            id1 = c1.id

            base_kwargs[kwarg_name] = value2
            st.number_input(**base_kwargs)
            c2 = self.get_delta_from_queue().new_element.number_input
            id2 = c2.id
            assert id1 != id2


def test_number_input_interaction():
    """Test interactions with an empty number input widget."""

    def script():
        import streamlit as st

        st.number_input("the label", value=None)

    at = AppTest.from_function(script).run()
    number_input = at.number_input[0]
    assert number_input.value is None

    # Set the value to 10
    at = number_input.set_value(10).run()
    number_input = at.number_input[0]
    assert number_input.value == 10

    # # Increment the value
    at = number_input.increment().run()
    number_input = at.number_input[0]
    assert number_input.value == 10.01

    # # Clear the value
    at = number_input.set_value(None).run()
    number_input = at.number_input[0]
    assert number_input.value is None


def test_None_session_state_value_retained():
    def script():
        import streamlit as st

        if "number_input" not in st.session_state:
            st.session_state["number_input"] = None

        st.number_input("number_input", key="number_input")
        st.button("button")

    at = AppTest.from_function(script).run()
    at = at.button[0].click().run()
    assert at.number_input[0].value is None
