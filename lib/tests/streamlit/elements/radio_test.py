# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""radio unit tests."""

from typing import Any
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException, StreamlitInvalidBindValueError
from streamlit.proto.LabelVisibility_pb2 import LabelVisibility
from streamlit.testing.v1.app_test import AppTest
from streamlit.testing.v1.util import patch_config_options
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.data_test_cases import (
    SHARED_TEST_CASES,
    CaseMetadata,
)
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class RadioTest(DeltaGeneratorTestCase):
    """Test ability to marshall radio protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.radio("the label", ("m", "f"))

        c = self.get_delta_from_queue().new_element.radio
        assert c.label == "the label"
        assert (
            c.label_visibility.value == LabelVisibility.LabelVisibilityOptions.VISIBLE
        )
        assert c.default == 0
        assert not c.disabled
        assert c.HasField("default")
        assert c.captions == []

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.radio("the label", ("m", "f"), disabled=True)

        c = self.get_delta_from_queue().new_element.radio
        assert c.disabled

    def test_none_value(self):
        """Test that it can be called with None as index value."""
        st.radio("the label", ("m", "f"), index=None)

        c = self.get_delta_from_queue().new_element.radio
        assert c.label == "the label"
        # If a proto property is null is not determined by this value,
        # but by the check via the HasField method:
        assert c.default == 0
        assert not c.HasField("default")

    def test_horizontal(self):
        """Test that it can be called with horizontal param."""
        st.radio("the label", ("m", "f"), horizontal=True)

        c = self.get_delta_from_queue().new_element.radio
        assert c.horizontal

    def test_horizontal_default_value(self):
        """Test that it can called with horizontal param value False by default."""
        st.radio("the label", ("m", "f"))

        c = self.get_delta_from_queue().new_element.radio
        assert not c.horizontal

    def test_valid_value(self):
        """Test that valid value is an int."""
        st.radio("the label", ("m", "f"), 1)

        c = self.get_delta_from_queue().new_element.radio
        assert c.label == "the label"
        assert c.default == 1

    def test_noneType_option(self):
        """Test NoneType option value."""
        current_value = st.radio("the label", (None, "selected"), 0)

        assert current_value is None

    @parameterized.expand(
        SHARED_TEST_CASES,
    )
    def test_option_types(self, name: str, input_data: Any, metadata: CaseMetadata):
        """Test that it supports different types of options."""
        st.radio("the label", input_data)

        c = self.get_delta_from_queue().new_element.radio
        assert c.label == "the label"
        assert c.default == 0
        assert {str(item) for item in c.options} == {
            str(item) for item in metadata.expected_sequence
        }

    def test_cast_options_to_string(self):
        """Test that it casts options to string."""
        arg_options = ["some str", 123, None, {}]
        proto_options = ["some str", "123", "None", "{}"]

        st.radio("the label", arg_options)

        c = self.get_delta_from_queue().new_element.radio
        assert c.label == "the label"
        assert c.default == 0
        assert c.options == proto_options

    def test_format_function(self):
        """Test that it formats options."""
        arg_options = [{"name": "john", "height": 180}, {"name": "lisa", "height": 200}]
        proto_options = ["john", "lisa"]

        st.radio("the label", arg_options, format_func=lambda x: x["name"])

        c = self.get_delta_from_queue().new_element.radio
        assert c.label == "the label"
        assert c.default == 0
        assert c.options == proto_options

    @parameterized.expand([((),), ([],), (np.array([]),), (pd.Series(np.array([])),)])
    def test_no_options(self, options):
        """Test that it handles no options."""
        st.radio("the label", options)

        c = self.get_delta_from_queue().new_element.radio
        assert c.label == "the label"
        assert (
            c.label_visibility.value == LabelVisibility.LabelVisibilityOptions.VISIBLE
        )
        assert c.default == 0
        assert c.options == []

    def test_invalid_value(self):
        """Test that value must be an int."""
        with pytest.raises(StreamlitAPIException):
            st.radio("the label", ("m", "f"), "1")

    def test_invalid_value_range(self):
        """Test that value must be within the length of the options."""
        with pytest.raises(StreamlitAPIException):
            st.radio("the label", ("m", "f"), 2)

    def test_outside_form(self):
        """Test that form id is marshalled correctly outside of a form."""

        st.radio("foo", ["bar", "baz"])

        proto = self.get_delta_from_queue().new_element.radio
        assert proto.form_id == ""

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self):
        """Test that form id is marshalled correctly inside of a form."""

        with st.form("form"):
            st.radio("foo", ["bar", "baz"])

        # 2 elements will be created: form block, widget
        assert len(self.get_all_deltas_from_queue()) == 2

        form_proto = self.get_delta_from_queue(0).add_block
        radio_proto = self.get_delta_from_queue(1).new_element.radio
        assert radio_proto.form_id == form_proto.form.form_id

    def test_inside_column(self):
        """Test that it works correctly inside of a column."""
        col1, _col2 = st.columns(2)

        with col1:
            st.radio("foo", ["bar", "baz"])

        all_deltas = self.get_all_deltas_from_queue()

        # 4 elements will be created: 1 horizontal block, 2 columns, 1 widget
        assert len(all_deltas) == 4
        radio_proto = self.get_delta_from_queue().new_element.radio

        assert radio_proto.label == "foo"
        assert radio_proto.options == ["bar", "baz"]
        assert radio_proto.default == 0

    @parameterized.expand(
        [
            ("visible", LabelVisibility.LabelVisibilityOptions.VISIBLE),
            ("hidden", LabelVisibility.LabelVisibilityOptions.HIDDEN),
            ("collapsed", LabelVisibility.LabelVisibilityOptions.COLLAPSED),
        ]
    )
    def test_label_visibility(self, label_visibility_value, proto_value):
        """Test that it can be called with label_visibility param."""
        st.radio("the label", ("m", "f"), label_visibility=label_visibility_value)

        c = self.get_delta_from_queue().new_element.radio
        assert c.label == "the label"
        assert c.default == 0
        assert c.label_visibility.value == proto_value

    def test_label_visibility_wrong_value(self):
        with pytest.raises(StreamlitAPIException) as e:
            st.radio("the label", ("m", "f"), label_visibility="wrong_value")
        assert (
            str(e.value)
            == "Unsupported label_visibility option 'wrong_value'. Valid values are 'visible', 'hidden' or 'collapsed'."
        )

    def test_no_captions(self):
        """Test that it can be called with no captions."""
        st.radio("the label", ("option1", "option2", "option3"), captions=None)

        c = self.get_delta_from_queue().new_element.radio
        assert c.label == "the label"
        assert c.default == 0
        assert c.captions == []

    def test_some_captions(self):
        """Test that it can be called with some captions."""
        st.radio(
            "the label",
            ("option1", "option2", "option3", "option4"),
            captions=("first caption", None, "", "last caption"),
        )

        c = self.get_delta_from_queue().new_element.radio
        assert c.label == "the label"
        assert c.default == 0
        assert c.captions == ["first caption", "", "", "last caption"]

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.radio("the label", ["option 1", "option 2"]))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-3).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    def test_radio_with_width(self):
        """Test st.radio with different width types."""
        test_cases = [
            (500, WidthConfigFields.PIXEL_WIDTH.value, "pixel_width", 500),
            ("stretch", WidthConfigFields.USE_STRETCH.value, "use_stretch", True),
            ("content", WidthConfigFields.USE_CONTENT.value, "use_content", True),
        ]

        for index, (
            width_value,
            expected_width_spec,
            field_name,
            field_value,
        ) in enumerate(test_cases):
            with self.subTest(width_value=width_value):
                st.radio(
                    f"test label {index}", ["option 1", "option 2"], width=width_value
                )

                el = self.get_delta_from_queue().new_element
                assert el.radio.label == f"test label {index}"

                assert el.width_config.WhichOneof("width_spec") == expected_width_spec
                assert getattr(el.width_config, field_name) == field_value

    def test_radio_with_invalid_width(self):
        """Test st.radio with invalid width values."""
        test_cases = [
            (
                "invalid",
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                -100,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                0,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                100.5,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
        ]

        for width_value, expected_error_message in test_cases:
            with self.subTest(width_value=width_value):
                with pytest.raises(StreamlitAPIException) as exc:
                    st.radio("test label", ["option 1", "option 2"], width=width_value)

                assert expected_error_message in str(exc.value)

    def test_radio_default_width(self):
        """Test that st.radio defaults to content width."""
        st.radio("test label", ["option 1", "option 2"])

        el = self.get_delta_from_queue().new_element
        assert el.radio.label == "test label"
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_CONTENT.value
        )
        assert el.width_config.use_content is True

    def test_stable_id_with_key(self):
        """Test that the widget ID is stable when a stable key is provided."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First render with certain params
            st.radio(
                label="Label 1",
                key="radio_key",
                index=0,
                help="Help 1",
                disabled=False,
                width="content",
                on_change=lambda: None,
                args=("arg1", "arg2"),
                kwargs={"kwarg1": "kwarg1"},
                label_visibility="visible",
                horizontal=False,
                captions=["c1", "c2"],
                options=["a", "b"],
                format_func=lambda x: x.capitalize(),
            )
            c1 = self.get_delta_from_queue().new_element.radio
            id1 = c1.id

            # Second render with different non-whitelisted params but same key
            st.radio(
                label="Label 2",
                key="radio_key",
                index=1,
                help="Help 2",
                disabled=True,
                width="stretch",
                on_change=lambda: None,
                args=("arg_1", "arg_2"),
                kwargs={"kwarg_1": "kwarg_1"},
                label_visibility="hidden",
                horizontal=True,
                captions=["c1x", "c2x"],
                options=["a", "b", "c"],
                format_func=lambda x: x.upper(),
            )
            c2 = self.get_delta_from_queue().new_element.radio
            id2 = c2.id
            assert id1 == id2

    def test_unstable_id_without_key(self) -> None:
        """Test that the widget ID changes when options change without a key.

        This verifies that without a stable key, changing options results in
        a new widget ID since the identity is computed from the options.
        """
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            st.radio(label="Label 1", options=["a", "b"], format_func=str)
            c1 = self.get_delta_from_queue().new_element.radio
            id1 = c1.id

            st.radio(label="Label 1", options=["a", "b", "c"], format_func=str)
            c2 = self.get_delta_from_queue().new_element.radio
            id2 = c2.id
            assert id1 != id2


