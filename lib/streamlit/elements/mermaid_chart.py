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

import re
from typing import TYPE_CHECKING, Final, cast

from streamlit.elements.lib.utils import normalize_alt
from streamlit.logger import get_logger
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import max_char_sequence

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import Width

_LOGGER: Final = get_logger(__name__)

# Match Mermaid accessibility directives the same way the frontend
# extractAccessibilityInfo helper does (MermaidChart.tsx): single-line
# accTitle / accDescr, plus multi-line accDescr { ... }.
_ACC_TITLE_LINE: Final = re.compile(r"^\s*accTitle\s*:[^\n]*\n?", re.MULTILINE)
_ACC_DESCR_LINE: Final = re.compile(r"^\s*accDescr\s*:[^\n]*\n?", re.MULTILINE)
_ACC_DESCR_BLOCK: Final = re.compile(r"^\s*accDescr\s*\{[^}]*\}\s*\n?", re.MULTILINE)


def _strip_mermaid_accessibility_directives(body: str) -> tuple[str, bool]:
    """Remove accTitle / accDescr directives from a Mermaid body.

    Returns
    -------
    tuple[str, bool]
        The body with directives removed, and whether any were present.
    """
    stripped, title_count = _ACC_TITLE_LINE.subn("", body)
    stripped, descr_line_count = _ACC_DESCR_LINE.subn("", stripped)
    stripped, descr_block_count = _ACC_DESCR_BLOCK.subn("", stripped)
    removed = (title_count + descr_line_count + descr_block_count) > 0
    return stripped, removed


def _apply_alt_as_acc_title(body: str, normalized_alt: str) -> str:
    """Strip existing accessibility directives and prepend accTitle.

    ``normalized_alt`` must already be stripped plain text with no newlines
    (as returned by ``normalize_alt``).
    """
    stripped, removed = _strip_mermaid_accessibility_directives(body)
    if removed:
        _LOGGER.warning(
            "The Mermaid diagram already sets accessibility directives "
            "(accTitle/accDescr). The alt=%r parameter overrides them "
            "for the accessible name.",
            normalized_alt,
        )
    # Prepend before the diagram type line so the frontend's type fallback
    # still sees the first non-directive line when alt is later omitted.
    return f"accTitle: {normalized_alt}\n{stripped}"


class MermaidChartMixin:
    @gather_metrics("mermaid_chart")
    def mermaid_chart(
        self,
        body: str,
        *,
        width: Width = "stretch",
        alt: str | None = None,
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

        alt : str or None
            A description of the diagram for screen readers and other assistive
            technologies. If this is ``None`` (default), the diagram keeps any
            Mermaid ``accTitle`` / ``accDescr`` directives in ``body``, or falls
            back to a type-derived name such as ``"Mermaid flowchart"``.

            An empty or whitespace-only string is treated the same as ``None``
            and is logged so authors notice the dual meaning of ``alt=""``
            across commands (decorative only on ``st.image`` / ``st.pyplot``).

            When ``alt`` is set, Streamlit applies it as Mermaid ``accTitle``,
            replacing any ``accTitle`` / ``accDescr`` already present in
            ``body``. Describe what the diagram shows rather than repeating
            text that is already visible on the page. This is a short
            description of the chart, not a full text alternative for a dense
            diagram.

        Examples
        --------
        .. code-block:: python
           :filename: streamlit_app.py

           import streamlit as st

           st.mermaid_chart(
               '''
               graph LR
                   A[Start] --> B{Decision}
                   B -->|Yes| C[OK]
                   B -->|No| D[Cancel]
               ''',
               alt="Decision flow from start to cancel",
           )

        .. output::
           https://doc-mermaid-chart.streamlit.app/
           height: 300px

        """
        normalized_alt = normalize_alt(alt)
        if normalized_alt is not None:
            body = _apply_alt_as_acc_title(body, normalized_alt)

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
