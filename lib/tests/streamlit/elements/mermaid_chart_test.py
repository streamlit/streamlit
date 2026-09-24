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

from unittest.mock import patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.mermaid_chart import (
    _apply_alt_marker,
    _find_author_accessibility_directives,
    _strip_prior_st_alt_markers,
)
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

    def test_mermaid_chart_with_alt(self) -> None:
        """Non-blank alt is injected as a %% stAlt comment before the diagram type."""
        st.mermaid_chart("graph TD\n    A --> B", alt="Decision flow")

        element = self.get_delta_from_queue().new_element.markdown
        assert element.body == (
            "````mermaid\n%% stAlt: Decision flow\ngraph TD\n    A --> B\n````"
        )

    def test_mermaid_chart_alt_strips_whitespace(self) -> None:
        """Leading and trailing whitespace is stripped from alt."""
        st.mermaid_chart("graph TD\n    A --> B", alt="  Decision flow  ")

        element = self.get_delta_from_queue().new_element.markdown
        assert element.body == (
            "````mermaid\n%% stAlt: Decision flow\ngraph TD\n    A --> B\n````"
        )

    @parameterized.expand([("",), ("   ",), ("\t\n",)])
    def test_mermaid_chart_blank_alt_is_noop(self, blank_alt: str) -> None:
        """Empty or whitespace-only alt leaves the body unchanged."""
        diagram = "graph TD\n    A --> B"
        st.mermaid_chart(diagram, alt=blank_alt)

        element = self.get_delta_from_queue().new_element.markdown
        assert element.body == f"````mermaid\n{diagram}\n````"
        assert "%% stAlt:" not in element.body
        assert "accTitle:" not in element.body

    def test_mermaid_chart_alt_none_is_noop(self) -> None:
        """Explicit alt=None leaves the body unchanged."""
        diagram = "graph TD\n    A --> B"
        st.mermaid_chart(diagram, alt=None)

        element = self.get_delta_from_queue().new_element.markdown
        assert element.body == f"````mermaid\n{diagram}\n````"

    def test_mermaid_chart_alt_overrides_existing_directives(self) -> None:
        """alt overrides author directives for the accessible name; source keeps them."""
        diagram = (
            "flowchart TD\naccTitle: Old title\naccDescr: Old description\nA --> B"
        )
        with patch("streamlit.elements.mermaid_chart._LOGGER.warning") as mock_warning:
            st.mermaid_chart(diagram, alt="Streamlit alt")

        element = self.get_delta_from_queue().new_element.markdown
        assert "%% stAlt: Streamlit alt\n" in element.body
        # Author directives stay in the source; FE prefers %% stAlt: for the name.
        assert "accTitle: Old title" in element.body
        assert "accDescr: Old description" in element.body
        mock_warning.assert_called_once()
        assert mock_warning.call_args.kwargs.get("stack_info") is True
        assert "Old title" in str(mock_warning.call_args)

    def test_mermaid_chart_alt_preserves_adversarial_text(self) -> None:
        """Adversarial plain text is preserved literally inside %% stAlt."""
        adversarial = 'Title with "quotes" & <tags> and `ticks`'
        st.mermaid_chart("graph TD\n    A --> B", alt=adversarial)

        element = self.get_delta_from_queue().new_element.markdown
        assert f"%% stAlt: {adversarial}\n" in element.body

    def test_mermaid_chart_alt_collapses_multiline(self) -> None:
        """Interior newlines in alt become spaces so Mermaid stays one comment."""
        st.mermaid_chart("graph TD\n    A --> B", alt="Revenue chart\nby quarter")

        element = self.get_delta_from_queue().new_element.markdown
        assert element.body == (
            "````mermaid\n%% stAlt: Revenue chart by quarter\ngraph TD\n    A --> B\n````"
        )

    def test_mermaid_chart_alt_one_line_body(self) -> None:
        """%% stAlt is inserted on its own line even when body has no newlines."""
        st.mermaid_chart("graph TD; A-->B", alt="One line flow")

        element = self.get_delta_from_queue().new_element.markdown
        assert element.body == (
            "````mermaid\n%% stAlt: One line flow\ngraph TD; A-->B\n````"
        )

    def test_mermaid_chart_alt_works_on_mindmap(self) -> None:
        """mindmap rejects accTitle; %% stAlt must still be injected without rewriting nodes."""
        diagram = "mindmap\n    root((App))\n        Leaf"
        st.mermaid_chart(diagram, alt="App taxonomy")

        element = self.get_delta_from_queue().new_element.markdown
        assert element.body == (
            "````mermaid\n%% stAlt: App taxonomy\nmindmap\n    root((App))\n        Leaf\n````"
        )
        assert "accTitle:" not in element.body

    def test_mermaid_chart_blank_alt_preserves_existing_acc_title(self) -> None:
        """Empty alt is non-decorative: author accTitle stays in the marshalled body."""
        diagram = "flowchart TD\naccTitle: Author title\nA --> B"
        st.mermaid_chart(diagram, alt="")

        element = self.get_delta_from_queue().new_element.markdown
        assert element.body == f"````mermaid\n{diagram}\n````"
        assert "accTitle: Author title" in element.body
        assert "%% stAlt:" not in element.body

    def test_mermaid_chart_alt_with_backticks_lengthens_fence(self) -> None:
        """Fence length is computed after injection so backticks in alt cannot close early."""
        st.mermaid_chart("graph TD\nA-->B", alt="Uses ```` four ticks")

        element = self.get_delta_from_queue().new_element.markdown
        assert element.body.startswith("`````mermaid\n")
        assert "%% stAlt: Uses ```` four ticks\n" in element.body
        assert element.body.endswith("\n`````")


