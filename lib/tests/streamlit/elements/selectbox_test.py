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
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
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
            c.label_visibility.value
            == LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE
        )
        assert c.default == 0
        assert c.HasField("default")
        assert not c.disabled
        assert c.placeholder == "Choose an option"
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
        assert c.placeholder == "Choose or add an option"

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
            ("visible", LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE),
            ("hidden", LabelVisibilityMessage.LabelVisibilityOptions.HIDDEN),
            ("collapsed", LabelVisibilityMessage.LabelVisibilityOptions.COLLAPSED),
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
        el = self.get_delta_from_queue(-2).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning


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


def test_selectbox_enum_coercion():
    """Test E2E Enum Coercion on a selectbox."""

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
    with (
        patch_config_options({"runner.enumCoercion": "off"}),
        pytest.raises(AssertionError),
    ):
        test_enum()  # expect a failure with the config value off.


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
        options = []
        formatted_options, formatted_option_to_option_index = create_mappings(options)
        serde = SelectboxSerde(
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
        )

        res = serde.serialize("something")
        assert res == ""

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
        )

        res = serde.serialize("Option A")
        assert res == "Format: Option A"

        res = serde.serialize("Option D")
        assert res == "Option D"

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
