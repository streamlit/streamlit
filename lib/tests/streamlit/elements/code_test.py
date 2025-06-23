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

from __future__ import annotations

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitInvalidHeightError, StreamlitInvalidWidthError
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import (
    HeightConfigFields,
    WidthConfigFields,
)


class CodeElement(DeltaGeneratorTestCase):
    """Test ability to marshall code protos."""

    def test_st_code_default(self):
        """Test st.code() with default language (python)."""
        code = "print('Hello, %s!' % 'Streamlit')"

        st.code(code)
        element = self.get_delta_from_queue().new_element

        assert element.code.code_text == code
        assert not element.code.show_line_numbers
        assert not element.code.wrap_lines
        assert element.code.language == "python"
        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert element.width_config.use_stretch

    def test_st_code_python(self):
        """Test st.code with python language."""
        code = "print('My string = %d' % my_value)"
        st.code(code, language="python")

        element = self.get_delta_from_queue().new_element
        assert element.code.code_text == code
        assert not element.code.show_line_numbers
        assert not element.code.wrap_lines
        assert element.code.language == "python"
        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert element.width_config.use_stretch

    def test_st_code_none(self):
        """Test st.code with None language."""
        code = "print('My string = %d' % my_value)"
        st.code(code, language=None)

        element = self.get_delta_from_queue().new_element
        assert element.code.code_text == code
        assert not element.code.show_line_numbers
        assert not element.code.wrap_lines
        assert element.code.language == "plaintext"
        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert element.width_config.use_stretch

    def test_st_code_none_with_line_numbers(self):
        """Test st.code with None language and line numbers."""
        code = "print('My string = %d' % my_value)"
        st.code(code, language=None, line_numbers=True)

        element = self.get_delta_from_queue().new_element
        assert element.code.code_text == code
        assert element.code.show_line_numbers
        assert not element.code.wrap_lines
        assert element.code.language == "plaintext"
        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert element.width_config.use_stretch

    def test_st_code_python_with_line_numbers(self):
        """Test st.code with Python language and line numbers."""
        code = "print('My string = %d' % my_value)"
        st.code(code, language="python", line_numbers=True)

        element = self.get_delta_from_queue().new_element
        assert element.code.code_text == code
        assert element.code.show_line_numbers
        assert not element.code.wrap_lines
        assert element.code.language == "python"
        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert element.width_config.use_stretch

    def test_st_code_with_wrap_true(self):
        """Test st.code with wrap_lines=True."""
        code = "print('My string = %d' % my_value)"
        st.code(code, wrap_lines=True)

        element = self.get_delta_from_queue().new_element
        assert element.code.code_text == code
        assert not element.code.show_line_numbers
        assert element.code.wrap_lines
        assert element.code.language == "python"
        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert element.width_config.use_stretch

    def test_st_code_with_wrap_false(self):
        """Test st.code with wrap_lines=False."""
        code = "print('My string = %d' % my_value)"
        st.code(code, wrap_lines=False)

        element = self.get_delta_from_queue().new_element
        assert element.code.code_text == code
        assert not element.code.show_line_numbers
        assert not element.code.wrap_lines
        assert element.code.language == "python"
        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert element.width_config.use_stretch

    def test_st_code_with_width_pixels(self):
        """Test st.code with width in pixels."""
        code = "print('My string = %d' % my_value)"
        st.code(code, width=500)

        element = self.get_delta_from_queue().new_element
        assert element.code.code_text == code
        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert element.width_config.pixel_width == 500

    def test_st_code_with_width_stretch(self):
        """Test st.code with stretch width."""
        code = "print('My string = %d' % my_value)"
        st.code(code, width="stretch")

        element = self.get_delta_from_queue().new_element
        assert element.code.code_text == code
        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert element.width_config.use_stretch

    @parameterized.expand(
        [
            "invalid",
            -100,
            0,
            100.5,
            None,
        ]
    )
    def test_st_code_with_invalid_width(self, width):
        """Test st.code with invalid width values."""
        code = "print('My string = %d' % my_value)"

        with pytest.raises(StreamlitInvalidWidthError) as e:
            st.code(code, width=width)
        assert "Invalid width" in str(e.value)

    # Height configuration tests
    def test_st_code_with_height_pixels(self):
        """Test st.code with height in pixels."""
        code = "print('My string = %d' % my_value)"
        st.code(code, height=300)

        element = self.get_delta_from_queue().new_element
        assert element.code.code_text == code
        assert (
            element.height_config.WhichOneof("height_spec")
            == HeightConfigFields.PIXEL_HEIGHT.value
        )
        assert element.height_config.pixel_height == 300

    def test_st_code_with_height_content(self):
        """Test st.code with content height."""
        code = "print('My string = %d' % my_value)"
        st.code(code, height="content")

        element = self.get_delta_from_queue().new_element
        assert element.code.code_text == code
        assert (
            element.height_config.WhichOneof("height_spec")
            == HeightConfigFields.USE_CONTENT.value
        )
        assert element.height_config.use_content

    def test_st_code_with_height_stretch(self):
        """Test st.code with stretch height."""
        code = "print('My string = %d' % my_value)"
        st.code(code, height="stretch")

        element = self.get_delta_from_queue().new_element
        assert element.code.code_text == code
        assert (
            element.height_config.WhichOneof("height_spec")
            == HeightConfigFields.USE_STRETCH.value
        )
        assert element.height_config.use_stretch

    @parameterized.expand(["invalid", -100, 0, 100.5])
    def test_st_code_with_invalid_height(self, height):
        """Test st.code with invalid height values."""
        code = "print('My string = %d' % my_value)"

        with pytest.raises(StreamlitInvalidHeightError) as e:
            st.code(code, height=height)
        assert "Invalid height" in str(e.value)

    def test_st_code_with_leading_whitespace(self):
        """Test st.code with code containing leading whitespace."""
        code = """
            def hello():
                print("Hello, Streamlit!")
"""
        st.code(code)

        element = self.get_delta_from_queue().new_element
        assert (
            element.code.code_text
            == """            def hello():
                print("Hello, Streamlit!")"""
        )
