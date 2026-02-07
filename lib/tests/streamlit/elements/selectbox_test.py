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

"""selectbox unit tests."""

from typing import Any
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.lib.options_selector_utils import create_mappings
from streamlit.elements.widgets.selectbox import SelectboxSerde
from streamlit.errors import StreamlitAPIException, StreamlitInvalidWidthError
from streamlit.proto.LabelVisibility_pb2 import LabelVisibility
from streamlit.testing.v1.app_test import AppTest
from streamlit.testing.v1.util import patch_config_options
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.data_test_cases import (
    SHARED_TEST_CASES,
    CaseMetadata,
)
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class SelectboxTest(DeltaGeneratorTestCase):
    """Test ability to marshall selectbox protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.selectbox("the label", ("m", "f"))

        c = self.get_delta_from_queue().new_element.selectbox
        assert c.label == "the label"
        assert (
            c.label_visibility.value == LabelVisibility.LabelVisibilityOptions.VISIBLE
        )
        assert c.default == 0
        assert c.HasField("default")
        assert not c.disabled
        # Default placeholders are now handled on the frontend side
        # Backend only passes through custom user-provided placeholders
        assert not c.accept_new_options

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.selectbox("the label", ("m", "f"), disabled=True)

        c = self.get_delta_from_queue().new_element.selectbox
        assert c.disabled

    def test_valid_value(self):
        """Test that valid value is an int."""
        st.selectbox("the label", ("m", "f"), 1)

        c = self.get_delta_from_queue().new_element.selectbox
        assert c.label == "the label"
        assert c.default == 1

    def test_none_index(self):
        """Test that it can be called with None as index value."""
        st.selectbox("the label", ("m", "f"), index=None)

        c = self.get_delta_from_queue().new_element.selectbox
        assert c.label == "the label"
        # If a proto property is null is not determined by this value,
        # but by the check via the HasField method:
        assert c.default == 0
        assert not c.HasField("default")

    def test_noneType_option(self):
        """Test NoneType option value."""
        current_value = st.selectbox("the label", (None, "selected"), 0)

        assert current_value is None

    @parameterized.expand(
        SHARED_TEST_CASES,
    )
    def test_option_types(self, name: str, input_data: Any, metadata: CaseMetadata):
        """Test that it supports different types of options."""
        st.selectbox("the label", input_data)

        c = self.get_delta_from_queue().new_element.selectbox
        assert c.label == "the label"
        assert c.default == 0
        assert {str(item) for item in c.options} == {
            str(item) for item in metadata.expected_sequence
        }

    def test_cast_options_to_string(self):
        """Test that it casts options to string."""
        arg_options = ["some str", 123, None, {}]
        proto_options = ["some str", "123", "None", "{}"]

        st.selectbox("the label", arg_options)

        c = self.get_delta_from_queue().new_element.selectbox
        assert c.label == "the label"
        assert c.default == 0
        assert c.options == proto_options

    def test_format_function(self):
        """Test that it formats options."""
        arg_options = [{"name": "john", "height": 180}, {"name": "lisa", "height": 200}]
        proto_options = ["john", "lisa"]

        st.selectbox("the label", arg_options, format_func=lambda x: x["name"])

        c = self.get_delta_from_queue().new_element.selectbox
        assert c.label == "the label"
        assert c.default == 0
        assert c.options == proto_options

    @parameterized.expand([((),), ([],), (np.array([]),), (pd.Series(np.array([])),)])
    def test_no_options(self, options):
        """Test that it handles no options."""
        st.selectbox("the label", options)

        c = self.get_delta_from_queue().new_element.selectbox
        assert c.label == "the label"
        assert c.default == 0
        assert c.options == []

    def test_accept_new_options(self):
        """Test that it can accept new options."""
        st.selectbox("the label", ("m", "f"), accept_new_options=True)

        c = self.get_delta_from_queue().new_element.selectbox
        assert c.accept_new_options
        # Placeholder logic is now handled on the frontend side
        # Backend only passes through custom user-provided placeholders

    def test_invalid_value(self):
        """Test that value must be an int."""
        with pytest.raises(StreamlitAPIException):
            st.selectbox("the label", ("m", "f"), "1")

    def test_invalid_value_range(self):
        """Test that value must be within the length of the options."""
        with pytest.raises(StreamlitAPIException):
            st.selectbox("the label", ("m", "f"), 2)

    def test_raises_exception_of_index_larger_than_options(self):
        """Test that it raises an exception if index is larger than options."""
        with pytest.raises(StreamlitAPIException) as ex:
            st.selectbox("Test box", ["a"], index=1)

        assert (
            str(ex.value)
            == "Selectbox index must be greater than or equal to 0 and less than the length of options."
        )

    def test_outside_form(self):
        """Test that form id is marshalled correctly outside of a form."""

        st.selectbox("foo", ("bar", "baz"))

        proto = self.get_delta_from_queue().new_element.color_picker
        assert proto.form_id == ""

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self):
        """Test that form id is marshalled correctly inside of a form."""

        with st.form("form"):
            st.selectbox("foo", ("bar", "baz"))

        # 2 elements will be created: form block, widget
        assert len(self.get_all_deltas_from_queue()) == 2

        form_proto = self.get_delta_from_queue(0).add_block
        selectbox_proto = self.get_delta_from_queue(1).new_element.selectbox
        assert selectbox_proto.form_id == form_proto.form.form_id

    @parameterized.expand(
        [
            ("visible", LabelVisibility.LabelVisibilityOptions.VISIBLE),
            ("hidden", LabelVisibility.LabelVisibilityOptions.HIDDEN),
            ("collapsed", LabelVisibility.LabelVisibilityOptions.COLLAPSED),
        ]
    )
    def test_label_visibility(self, label_visibility_value, proto_value):
        """Test that it can be called with label_visibility param."""
        st.selectbox("the label", ("m", "f"), label_visibility=label_visibility_value)

        c = self.get_delta_from_queue().new_element.selectbox
        assert c.label_visibility.value == proto_value

    def test_label_visibility_wrong_value(self):
        with pytest.raises(StreamlitAPIException) as e:
            st.selectbox("the label", ("m", "f"), label_visibility="wrong_value")
        assert (
            str(e.value)
            == "Unsupported label_visibility option 'wrong_value'. Valid values are 'visible', 'hidden' or 'collapsed'."
        )

    def test_placeholder(self):
        """Test that it can be called with placeholder params."""
        st.selectbox("the label", ("m", "f"), placeholder="Please select")

        c = self.get_delta_from_queue().new_element.selectbox
        assert c.placeholder == "Please select"

    def test_width_config_default(self):
        """Test that default width is 'stretch'."""
        st.selectbox("the label", ("m", "f"))

        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

    def test_width_config_pixel(self):
        """Test that pixel width works properly."""
        st.selectbox("the label", ("m", "f"), width=200)

        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert c.width_config.pixel_width == 200

    def test_width_config_stretch(self):
        """Test that 'stretch' width works properly."""
        st.selectbox("the label", ("m", "f"), width="stretch")

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
            st.selectbox("the label", ("m", "f"), width=width)

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.selectbox("the label", ["Coffee", "Tea", "Water"]))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-3).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    def test_stable_id_with_key(self):
        """Test that the widget ID is stable when a stable key is provided."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First render with certain params
            st.selectbox(
                label="Label 1",
                key="selectbox_key",
                index=0,
                help="Help 1",
                disabled=False,
                width="stretch",
                on_change=lambda: None,
                args=("arg1", "arg2"),
                kwargs={"kwarg1": "kwarg1"},
                label_visibility="visible",
                placeholder="placeholder 1",
                format_func=lambda x: x.capitalize(),
                options=["a", "b", "cd"],
                # Whitelisted kwargs:
                accept_new_options=True,
            )
            c1 = self.get_delta_from_queue().new_element.selectbox
            id1 = c1.id

            # Second render with different non-whitelisted params but same key
            st.selectbox(
                label="Label 2",
                key="selectbox_key",
                index=None,
                help="Help 2",
                disabled=True,
                width=200,
                on_change=lambda: None,
                args=("arg_1", "arg_2"),
                kwargs={"kwarg_1": "kwarg_1"},
                label_visibility="hidden",
                placeholder="placeholder 2",
                format_func=lambda x: x.upper(),
                options=["apple", "banana", "cherry"],
                # Whitelisted kwargs:
                accept_new_options=True,
            )
            c2 = self.get_delta_from_queue().new_element.selectbox
            id2 = c2.id
            assert id1 == id2

    @parameterized.expand(
        [
            ("accept_new_options", True, False),
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
                "key": "selectbox_key_whitelist",
                "options": ["a", "b"],
                "accept_new_options": True,
                "format_func": lambda x: x.lower(),
            }

            base_kwargs[kwarg_name] = value1

            st.selectbox(**base_kwargs)
            c1 = self.get_delta_from_queue().new_element.selectbox
            id1 = c1.id

            base_kwargs[kwarg_name] = value2
            st.selectbox(**base_kwargs)
            c2 = self.get_delta_from_queue().new_element.selectbox
            id2 = c2.id
            assert id1 != id2


def test_selectbox_interaction():
    """Test interactions with an empty selectbox widget."""

    def script():
        import streamlit as st

        st.selectbox("the label", ("m", "f"), index=None)

    at = AppTest.from_function(script).run()
    selectbox = at.selectbox[0]
    assert selectbox.value is None

    # Select option m
    at = selectbox.set_value("m").run()
    selectbox = at.selectbox[0]
    assert selectbox.value == "m"

    # # Clear the value
    at = selectbox.set_value(None).run()
    selectbox = at.selectbox[0]
    assert selectbox.value is None


def test_selectbox_preserves_selection_when_options_expand():
    """Test that selection is preserved when new options are added."""

    def script():
        import streamlit as st

        # Use session state to track which options to show
        if "expanded" not in st.session_state:
            st.session_state["expanded"] = False

        if st.session_state["expanded"]:
            options = ["A", "B", "C", "D"]
        else:
            options = ["A", "B", "C"]

        selected = st.selectbox("Pick one", options, key="picker")
        # Output the actual returned value to verify
        st.text(f"Selected: {selected}")

        if st.button("Expand options"):
            st.session_state["expanded"] = True

    at = AppTest.from_function(script).run()

    # Select "B"
    at = at.selectbox[0].set_value("B").run()
    assert at.text[0].value == "Selected: B"

    # Click button to expand options (add "D")
    at = at.button[0].click().run()

    # Selection should be preserved since "B" is still in options
    # (no extra run needed - value is valid in both old and new options)
    # Check the actual widget return value via st.text output
    assert at.text[0].value == "Selected: B"


def test_selectbox_resets_when_selection_removed():
    """Test that selection resets to default when selected option is removed."""

    def script():
        import streamlit as st

        # Use session state to track which options to show
        if "shrunk" not in st.session_state:
            st.session_state["shrunk"] = False

        if st.session_state["shrunk"]:
            options = ["A", "C"]  # "B" removed
        else:
            options = ["A", "B", "C"]

        selected = st.selectbox("Pick one", options, key="picker")
        # Output the actual returned value to verify
        st.text(f"Selected: {selected}")

        if st.button("Shrink options"):
            st.session_state["shrunk"] = True

    at = AppTest.from_function(script).run()

    # Select "B"
    at = at.selectbox[0].set_value("B").run()
    assert at.text[0].value == "Selected: B"

    # Click button to shrink options (remove "B")
    at = at.button[0].click().run()
    # Extra run needed: AppTest doesn't fully simulate frontend processing
    # the set_value=True response. The second run picks up the reset value.
    at = at.run()

    # Selection should reset to default ("A") since "B" is no longer in options
    # Check the actual widget return value via st.text output
    assert at.text[0].value == "Selected: A"


def test_selectbox_resets_when_options_shrink_significantly():
    """Test that selection resets when options shrink and selected value is gone.

    When a user selects a value that later gets removed from the options,
    the selection should reset to the default index.
    """

    def script():
        import streamlit as st

        if "shrunk" not in st.session_state:
            st.session_state["shrunk"] = False

        if st.session_state["shrunk"]:
            # Only 2 options now - "C", "D", "E" are gone
            options = ["A", "B"]
        else:
            # 5 options
            options = ["A", "B", "C", "D", "E"]

        selected = st.selectbox("Pick one", options, index=0, key="picker")
        st.text(f"Selected: {selected}")

        if st.button("Shrink options"):
            st.session_state["shrunk"] = True

    at = AppTest.from_function(script).run()

    # Initial selection should be "A" (default)
    assert at.text[0].value == "Selected: A"

    # Select "D" which will be removed when options shrink
    at = at.selectbox[0].set_value("D").run()
    assert at.text[0].value == "Selected: D"

    # Click button to shrink options (removes "C", "D", "E")
    at = at.button[0].click().run()
    # Extra run needed: AppTest doesn't fully simulate frontend processing
    # the set_value=True response. The second run picks up the reset value.
    at = at.run()

    # Selection should reset to "A" (default) since "D" is no longer in options
    assert at.text[0].value == "Selected: A"


def test_selectbox_preserves_custom_value_with_accept_new_options():
    """Test that accept_new_options=True preserves values not in the options list.

    When accept_new_options=True, the validation is skipped and the value is
    preserved even if it's not in the current options list.
    """

    def script():
        import streamlit as st

        if "shrunk" not in st.session_state:
            st.session_state["shrunk"] = False

        if st.session_state["shrunk"]:
            options = ["A", "C"]  # "B" removed
        else:
            options = ["A", "B", "C"]

        selected = st.selectbox(
            "Pick one", options, key="picker", accept_new_options=True
        )
        st.text(f"Selected: {selected}")

        if st.button("Shrink options"):
            st.session_state["shrunk"] = True

    at = AppTest.from_function(script).run()

    # Select "B"
    at = at.selectbox[0].set_value("B").run()
    assert at.text[0].value == "Selected: B"

    # Click button to shrink options (remove "B")
    at = at.button[0].click().run()

    # With accept_new_options=True, selection should be PRESERVED even though
    # "B" is no longer in options (no reset, no extra run needed)
    assert at.text[0].value == "Selected: B"


def test_selectbox_enum_coercion():
    """Test E2E Enum Coercion on a selectbox.

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

        selected = st.selectbox("my_enum", EnumA, index=0)
        st.text(id(selected.__class__))
        st.text(id(EnumA))
        st.text(selected in EnumA)

    at = AppTest.from_function(script).run()

    def test_enum():
        selectbox = at.selectbox[0]
        original_class = selectbox.value.__class__
        selectbox.set_value(original_class.C).run()
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

        if "selectbox" not in st.session_state:
            st.session_state["selectbox"] = None

        st.selectbox("selectbox", ["a", "b", "c"], key="selectbox")
        st.button("button")

    at = AppTest.from_function(script).run()
    at = at.button[0].click().run()
    assert at.selectbox[0].value is None


class TestSelectboxSerde:
    def test_serialize(self):
        options = ["Option A", "Option B", "Option C"]
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        serde = SelectboxSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        res = serde.serialize("Option A")
        assert res == "Option A"

    def test_serialize_none(self):
        options = ["Option A", "Option B", "Option C"]
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        serde = SelectboxSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        res = serde.serialize(None)
        assert res is None

    def test_serialize_empty_options(self):
        """Test serializing with empty options.

        Even with empty options, serialize should return the formatted value
        (not None or empty string) because accept_new_options=True allows
        user-entered values even when the options list is empty.
        """
        options = []
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        serde = SelectboxSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        # With default format_func (str), "something" should serialize to "something"
        res = serde.serialize("something")
        assert res == "something"
        # Should not return empty string or None
        assert res != ""
        assert res is not None

    def test_serialize_with_format_func(self):
        options = ["Option A", "Option B", "Option C"]

        # Define format_func for testing purposes
        def format_func(x):
            return f"Format: {x}"

        formatted_options, formatted_option_to_option_index = create_mappings(
            options, format_func
        )
        serde = SelectboxSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=format_func,
        )

        res = serde.serialize("Option A")
        assert res == "Format: Option A"

        # When a value is not found in options but format_func succeeds,
        # return the formatted value (not the original) for type consistency
        res = serde.serialize("Option D")
        assert res == "Format: Option D"

    def test_deserialize(self):
        options = ["Option A", "Option B", "Option C"]
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        serde = SelectboxSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        res = serde.deserialize("Option A")
        assert res == "Option A"

    def test_deserialize_with_new_option(self):
        options = ["Option A", "Option B", "Option C"]
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        serde = SelectboxSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        res = serde.deserialize("New Option")
        assert res == "New Option"

    def test_deserialize_none(self):
        options = ["Option A", "Option B", "Option C"]
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        serde = SelectboxSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        res = serde.deserialize(None)
        assert res is None

    def test_deserialize_with_default_index(self):
        options = ["Option A", "Option B", "Option C"]
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        default_index = 2
        serde = SelectboxSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            default_option_index=default_index,
        )

        res = serde.deserialize(None)
        assert res == "Option C"

    def test_deserialize_empty_options_with_default_index(self):
        """Test that deserializing with empty options returns None even with default index."""
        options = []
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        default_index = 0
        serde = SelectboxSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            default_option_index=default_index,
        )

        res = serde.deserialize(None)
        assert res is None

    def test_deserialize_empty_options_with_string_value(self):
        """Test deserializing a string value with empty options.

        When accept_new_options=True, users can enter custom values even
        when options is empty. The serde should return these user-entered
        values as-is.
        """
        options = []
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        serde = SelectboxSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        # User-entered values should be returned as-is (supports accept_new_options=True)
        res = serde.deserialize("user_entered_value")
        assert res == "user_entered_value"

        # Even empty string is a valid user input when accept_new_options=True
        res = serde.deserialize("")
        assert res == ""

    def test_deserialize_complex_options(self):
        # Test with more complex option types
        complex_options = [
            {"id": 1, "name": "First"},
            {"id": 2, "name": "Second"},
            {"id": 3, "name": "Third"},
        ]

        # Define format_func for testing purposes
        def format_func(x):
            return x["name"]

        formatted_options, formatted_option_to_option_index = create_mappings(
            complex_options, format_func
        )
        serde = SelectboxSerde(
            complex_options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        res = serde.deserialize("First")
        assert res == complex_options[0]

    def test_deserialize_numeric_string_options(self):
        options = ["1", "2", "3"]
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        serde = SelectboxSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        res = serde.deserialize("2")
        assert res == "2"

        res = serde.deserialize("4")
        assert res == "4"

    def test_deserialize_enum_options(self):
        from enum import Enum

        class TestEnum(Enum):
            A = 1
            B = 2
            C = 3

        options = [TestEnum.A, TestEnum.B, TestEnum.C]
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        serde = SelectboxSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        res = serde.deserialize("TestEnum.B")
        assert res == TestEnum.B

    def test_serialize_deepcopied_custom_objects(self):
        """Test that serialize works with deepcopied custom objects without __eq__.

        This tests the fix for https://github.com/streamlit/streamlit/issues/13646
        where custom objects without __eq__ would fail serialization after deepcopy
        because the old implementation used index_() which relies on ==.
        """
        from copy import deepcopy

        # Custom class without __eq__ implementation
        class MyOption:  # noqa: B903
            def __init__(self, value: str):
                self.value = value

        def format_func(x):
            return x.value

        options = [MyOption("a"), MyOption("b"), MyOption("c")]
        formatted_options, formatted_option_to_option_index = create_mappings(
            options, format_func
        )
        serde = SelectboxSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=format_func,
        )

        # Simulate deepcopied value (what happens after register_widget)
        deepcopied_value = deepcopy(options[0])

        # This should work correctly using format_func comparison
        res = serde.serialize(deepcopied_value)
        assert res == "a"
