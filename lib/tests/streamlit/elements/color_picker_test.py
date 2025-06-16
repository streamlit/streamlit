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

"""color_picker unit test."""

from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class ColorPickerTest(DeltaGeneratorTestCase):
    def test_just_label(self):
        """Test that it can be called with no value."""
        st.color_picker("the label")

        c = self.get_delta_from_queue().new_element.color_picker
        assert c.label == "the label"
        assert (
            c.label_visibility.value
            == LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE
        )
        assert c.default == "#000000"
        assert not c.disabled

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.color_picker("the label", disabled=True)

        c = self.get_delta_from_queue().new_element.color_picker
        assert c.disabled

    @parameterized.expand([("#333333", "#333333"), ("#333", "#333"), (None, "#000000")])
    def test_value_types(self, arg_value, proto_value):
        """Test that it supports different types of values."""
        st.color_picker("the label", arg_value)

        c = self.get_delta_from_queue().new_element.color_picker
        assert c.label == "the label"
        assert c.default == proto_value

    def test_invalid_value_type_error(self):
        """Tests that when the value type is invalid, an exception is generated"""
        with pytest.raises(StreamlitAPIException):
            st.color_picker("the label", 1234567)

    def test_invalid_string(self):
        """Tests that when the string doesn't match regex, an exception is generated"""
        with pytest.raises(StreamlitAPIException):
            st.color_picker("the label", "#invalid-string")

    def test_outside_form(self):
        """Test that form id is marshalled correctly outside of a form."""

        st.color_picker("foo")

        proto = self.get_delta_from_queue().new_element.color_picker
        assert proto.form_id == ""

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self):
        """Test that form id is marshalled correctly inside of a form."""

        with st.form("form"):
            st.color_picker("foo")

        # 2 elements will be created: form block, widget
        assert len(self.get_all_deltas_from_queue()) == 2

        form_proto = self.get_delta_from_queue(0).add_block
        color_picker_proto = self.get_delta_from_queue(1).new_element.color_picker
        assert color_picker_proto.form_id == form_proto.form.form_id

    @parameterized.expand(
        [
            ("visible", LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE),
            ("hidden", LabelVisibilityMessage.LabelVisibilityOptions.HIDDEN),
            ("collapsed", LabelVisibilityMessage.LabelVisibilityOptions.COLLAPSED),
        ]
    )
    def test_label_visibility(self, label_visibility_value, proto_value):
        """Test that it can be called with label_visibility param."""
        st.color_picker("the label", label_visibility=label_visibility_value)

        c = self.get_delta_from_queue().new_element.color_picker
        assert c.label == "the label"
        assert c.label_visibility.value == proto_value

    def test_label_visibility_wrong_value(self):
        with pytest.raises(StreamlitAPIException) as e:
            st.color_picker("the label", label_visibility="wrong_value")
        assert (
            str(e.value)
            == "Unsupported label_visibility option 'wrong_value'. Valid values are 'visible', 'hidden' or 'collapsed'."
        )

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.color_picker("the label"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    def test_color_picker_with_width(self):
        """Test st.color_picker with different width types."""
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
                st.color_picker(f"test label {index}", width=width_value)

                el = self.get_delta_from_queue().new_element
                assert el.color_picker.label == f"test label {index}"

                assert el.width_config.WhichOneof("width_spec") == expected_width_spec
                assert getattr(el.width_config, field_name) == field_value

    def test_color_picker_with_invalid_width(self):
        """Test st.color_picker with invalid width values."""
        test_cases = [
            (
                "invalid",
                "Invalid width value: 'invalid'. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                -100,
                "Invalid width value: -100. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                0,
                "Invalid width value: 0. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                100.5,
                "Invalid width value: 100.5. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
        ]

        for width_value, expected_error_message in test_cases:
            with self.subTest(width_value=width_value):
                with pytest.raises(StreamlitAPIException) as exc:
                    st.color_picker("test label", width=width_value)

                assert str(exc.value) == expected_error_message

    def test_color_picker_default_width(self):
        """Test that st.color_picker defaults to content width."""
        st.color_picker("test label")

        el = self.get_delta_from_queue().new_element
        assert el.color_picker.label == "test label"
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_CONTENT.value
        )
        assert el.width_config.use_content is True
