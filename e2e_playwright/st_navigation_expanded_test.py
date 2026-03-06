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

"""E2E tests for st.navigation with expanded parameter."""

from __future__ import annotations

from playwright.sync_api import Page, expect


def test_expanded_int_shows_limited_pages_with_view_more_button(app: Page) -> None:
    """Test that expanded=N shows N pages with 'View X more' button."""
    # The app has 10 pages with expanded=3
    # Should show only 3 pages initially
    sidebar_nav_links = app.get_by_test_id("stSidebarNavLink")
    expect(sidebar_nav_links).to_have_count(3)

    # Should show "View 7 more" button (10 total - 3 shown = 7)
    view_button = app.get_by_test_id("stSidebarNavViewButton")
    expect(view_button).to_be_visible()
    expect(view_button).to_contain_text("View 7 more")


def test_expanded_int_view_button_expands_to_show_all_pages(app: Page) -> None:
    """Test that clicking 'View X more' shows all pages."""
    # Click the view button to expand
    view_button = app.get_by_test_id("stSidebarNavViewButton")
    view_button.click()

    # Now all 10 pages should be visible
    sidebar_nav_links = app.get_by_test_id("stSidebarNavLink")
    expect(sidebar_nav_links).to_have_count(10)

    # Button should now say "View less"
    expect(view_button).to_contain_text("View less")


def test_expanded_int_view_button_can_collapse_again(app: Page) -> None:
    """Test that clicking 'View less' collapses back to N pages."""
    view_button = app.get_by_test_id("stSidebarNavViewButton")

    # Expand
    view_button.click()
    expect(app.get_by_test_id("stSidebarNavLink")).to_have_count(10)
    expect(view_button).to_contain_text("View less")

    # Collapse
    view_button.click()
    expect(app.get_by_test_id("stSidebarNavLink")).to_have_count(3)
    expect(view_button).to_contain_text("View 7 more")
