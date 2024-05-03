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

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_loaded


def _get_title_elements(app: Page) -> Locator:
    """Title elements are rendered as h1 elements"""
    return app.locator(".element-container .stMarkdown h1")


def _get_header_elements(app: Page) -> Locator:
    """Header elements are rendered as h2 elements"""
    return app.locator(".element-container .stMarkdown h2")


def _get_subheader_elements(app: Page) -> Locator:
    """Subheader elements are rendered as h3 elements"""
    return app.locator(".element-container .stMarkdown h3")


_header_divider_filter_text = re.compile(r"[a-zA-Z]+ Header Divider:")
_subheader_divider_filter_text = re.compile(r"[a-zA-Z]+ Subheader Divider:")


def test_correct_number_of_title_elements(app: Page):
    """Test that correct number of st.title (=> h1) exist with the right content"""
    headers = _get_title_elements(app)
    expect(headers).to_have_count(4)


def test_correct_number_and_content_of_header_elements(app: Page):
    headers = _get_header_elements(app).filter(has_not_text=_header_divider_filter_text)
    expect(headers).to_have_count(3)

    expect(headers.nth(0)).to_have_text("This header is awesome!")
    expect(headers.nth(1)).to_have_text("This header is awesome too!")
    expect(headers.nth(2)).to_have_text(
        "This header with hidden anchor is awesome tooooo!"
    )


def test_correct_number_and_content_of_subheader_elements(app: Page):
    """Test that correct number of st.subheader (=> h3) exist with the right content"""
    headers = app.locator(".element-container .stMarkdown h3").filter(
        has_not_text=_subheader_divider_filter_text
    )
    expect(headers).to_have_count(5)

    expect(headers.nth(0)).to_have_text("This subheader is awesome!")
    expect(headers.nth(1)).to_have_text("This subheader is awesome too!")
    expect(headers.nth(2)).to_have_text("`Code` - Subheader without Anchor")
    expect(headers.nth(3)).to_have_text(
        "`Code` - Subheader with Anchor [test_link](href)"
    )
    expect(headers.nth(4)).to_have_text("`Code` - Subheader with hidden Anchor")


def test_display_headers_with_anchors_and_style_icons(app: Page):
    headers = _get_header_elements(app)

    first_header = headers.nth(0)
    expect(first_header).to_have_id("this-header-is-awesome")
    expect(first_header.locator("svg")).to_be_attached()
    expect(first_header.locator("a")).to_have_attribute(
        "href", "#this-header-is-awesome"
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
    expect(first_header).to_have_id("this-subheader-is-awesome")
    expect(first_header.locator("svg")).to_be_attached()
    expect(first_header.locator("a")).to_have_attribute(
        "href", "#this-subheader-is-awesome"
    )

    second_header = headers.nth(1)
    expect(second_header).to_have_id("awesome-subheader")
    expect(second_header.locator("svg")).to_be_attached()
    expect(second_header.locator("a")).to_have_attribute("href", "#awesome-subheader")

    third_header = headers.nth(4)
    expect(third_header).to_have_id("subheader-with-hidden-anchor")
    expect(third_header.locator("svg")).not_to_be_attached()


def test_links_are_rendered_correctly(app: Page, assert_snapshot: ImageCompareFunction):
    wait_for_app_loaded(app)
    link = app.get_by_text("a link")
    link.scroll_into_view_if_needed()
    expect(link).to_have_count(1)
    expect(link).to_be_visible()
    assert_snapshot(link, name="st_header-title_with_link")


_number_of_colors = 8


def test_header_divider_snapshot(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.header renders correctly with dividers."""
    header_divider_elements = _get_header_elements(app).filter(
        has_text=_header_divider_filter_text
    )
    expect(header_divider_elements).to_have_count(_number_of_colors)

    for i, element in enumerate(header_divider_elements.all()):
        assert_snapshot(element, name=f"st_header-divider_{i}")


def test_subheader_divider_snapshot(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.subheader renders correctly with dividers."""
    subheader_divider_elements = _get_subheader_elements(app).filter(
        has_text=_subheader_divider_filter_text
    )
    expect(subheader_divider_elements).to_have_count(_number_of_colors)

    for i, element in enumerate(subheader_divider_elements.all()):
        assert_snapshot(element, name=f"st_subheader-divider_{i}")
