# Copyright 2018-2020 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""text_input unit test."""

import re

from streamlit import StreamlitAPIException
from streamlit.proto.TextInput_pb2 import TextInput
from tests import testutil
import streamlit as st


class TextInputTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall text_input protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.text_input("the label")

        c = self.get_delta_from_queue().new_element.text_input
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.default, "")
        self.assertEqual(c.type, TextInput.DEFAULT)

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


class SomeObj(object):
    pass
