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

from __future__ import annotations

from typing import TYPE_CHECKING

from typing_extensions import assert_type

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.mermaid_chart import MermaidChartMixin

    mermaid_chart = MermaidChartMixin().mermaid_chart

    # =====================================================================
    # st.mermaid_chart return type tests
    # =====================================================================

    # Basic mermaid chart - returns DeltaGenerator
    assert_type(mermaid_chart("graph TD\n    A --> B"), DeltaGenerator)

    # Mermaid chart with flowchart
    assert_type(
        mermaid_chart("""
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[OK]
    B -->|No| D[Cancel]
"""),
        DeltaGenerator,
    )

    # Mermaid chart with sequence diagram
    assert_type(
        mermaid_chart("""
sequenceDiagram
    participant A
    participant B
    A->>B: Hello
    B-->>A: Hi
"""),
        DeltaGenerator,
    )

    # Mermaid chart with pie chart
    assert_type(
        mermaid_chart("""
pie title Pets
    "Dogs" : 50
    "Cats" : 30
"""),
        DeltaGenerator,
    )

    # Mermaid chart with width="stretch"
    assert_type(mermaid_chart("graph TD\n    A --> B", width="stretch"), DeltaGenerator)

    # Mermaid chart with width="content"
    assert_type(mermaid_chart("graph TD\n    A --> B", width="content"), DeltaGenerator)

    # Mermaid chart with pixel width
    assert_type(mermaid_chart("graph TD\n    A --> B", width=100), DeltaGenerator)
