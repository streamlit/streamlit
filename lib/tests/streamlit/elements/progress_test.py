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

import streamlit as st
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class DeltaGeneratorProgressTest(DeltaGeneratorTestCase):
    """Test DeltaGenerator Progress."""

    def test_progress_int(self):
        """Test Progress with int values."""
        values = [0, 42, 100]
        for value in values:
            st.progress(value)

            element = self.get_delta_from_queue().new_element
            self.assertEqual(value, element.progress.value)

    def test_progress_float(self):
        """Test Progress with float values."""
        values = [0.0, 0.42, 1.0]
        for value in values:
            st.progress(value)

            element = self.get_delta_from_queue().new_element
            self.assertEqual(int(value * 100), element.progress.value)

    def test_progress_bad_values(self):
        """Test Progress with bad values."""
        values = [-1, 101, -0.01, 1.01]
        for value in values:
            with self.assertRaises(StreamlitAPIException):
                st.progress(value)

        with self.assertRaises(StreamlitAPIException):
            st.progress("some string")

    def test_progress_text(self):
        """Test Progress with text."""
        text = "TEST_TEXT"
        st.progress(42, text=text)

        element = self.get_delta_from_queue().new_element
        self.assertEqual(text, element.progress.text)

    def test_progress_with_text(self):
        """Test Progress with invalid type in text parameter."""
        text = object()
        with self.assertRaises(StreamlitAPIException):
            st.progress(42, text=text)
