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

from typing import TYPE_CHECKING, cast

from typing_extensions import assert_type

if TYPE_CHECKING:
    import sympy

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.markdown import MarkdownMixin

    markdown = MarkdownMixin().markdown
    caption = MarkdownMixin().caption
    latex = MarkdownMixin().latex
    badge = MarkdownMixin().badge

    # =====================================================================
    # st.markdown return type tests
    # =====================================================================

    # Basic markdown - returns DeltaGenerator
    assert_type(markdown("Hello, world!"), DeltaGenerator)
    assert_type(markdown("**Bold** and *italic*"), DeltaGenerator)
    assert_type(markdown("# Heading"), DeltaGenerator)

    # body is SupportsStr, so non-str values should work
    assert_type(markdown(42), DeltaGenerator)

    # Markdown with unsafe_allow_html parameter
    assert_type(markdown("<p>HTML content</p>", unsafe_allow_html=True), DeltaGenerator)
    assert_type(markdown("Safe text", unsafe_allow_html=False), DeltaGenerator)

    # unsafe_allow_html as positional argument (it's positional-or-keyword)
    assert_type(markdown("<p>HTML</p>", True), DeltaGenerator)

    # Markdown with help parameter (keyword-only)
    assert_type(markdown("Text", help="This is help text"), DeltaGenerator)
    assert_type(markdown("Text", help=None), DeltaGenerator)

    # Markdown with width parameter (keyword-only)
    assert_type(markdown("Text", width="auto"), DeltaGenerator)
    assert_type(markdown("Text", width="content"), DeltaGenerator)
    assert_type(markdown("Text", width="stretch"), DeltaGenerator)
    assert_type(markdown("Text", width=300), DeltaGenerator)

    # Markdown with text_alignment parameter (keyword-only)
    assert_type(markdown("Text", text_alignment="left"), DeltaGenerator)
    assert_type(markdown("Text", text_alignment="center"), DeltaGenerator)
    assert_type(markdown("Text", text_alignment="right"), DeltaGenerator)
    assert_type(markdown("Text", text_alignment="justify"), DeltaGenerator)

    # Markdown with anchors parameter (keyword-only)
    assert_type(markdown("# H", anchors=True), DeltaGenerator)
    assert_type(markdown("# H", anchors=False), DeltaGenerator)

    # Markdown with wrap parameter (keyword-only)
    assert_type(markdown("Text", wrap=True), DeltaGenerator)
    assert_type(markdown("Text", wrap=False), DeltaGenerator)

    # Markdown with all parameters combined
    assert_type(
        markdown(
            "**Important notice**",
            unsafe_allow_html=False,
            help="Additional information",
            width="stretch",
            text_alignment="center",
            anchors=False,
            wrap=False,
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid width value (not "stretch", "content", "auto", or int)
    markdown("Text", width="invalid")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Invalid text_alignment value (not "left", "center", "right", or "justify")
    markdown("Text", text_alignment="start")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Passing help as positional argument (should be keyword-only)
    markdown("Text", False, "help text")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]

    # Invalid anchors value (must be bool)
    markdown("# H", anchors="yes")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Invalid wrap value (must be bool)
    markdown("Text", wrap="yes")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # =====================================================================
    # st.caption wrap
    # =====================================================================

    assert_type(caption("Note", wrap=True), DeltaGenerator)
    assert_type(caption("Note", wrap=False), DeltaGenerator)
    caption("Note", wrap="yes")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # =====================================================================
    # st.latex return type tests
    # =====================================================================

    # Basic usage - returns DeltaGenerator
    assert_type(latex(r"a + b"), DeltaGenerator)

    # body is SupportsStr, so non-str values should work
    assert_type(latex(42), DeltaGenerator)

    # body may be a SymPy expression
    sympy_expr = cast("sympy.Expr", object())
    assert_type(latex(sympy_expr), DeltaGenerator)

    # help parameter (keyword-only)
    assert_type(latex(r"x^2", help="Quadratic"), DeltaGenerator)
    assert_type(latex(r"x^2", help=None), DeltaGenerator)

    # width parameter (keyword-only)
    assert_type(latex(r"x^2", width="content"), DeltaGenerator)
    assert_type(latex(r"x^2", width="stretch"), DeltaGenerator)
    assert_type(latex(r"x^2", width=300), DeltaGenerator)

    # All parameters combined
    assert_type(
        latex(
            r"E = mc^2",
            help="Mass-energy equivalence",
            width="stretch",
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Invalid st.latex usages - should NOT type check
    # =====================================================================

    # Invalid width value (not "stretch", "content", or int)
    latex(r"x^2", width="auto")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    latex(r"x^2", width=None)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Invalid help type
    latex(r"x^2", help=123)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Passing keyword-only parameters as positional
    latex(r"x^2", "help")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]

    # =====================================================================
    # st.badge return type tests
    # =====================================================================

    # Basic usage - returns DeltaGenerator
    assert_type(badge("New"), DeltaGenerator)

    # icon parameter (keyword-only)
    assert_type(badge("New", icon=":material/star:"), DeltaGenerator)
    assert_type(badge("Alert", icon="🚨"), DeltaGenerator)
    assert_type(badge("New", icon=None), DeltaGenerator)

    # color parameter (keyword-only) - all supported literals
    assert_type(badge("New", color="red"), DeltaGenerator)
    assert_type(badge("New", color="orange"), DeltaGenerator)
    assert_type(badge("New", color="yellow"), DeltaGenerator)
    assert_type(badge("New", color="blue"), DeltaGenerator)
    assert_type(badge("New", color="green"), DeltaGenerator)
    assert_type(badge("New", color="violet"), DeltaGenerator)
    assert_type(badge("New", color="gray"), DeltaGenerator)
    assert_type(badge("New", color="grey"), DeltaGenerator)
    assert_type(badge("New", color="primary"), DeltaGenerator)

    # width parameter (keyword-only)
    assert_type(badge("New", width="content"), DeltaGenerator)
    assert_type(badge("New", width="stretch"), DeltaGenerator)
    assert_type(badge("New", width=300), DeltaGenerator)

    # help parameter (keyword-only)
    assert_type(badge("New", help="Help text"), DeltaGenerator)
    assert_type(badge("New", help=None), DeltaGenerator)

    # All parameters combined
    assert_type(
        badge(
            "Success",
            icon=":material/check:",
            color="green",
            width="stretch",
            help="Completed",
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Invalid st.badge usages - should NOT type check
    # =====================================================================

    # label is str, not SupportsStr
    badge(42)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Invalid color value
    badge("New", color="rainbow")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Invalid width value (not "stretch", "content", or int)
    badge("New", width="auto")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Invalid icon type (not str or None)
    badge("New", icon=123)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Passing keyword-only parameters as positional
    badge("New", ":material/star:")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]

    # st.badge does not take wrap
    badge("New", wrap=False)  # type: ignore[call-arg]  # ty: ignore[unknown-argument]