@pytest.mark.parametrize(
    ("body", "expected"),
    [
        ("flowchart TD\nA --> B", []),
        (
            "flowchart TD\naccTitle: Checkout\nA --> B",
            ["accTitle: Checkout"],
        ),
        (
            "flowchart TD\naccDescr: Steps\nA --> B",
            ["accDescr: Steps"],
        ),
        (
            "flowchart TD\naccTitle: Title\naccDescr: Desc\nA --> B",
            ["accTitle: Title", "accDescr: Desc"],
        ),
        (
            "flowchart TD\naccDescr {\n  First line\n  Second line\n}\nA --> B",
            ["accDescr {\n  First line\n  Second line\n}"],
        ),
        # Indented content / frontmatter values are not directives.
        (
            "mindmap\n    root((App))\n        accTitle: Sales\n        Other",
            [],
        ),
        (
            "---\ntitle: Meta\naccTitle: NotADirective\n---\nflowchart TD\nA --> B",
            [],
        ),
        (
            'flowchart TD\n    A["accTitle: Label"]\n    A --> B',
            [],
        ),
    ],
)
def test_find_author_accessibility_directives(body: str, expected: list[str]) -> None:
    """Detect top-level author accTitle / accDescr; ignore content-shaped lines."""
    assert _find_author_accessibility_directives(body) == expected


def test_strip_prior_st_alt_markers_only() -> None:
    """Only prior %% stAlt: markers are removed from the source."""
    body = "%% stAlt: Old\nflowchart TD\naccTitle: Keep\nA --> B"
    assert _strip_prior_st_alt_markers(body) == "flowchart TD\naccTitle: Keep\nA --> B"


def test_apply_alt_marker_inserts_before_diagram_type() -> None:
    """%% stAlt is inserted before the diagram type; author directives stay."""
    body = "flowchart TD\naccTitle: Old\nA --> B"
    with patch("streamlit.elements.mermaid_chart._LOGGER.warning") as mock_warning:
        result = _apply_alt_marker(body, "New title")

    assert result == "%% stAlt: New title\nflowchart TD\naccTitle: Old\nA --> B"
    mock_warning.assert_called_once()
    assert mock_warning.call_args.kwargs.get("stack_info") is True


def test_apply_alt_marker_no_warning_when_replacing_only_st_alt() -> None:
    """Replacing a prior %% stAlt: marker is silent (not an author directive)."""
    with patch("streamlit.elements.mermaid_chart._LOGGER.warning") as mock_warning:
        result = _apply_alt_marker("%% stAlt: Old\nflowchart TD\nA --> B", "New")

    assert result == "%% stAlt: New\nflowchart TD\nA --> B"
    mock_warning.assert_not_called()


