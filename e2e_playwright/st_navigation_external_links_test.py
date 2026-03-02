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

"""E2E tests for st.navigation with external links.

Tests that external URL pages are rendered correctly in both sidebar
and top navigation modes, with proper attributes for opening in new tabs.
"""

from __future__ import annotations

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import select_radio_option


def test_sidebar_links_have_expected_attributes(app: Page) -> None:
    """Sidebar links should render with correct internal/external attributes."""
    expect(app.get_by_test_id("stSidebarNav")).to_be_visible()

    sidebar_nav_links = app.get_by_test_id("stSidebarNavLink")
    # 2 internal + 2 external = 4 links
    expect(sidebar_nav_links).to_have_count(4)

    docs_link = sidebar_nav_links.filter(has_text="Docs")
    streamlit_link = sidebar_nav_links.filter(has_text="Streamlit")
    home_link = sidebar_nav_links.filter(has_text="Home")
    about_link = sidebar_nav_links.filter(has_text="About")

    # External links open in a new tab with noopener.
    expect(docs_link).to_have_attribute("target", "_blank")
    expect(docs_link).to_have_attribute("rel", "noopener noreferrer")
    expect(streamlit_link).to_have_attribute("target", "_blank")
    expect(streamlit_link).to_have_attribute("rel", "noopener noreferrer")

    # External links should point to external destinations.
    expect(docs_link).to_have_attribute("href", "https://docs.streamlit.io")
    expect(streamlit_link).to_have_attribute("href", "https://streamlit.io")

    # Internal links should not open in new tab.
    expect(home_link).not_to_have_attribute("target", "_blank")
    expect(about_link).not_to_have_attribute("target", "_blank")


def test_sidebar_internal_navigation_still_works(app: Page) -> None:
    """Clicking internal links in sidebar should still navigate within the app."""
    sidebar_nav_links = app.get_by_test_id("stSidebarNavLink")
    expect(sidebar_nav_links).to_have_count(4)

    # Click "About" (internal page)
    sidebar_nav_links.filter(has_text="About").click()
    wait_for_app_run(app)

    expect(
        app.get_by_test_id("stHeading").filter(has_text="About Page")
    ).to_be_visible()


def test_top_nav_links_have_expected_attributes_and_navigation(app: Page) -> None:
    """Top nav links should render expected attributes and internal navigation."""
    select_radio_option(app, option="top", label="Position")

    # Click the "External" section to open the dropdown
    external_section = app.get_by_text("External").first
    expect(external_section).to_be_visible()
    external_section.click()

    # External links should appear in the popover
    docs_link = app.get_by_test_id("stTopNavDropdownLink").filter(has_text="Docs")
    streamlit_link = app.get_by_test_id("stTopNavDropdownLink").filter(
        has_text="Streamlit"
    )

    expect(docs_link).to_be_visible()
    expect(streamlit_link).to_be_visible()

    # External links open in a new tab with noopener.
    expect(docs_link).to_have_attribute("target", "_blank")
    expect(docs_link).to_have_attribute("rel", "noopener noreferrer")
    expect(streamlit_link).to_have_attribute("target", "_blank")
    expect(streamlit_link).to_have_attribute("rel", "noopener noreferrer")

    # External links should point to external destinations.
    expect(docs_link).to_have_attribute("href", "https://docs.streamlit.io")
    expect(streamlit_link).to_have_attribute("href", "https://streamlit.io")

    # Click the "Internal" section to open the dropdown
    internal_section = app.get_by_text("Internal").first
    expect(internal_section).to_be_visible()
    internal_section.click()

    # Click "About" in the popover
    about_link = app.get_by_role("link", name="About")
    expect(about_link).to_be_visible()
    # Internal links should not open in a new tab.
    expect(about_link).not_to_have_attribute("target", "_blank")
    about_link.click()
    wait_for_app_run(app)

    expect(
        app.get_by_test_id("stHeading").filter(has_text="About Page")
    ).to_be_visible()
