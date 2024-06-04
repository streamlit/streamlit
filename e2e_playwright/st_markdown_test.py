# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import expect_help_tooltip, get_markdown


def test_different_markdown_elements_in_one_block_displayed(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the block containing a mixture of different markdown elements is displayed correctly."""

    markdown_elements = themed_app.get_by_test_id("stMarkdown")

    expect(markdown_elements).to_have_count(54)

    # Snapshot one big markdown block containing a variety of elements to reduce number of snapshots
    multi_markdown_format_container = markdown_elements.nth(14)
    multi_markdown_format_container.scroll_into_view_if_needed()
    assert_snapshot(
        multi_markdown_format_container,
        name="st_markdown-many_elements_in_one_block",
    )


def test_displays_individual_markdowns(app: Page):
    """Verifies the correct text content of markdown elements."""

    # get markdown elements in main app view, not sidebar
    markdown_elements = app.get_by_test_id("stAppViewBlockContainer").get_by_test_id(
        "stMarkdown"
    )

    # Assert the text content of each markdown element
    text = [
        "This markdown is awesome! 😎",
        "This <b>HTML tag</b> is escaped!",
        "This HTML tag is not escaped!",
        "[text]",
        "link",
        "[][]",
        "Inline math with KaTeX\\KaTeXKATE​X",
        "ax2+bx+c=0ax^2 + bx + c = 0ax2+bx+c=0",
        "Col1Col2SomeData",
        "Bold text within blue background",
        "Italic text within red background",
        "Link within rainbow background",
        "LaTeX math within green background: ax2+bx+c=0ax^2 + bx + c = 0ax2+bx+c=0",
    ]

    for i in range(len(text)):
        expect(markdown_elements.nth(i)).to_have_text(text[i])

    # Check that the style contains the correct background color
    blue_background = markdown_elements.nth(9).locator("span").first
    red_background = markdown_elements.nth(10).locator("span").first
    rainbow_background = markdown_elements.nth(11).locator("span").first
    green_background = markdown_elements.nth(12).locator("span").first

    expect(blue_background).to_have_css("background-color", "rgba(28, 131, 225, 0.1)")
    expect(red_background).to_have_css("background-color", "rgba(255, 43, 43, 0.1)")
    expect(rainbow_background).to_have_css(
        "background-image",
        "linear-gradient(to right, rgba(255, 43, 43, 0.1), rgba(255, 227, 18, 0.1), rgba(255, 227, 18, 0.1), rgba(33, 195, 84, 0.1), rgba(28, 131, 225, 0.1), rgba(128, 61, 245, 0.1), rgba(88, 63, 132, 0.1))",
    )
    expect(green_background).to_have_css("background-color", "rgba(33, 195, 84, 0.1)")

    # Additional checks for specific elements like links
    expect(markdown_elements.nth(3).locator("a")).to_have_count(0)
    expect(markdown_elements.nth(4).locator("a")).to_have_attribute("href", "href")


# Headers in markdown tests


def test_markdown_displays_long_headers_above_other_elements(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Displays long headers above other elements in the markdown block"""

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
    # expand the sidebar
    app.get_by_test_id("collapsedControl").click()
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_visible()
    assert_snapshot(sidebar, name="st_markdown-headers_in_sidebar")


def test_match_snapshot_for_headers_in_single_markdown_command(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that snapshot of headers joined in a single string and written in a single st.markdown command is correct."""
    container = _get_container_of_text(app, "Headers in single st.markdown command")
    assert_snapshot(container, name="st_markdown-headers_joined_in_single_command")


def test_match_snapshot_for_headers_in_multiple_markdown_commands(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that snapshot of headers written in multiple st.markdown commands is correct"""
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
    container = _get_container_of_text(app, "Headers in column beside widget")
    assert_snapshot(container, name="st_markdown-headers_beside_widget")


def test_help_tooltip_works(app: Page):
    """Test that the help tooltip is displayed on hover."""
    # Get the first element in the main view:
    markdown_with_help = (
        app.get_by_test_id("stAppViewBlockContainer")
        .get_by_test_id("stMarkdown")
        .nth(0)
    )
    expect_help_tooltip(app, markdown_with_help, "This is a help tooltip!")


def test_latex_elements(themed_app: Page, assert_snapshot: ImageCompareFunction):
    expect(themed_app.get_by_test_id("stMarkdown").nth(50)).to_contain_text("LATE​X")
    expect(themed_app.get_by_test_id("stMarkdown").nth(51)).to_contain_text("a + b")
    latex_elements = themed_app.get_by_test_id("stMarkdown")

    for i in range(50, 53):
        assert_snapshot(latex_elements.nth(i), name=f"st_latex-{i}")


def test_large_image_in_markdown(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that large images in markdown are displayed correctly with max width 100%."""
    markdown_element = get_markdown(
        app, "Images in markdown should keep inside the container width"
    )
    image_element = markdown_element.locator("img")

    image_element.scroll_into_view_if_needed()
    expect(image_element).to_be_visible()
    expect(image_element).to_have_css("max-width", "100%")
    # Wait for the image to load:
    app.expect_response("**/streamlit-logo.png")
    # Add additional timeout to avoid flakiness
    #  since sometimes the image is not rendered yet
    app.wait_for_timeout(2000)
    assert_snapshot(markdown_element, name="st_markdown-with_large_image")