def test_apply_alt_marker_no_warning_without_directives() -> None:
    """No override warning when the body has no accessibility directives."""
    with patch("streamlit.elements.mermaid_chart._LOGGER.warning") as mock_warning:
        result = _apply_alt_marker("flowchart TD\nA --> B", "New title")

    assert result == "%% stAlt: New title\nflowchart TD\nA --> B"
    mock_warning.assert_not_called()


def test_apply_alt_marker_skips_leading_blank_lines() -> None:
    """Leading blank lines are preserved; %% stAlt still precedes the type."""
    result = _apply_alt_marker("\ngraph TD\n    A --> B", "Decision flow")
    assert result == "\n%% stAlt: Decision flow\ngraph TD\n    A --> B"


def test_apply_alt_marker_preserves_frontmatter_and_labels() -> None:
    """YAML frontmatter and flowchart content are unchanged when alt is applied."""
    body = (
        "---\ntitle: Meta\naccTitle: NotADirective\n---\n"
        "flowchart TD\n"
        '    A["accTitle: Label"]\n'
        "    A --> B"
    )
    with patch("streamlit.elements.mermaid_chart._LOGGER.warning") as mock_warning:
        result = _apply_alt_marker(body, "Named")
    assert result.startswith("---\ntitle: Meta\naccTitle: NotADirective\n---\n")
    assert 'A["accTitle: Label"]' in result
    assert "%% stAlt: Named\n" in result
    mock_warning.assert_not_called()


@pytest.mark.parametrize(
    ("body", "expected"),
    [
        (
            "%% comment\ngraph TD\n    A --> B",
            "%% comment\n%% stAlt: Named\ngraph TD\n    A --> B",
        ),
        (
            "%%{init: {'theme': 'dark'}}%%\ngraph TD\n    A --> B",
            "%%{init: {'theme': 'dark'}}%%\n%% stAlt: Named\ngraph TD\n    A --> B",
        ),
        (
            "%%{\ninit: {'theme': 'dark'}\n}%%\ngraph TD\n    A --> B",
            "%%{\ninit: {'theme': 'dark'}\n}%%\n%% stAlt: Named\ngraph TD\n    A --> B",
        ),
        (
            "---\ntitle: Meta\n---\ngraph TD\n    A --> B",
            "---\ntitle: Meta\n---\n%% stAlt: Named\ngraph TD\n    A --> B",
        ),
        (
            "%% lead\n---\ntitle: Meta\n---\n%% more\ngraph TD\n    A --> B",
            "%% lead\n---\ntitle: Meta\n---\n%% more\n%% stAlt: Named\ngraph TD\n    A --> B",
        ),
    ],
)
def test_apply_alt_marker_skips_preamble(body: str, expected: str) -> None:
    """%% stAlt precedes the diagram type after comments, init, and frontmatter."""
    assert _apply_alt_marker(body, "Named") == expected


def test_apply_alt_marker_one_line_body() -> None:
    """One-line bodies get %% stAlt on a preceding line."""
    assert (
        _apply_alt_marker("graph TD; A-->B", "One line")
        == "%% stAlt: One line\ngraph TD; A-->B"
    )


def test_apply_alt_marker_collapses_multiline_alt() -> None:
    """Newlines inside alt are collapsed before injection."""
    assert (
        _apply_alt_marker("graph TD\nA-->B", "Line one\nLine two")
        == "%% stAlt: Line one Line two\ngraph TD\nA-->B"
    )


def test_apply_alt_marker_inserts_comment_not_acc_title_on_mindmap() -> None:
    """mindmap gets %% stAlt, not accTitle (which would become a node)."""
    assert (
        _apply_alt_marker("mindmap\n    root((App))", "Taxonomy")
        == "%% stAlt: Taxonomy\nmindmap\n    root((App))"
    )


@pytest.mark.parametrize(
    "body",
    [
        "mindmap\n    root((App))\n        accTitle: Sales\n        Other",
        "kanban\n  Column1\n    accTitle: Sales",
        "block-beta\n  columns 1\n  accTitle: Sales",
    ],
)
def test_apply_alt_marker_preserves_acc_title_shaped_content(body: str) -> None:
    """accTitle-shaped content survives; no false override warning."""
    with patch("streamlit.elements.mermaid_chart._LOGGER.warning") as mock_warning:
        result = _apply_alt_marker(body, "App taxonomy")
    assert "%% stAlt: App taxonomy\n" in result
    assert "accTitle: Sales" in result
    mock_warning.assert_not_called()
