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

import re

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import build_app_url, wait_for_app_loaded, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    expect_prefixed_markdown,
    goto_app,
    select_radio_option,
)


def test_sidebar_navigation_mode_shows_sidebar_nav_only(app: Page) -> None:
    """Sidebar position: sidebar navigation is visible, top navigation is not."""
    # Sidebar navigation should be visible by default (position='sidebar').
    expect(app.get_by_test_id("stSidebar")).to_be_visible()
    expect(app.get_by_test_id("stSidebarNav")).to_be_visible()

    # Sidebar navigation should have links for both pages.
    sidebar_nav_links = app.get_by_test_id("stSidebarNavLink")
    expect(sidebar_nav_links).to_have_count(2)
    expect(sidebar_nav_links.first).to_be_visible()

    # Clicking the second page should change the header from A to B.
    sidebar_nav_links.nth(1).click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stHeading").filter(has_text="Header B")).to_be_visible()

    # Top navigation should not be visible in sidebar mode.
    expect(app.get_by_test_id("stTopNavLink")).not_to_be_visible()


def test_top_navigation_mode_shows_top_nav_only(app: Page) -> None:
    """Top position: top navigation is visible, sidebar navigation is hidden."""
    # Switch navigation position to top.
    select_radio_option(app, option="top", label="Position")

    # Sidebar container still exists (there is user content in the sidebar),
    # but the sidebar navigation menu should be hidden.
    expect(app.get_by_test_id("stSidebar")).to_be_visible()
    expect(app.get_by_test_id("stSidebarNav")).not_to_be_visible()

    # Top navigation should be visible with links for both pages.
    nav_links = app.get_by_test_id("stTopNavLink")
    expect(nav_links).to_have_count(2)
    expect(nav_links.first).to_be_visible()

    # Clicking the second page should change the header from A to B.
    nav_links.nth(1).click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stHeading").filter(has_text="Header B")).to_be_visible()


def test_hidden_navigation_mode_hides_both_navs(app: Page) -> None:
    """Hidden position: both sidebar and top navigation UIs are hidden."""
    # Switch navigation position to hidden.
    select_radio_option(app, option="hidden", label="Position")

    # Sidebar container still exists because the app adds sidebar content,
    # but there should be no navigation menu in sidebar or header.
    expect(app.get_by_test_id("stSidebar")).to_be_visible()
    expect(app.get_by_test_id("stSidebarNav")).not_to_be_visible()
    expect(app.get_by_test_id("stTopNavLink")).not_to_be_visible()

    # The app should still show content from the current page.
    expect(app.get_by_test_id("stHeading").filter(has_text="Header A")).to_be_visible()


def test_page_specific_bound_query_param_cleared_on_page_switch(
    page: Page, app_base_url: str
) -> None:
    """Page-scoped bound widget params are cleared when navigating to another page."""
    goto_app(page, build_app_url(app_base_url, query={"page_a_num": "42"}))

    expect_prefixed_markdown(page, "page_a_num:", "42")
    expect(page).to_have_url(re.compile(r"page_a_num=42"))

    # Switch to page B via sidebar nav
    page.get_by_test_id("stSidebarNavLink").nth(1).click()
    wait_for_app_loaded(page)

    expect(page.get_by_test_id("stHeading").filter(has_text="Header B")).to_be_visible()
    expect(page).not_to_have_url(re.compile(r"page_a_num="))


def test_entry_file_bound_query_param_persists_across_page_switch(
    page: Page, app_base_url: str
) -> None:
    """Entry-file bound widget params persist when navigating between pages."""
    goto_app(page, build_app_url(app_base_url, query={"entry_radio": "green"}))

    expect_prefixed_markdown(page, "entry_radio:", "green")
    expect(page).to_have_url(re.compile(r"entry_radio=green"))

    # Switch to page B
    page.get_by_test_id("stSidebarNavLink").nth(1).click()
    wait_for_app_run(page)

    expect(page.get_by_test_id("stHeading").filter(has_text="Header B")).to_be_visible()

    # Entry-file param should still be in the URL
    expect(page).to_have_url(re.compile(r"entry_radio=green"))
    expect_prefixed_markdown(page, "entry_radio:", "green")

    # Switch back to page A
    page.get_by_test_id("stSidebarNavLink").nth(0).click()
    wait_for_app_run(page)

    expect(page.get_by_test_id("stHeading").filter(has_text="Header A")).to_be_visible()
    expect(page).to_have_url(re.compile(r"entry_radio=green"))
    expect_prefixed_markdown(page, "entry_radio:", "green")
