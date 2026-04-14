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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import goto_app


def test_hidden_pages_not_shown_in_sidebar_nav(app: Page) -> None:
    """Test that hidden pages are not shown in the sidebar navigation."""
    # Sidebar navigation should be visible
    expect(app.get_by_test_id("stSidebarNav")).to_be_visible()

    # Only visible pages should be shown (Home and About)
    sidebar_nav_links = app.get_by_test_id("stSidebarNavLink")
    expect(sidebar_nav_links).to_have_count(2)

    # Verify the visible pages
    expect(sidebar_nav_links.first).to_contain_text("Home")
    expect(sidebar_nav_links.nth(1)).to_contain_text("About")


def test_hidden_page_accessible_via_url(app: Page, app_port: int) -> None:
    """Test that hidden pages can be accessed directly via URL."""
    # Navigate to the hidden detail page via URL
    goto_app(app, f"http://localhost:{app_port}/detail")

    # The detail page should be rendered
    expect(
        app.get_by_test_id("stHeading").filter(has_text="Detail Page")
    ).to_be_visible()

    # But it should not appear in navigation
    sidebar_nav_links = app.get_by_test_id("stSidebarNavLink")
    expect(sidebar_nav_links).to_have_count(2)  # Still only 2 visible pages


def test_hidden_page_accessible_via_page_link(app: Page) -> None:
    """Test that hidden pages can be accessed via st.page_link."""
    # Home page should have a link to the hidden detail page
    expect(app.get_by_test_id("stHeading").filter(has_text="Home Page")).to_be_visible()

    # Click the page link to the hidden detail page
    app.get_by_test_id("stPageLink").click()
    wait_for_app_run(app)

    # The detail page should be rendered
    expect(
        app.get_by_test_id("stHeading").filter(has_text="Detail Page")
    ).to_be_visible()


def test_navigation_shows_only_visible_pages(app: Page) -> None:
    """Test that navigation count reflects only visible pages."""
    # The app has 4 pages total, but only 2 are visible
    sidebar_nav_links = app.get_by_test_id("stSidebarNavLink")
    expect(sidebar_nav_links).to_have_count(2)

    # Navigate to About page
    sidebar_nav_links.nth(1).click()
    wait_for_app_run(app)

    # About page should be shown
    expect(
        app.get_by_test_id("stHeading").filter(has_text="About Page")
    ).to_be_visible()

    # Navigation should still show only 2 pages
    expect(sidebar_nav_links).to_have_count(2)


def test_hidden_pages_not_shown_in_top_nav(app: Page, app_port: int) -> None:
    """Test that hidden pages are not shown in top navigation."""
    # Navigate to the app with top navigation
    goto_app(app, f"http://localhost:{app_port}/?nav_position=top")

    # Only visible pages should be shown (Home and About)
    top_nav_links = app.get_by_test_id("stTopNavLink")
    expect(top_nav_links).to_have_count(2)

    # Verify the visible pages
    expect(top_nav_links.first).to_contain_text("Home")
    expect(top_nav_links.nth(1)).to_contain_text("About")


def test_hidden_page_accessible_via_url_with_top_nav(app: Page, app_port: int) -> None:
    """Test that hidden pages can be accessed via URL with top navigation."""
    # Navigate to hidden page with top nav position
    goto_app(app, f"http://localhost:{app_port}/detail?nav_position=top")

    # The detail page should be rendered
    expect(
        app.get_by_test_id("stHeading").filter(has_text="Detail Page")
    ).to_be_visible()

    # Top navigation should show only visible pages
    top_nav_links = app.get_by_test_id("stTopNavLink")
    expect(top_nav_links).to_have_count(2)


def test_nav_hidden_when_only_one_visible_page(app: Page, app_port: int) -> None:
    """Test that navigation is hidden when only one page is visible."""
    # Navigate to app with single visible page mode
    goto_app(app, f"http://localhost:{app_port}/?single_visible=true")

    # Home page should be shown
    expect(app.get_by_test_id("stHeading").filter(has_text="Home Page")).to_be_visible()

    # Sidebar should NOT be mounted at all when there's only 1 visible page
    # and no sidebar elements (prevents empty sidebar from appearing)
    expect(app.get_by_test_id("stSidebar")).to_have_count(0)

    # Sidebar navigation should also NOT be mounted
    expect(app.get_by_test_id("stSidebarNav")).to_have_count(0)


def test_nav_hidden_when_only_one_visible_page_top_nav(
    app: Page, app_port: int
) -> None:
    """Test that top navigation is hidden when only one page is visible."""
    # Navigate to app with single visible page mode and top nav
    goto_app(app, f"http://localhost:{app_port}/?single_visible=true&nav_position=top")

    # Home page should be shown
    expect(app.get_by_test_id("stHeading").filter(has_text="Home Page")).to_be_visible()

    # Top navigation should NOT be mounted (only 1 visible page)
    expect(app.get_by_test_id("stTopNavLink")).to_have_count(0)


def test_hidden_page_accessible_via_switch_page(app: Page) -> None:
    """Test that hidden pages can be accessed via st.switch_page."""
    # Home page should be shown with the switch page button
    expect(app.get_by_test_id("stHeading").filter(has_text="Home Page")).to_be_visible()

    # Click the button that triggers st.switch_page to the hidden admin page
    app.get_by_test_id("stButton").filter(has_text="Switch to Admin").click()
    wait_for_app_run(app)

    # The admin page should be rendered
    expect(
        app.get_by_test_id("stHeading").filter(has_text="Admin Page")
    ).to_be_visible()

    # Navigation should still show only 2 visible pages (Home and About)
    sidebar_nav_links = app.get_by_test_id("stSidebarNavLink")
    expect(sidebar_nav_links).to_have_count(2)


def test_section_hidden_when_all_pages_hidden(app: Page, app_port: int) -> None:
    """Test that section headers are not shown when all pages in a section are hidden."""
    # Navigate to app with test_hidden_section mode
    goto_app(app, f"http://localhost:{app_port}/?test_hidden_section=true")

    # Home page should be shown
    expect(app.get_by_test_id("stHeading").filter(has_text="Home Page")).to_be_visible()

    # Sidebar navigation should be visible
    expect(app.get_by_test_id("stSidebarNav")).to_be_visible()

    # Only the "Main" section header should be visible, not "Admin"
    section_headers = app.get_by_test_id("stNavSectionHeader")
    expect(section_headers).to_have_count(1)
    expect(section_headers.first).to_contain_text("Main")

    # Only 2 visible pages should be shown (Home and About from Main section)
    sidebar_nav_links = app.get_by_test_id("stSidebarNavLink")
    expect(sidebar_nav_links).to_have_count(2)


def test_section_hidden_when_all_pages_hidden_top_nav(app: Page, app_port: int) -> None:
    """Test that section headers are not shown in top nav when all pages are hidden."""
    # Navigate to app with test_hidden_section mode and top nav
    goto_app(
        app, f"http://localhost:{app_port}/?test_hidden_section=true&nav_position=top"
    )

    # Home page should be shown
    expect(app.get_by_test_id("stHeading").filter(has_text="Home Page")).to_be_visible()

    # Only the "Main" section should be visible as a dropdown (Admin section is all hidden)
    # In top nav with sections, pages are rendered inside section dropdowns
    top_nav_sections = app.get_by_test_id("stTopNavSection")
    expect(top_nav_sections).to_have_count(1)
    expect(top_nav_sections.first).to_contain_text("Main")
