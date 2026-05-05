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

from typing import TYPE_CHECKING, Literal, cast

from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import Width


class MermaidChartMixin:
    @gather_metrics("mermaid_chart")
    def mermaid_chart(
        self,
        body: str,
        *,
        width: Width | Literal["auto"] = "auto",
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

        width : "auto", "stretch", "content", or int
            The width of the element. This can be one of the following:

            - ``"auto"`` (default): The width of the element adapts based on
              the container flex layout. In vertical containers, the element
              uses ``"stretch"`` width. In horizontal containers, the element
              uses ``"content"`` width.
            - ``"stretch"``: The width of the element matches the width of
              the parent container.
            - ``"content"``: The width of the element matches the width of its
              content, but doesn't exceed the width of the parent container.
            - An integer specifying the width in pixels: The element has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the element matches the width
              of the parent container.

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> st.mermaid_chart('''
        ...     graph LR
        ...         A[Start] --> B{Decision}
        ...         B -->|Yes| C[OK]
        ...         B -->|No| D[Cancel]
        ... ''')

        .. output::
           https://doc-mermaid-chart.streamlit.app/
           height: 300px

        """
        # Use four backticks to safely handle diagrams containing triple backticks
        mermaid_body = f"````mermaid\n{body}\n````"
        return self.dg._markdown(mermaid_body, width=width)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
