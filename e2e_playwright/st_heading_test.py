# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_loaded
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    expect_help_tooltip,
    get_heading,
)

# Does not include divider header/subheaders
TITLE_COUNT = 9
HEADER_COUNT = 8
SUBHEADER_COUNT = 11


def _get_title_elements(app: Page) -> Locator:
    """Title elements are rendered as h1 elements."""
    return app.get_by_test_id("stHeading").locator("h1")


def _get_header_elements(app: Page) -> Locator:
    """Header elements are rendered as h2 elements."""
    return app.get_by_test_id("stHeading").locator("h2")


def _get_subheader_elements(app: Page) -> Locator:
    """Subheader elements are rendered as h3 elements."""
    return app.get_by_test_id("stHeading").locator("h3")


_header_divider_filter_text = re.compile(r"[a-zA-Z]+ Header Divider:")
_subheader_divider_filter_text = re.compile(r"[a-zA-Z]+ Subheader Divider:")


def test_correct_number_and_content_of_title_elements(app: Page):
    """Test that correct number of st.title (=> h1) exist with the right content."""
    titles = _get_title_elements(app)
    expect(titles).to_have_count(TITLE_COUNT)

    expect(titles.nth(0)).to_have_text("info This title is awesome!")
    expect(titles.nth(1)).to_have_text("This title is awesome too!")
    expect(titles.nth(2)).to_have_text("Code - Title with hidden Anchor")
    expect(titles.nth(3)).to_have_text("a link")
    expect(titles.nth(4)).to_have_text("日本語タイトル")
    expect(titles.nth(5)).to_have_text("その他の邦題")


def test_correct_number_and_content_of_header_elements(app: Page):
    """Test that correct number of st.header (=> h2) exist with the right content."""
    headers = _get_header_elements(app).filter(has_not_text=_header_divider_filter_text)
    expect(headers).to_have_count(HEADER_COUNT)

    expect(headers.nth(0)).to_have_text("info This header is awesome!")
    expect(headers.nth(1)).to_have_text("This header is awesome too!")
    expect(headers.nth(2)).to_have_text(
        "This header with hidden anchor is awesome tooooo!"
    )


def test_correct_number_and_content_of_subheader_elements(app: Page):
    """Test that correct number of st.subheader (=> h3) exist with the right content."""
    subheaders = _get_subheader_elements(app).filter(
        has_not_text=_subheader_divider_filter_text
    )
    expect(subheaders).to_have_count(SUBHEADER_COUNT)

    expect(subheaders.nth(0)).to_have_text("info This subheader is awesome!")
    expect(subheaders.nth(1)).to_have_text("This subheader is awesome too!")
    expect(subheaders.nth(2)).to_have_text("Code - Subheader without Anchor")
    expect(subheaders.nth(3)).to_have_text("Code - Subheader with Anchor test_link")
    expect(subheaders.nth(4)).to_have_text("Subheader with hidden Anchor")


def test_display_titles_with_anchors(app: Page):
    titles = _get_title_elements(app)

    expect(titles.nth(0)).to_have_id("info-this-title-is-awesome")
    expect(titles.nth(1)).to_have_id("awesome-title")
    expect(titles.nth(2)).to_have_id("code-title-with-hidden-anchor")
    expect(titles.nth(3)).to_have_id("a-link")
    # the id is generated based on the title
    expect(titles.nth(4)).to_have_id("d3b04b7a")
    expect(titles.nth(5)).to_have_id("アンカー")


def test_display_headers_with_anchors_and_style_icons(app: Page):
    # Test header with icon and anchor
    first_header = get_heading(app, "This header is awesome!").locator("h2")
    expect(first_header).to_have_id("info-this-header-is-awesome")
    expect(first_header.locator("svg")).to_be_attached()
    expect(first_header.locator("a")).to_have_attribute(
        "href", "#info-this-header-is-awesome"
    )

    # Test header with custom anchor
    second_header = get_heading(app, "This header is awesome too!").locator("h2")
    expect(second_header).to_have_id("awesome-header")
    expect(second_header.locator("svg")).to_be_attached()
    expect(second_header.locator("a")).to_have_attribute("href", "#awesome-header")

    # Test header with hidden anchor
    third_header = get_heading(
        app, "This header with hidden anchor is awesome tooooo!"
    ).locator("h2")
    expect(third_header).to_have_id("this-header-with-hidden-anchor-is-awesome-tooooo")
    expect(third_header.locator("svg")).not_to_be_attached()


