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
from streamlit.proto.Markdown_pb2 import Markdown as MarkdownProto
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class CodeElement(DeltaGeneratorTestCase):
    """Test ability to marshall code protos."""

    def test_st_code_default(self):
        """Test st.code() with default language (python)."""
        code = "print('Hello, %s!' % 'Streamlit')"

        st.code(code)
        element = self.get_delta_from_queue().new_element

        self.assertEqual(element.code.code_text, code)
        self.assertEqual(element.code.show_line_numbers, False)
        self.assertEqual(element.code.language, "python")

    def test_st_code_python(self):
        """Test st.code with python language."""
        code = "print('My string = %d' % my_value)"
        st.code(code, language="python")

        element = self.get_delta_from_queue().new_element
        self.assertEqual(element.code.code_text, code)
        self.assertEqual(element.code.show_line_numbers, False)
        self.assertEqual(element.code.language, "python")

    def test_st_code_none(self):
        """Test st.code with None language."""
        code = "print('My string = %d' % my_value)"
        st.code(code, language=None)

        element = self.get_delta_from_queue().new_element
        self.assertEqual(element.code.code_text, code)
        self.assertEqual(element.code.show_line_numbers, False)
        self.assertEqual(element.code.language, "plaintext")

    def test_st_code_none_with_line_numbers(self):
        """Test st.code with None language and line numbers."""
        code = "print('My string = %d' % my_value)"
        st.code(code, language=None, line_numbers=True)

        element = self.get_delta_from_queue().new_element
        self.assertEqual(element.code.code_text, code)
        self.assertEqual(element.code.show_line_numbers, True)
        self.assertEqual(element.code.language, "plaintext")

    def test_st_code_python_with_line_numbers(self):
        """Test st.code with Python language and line numbers."""
        code = "print('My string = %d' % my_value)"
        st.code(code, language="python", line_numbers=True)

        element = self.get_delta_from_queue().new_element
        self.assertEqual(element.code.code_text, code)
        self.assertEqual(element.code.show_line_numbers, True)
        self.assertEqual(element.code.language, "python")