def test_radio_interaction():
    """Test interactions with an empty radio widget."""

    def script():
        import streamlit as st

        st.radio("the label", ("m", "f"), index=None)

    at = AppTest.from_function(script).run()
    radio = at.radio[0]
    assert radio.value is None

    # Select option m
    at = radio.set_value("m").run()
    radio = at.radio[0]
    assert radio.value == "m"

    # # Clear the value
    at = radio.set_value(None).run()
    radio = at.radio[0]
    assert radio.value is None


def test_radio_enum_coercion():
    """Test E2E Enum Coercion on a radio.

    When enum classes are redefined between runs (common in Streamlit scripts),
    the widget should return a valid enum value from the current class when
    coercion is enabled. When coercion is "off", the value from session state
    (which may be from an old class) is returned as-is.
    """

    def script():
        from enum import Enum

        import streamlit as st

        class EnumA(Enum):
            A = 1
            B = 2
            C = 3

        selected = st.radio("my_enum", EnumA, index=0)
        st.text(id(selected.__class__))
        st.text(id(EnumA))
        st.text(selected in EnumA)

    at = AppTest.from_function(script).run()

    def test_enum():
        radio = at.radio[0]
        original_class = radio.value.__class__
        radio.set_value(original_class.C).run()
        assert at.text[0].value == at.text[1].value, "Enum Class ID not the same"
        assert at.text[2].value == "True", "Not all enums found in class"

    with patch_config_options({"runner.enumCoercion": "nameOnly"}):
        test_enum()
    # With coercion="off", the value from session state (old class) is returned as-is,
    # so class IDs will differ - expect assertion to fail.
    with (
        patch_config_options({"runner.enumCoercion": "off"}),
        pytest.raises(AssertionError),
    ):
        test_enum()