def test_display_subheaders_with_anchors_and_style_icons(app: Page):
    # Test subheader with icon and anchor
    first_subheader = get_heading(app, "This subheader is awesome!").locator("h3")
    expect(first_subheader).to_have_id("info-this-subheader-is-awesome")
    expect(first_subheader.locator("svg")).to_be_attached()
    expect(first_subheader.locator("a")).to_have_attribute(
        "href", "#info-this-subheader-is-awesome"
    )

    # Test subheader with custom anchor
    second_subheader = get_heading(app, "This subheader is awesome too!").locator("h3")
    expect(second_subheader).to_have_id("awesome-subheader")
    expect(second_subheader.locator("svg")).to_be_attached()
    expect(second_subheader.locator("a")).to_have_attribute(
        "href", "#awesome-subheader"
    )

    # Test subheader with hidden anchor
    third_subheader = get_heading(app, "Subheader with hidden Anchor").locator("h3")
    expect(third_subheader).to_have_id("subheader-with-hidden-anchor")
    expect(third_subheader.locator("svg")).not_to_be_attached()


def test_clicking_on_anchor_changes_url(app: Page):
    import re

    header = get_heading(app, "This header is awesome!").locator("h2")
    header.hover()
    link = header.locator("a")
    expect(link).to_have_attribute("href", "#info-this-header-is-awesome")
    link.click()
    expect(app).to_have_url(re.compile(".*#info-this-header-is-awesome"))


