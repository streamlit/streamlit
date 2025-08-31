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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction

PAGE_LINK_COUNT = 10


def test_page_links(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.page_link renders correctly."""
    page_link_elements = app.get_by_test_id("stPageLink")
    expect(page_link_elements).to_have_count(PAGE_LINK_COUNT)

    # Screenshot link using the link element to reflect width
    # Help causes two stPageLink-NavLink elements to be rendered under a stPageLink
    # (one for normal, one for mobile tooltip) so indices are off
    page_link_links = page_link_elements.get_by_test_id("stPageLink-NavLink")

    assert_snapshot(page_link_links.nth(1), name="st_page_link-sidebar-icon")
    assert_snapshot(page_link_links.nth(4), name="st_page_link-sidebar-disabled")
    assert_snapshot(page_link_links.nth(7), name="st_page_link-icon")
    assert_snapshot(page_link_links.nth(10), name="st_page_link-disabled")


def test_default_container_width(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.page_link default container width in main is false and in sidebar is true."""
    page_links = app.get_by_test_id("stPageLink")

    page_links.nth(0).get_by_test_id("stMarkdownContainer").hover()
    assert_snapshot(page_links.nth(0), name="st_page_link-sidebar-default")

    page_links.nth(4).get_by_test_id("stMarkdownContainer").hover()
    assert_snapshot(
        page_links.nth(4), name="st_page_link-sidebar-container-width-false"
    )

    page_links.nth(5).get_by_test_id("stMarkdownContainer").hover()
    assert_snapshot(page_links.nth(5), name="st_page_link-default")

    page_links.nth(9).get_by_test_id("stMarkdownContainer").hover()
    assert_snapshot(page_links.nth(9), name="st_page_link-container-width-true")


def test_page_link_help_tooltip(app: Page):
    """Test that st.page_link help tooltip renders correctly."""
    page_links = app.get_by_test_id("stPageLink")
    expect(page_links).to_have_count(PAGE_LINK_COUNT)

    # Get the tooltip hover target and ensure it's visible before hovering
    hover_target = page_links.nth(7).get_by_test_id("stTooltipHoverTarget")
    expect(hover_target).to_be_visible()

    # Hover over the tooltip target
    hover_target.hover()

    expect(app.get_by_text("Some help text")).to_be_visible()
