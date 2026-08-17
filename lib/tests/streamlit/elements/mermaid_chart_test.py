# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""Mermaid chart unit tests."""

from __future__ import annotations

import streamlit as st
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class MermaidChartTest(DeltaGeneratorTestCase):
    """Test ability to render mermaid charts."""

    def test_mermaid_chart(self) -> None:
        """Test that mermaid_chart wraps content in a mermaid code block."""
        st.mermaid_chart("graph TD\n    A --> B")

        element = self.get_delta_from_queue().new_element.markdown
        assert element.body == "````mermaid\ngraph TD\n    A --> B\n````"

    def test_mermaid_chart_multiline(self) -> None:
        """Test mermaid_chart with multiline diagram definition."""
        diagram = """
graph LR
    A[Start] --> B{Decision}
    B -->|Yes| C[OK]
    B -->|No| D[Cancel]
"""
        st.mermaid_chart(diagram)

        element = self.get_delta_from_queue().new_element.markdown
        assert element.body == f"````mermaid\n{diagram}\n````"

    def test_mermaid_chart_empty_body(self) -> None:
        """Test mermaid_chart with empty body still wraps in code block."""
        st.mermaid_chart("")

        element = self.get_delta_from_queue().new_element.markdown
        assert element.body == "````mermaid\n\n````"

    def test_mermaid_chart_with_backticks_in_body(self) -> None:
        """Test mermaid_chart handles body containing backticks safely."""
        # Body with 4 backticks should use 5 backticks for the fence
        diagram = "graph TD\n    A[```code```] --> B[````more````]"
        st.mermaid_chart(diagram)

        element = self.get_delta_from_queue().new_element.markdown
        # Should use 5 backticks since body contains 4 consecutive backticks
        assert element.body == f"`````mermaid\n{diagram}\n`````"

    def test_mermaid_chart_with_triple_backticks(self) -> None:
        """Test mermaid_chart handles body with triple backticks."""
        diagram = "graph TD\n    A[```code```] --> B"
        st.mermaid_chart(diagram)

        element = self.get_delta_from_queue().new_element.markdown
        # Should still use 4 backticks since body only has 3 consecutive
        assert element.body == f"````mermaid\n{diagram}\n````"

    def test_mermaid_chart_default_width(self) -> None:
        """Test that mermaid_chart defaults to stretch width."""
        st.mermaid_chart("graph TD\n    A --> B")

        el = self.get_delta_from_queue().new_element
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.width_config.use_stretch is True

    def test_mermaid_chart_with_width(self) -> None:
        """Test that mermaid_chart passes the width through to the layout config."""
        test_cases = [
            (300, WidthConfigFields.PIXEL_WIDTH.value, "pixel_width", 300),
            ("stretch", WidthConfigFields.USE_STRETCH.value, "use_stretch", True),
            ("content", WidthConfigFields.USE_CONTENT.value, "use_content", True),
        ]

        for width_value, expected_width_spec, field_name, field_value in test_cases:
            with self.subTest(width_value=width_value):
                st.mermaid_chart("graph TD\n    A --> B", width=width_value)

                el = self.get_delta_from_queue().new_element
                # Width is wired through to the markdown layout config.
                assert el.markdown.body == "````mermaid\ngraph TD\n    A --> B\n````"
                assert el.width_config.WhichOneof("width_spec") == expected_width_spec
                assert getattr(el.width_config, field_name) == field_value