def test_None_session_state_value_retained():
    def script():
        import streamlit as st

        if "radio" not in st.session_state:
            st.session_state["radio"] = None

        st.radio("radio", ["a", "b", "c"], key="radio")
        st.button("button")

    at = AppTest.from_function(script).run()
    at = at.button[0].click().run()
    assert at.radio[0].value is None


def test_dynamic_options_with_key_retains_value() -> None:
    """Test that changing options with a key retains the selected value if still valid."""

    def script():
        import streamlit as st

        if "counter" not in st.session_state:
            st.session_state["counter"] = 0

        counter = st.session_state["counter"]

        # First run: options are ["A", "B", "C"]
        # Second run: options are ["A", "B", "D"] (C removed, D added)
        if counter == 0:
            options = ["A", "B", "C"]
        else:
            options = ["A", "B", "D"]

        selected = st.radio("Select", options, key="dynamic_radio")
        st.text(f"Selected: {selected}")
        st.button("Next", on_click=lambda: st.session_state.__setitem__("counter", 1))

    at = AppTest.from_function(script).run()

    # Initially "A" is selected (index 0)
    assert at.radio[0].value == "A"

    # Select "B"
    at = at.radio[0].set_value("B").run()
    assert at.radio[0].value == "B"

    # Click button to change options from ["A", "B", "C"] to ["A", "B", "D"]
    # "B" should remain selected since it's still in the new options
    at = at.button[0].click().run()
    assert at.radio[0].value == "B"
    assert "Selected: B" in at.text[0].value


