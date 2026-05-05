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
