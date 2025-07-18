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
from e2e_playwright.shared.app_utils import get_expander

PAGE_LINK_COUNT = 16


def test_page_links(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.page_link renders correctly."""
    page_link_elements = app.get_by_test_id("stPageLink")
    expect(page_link_elements).to_have_count(PAGE_LINK_COUNT)

    assert_snapshot(page_link_elements.nth(5), name="st_page_link-default")
    assert_snapshot(page_link_elements.nth(6), name="st_page_link-icon")
    assert_snapshot(page_link_elements.nth(7), name="st_page_link-help")
    assert_snapshot(page_link_elements.nth(8), name="st_page_link-disabled")
    assert_snapshot(page_link_elements.nth(9), name="st_page_link-material-icon")

    # st.Page object page links
    assert_snapshot(page_link_elements.nth(10), name="st_page_link-st_page_with_icon")
    assert_snapshot(
        page_link_elements.nth(11), name="st_page_link-st_page_with_material_icon"
    )
    assert_snapshot(
        page_link_elements.nth(12), name="st_page_link-st_page_icon_override"
    )

    # Sidebar page links
    assert_snapshot(page_link_elements.nth(0), name="st_page_link-sidebar-default")
    assert_snapshot(page_link_elements.nth(1), name="st_page_link-sidebar-icon")
    assert_snapshot(page_link_elements.nth(2), name="st_page_link-sidebar-help")
    assert_snapshot(page_link_elements.nth(3), name="st_page_link-sidebar-disabled")
    assert_snapshot(
        page_link_elements.nth(4), name="st_page_link-sidebar-width_content"
    )


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


def test_page_link_width_examples(app: Page, assert_snapshot: ImageCompareFunction):
    """Test page link width examples via screenshot matching."""
    page_expander = get_expander(app, "Page Link Width Examples")

    page_elements = page_expander.get_by_test_id("stPageLink")

    assert_snapshot(page_elements.nth(0), name="st_page_link-width_content")
    assert_snapshot(page_elements.nth(1), name="st_page_link-width_stretch")
    assert_snapshot(page_elements.nth(2), name="st_page_link-width_500px")
