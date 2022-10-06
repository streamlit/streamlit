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

"""text_input unit test."""

import re
from unittest.mock import MagicMock, patch

from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from streamlit.proto.TextInput_pb2 import TextInput
from tests import testutil


class TextInputTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall text_input protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.text_input("the label")

        c = self.get_delta_from_queue().new_element.text_input
        self.assertEqual(c.label, "the label")
        self.assertEqual(
            c.label_visibility.value,
            LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE,
        )
        self.assertEqual(c.default, "")
        self.assertEqual(c.type, TextInput.DEFAULT)
        self.assertEqual(c.disabled, False)

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.text_input("the label", disabled=True)

        c = self.get_delta_from_queue().new_element.text_input
        self.assertEqual(c.disabled, True)

    def test_value_types(self):
        """Test that it supports different types of values."""
        arg_values = ["some str", 123, None, {}, SomeObj()]
        proto_values = ["some str", "123", "None", "{}", ".*SomeObj.*"]

        for arg_value, proto_value in zip(arg_values, proto_values):
            st.text_input("the label", arg_value)

            c = self.get_delta_from_queue().new_element.text_input
            self.assertEqual(c.label, "the label")
            self.assertTrue(re.match(proto_value, c.default))

    def test_input_types(self):
        # Test valid input types.
        type_strings = ["default", "password"]
        type_values = [TextInput.DEFAULT, TextInput.PASSWORD]
        for type_string, type_value in zip(type_strings, type_values):
            st.text_input("label", type=type_string)

            c = self.get_delta_from_queue().new_element.text_input
            self.assertEqual(type_value, c.type)

        # An invalid input type should raise an exception.
        with self.assertRaises(StreamlitAPIException) as exc:
            st.text_input("label", type="bad_type")

        self.assertEqual(
            "'bad_type' is not a valid text_input type. "
            "Valid types are 'default' and 'password'.",
            str(exc.exception),
        )

    def test_placeholder(self):
        """Test that it can be called with placeholder"""
        st.text_input("the label", "", placeholder="testing")

        c = self.get_delta_from_queue().new_element.text_input
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.default, "")
        self.assertEqual(c.placeholder, "testing")
        self.assertEqual(c.type, TextInput.DEFAULT)

    def test_outside_form(self):
        """Test that form id is marshalled correctly outside of a form."""

        st.text_input("foo")

        proto = self.get_delta_from_queue().new_element.text_input
        self.assertEqual(proto.form_id, "")

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self):
        """Test that form id is marshalled correctly inside of a form."""

        with st.form("form"):
            st.text_input("foo")

        # 2 elements will be created: form block, widget
        self.assertEqual(len(self.get_all_deltas_from_queue()), 2)

        form_proto = self.get_delta_from_queue(0).add_block
        text_input_proto = self.get_delta_from_queue(1).new_element.text_input
        self.assertEqual(text_input_proto.form_id, form_proto.form.form_id)

    def test_inside_column(self):
        """Test that it works correctly inside of a column."""
        col1, col2, col3 = st.columns([2.5, 1.5, 0.5])

        with col1:
            st.text_input("foo")

        all_deltas = self.get_all_deltas_from_queue()

        # 5 elements will be created: 1 horizontal block, 3 columns, 1 widget
        self.assertEqual(len(all_deltas), 5)
        text_input_proto = self.get_delta_from_queue().new_element.text_input

        self.assertEqual(text_input_proto.label, "foo")

    def test_autocomplete_defaults(self):
        """If 'autocomplete' is unspecified, it defaults to the empty string
        for default inputs, and "new-password" for password inputs.
        """
        st.text_input("foo")
        proto = self.get_delta_from_queue().new_element.text_input
        self.assertEqual("", proto.autocomplete)

        st.text_input("password", type="password")
        proto = self.get_delta_from_queue().new_element.text_input
        self.assertEqual("new-password", proto.autocomplete)

    def test_autcomplete(self):
        """Autocomplete should be marshalled if specified."""
        st.text_input("foo", autocomplete="you-complete-me")
        proto = self.get_delta_from_queue().new_element.text_input
        self.assertEqual("you-complete-me", proto.autocomplete)

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
        self.assertEqual(c.label_visibility.value, proto_value)

    def test_label_visibility_wrong_value(self):
        with self.assertRaises(StreamlitAPIException) as e:
            st.text_input("the label", label_visibility="wrong_value")
            self.assertEquals(
                str(e),
                "Unsupported label_visibility option 'wrong_value'. Valid values are "
                "'visible', 'hidden' or 'collapsed'.",
            )


class SomeObj:
    pass