def test_headers_snapshot_match(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    # Test simple header
    header_simple = get_heading(themed_app, "This header is awesome!")
    assert_snapshot(header_simple, name="st_header-simple")

    # Test header with help (exact match to avoid matching "header with help and hidden anchor")
    header_with_help = get_heading(themed_app, re.compile(r"^header with help$"))
    assert_snapshot(header_with_help, name="st_header-with_help")


def test_headers_hovered_snapshot_match(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    # Test simple header with visible anchor on hover
    header = get_heading(themed_app, "This header is awesome!")
    link_container = header.get_by_test_id("stHeaderActionElements").locator("a")
    expect(link_container).to_have_css("visibility", "hidden")
    header.hover()
    expect(link_container).to_have_css("visibility", "visible")
    assert_snapshot(header, name="st_header-hover_with_visible_anchor")

    # Test header with help and anchor on hover (exact match)
    header_with_help = get_heading(themed_app, re.compile(r"^header with help$"))
    link_container = header_with_help.get_by_test_id("stHeaderActionElements").locator(
        "a"
    )
    expect(link_container).to_have_css("visibility", "hidden")
    header_with_help.hover()
    expect(link_container).to_have_css("visibility", "visible")
    assert_snapshot(header_with_help, name="st_header-hover_with_help_and_anchor")

    # Test header with help and hidden anchor (no link)
    header_hidden = get_heading(
        themed_app, re.compile(r"^header with help and hidden anchor$")
    )
    link_container = header_hidden.get_by_test_id("stHeaderActionElements").locator("a")
    expect(link_container).not_to_be_attached()
    assert_snapshot(header_hidden, name="st_header-hover_with_help_and_hidden_anchor")


def test_subheaders_snapshot_match(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    # Test simple subheader
    subheader_simple = get_heading(themed_app, "This subheader is awesome!")
    assert_snapshot(subheader_simple, name="st_subheader-simple")

    # Test subheader with help (exact match to avoid matching "Subheader with help and hidden anchor")
    subheader_with_help = get_heading(themed_app, re.compile(r"^Subheader with help$"))
    assert_snapshot(subheader_with_help, name="st_subheader-with_code_and_help")


def test_subheaders_hovered_snapshot_match(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    # Test simple subheader with visible anchor on hover
    subheader = get_heading(themed_app, "This subheader is awesome!")
    link_container = subheader.get_by_test_id("stHeaderActionElements").locator("a")
    expect(link_container).to_have_css("visibility", "hidden")
    subheader.hover()
    expect(link_container).to_have_css("visibility", "visible")
    assert_snapshot(subheader, name="st_subheader-hover_with_visible_anchor")

    # Test subheader with help and anchor on hover (exact match)
    subheader_with_help = get_heading(themed_app, re.compile(r"^Subheader with help$"))
    link_container = subheader_with_help.get_by_test_id(
        "stHeaderActionElements"
    ).locator("a")
    expect(link_container).to_have_css("visibility", "hidden")
    subheader_with_help.hover()
    expect(link_container).to_have_css("visibility", "visible")
    assert_snapshot(subheader_with_help, name="st_subheader-hover_with_help_and_anchor")

    # Test subheader with help and hidden anchor (no link)
    subheader_hidden = get_heading(
        themed_app, re.compile(r"^Subheader with help and hidden anchor$")
    )
    link_container = subheader_hidden.get_by_test_id("stHeaderActionElements").locator(
        "a"
    )
    expect(link_container).not_to_be_attached()
    assert_snapshot(
        subheader_hidden, name="st_subheader-hover_with_help_and_hidden_anchor"
    )


def test_links_are_rendered_correctly_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    wait_for_app_loaded(themed_app)
    link = themed_app.get_by_text("a link")
    link.scroll_into_view_if_needed()
    expect(link).to_have_count(1)
    expect(link).to_be_visible()
    assert_snapshot(link, name="st_header-title_with_link")


# 9 colors: red, orange, yellow, blue, green, violet, gray, grey, rainbow
_number_of_colors = 9


@pytest.mark.parametrize("color_index", range(_number_of_colors))
def test_header_divider_snapshot(
    app: Page, assert_snapshot: ImageCompareFunction, color_index: int
):
    """Test that st.header renders correctly with dividers."""
    header_divider_elements = _get_header_elements(app).filter(
        has_text=_header_divider_filter_text
    )
    expect(header_divider_elements).to_have_count(_number_of_colors)
    header_divider_element = header_divider_elements.nth(color_index)
    header_divider_element.scroll_into_view_if_needed()
    assert_snapshot(
        header_divider_element,
        name=f"st_header-divider_{color_index}",
    )


@pytest.mark.parametrize("color_index", range(_number_of_colors))
def test_subheader_divider_snapshot(
    app: Page, assert_snapshot: ImageCompareFunction, color_index: int
):
    """Test that st.subheader renders correctly with dividers."""
    subheader_divider_elements = _get_subheader_elements(app).filter(
        has_text=_subheader_divider_filter_text
    )
    expect(subheader_divider_elements).to_have_count(_number_of_colors)
    subheader_divider_element = subheader_divider_elements.nth(color_index)
    subheader_divider_element.scroll_into_view_if_needed()
    assert_snapshot(
        subheader_divider_element,
        name=f"st_subheader-divider_{color_index}",
    )


def test_help_tooltip_works(app: Page):
    """Test that the help tooltip is displayed on hover."""
    tooltip_text = "Some help tooltip"

    # Use exact match to avoid matching "header with help and hidden anchor"
    header_with_help = get_heading(app, re.compile(r"^header with help$"))
    expect_help_tooltip(app, header_with_help, tooltip_text)

    # Use exact match to avoid matching "Subheader with help and hidden anchor"
    subheader_with_help = get_heading(app, re.compile(r"^Subheader with help$"))
    expect_help_tooltip(app, subheader_with_help, tooltip_text)

    title_with_help = get_heading(app, "This title is awesome too!")
    expect_help_tooltip(app, title_with_help, tooltip_text)


def test_not_scrolled_on_empty_anchor_tag(app: Page):
    """Test that the page is not scrolled when the page contains an empty
    header/anchor tag and no window hash.
    """

    # Check if the page is still scrolled to the top
    # after one second timeout.
    app.wait_for_timeout(1000)
    scroll_position = app.evaluate("window.scrollY")
    # Usage of assert is fine here since we just need to verify that
    # this is still scrolled to top, no need to wait for this to happen.
    assert scroll_position == 0


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stHeading")


def test_heading_widths_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that headings with different width configurations render correctly."""

    # Title width examples
    title_400px = get_heading(themed_app, "Title with 400px width")
    title_400px.scroll_into_view_if_needed()
    assert_snapshot(title_400px, name="st_title-width_400px")

    title_stretch = get_heading(themed_app, "Title with stretch width")
    title_stretch.scroll_into_view_if_needed()
    assert_snapshot(title_stretch, name="st_title-width_stretch")

    title_content = get_heading(themed_app, "Title with content width")
    title_content.scroll_into_view_if_needed()
    assert_snapshot(title_content, name="st_title-width_content")

    # Header width examples
    header_400px = get_heading(themed_app, "Header with 400px width")
    header_400px.scroll_into_view_if_needed()
    assert_snapshot(header_400px, name="st_header-width_400px")

    header_stretch = get_heading(themed_app, "Header with stretch width")
    header_stretch.scroll_into_view_if_needed()
    assert_snapshot(header_stretch, name="st_header-width_stretch")

    header_content = get_heading(themed_app, "Header with content width")
    header_content.scroll_into_view_if_needed()
    assert_snapshot(header_content, name="st_header-width_content")

    # Subheader width examples
    subheader_300px = get_heading(themed_app, "Subheader with 300px width")
    subheader_300px.scroll_into_view_if_needed()
    assert_snapshot(subheader_300px, name="st_subheader-width_300px")

    subheader_stretch = get_heading(themed_app, "Subheader with stretch width")
    subheader_stretch.scroll_into_view_if_needed()
    assert_snapshot(subheader_stretch, name="st_subheader-width_stretch")

    subheader_content = get_heading(themed_app, "Subheader with content width")
    subheader_content.scroll_into_view_if_needed()
    assert_snapshot(subheader_content, name="st_subheader-width_content")
