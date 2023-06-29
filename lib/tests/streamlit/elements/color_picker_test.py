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

"""color_picker unit test."""

from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class ColorPickerTest(DeltaGeneratorTestCase):
    def test_just_label(self):
        """Test that it can be called with no value."""
        st.color_picker("the label")

        c = self.get_delta_from_queue().new_element.color_picker
        self.assertEqual(c.label, "the label")
        self.assertEqual(
            c.label_visibility.value,
            LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE,
        )
        self.assertEqual(c.default, "#000000")
        self.assertEqual(c.disabled, False)

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.color_picker("the label", disabled=True)

        c = self.get_delta_from_queue().new_element.color_picker
        self.assertEqual(c.disabled, True)

    @parameterized.expand([("#333333", "#333333"), ("#333", "#333"), (None, "#000000")])
    def test_value_types(self, arg_value, proto_value):
        """Test that it supports different types of values."""
        st.color_picker("the label", arg_value)

        c = self.get_delta_from_queue().new_element.color_picker
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.default, proto_value)

    def test_invalid_value_type_error(self):
        """Tests that when the value type is invalid, an exception is generated"""
        with pytest.raises(StreamlitAPIException) as exc_message:
            st.color_picker("the label", 1234567)

    def test_invalid_string(self):
        """Tests that when the string doesn't match regex, an exception is generated"""
        with pytest.raises(StreamlitAPIException) as exc_message:
            st.color_picker("the label", "#invalid-string")

    def test_outside_form(self):
        """Test that form id is marshalled correctly outside of a form."""

        st.color_picker("foo")

        proto = self.get_delta_from_queue().new_element.color_picker
        self.assertEqual(proto.form_id, "")

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self):
        """Test that form id is marshalled correctly inside of a form."""

        with st.form("form"):
            st.color_picker("foo")

        # 2 elements will be created: form block, widget
        self.assertEqual(len(self.get_all_deltas_from_queue()), 2)

        form_proto = self.get_delta_from_queue(0).add_block
        color_picker_proto = self.get_delta_from_queue(1).new_element.color_picker
        self.assertEqual(color_picker_proto.form_id, form_proto.form.form_id)

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
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.label_visibility.value, proto_value)

    def test_label_visibility_wrong_value(self):
        with self.assertRaises(StreamlitAPIException) as e:
            st.color_picker("the label", label_visibility="wrong_value")
        self.assertEqual(
            str(e.exception),
            "Unsupported label_visibility option 'wrong_value'. Valid values are "
            "'visible', 'hidden' or 'collapsed'.",
        )