def test_dynamic_options_with_key_resets_invalid_value() -> None:
    """Test that changing options resets value to default if selected value is removed."""

    def script():
        import streamlit as st

        if "counter" not in st.session_state:
            st.session_state["counter"] = 0

        counter = st.session_state["counter"]

        # First run: options are ["A", "B", "C"]
        # Second run: options are ["D", "E", "F"] (all changed)
        if counter == 0:
            options = ["A", "B", "C"]
        else:
            options = ["D", "E", "F"]

        selected = st.radio("Select", options, key="dynamic_radio")
        st.text(f"Selected: {selected}")
        st.button("Next", on_click=lambda: st.session_state.__setitem__("counter", 1))

    at = AppTest.from_function(script).run()

    # Initially "A" is selected (index 0)
    assert at.radio[0].value == "A"

    # Select "B"
    at = at.radio[0].set_value("B").run()
    assert at.radio[0].value == "B"

    # Click button to change options from ["A", "B", "C"] to ["D", "E", "F"]
    # "B" is no longer valid, so should reset to default (index 0 = "D")
    at = at.button[0].click().run()
    assert at.radio[0].value == "D"
    assert "Selected: D" in at.text[0].value


def test_dynamic_options_with_key_and_none_index() -> None:
    """Test dynamic options with index=None (no default selection)."""

    def script():
        import streamlit as st

        if "counter" not in st.session_state:
            st.session_state["counter"] = 0

        counter = st.session_state["counter"]

        if counter == 0:
            options = ["A", "B", "C"]
        else:
            options = ["D", "E", "F"]

        selected = st.radio("Select", options, index=None, key="dynamic_radio")
        st.text(f"Selected: {selected}")
        st.button("Next", on_click=lambda: st.session_state.__setitem__("counter", 1))

    at = AppTest.from_function(script).run()

    # Initially no selection
    assert at.radio[0].value is None

    # Select "B"
    at = at.radio[0].set_value("B").run()
    assert at.radio[0].value == "B"

    # Click button to change options from ["A", "B", "C"] to ["D", "E", "F"]
    # "B" is no longer valid and index=None, so should reset to None
    at = at.button[0].click().run()
    assert at.radio[0].value is None
    assert "Selected: None" in at.text[0].value


def test_dynamic_format_func_preserves_value() -> None:
    """Test that changing format_func preserves value if underlying option still exists."""

    def script():
        import streamlit as st

        if "counter" not in st.session_state:
            st.session_state["counter"] = 0

        counter = st.session_state["counter"]

        # First run: format_func=str.upper -> displays "A", "B", "C"
        # Second run: format_func=str.lower -> displays "a", "b", "c"
        # The formatted display changes, but underlying options remain the same.
        if counter == 0:
            format_func = str.upper
        else:
            format_func = str.lower

        options = ["A", "B", "C"]
        selected = st.radio(
            "Select", options, format_func=format_func, key="dynamic_radio"
        )
        st.text(f"Selected: {selected}")
        st.button("Next", on_click=lambda: st.session_state.__setitem__("counter", 1))

    at = AppTest.from_function(script).run()

    # Initially "A" is selected (index 0), displayed as "A"
    assert at.radio[0].value == "A"

    # Select "B" (displayed as "B")
    at = at.radio[0].set_value("B").run()
    assert at.radio[0].value == "B"

    # Click button to change format_func from upper to lower
    # The value "B" should be preserved because the underlying option "B"
    # still exists in the options list, even though its display changes to "b".
    at = at.button[0].click().run()
    assert at.radio[0].value == "B"
    # Verify it didn't reset to the default "A"
    assert at.radio[0].value != "A"
    assert "Selected: B" in at.text[0].value


