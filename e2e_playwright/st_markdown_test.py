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

import re

import pytest
from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    expand_sidebar,
    expect_help_tooltip,
    get_caption,
    get_element_by_key,
    get_markdown,
    tab_until_focused,
    wait_for_all_images_to_be_loaded,
)


def test_different_markdown_elements_in_one_block_displayed(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the block containing a mixture of different markdown elements is
    displayed correctly.
    """

    mixed_markdown_element = (
        get_element_by_key(themed_app, "mixed_markdown")
        .get_by_test_id("stMarkdown")
        .first
    )

    expect(mixed_markdown_element).to_be_visible()
    mixed_markdown_element.scroll_into_view_if_needed()

    assert_snapshot(
        mixed_markdown_element,
        name="st_markdown-many_elements_in_one_block",
        image_threshold=0.001,
    )


def test_displays_individual_markdowns(app: Page):
    """Verifies the correct text content of markdown elements."""

    # get markdown elements in main app view, not sidebar
    markdown_elements = app.get_by_test_id("stMain").get_by_test_id("stMarkdown")

    # Assert the text content of each markdown element
    text = [
        "This markdown is awesome! 😎",
        "This <b>HTML tag</b> is escaped!",
        "info This HTML tag is not escaped!",
        "[text]",
        "link",
        "[][]",
        "Col1Col2SomeData",
        "Bold text within blue background",
        "Italic text within red background",
        "Link within rainbow background",
        "LaTeX math within green background: ax2+bx+c=0ax^2 + bx + c = 0ax2+bx+c=0",
    ]

    for i in range(len(text)):
        expect(markdown_elements.nth(i)).to_have_text(text[i])

    # Check that the style contains the correct background color
    blue_background = markdown_elements.nth(7).locator("span").first
    red_background = markdown_elements.nth(8).locator("span").first
    rainbow_background = markdown_elements.nth(9).locator("span").first
    green_background = markdown_elements.nth(10).locator("span").first

    expect(blue_background).to_have_css("background-color", "rgba(28, 131, 255, 0.1)")
    expect(red_background).to_have_css("background-color", "rgba(255, 43, 43, 0.1)")
    expect(rainbow_background).to_have_css(
        "background-image",
        "linear-gradient(to right, rgba(255, 43, 43, 0.1), rgba(255, 164, 33, 0.1), "
        "rgba(255, 255, 18, 0.1), rgba(33, 195, 84, 0.1), rgba(28, 131, 255, 0.1), "
        "rgba(154, 93, 255, 0.1), rgba(88, 63, 132, 0.1))",
    )
    expect(green_background).to_have_css("background-color", "rgba(33, 195, 84, 0.1)")

    # Additional checks for specific elements like links
    expect(markdown_elements.nth(3).locator("a")).to_have_count(0)
    expect(markdown_elements.nth(4).locator("a")).to_have_attribute("href", "href")


# Headers in markdown tests


def test_markdown_displays_long_headers_above_other_elements(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Displays long headers above other elements in the markdown block."""

    long_header = (
        app.get_by_test_id("stVerticalBlock").get_by_test_id("stVerticalBlock").nth(0)
    )

    assert_snapshot(long_header, name="st_markdown-header_long_above_markdown_table")


def _get_container_of_text(app: Page, text: str) -> Locator:
    """Get the parent container in which the passed text is located.
    The tests are written in a way that the text and the headers are put
    into the same container.
    """

    # take the 2nd match because the first would be the most outer block
    return (
        app.get_by_test_id("stVerticalBlock")
        .filter(has=app.get_by_text(text, exact=True))
        .nth(1)
    )


def test_header_attributes(app: Page):
    # Test that headers with ids exist
    h1 = app.locator("h1#header-header1")
    h2 = app.locator("h2#header-header2")
    h3 = app.locator("h3#header-header3")
    h4 = app.locator("h4#header-header4")
    h5 = app.locator("h5#header-header5")
    h6 = app.locator("h6#header-header6")

    expect(h1).to_have_count(7)
    expect(h2).to_have_count(7)
    expect(h3).to_have_count(7)
    expect(h4).to_have_count(7)
    expect(h5).to_have_count(7)
    expect(h6).to_have_count(7)


def test_match_snapshot_for_headers_in_sidebar(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that headers in sidebar are rendered correctly."""
    sidebar = expand_sidebar(app)
    assert_snapshot(sidebar, name="st_markdown-headers_in_sidebar")


def test_match_snapshot_for_headers_in_single_markdown_command(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that snapshot of headers joined in a single string and written in a single
    st.markdown command is correct.
    """
    container = _get_container_of_text(app, "Headers in single st.markdown command")
    assert_snapshot(container, name="st_markdown-headers_joined_in_single_command")


def test_match_snapshot_for_headers_in_multiple_markdown_commands(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that snapshot of headers written in multiple st.markdown commands is correct."""
    container = _get_container_of_text(app, "Headers in multiple st.markdown command")
    assert_snapshot(container, name="st_markdown-headers_via_multiple_commands")


def test_match_snapshot_for_columns(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the st.markdown columns snapshot is correct."""
    container = _get_container_of_text(app, "Headers in columns")
    assert_snapshot(container, name="st_markdown-headers_in_columns")


def test_match_snapshot_for_columns_with_elements_above(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the st.markdown columns with elements above snapshot is correct."""
    container = _get_container_of_text(
        app, "Headers in columns with other elements above"
    )
    assert_snapshot(container, name="st_markdown-headers_in_labeled_columns")


def test_match_snapshot_for_column_beside_widget(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the st.markdown columns beside widget snapshot is correct."""
    # Wait for the labels to be visible, or else the snapshot tests will flake
    expect(app.get_by_text("This is a label")).to_have_count(2)

    container = _get_container_of_text(app, "Headers in column beside widget")
    assert_snapshot(container, name="st_markdown-headers_beside_widget")


def test_match_snapshot_for_headers_bold_text(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the headers with bold markdown syntex is correct."""
    container = _get_container_of_text(app, "Headers with bold syntax")
    assert_snapshot(container, name="st_markdown-headers_bold_syntax")

    # H1 defaults to extra bold
    h1 = app.locator("h1#bold-header1")
    expect(h1.locator("strong").first).to_have_css("font-weight", "700")

    header_ids = [
        "h2#bold-header2",
        "h3#bold-header3",
        "h4#bold-header4",
        "h5#bold-header5",
        "h6#bold-header6",
    ]
    for header_id in header_ids:
        header = app.locator(header_id)
        expect(header.locator("strong").first).to_have_css("font-weight", "600")


def test_help_tooltip_works(app: Page):
    """Test that the help tooltip is displayed on hover."""
    # Get the stMarkdown element (parent) that contains both the markdown content and help tooltip.
    # The tooltip is rendered as a sibling to stMarkdownContainer inside stMarkdown.
    # We can't use get_markdown() here because it returns stMarkdownContainer which doesn't contain the tooltip.
    markdown_with_help = app.get_by_test_id("stMarkdown").filter(
        has_text="This markdown is awesome!"
    )
    expect(markdown_with_help).to_be_visible()
    expect_help_tooltip(app, markdown_with_help, "This is a help tooltip!")


def test_latex_elements(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that LaTeX elements are rendered correctly.

    Uses themed_app for formula rendering which may have theme-dependent colors.
    Width tests are in test_latex_width_examples.
    """
    latex_elements = get_element_by_key(themed_app, "latex_elements").get_by_test_id(
        "stMarkdown"
    )
    expect(latex_elements).to_have_count(8)

    assert_snapshot(latex_elements.nth(0), name="st_latex-latex")
    expect(latex_elements.nth(0)).to_contain_text("LATEX")

    assert_snapshot(latex_elements.nth(1), name="st_latex-formula")

    expect(latex_elements.nth(2)).to_contain_text("a + b")
    assert_snapshot(latex_elements.nth(2), name="st_latex-sympy")

    expect(latex_elements.nth(3)).to_contain_text("this is a very long formula")
    assert_snapshot(latex_elements.nth(3), name="st_latex-long")

    expect(latex_elements.nth(4)).to_contain_text("this is a very long formula")
    assert_snapshot(latex_elements.nth(4), name="st_latex-long-help")


def test_latex_width_examples(app: Page, assert_snapshot: ImageCompareFunction):
    """Test LaTeX elements with different width configurations.

    Uses single-theme (app) fixture since width/layout behavior is theme-independent.
    """
    latex_elements = get_element_by_key(app, "latex_elements").get_by_test_id(
        "stMarkdown"
    )

    assert_snapshot(latex_elements.nth(5), name="st_latex-width_pixels")
    assert_snapshot(latex_elements.nth(6), name="st_latex-width_stretch")
    assert_snapshot(latex_elements.nth(7), name="st_latex-width_content")


def test_badge_elements(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that badge elements are displayed correctly."""
    badge_container = get_element_by_key(themed_app, "badge_elements")

    # Check that the badge texts are displayed correctly
    expect(badge_container).to_contain_text("Simple badge")
    expect(badge_container).to_contain_text("Green badge with emoji")
    expect(badge_container).to_contain_text("Red badge with material icon")
    expect(badge_container).to_contain_text("🚀")
    expect(badge_container).to_contain_text("This is a very long badge")
    expect(badge_container).to_contain_text("Blue markdown badge")
    expect(badge_container).to_contain_text("🌱 Green markdown badge")
    expect(badge_container).to_contain_text("Yellow markdown badge")

    # Take a snapshot of all badges together
    assert_snapshot(badge_container, name="st_badge-examples")


def test_large_image_in_markdown(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that large images in markdown are displayed correctly with max width 100%."""
    markdown_element = get_markdown(
        app, "Images in markdown should stay inside the container width"
    )
    image_element = markdown_element.locator("img")

    image_element.scroll_into_view_if_needed()
    expect(image_element).to_be_visible()
    expect(image_element).to_have_css("max-width", "100%")
    # Wait for the image to load:
    wait_for_all_images_to_be_loaded(app)
    assert_snapshot(markdown_element, name="st_markdown-with_large_image")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stMarkdown")


@pytest.mark.app_hash("bold-header1")
def test_anchor_scrolling(app: Page):
    """Test that anchor scrolling works correctly."""
    # The app fixture navigates with the requested hash fragment (#bold-header1),
    # which should scroll to the header.
    expect(app.get_by_text("Bold header1")).to_be_in_viewport()


def test_markdown_heading_anchor_icon_is_keyboard_focusable_and_visible(app: Page):
    """Test that st.markdown headings expose a keyboard-focusable anchor icon.

    The anchor icon is hidden by default to reduce visual noise, but it must be
    reachable by tabbing. When focused, it should become visible and be
    activatable using the keyboard.
    """
    heading = app.locator("h1#bold-header1")
    heading.scroll_into_view_if_needed()

    link = heading.get_by_role("link", name="Link to heading")
    expect(link).to_have_attribute("href", "#bold-header1")
    expect(link).to_have_css("opacity", "0")

    # Start tabbing from a deterministic, nearby focusable element that appears before
    # this heading in the document.
    app.get_by_test_id("stMainBlockContainer").get_by_role(
        "textbox", name="This is a label"
    ).click()
    tab_until_focused(app, link)

    expect(link).to_be_focused()
    expect(link).to_have_css("opacity", "1")

    app.keyboard.press("Enter")
    expect(app).to_have_url(re.compile(r".*#bold-header1"))


@pytest.mark.performance
def test_markdown_rendering_performance(app: Page):
    """Test that the performance of st.markdown and st.text."""
    app.get_by_text("Run element").click()
    # This is currently very slow, hence the need for a performance test
    expect(app.get_by_text("DONE")).to_be_attached(timeout=15000)

    app.get_by_text("st.text").click()
    expect(app.get_by_text("DONE")).not_to_be_attached()

    app.get_by_text("Run element").click()
    expect(app.get_by_text("DONE")).to_be_attached()


def test_markdown_width_examples(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that markdown elements with different width configurations are displayed correctly.

    Uses single-theme (app) fixture since width/layout behavior is theme-independent.
    """
    # Test content width
    markdown_content = get_markdown(app, r"Content width:")
    markdown_content.scroll_into_view_if_needed()
    assert_snapshot(markdown_content, name="st_markdown-width_content")

    # Test fixed width (200px)
    markdown_200px = get_markdown(app, r"Fixed width \(200px\):")
    markdown_200px.scroll_into_view_if_needed()
    assert_snapshot(markdown_200px, name="st_markdown-width_200px")

    # Test stretch width
    markdown_stretch = get_markdown(app, r"Stretch width:")
    markdown_stretch.scroll_into_view_if_needed()
    assert_snapshot(markdown_stretch, name="st_markdown-width_stretch")


def test_caption_width_examples(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that caption elements with different width configurations are displayed correctly.

    Uses single-theme (app) fixture since width/layout behavior is theme-independent.
    """
    # Test content width
    caption_content = get_caption(app, r"caption with content-based width")
    caption_content.scroll_into_view_if_needed()
    assert_snapshot(caption_content, name="st_caption-width_content")

    # Test fixed width (300px)
    caption_300px = get_caption(app, r"caption with a fixed width of 300 pixels")
    caption_300px.scroll_into_view_if_needed()
    assert_snapshot(caption_300px, name="st_caption-width_300px")

    # Test stretch width
    caption_stretch = get_caption(app, r"caption that stretches to fill")
    caption_stretch.scroll_into_view_if_needed()
    assert_snapshot(caption_stretch, name="st_caption-width_stretch")


def test_badge_width_examples(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that badge elements with different width configurations are displayed correctly.

    Uses single-theme (app) fixture since width/layout behavior is theme-independent.
    """
    # Test content width (default)
    badge_content = get_markdown(app, r"Default badge")
    badge_content.scroll_into_view_if_needed()
    assert_snapshot(badge_content, name="st_badge-width_content")

    # Test fixed width (100px)
    badge_100px = get_markdown(app, r"Fixed 100px badge")
    badge_100px.scroll_into_view_if_needed()
    assert_snapshot(badge_100px, name="st_badge-width_100px")

    # Test stretch width
    badge_stretch = get_markdown(app, r"Stretch badge")
    badge_stretch.scroll_into_view_if_needed()
    assert_snapshot(badge_stretch, name="st_badge-width_stretch")


def test_unsafe_allow_html(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that unsafe allow html works correctly."""
    markdown_element = get_markdown(app, "info This HTML tag is not escaped!")
    assert_snapshot(markdown_element, name="st_markdown-unsafe_allow_html")


def test_long_word_in_container(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that a long word in a container is displayed correctly (doesn't overflow the container)."""
    container = get_element_by_key(app, "long_word")
    expect(container).to_be_visible()
    assert_snapshot(container, name="st_markdown-long_word_in_container")


@pytest.mark.parametrize(
    ("alignment_value", "text_content"),
    [
        ("left", "Left aligned text is the default behavior"),
        ("center", "Center aligned text with some content"),
        ("right", "Right aligned text content demonstrates"),
        ("justify", "Justified text alignment"),
    ],
)
def test_markdown_text_alignment(
    app: Page,
    assert_snapshot: ImageCompareFunction,
    alignment_value: str,
    text_content: str,
):
    """Test st.markdown text alignment for all alignment types.

    This test verifies that text, tables, and nested lists all respond correctly
    to text-align CSS for each alignment value.
    """
    markdown_element = get_markdown(app, text_content)
    markdown_element.scroll_into_view_if_needed()

    assert_snapshot(
        markdown_element, name=f"st_markdown-text_alignment_{alignment_value}"
    )


def test_markdown_short_text_alignment_with_help(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test short centered markdown with help tooltip to verify icon alignment."""
    short_centered = get_markdown(app, "Short text")
    short_centered.scroll_into_view_if_needed()

    expect_help_tooltip(app, short_centered, "This is a help tooltip!")

    assert_snapshot(short_centered, name="st_markdown-short_text_center_with_help")


def test_caption_text_alignment(app: Page, assert_snapshot: ImageCompareFunction):
    """Test st.caption with text alignment."""
    # Test center alignment
    caption_center = get_caption(app, "Centered caption text")
    caption_center.scroll_into_view_if_needed()
    assert_snapshot(caption_center, name="st_caption-text_alignment_center")

    # Test right alignment
    caption_right = get_caption(app, "Right aligned caption")
    caption_right.scroll_into_view_if_needed()
    assert_snapshot(caption_right, name="st_caption-text_alignment_right")

    # Test justify alignment
    caption_justify = get_caption(app, "Justified caption text")
    caption_justify.scroll_into_view_if_needed()
    assert_snapshot(caption_justify, name="st_caption-text_alignment_justify")


@pytest.mark.parametrize(
    ("element_key", "expected_text", "element_test_id"),
    [
        (
            "markdown_newlines_tooltip",
            "Markdown with newlines in tooltip",
            "stMarkdownContainer",
        ),
        (
            "caption_newlines_tooltip",
            "Caption with newlines in tooltip",
            "stCaptionContainer",
        ),
        (
            "markdown_center_newlines_tooltip",
            "Center aligned with newlines in tooltip",
            "stMarkdownContainer",
        ),
        (
            "markdown_spaces_around_newlines",
            "Markdown with spaces around newlines",
            "stMarkdownContainer",
        ),
        (
            "markdown_bracket_in_tooltip",
            "Markdown with closing bracket in tooltip",
            "stMarkdownContainer",
        ),
    ],
)
def test_tooltip_with_newlines_gh_13339(
    app: Page,
    element_key: str,
    expected_text: str,
    element_test_id: str,
):
    r"""Test that tooltips with newlines render correctly inside the tooltip (gh-13339).

    This regression test verifies that when help text contains double newlines (\n\n),
    the text renders inside the tooltip box with proper paragraph breaks rather than
    outside of it.

    The bug caused the directive syntax to break, leaking the help text into the
    markdown container itself instead of keeping it in the tooltip popup.
    """
    element_container = get_element_by_key(app, element_key)
    element_container.scroll_into_view_if_needed()
    expect(element_container).to_be_visible()

    # Get the actual markdown/caption element inside the container
    element = element_container.get_by_test_id(element_test_id)

    # CRITICAL: Verify the help text is NOT leaked into the element content
    # In the bug condition, "Line 2" and "Line 3" would appear in the visible text
    expect(element).to_have_text(expected_text)
    expect(element).not_to_contain_text("Line 2")
    expect(element).not_to_contain_text("Line 3")

    # Hover to show tooltip
    hover_target = element_container.get_by_test_id("stTooltipHoverTarget")
    hover_target.hover()

    # Verify tooltip is visible and contains the multiline content
    tooltip_content = app.get_by_test_id("stTooltipContent")
    expect(tooltip_content).to_be_visible()

    # All test cases now use consistent "Line 1/2/3" format for simplicity
    expect(tooltip_content).to_contain_text("Line 1")
    expect(tooltip_content).to_contain_text("Line 2")
    expect(tooltip_content).to_contain_text("Line 3")


def test_tooltip_with_complex_markdown_gh_13339(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that tooltips with complex markdown features render correctly.

    Comprehensive test verifying that help tooltips support:
    - Bold, italic, and other text formatting
    - Inline code and code blocks
    - Links
    - Color directives
    - Brackets [ and ]
    - Emojis

    Uses snapshot testing to verify the markdown is rendered correctly.
    """
    element_container = get_element_by_key(app, "markdown_complex_tooltip")
    element_container.scroll_into_view_if_needed()
    expect(element_container).to_be_visible()

    element = element_container.get_by_test_id("stMarkdownContainer")

    # Verify the help text is NOT leaked into the markdown content
    expect(element).to_have_text("Tooltip with complex markdown")
    expect(element).not_to_contain_text("Bold")
    expect(element).not_to_contain_text("italic")
    expect(element).not_to_contain_text("array[index]")
    expect(element).not_to_contain_text("Streamlit")

    hover_target = element_container.get_by_test_id("stTooltipHoverTarget")
    hover_target.hover()

    tooltip_content = app.get_by_test_id("stTooltipContent")
    expect(tooltip_content).to_be_visible()

    expect(tooltip_content).to_contain_text("Bold")
    expect(tooltip_content).to_contain_text("italic")
    expect(tooltip_content).to_contain_text("code")
    expect(tooltip_content).to_contain_text("brackets [x]")
    expect(tooltip_content).to_contain_text("Streamlit")
    expect(tooltip_content).to_contain_text("array[index]")
    expect(tooltip_content).to_contain_text("🎉")

    expect(tooltip_content.locator("code")).to_have_count(1)

    expect(tooltip_content.locator("a")).to_have_attribute(
        "href", "https://streamlit.io"
    )

    assert_snapshot(
        tooltip_content, name="st_markdown-complex_tooltip_with_markdown_formatting"
    )
