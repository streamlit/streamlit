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

"""Streamlit support for Mermaid diagrams."""

from __future__ import annotations

from typing import TYPE_CHECKING, cast

from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import max_char_sequence

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import Width


class MermaidChartMixin:
    @gather_metrics("mermaid_chart")
    def mermaid_chart(
        self,
        body: str,
        *,
        width: Width = "stretch",
    ) -> DeltaGenerator:
        """Display a Mermaid diagram.

        Mermaid is a diagramming and charting tool that uses text-based
        definitions to create diagrams dynamically. For more information
        about Mermaid syntax, see https://mermaid.js.org/.

        Parameters
        ----------
        body : str
            The Mermaid diagram definition as a string. This uses Mermaid's
            text-based syntax to define flowcharts, sequence diagrams, class
            diagrams, state diagrams, and more.

        width : "stretch", "content", or int
            The width of the element. This can be one of the following:

            - ``"stretch"`` (default): The width of the element matches the
              width of the parent container.
            - ``"content"``: The width of the element matches the width of its
              content, but doesn't exceed the width of the parent container.
            - An integer specifying the width in pixels: The element has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the element matches the width
              of the parent container.

        Examples
        --------
        .. code-block:: python
           :filename: streamlit_app.py

           import streamlit as st

           st.mermaid_chart('''
               graph LR
                   A[Start] --> B{Decision}
                   B -->|Yes| C[OK]
                   B -->|No| D[Cancel]
           ''')

        .. output::
           https://doc-mermaid-chart.streamlit.app/
           height: 300px

        """
        # Dynamically calculate the fence length to be longer than any backtick
        # sequence in the body, ensuring the fence cannot be prematurely closed.
        # This follows the same pattern used in st.write for safe code block wrapping.
        backtick_count = max(4, max_char_sequence(body, "`") + 1)
        backtick_fence = "`" * backtick_count
        mermaid_body = f"{backtick_fence}mermaid\n{body}\n{backtick_fence}"
        return self.dg._markdown(mermaid_body, width=width)

    @property
    def dg(self) -> DeltaGenerator:
        """The associated DeltaGenerator."""
        return cast("DeltaGenerator", self)