def test_custom_objects_without_eq() -> None:
    """Test that custom class objects without __eq__ work with format_func.

    This tests the fix for issue #13646 where custom objects without __eq__
    would have their selections cleared after script reruns because the
    serialization used == comparison after deepcopy created new instances.
    """

    def script():
        import streamlit as st

        # Custom class without __eq__ implementation - uses identity comparison
        # Must be defined inside script() because AppTest.from_function() runs in isolation
        class CustomOption:  # noqa: B903
            def __init__(self, value: str, label: str):
                self.value = value
                self.label = label

        # Create new option instances on each run (simulating the behavior
        # that triggers the bug - each rerun creates new object instances)
        options = [
            CustomOption("opt_a", "Option A"),
            CustomOption("opt_b", "Option B"),
            CustomOption("opt_c", "Option C"),
        ]

        selected = st.radio(
            "Select",
            options,
            format_func=lambda x: x.label,
            key="custom_radio",
        )
        st.text(f"Selected: {selected.value if selected else None}")
        st.button("Rerun")

    at = AppTest.from_function(script).run()

    # Initially "opt_a" is selected (index 0) - value is the CustomOption object
    assert at.radio[0].value.value == "opt_a"
    assert "Selected: opt_a" in at.text[0].value

    # Click button to trigger a rerun - this creates new CustomOption instances
    # Without the fix, the selection would be cleared because the deepcopied
    # value wouldn't match any option (identity comparison using == fails for
    # objects without __eq__, so it falls back to `is` comparison which fails)
    at = at.button[0].click().run()

    # After rerun, the selection should still be the first option
    # The fix uses format_func comparison instead of == comparison
    assert at.radio[0].value.value == "opt_a"
    # Verify it didn't reset to None or become invalid
    assert at.radio[0].value is not None
    assert "Selected: opt_a" in at.text[0].value


class RadioBindQueryParamsTest(DeltaGeneratorTestCase):
    """Tests for radio bind='query-params' functionality."""

    def test_bind_query_params_sets_query_param_key(self):
        """Test that bind='query-params' with a key sets query_param_key in proto."""
        st.radio("the label", ["a", "b", "c"], key="my_key", bind="query-params")

        c = self.get_delta_from_queue().new_element.radio
        assert c.query_param_key == "my_key"

    def test_bind_query_params_without_key_raises_exception(self):
        """Test that bind='query-params' without a key raises an exception."""
        with pytest.raises(StreamlitAPIException, match=r"must have a unique 'key'"):
            st.radio("the label", ["a", "b", "c"], bind="query-params")

    def test_no_bind_does_not_set_query_param_key(self):
        """Test that without bind parameter, query_param_key is not set."""
        st.radio("the label", ["a", "b", "c"], key="my_key")

        c = self.get_delta_from_queue().new_element.radio
        assert c.query_param_key == ""
        assert c.label == "the label"

    def test_invalid_bind_value_raises_exception(self):
        """Test that an invalid bind value raises StreamlitInvalidBindValueError."""
        with pytest.raises(StreamlitInvalidBindValueError, match=r"invalid-value"):
            st.radio("the label", ["a", "b"], key="my_key", bind="invalid-value")

    def test_bind_with_format_func(self):
        """Test that bind works with format_func."""
        st.radio(
            "the label",
            ["cat", "dog"],
            format_func=str.upper,
            key="my_key",
            bind="query-params",
        )

        c = self.get_delta_from_queue().new_element.radio
        assert c.query_param_key == "my_key"
        assert list(c.options) == ["CAT", "DOG"]

    def test_bind_with_index_none(self):
        """Test that bind works with index=None (clearable)."""
        st.radio(
            "the label", ["a", "b", "c"], index=None, key="my_key", bind="query-params"
        )

        c = self.get_delta_from_queue().new_element.radio
        assert c.query_param_key == "my_key"
        assert not c.HasField("default")
