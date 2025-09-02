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

"""LaTeX unit test."""

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitInvalidWidthError
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class LatexTest(DeltaGeneratorTestCase):
    """Test ability to marshall latex protos."""

    def test_latex(self):
        st.latex("ax^2 + bx + c = 0")

        c = self.get_delta_from_queue().new_element.markdown
        assert c.body == "$$\nax^2 + bx + c = 0\n$$"

    def test_sympy_expression(self):
        try:
            import sympy

            a, b = sympy.symbols("a b")
            out = a + b
        except Exception:
            out = "a + b"

        st.latex(out)

        c = self.get_delta_from_queue().new_element.markdown
        assert c.body == "$$\na + b\n$$"

    @parameterized.expand(
        [
            (500, WidthConfigFields.PIXEL_WIDTH, 500),
            ("stretch", WidthConfigFields.USE_STRETCH, True),
            ("content", WidthConfigFields.USE_CONTENT, True),
            (None, WidthConfigFields.USE_STRETCH, True),
        ]
    )
    def test_latex_width(self, width_value, expected_field, expected_value):
        """Test LaTeX width configurations."""
        if width_value is None:
            st.latex("ax^2 + bx + c = 0")
        else:
            st.latex("ax^2 + bx + c = 0", width=width_value)
        c = self.get_delta_from_queue().new_element
        assert c.markdown.body == "$$\nax^2 + bx + c = 0\n$$"
        assert c.width_config.WhichOneof("width_spec") == expected_field.value
        if expected_field == WidthConfigFields.PIXEL_WIDTH:
            assert c.width_config.pixel_width == expected_value
        elif expected_field == WidthConfigFields.USE_STRETCH:
            assert c.width_config.use_stretch
        else:
            assert c.width_config.use_content

    @parameterized.expand(
        [
            "invalid",
            -100,
            0,
            100.5,
            None,
        ]
    )
    def test_latex_invalid_width(self, width_value):
        """Test that invalid width values raise an exception."""
        with pytest.raises(StreamlitInvalidWidthError):
            st.latex("ax^2 + bx + c = 0", width=width_value)
