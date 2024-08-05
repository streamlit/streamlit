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

import re

import pytest
from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_loaded
from e2e_playwright.shared.app_utils import expect_help_tooltip


def _get_title_elements(app: Page) -> Locator:
    """Title elements are rendered as h1 elements"""
    return app.get_by_test_id("stHeading").locator("h1")


def _get_header_elements(app: Page) -> Locator:
    """Header elements are rendered as h2 elements"""
    return app.get_by_test_id("stHeading").locator("h2")


def _get_subheader_elements(app: Page) -> Locator:
    """Subheader elements are rendered as h3 elements"""
    return app.get_by_test_id("stHeading").locator("h3")


_header_divider_filter_text = re.compile(r"[a-zA-Z]+ Header Divider:")
_subheader_divider_filter_text = re.compile(r"[a-zA-Z]+ Subheader Divider:")


def test_correct_number_and_content_of_title_elements(app: Page):
    """Test that correct number of st.title (=> h1) exist with the right content"""
    titles = _get_title_elements(app)
    expect(titles).to_have_count(6)

    expect(titles.nth(0)).to_have_text("info This title is awesome!")
    expect(titles.nth(1)).to_have_text("This title is awesome too!")
    expect(titles.nth(2)).to_have_text("Code - Title with hidden Anchor")
    expect(titles.nth(3)).to_have_text("a link")
    expect(titles.nth(4)).to_have_text("日本語タイトル")
    expect(titles.nth(5)).to_have_text("その他の邦題")


def test_correct_number_and_content_of_header_elements(app: Page):
    """Test that correct number of st.header (=> h2) exist with the right content"""
    headers = _get_header_elements(app).filter(has_not_text=_header_divider_filter_text)
    expect(headers).to_have_count(5)

    expect(headers.nth(0)).to_have_text("info This header is awesome!")
    expect(headers.nth(1)).to_have_text("This header is awesome too!")
    expect(headers.nth(2)).to_have_text(
        "This header with hidden anchor is awesome tooooo!"
    )


def test_correct_number_and_content_of_subheader_elements(app: Page):
    """Test that correct number of st.subheader (=> h3) exist with the right content"""
    subheaders = _get_subheader_elements(app).filter(
        has_not_text=_subheader_divider_filter_text
    )
    expect(subheaders).to_have_count(8)

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
    headers = _get_header_elements(app)

    first_header = headers.nth(0)
    expect(first_header).to_have_id("info-this-header-is-awesome")
    expect(first_header.locator("svg")).to_be_attached()
    expect(first_header.locator("a")).to_have_attribute(
        "href", "#info-this-header-is-awesome"
    )

    second_header = headers.nth(1)
    expect(second_header).to_have_id("awesome-header")
    expect(second_header.locator("svg")).to_be_attached()
    expect(second_header.locator("a")).to_have_attribute("href", "#awesome-header")

    third_header = headers.nth(2)
    expect(third_header).to_have_id("this-header-with-hidden-anchor-is-awesome-tooooo")
    expect(third_header.locator("svg")).not_to_be_attached()


def test_display_subheaders_with_anchors_and_style_icons(app: Page):
    headers = _get_subheader_elements(app)

    first_header = headers.nth(0)
    expect(first_header).to_have_id("info-this-subheader-is-awesome")
    expect(first_header.locator("svg")).to_be_attached()
    expect(first_header.locator("a")).to_have_attribute(
        "href", "#info-this-subheader-is-awesome"
    )

    second_header = headers.nth(1)
    expect(second_header).to_have_id("awesome-subheader")
    expect(second_header.locator("svg")).to_be_attached()
    expect(second_header.locator("a")).to_have_attribute("href", "#awesome-subheader")

    third_header = headers.nth(4)
    expect(third_header).to_have_id("subheader-with-hidden-anchor")
    expect(third_header.locator("svg")).not_to_be_attached()


