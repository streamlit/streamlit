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

# Match MermaidChart.tsx's accessible-name sources so a Python-injected marker
# is the only author name when alt is set: Streamlit's parser-ignored
# ``%% stAlt:`` marker, plus Mermaid accTitle / accDescr forms.
_ST_ALT_LINE: Final = re.compile(r"^\s*%%\s*stAlt\s*:[^\n]*\n?", re.MULTILINE)
_ACC_TITLE_LINE: Final = re.compile(r"^\s*accTitle\s*:[^\n]*\n?", re.MULTILINE)
_ACC_DESCR_LINE: Final = re.compile(r"^\s*accDescr\s*:[^\n]*\n?", re.MULTILINE)
_ACC_DESCR_BLOCK: Final = re.compile(r"^\s*accDescr\s*\{[^}]*\}\s*\n?", re.MULTILINE)

# Marker written into the diagram source when ``alt`` is set. Mermaid treats
# ``%%`` lines as comments in every grammar; ``accTitle`` is not safe for
# mindmap / kanban / block-beta and similar types.
_ST_ALT_PREFIX: Final = "%% stAlt: "


def _strip_mermaid_accessibility_directives(body: str) -> tuple[str, list[str]]:
    """Remove stAlt / accTitle / accDescr directives.

    Returns the cleaned body and each removed directive (whitespace-trimmed),
    so override warnings can report exactly what was stripped.
    """
    removed: list[str] = []

    def _sub_collecting(pattern: re.Pattern[str], text: str) -> str:
        def _replacer(match: re.Match[str]) -> str:
            removed.append(match.group(0).strip())
            return ""

        return pattern.sub(_replacer, text)

    stripped = _sub_collecting(_ST_ALT_LINE, body)
    stripped = _sub_collecting(_ACC_TITLE_LINE, stripped)
    stripped = _sub_collecting(_ACC_DESCR_LINE, stripped)
    stripped = _sub_collecting(_ACC_DESCR_BLOCK, stripped)
    return stripped, removed


def _skip_mermaid_preamble(lines: list[str]) -> int:
    """Index of the diagram-type line after blank, ``%%``, and YAML frontmatter.

    Mermaid strips comments, ``%%{init}%%`` directives (including multiline),
    and ``---`` frontmatter before detecting the diagram type. The ``%% stAlt:``
    marker is inserted just before that type line.
    """
    i = 0
    n = len(lines)
    while i < n:
        stripped = lines[i].strip()
        if not stripped:
            i += 1
            continue
        if stripped.startswith("%%{"):
            # Single- or multi-line init/config directive until }%%.
            if "}%%" not in stripped:
                i += 1
                while i < n and "}%%" not in lines[i]:
                    i += 1
            if i < n:
                i += 1
            continue
        if stripped.startswith("%%"):
            i += 1
            continue
        if stripped == "---":
            i += 1
            while i < n and lines[i].strip() != "---":
                i += 1
            if i < n:
                i += 1  # closing ---
            continue
        break
    return i


def _apply_alt_marker(body: str, normalized_alt: str) -> str:
    """Strip existing accessibility directives and insert ``%% stAlt:``.

    Uses a Mermaid comment marker rather than ``accTitle`` so every diagram
    grammar Streamlit ships (including mindmap, kanban, block-beta) keeps
    rendering. The frontend maps ``%% stAlt:`` to the ``<img>`` accessible name.

    ``normalized_alt`` comes from ``normalize_alt`` (outer-stripped). Interior
    whitespace is collapsed so a multi-line ``alt`` cannot inject extra lines.
    """
    stripped, removed = _strip_mermaid_accessibility_directives(body)
    single_line_alt = " ".join(normalized_alt.split())
    if removed:
        _LOGGER.warning(
            "The Mermaid diagram already sets accessibility directives %r. "
            "The alt=%r parameter overrides them for the accessible name.",
            removed,
            single_line_alt,
            stack_info=True,
        )

    lines = stripped.splitlines(keepends=True)
    insert_at = _skip_mermaid_preamble(lines)
    if insert_at > 0 and not lines[insert_at - 1].endswith("\n"):
        lines[insert_at - 1] += "\n"
    lines.insert(insert_at, f"{_ST_ALT_PREFIX}{single_line_alt}\n")
    return "".join(lines)


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
            A short, plain-text accessible name for the diagram. If this is
            ``None`` (default), the diagram keeps any Mermaid ``accTitle`` /
            ``accDescr`` directives in ``body``, or falls back to a
            type-derived name such as ``"Mermaid flowchart"``.

            An empty or whitespace-only string is treated the same as ``None``
            and is logged so authors notice the dual meaning of ``alt=""``
            across commands (decorative only on ``st.image`` / ``st.pyplot``).

            When ``alt`` is set, Streamlit inserts it into ``body`` as a
            Mermaid comment (``%% stAlt: …``, visible via Copy Source) so every
            diagram type keeps rendering, and replaces any ``accTitle`` /
            ``accDescr`` already present. Describe what the diagram shows
            rather than repeating text that is already visible on the page.
            This is a short name, not a full text alternative for a dense
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
            body = _apply_alt_marker(body, normalized_alt)

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
