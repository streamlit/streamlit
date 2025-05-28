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

"""text_input unit test."""

import re
from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException, StreamlitInvalidWidthError
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from streamlit.proto.TextInput_pb2 import TextInput
from streamlit.testing.v1.app_test import AppTest
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class TextInputTest(DeltaGeneratorTestCase):
    """Test ability to marshall text_input protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.text_input("the label")

        c = self.get_delta_from_queue().new_element.text_input
        assert c.label == "the label"
        assert (
            c.label_visibility.value
            == LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE
        )
        assert c.default == ""
        assert c.HasField("default")
        assert c.type == TextInput.DEFAULT
        assert not c.disabled

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.text_input("the label", disabled=True)

        c = self.get_delta_from_queue().new_element.text_input
        assert c.disabled

    def test_value_types(self):
        """Test that it supports different types of values."""
        arg_values = ["some str", 123, {}, SomeObj()]
        proto_values = ["some str", "123", "{}", ".*SomeObj.*"]

        for arg_value, proto_value in zip(arg_values, proto_values):
            st.text_input("the label", arg_value)

            c = self.get_delta_from_queue().new_element.text_input
            assert c.label == "the label"
            assert re.match(proto_value, c.default)

    def test_none_value(self):
        """Test that it can be called with None as initial value."""
        st.text_input("the label", value=None)

        c = self.get_delta_from_queue().new_element.text_input
        assert c.label == "the label"
        # If a proto property is null, it is not determined by
        # this value, but by the check via the HasField method:
        assert c.default == ""
        assert not c.HasField("default")

    def test_input_types(self):
        # Test valid input types.
        type_strings = ["default", "password"]
        type_values = [TextInput.DEFAULT, TextInput.PASSWORD]
        for type_string, type_value in zip(type_strings, type_values):
            st.text_input("label", type=type_string)

            c = self.get_delta_from_queue().new_element.text_input
            assert type_value == c.type

        # An invalid input type should raise an exception.
        with pytest.raises(StreamlitAPIException) as exc:
            st.text_input("label", type="bad_type")

        assert (
            str(exc.value)
            == "'bad_type' is not a valid text_input type. Valid types are 'default' and 'password'."
        )

    def test_placeholder(self):
        """Test that it can be called with placeholder"""
        st.text_input("the label", "", placeholder="testing")

        c = self.get_delta_from_queue().new_element.text_input
        assert c.label == "the label"
        assert c.default == ""
        assert c.placeholder == "testing"
        assert c.type == TextInput.DEFAULT

    def test_outside_form(self):
        """Test that form id is marshalled correctly outside of a form."""

        st.text_input("foo")

        proto = self.get_delta_from_queue().new_element.text_input
        assert proto.form_id == ""

    def test_emoji_icon(self):
        """Test that it can be called with an emoji icon."""
        st.text_input("foo", icon="📋")

        c = self.get_delta_from_queue().new_element.text_input
        assert c.icon == "📋"

    def test_material_icon(self):
        """Test that it can be called with a material icon."""
        st.text_input("foo", icon=":material/search:")

        c = self.get_delta_from_queue().new_element.text_input
        assert c.icon == ":material/search:"

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self):
        """Test that form id is marshalled correctly inside of a form."""

        with st.form("form"):
            st.text_input("foo")

        # 2 elements will be created: form block, widget
        assert len(self.get_all_deltas_from_queue()) == 2

        form_proto = self.get_delta_from_queue(0).add_block
        text_input_proto = self.get_delta_from_queue(1).new_element.text_input
        assert text_input_proto.form_id == form_proto.form.form_id

    def test_inside_column(self):
        """Test that it works correctly inside of a column."""
        col1, col2, col3 = st.columns([2.5, 1.5, 0.5])

        with col1:
            st.text_input("foo")

        all_deltas = self.get_all_deltas_from_queue()

        # 5 elements will be created: 1 horizontal block, 3 columns, 1 widget
        assert len(all_deltas) == 5
        text_input_proto = self.get_delta_from_queue().new_element.text_input

        assert text_input_proto.label == "foo"

    def test_autocomplete_defaults(self):
        """If 'autocomplete' is unspecified, it defaults to the empty string
        for default inputs, and "new-password" for password inputs.
        """
        st.text_input("foo")
        proto = self.get_delta_from_queue().new_element.text_input
        assert proto.autocomplete == ""

        st.text_input("password", type="password")
        proto = self.get_delta_from_queue().new_element.text_input
        assert proto.autocomplete == "new-password"

    def test_autcomplete(self):
        """Autocomplete should be marshalled if specified."""
        st.text_input("foo", autocomplete="you-complete-me")
        proto = self.get_delta_from_queue().new_element.text_input
        assert proto.autocomplete == "you-complete-me"

    @parameterized.expand(
        [
            ("visible", LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE),
            ("hidden", LabelVisibilityMessage.LabelVisibilityOptions.HIDDEN),
            ("collapsed", LabelVisibilityMessage.LabelVisibilityOptions.COLLAPSED),
        ]
    )
    def test_label_visibility(self, label_visibility_value, proto_value):
        """Test that it can be called with label_visibility param."""
        st.text_input("the label", label_visibility=label_visibility_value)
        c = self.get_delta_from_queue().new_element.text_input
        assert c.label_visibility.value == proto_value

    def test_label_visibility_wrong_value(self):
        with pytest.raises(StreamlitAPIException) as e:
            st.text_input("the label", label_visibility="wrong_value")
        assert (
            str(e.value)
            == "Unsupported label_visibility option 'wrong_value'. Valid values are 'visible', 'hidden' or 'collapsed'."
        )

    def test_width_config_default(self):
        """Test that default width is 'stretch'."""
        st.text_input("the label")

        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

    def test_width_config_pixel(self):
        """Test that pixel width works properly."""
        st.text_input("the label", width=100)

        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert c.width_config.pixel_width == 100

    def test_width_config_stretch(self):
        """Test that 'stretch' width works properly."""
        st.text_input("the label", width="stretch")

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
            st.text_input("the label", width=width)

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.text_input("the label"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning


class SomeObj:
    pass


def test_text_input_interaction():
    """Test interactions with an empty text_input widget."""

    def script():
        import streamlit as st

        st.text_input("the label", value=None)

    at = AppTest.from_function(script).run()
    text_input = at.text_input[0]
    assert text_input.value is None

    # Input a value:
    at = text_input.input("Foo").run()
    text_input = at.text_input[0]
    assert text_input.value == "Foo"

    # # Clear the value
    at = text_input.set_value(None).run()
    text_input = at.text_input[0]
    assert text_input.value is None


def test_None_session_state_value_retained():
    def script():
        import streamlit as st

        if "text_input" not in st.session_state:
            st.session_state["text_input"] = None

        st.text_input("text_input", key="text_input")
        st.button("button")

    at = AppTest.from_function(script).run()
    at = at.button[0].click().run()
    assert at.text_input[0].value is None