def test_clicking_on_anchor_changes_url(app: Page):
    import re

    headers = _get_header_elements(app)
    first_header = headers.nth(0)
    first_header.hover()
    link = first_header.locator("a")
    expect(link).to_have_attribute("href", "#info-this-header-is-awesome")
    link.click()
    expect(app).to_have_url(re.compile(".*#info-this-header-is-awesome"))


def test_headers_snapshot_match(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    headers = _get_header_elements(themed_app)

    assert_snapshot(headers.nth(0), name="st_header-simple")
    assert_snapshot(headers.nth(3), name="st_header-with_help")


def test_headers_hovered_snapshot_match(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    headers = _get_header_elements(themed_app)
    header = headers.nth(0)
    link_container = header.get_by_test_id("stHeaderActionElements").locator("a")
    expect(link_container).to_have_css("visibility", "hidden")
    header.hover()
    expect(link_container).to_have_css("visibility", "visible")
    assert_snapshot(header, name="st_header-hover_with_visible_anchor")

    header = headers.nth(3)
    link_container = header.get_by_test_id("stHeaderActionElements").locator("a")
    expect(link_container).to_have_css("visibility", "hidden")
    header.hover()
    expect(link_container).to_have_css("visibility", "visible")
    assert_snapshot(header, name="st_header-hover_with_help_and_anchor")

    header = headers.nth(4)
    link_container = header.get_by_test_id("stHeaderActionElements").locator("a")
    expect(link_container).not_to_be_attached()
    assert_snapshot(header, name="st_header-hover_with_help_and_hidden_anchor")


def test_subheaders_snapshot_match(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    headers = _get_subheader_elements(themed_app)

    assert_snapshot(headers.nth(0), name="st_subheader-simple")
    assert_snapshot(headers.nth(5), name="st_subheader-with_code_and_help")


def test_subheaders_hovered_snapshot_match(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    headers = _get_subheader_elements(themed_app)
    header = headers.nth(0)
    link_container = header.get_by_test_id("stHeaderActionElements").locator("a")
    expect(link_container).to_have_css("visibility", "hidden")
    header.hover()
    expect(link_container).to_have_css("visibility", "visible")
    assert_snapshot(header, name="st_subheader-hover_with_visible_anchor")

    header = headers.nth(5)
    link_container = header.get_by_test_id("stHeaderActionElements").locator("a")
    expect(link_container).to_have_css("visibility", "hidden")
    header.hover()
    expect(link_container).to_have_css("visibility", "visible")
    assert_snapshot(header, name="st_subheader-hover_with_help_and_anchor")

    header = headers.nth(6)
    link_container = header.get_by_test_id("stHeaderActionElements").locator("a")
    expect(link_container).not_to_be_attached()
    assert_snapshot(header, name="st_subheader-hover_with_help_and_hidden_anchor")


def test_links_are_rendered_correctly_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    wait_for_app_loaded(themed_app)
    link = themed_app.get_by_text("a link")
    link.scroll_into_view_if_needed()
    expect(link).to_have_count(1)
    expect(link).to_be_visible()
    assert_snapshot(link, name="st_header-title_with_link")


_number_of_colors = 8


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
    header_with_help = _get_header_elements(app).nth(3)

    tooltip_text = "Some help tooltip"
    expect_help_tooltip(app, header_with_help, tooltip_text)

    subheader_with_help = _get_subheader_elements(app).nth(5)
    expect_help_tooltip(app, subheader_with_help, tooltip_text)

    title_with_help = _get_title_elements(app).nth(1)
    expect_help_tooltip(app, title_with_help, tooltip_text)


def test_not_scrolled_on_empty_anchor_tag(app: Page):
    """Test that the page is not scrolled when the page contains an empty
    header/anchor tag and no window hash."""

    # Check if the page is still scrolled to the top
    # after one second timeout.
    app.wait_for_timeout(1000)
    scroll_position = app.evaluate("window.scrollY")
    # Usage of assert is fine here since we just need to verify that
    # this is still scrolled to top, no need to wait for this to happen.
    assert scroll_position == 0
