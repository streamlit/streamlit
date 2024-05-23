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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import (
    ImageCompareFunction,
    wait_for_app_loaded,
    wait_for_app_run,
)


def test_loads_main_script_on_initial_page_load(app: Page):
    """Test that the main script is loaded on initial page load."""
    expect(app.get_by_test_id("stHeading").nth(0)).to_contain_text("Main Page")


def test_renders_sidebar_nav_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the sidebar nav is rendered correctly."""
    assert_snapshot(themed_app.get_by_test_id("stSidebarNav"), name="mpa-sidebar_nav")


def test_can_switch_between_pages_by_clicking_on_sidebar_links(app: Page):
    """Test that we can switch between pages by clicking on sidebar links."""
    app.get_by_test_id("stSidebarNav").locator("a").nth(1).click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stHeading").nth(1)).to_contain_text("Page 3")


def test_main_script_persists_across_page_changes(app: Page):
    """Test that we can switch between pages and content from main script persists."""
    app.get_by_test_id("stSidebarNav").locator("a").nth(1).click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stHeading").nth(0)).to_contain_text("Main Page")


def test_main_script_widgets_persist_across_page_changes(app: Page):
    """Test that we can switch between pages and widgets from main script persists."""
    slider = app.locator('.stSlider [role="slider"]')
    slider.click()
    slider.press("ArrowRight")
    wait_for_app_run(app, wait_delay=500)

    app.get_by_test_id("stSidebarNav").locator("a").nth(3).click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stMarkdown").nth(0)).to_contain_text("x is 1")


def test_supports_navigating_to_page_directly_via_url(page: Page, app_port: int):
    """Test that we can navigate to a page directly via URL."""
    page.goto(f"http://localhost:{app_port}/page_5")
    wait_for_app_loaded(page)

    expect(page.get_by_test_id("stHeading").nth(1)).to_contain_text("Page 5")


def test_supports_navigating_to_page_directly_via_url_title(page: Page, app_port: int):
    """Test that we can navigate to a page directly via URL. using the title."""
    page.goto(f"http://localhost:{app_port}/Different_Title")
    wait_for_app_loaded(page)

    expect(page.get_by_test_id("stHeading").nth(1)).to_contain_text("Page 3")


def test_can_switch_between_pages_and_edit_widgets(app: Page):
    """Test that we can switch between pages and page widgets do not persist."""
    app.get_by_test_id("stSidebarNav").locator("a").nth(1).click()
    wait_for_app_run(app, wait_delay=1000)

    slider = app.locator('.stSlider [role="slider"]').nth(1)
    slider.click()
    slider.press("ArrowRight")
    wait_for_app_run(app)
    expect(app.get_by_test_id("stMarkdown").nth(1)).to_contain_text("x is 1")

    app.get_by_test_id("stSidebarNav").locator("a").nth(0).click()
    wait_for_app_run(app, wait_delay=1000)

    app.get_by_test_id("stSidebarNav").locator("a").nth(1).click()
    wait_for_app_run(app, wait_delay=1000)

    expect(app.get_by_test_id("stMarkdown").nth(1)).to_contain_text("x is 0")


def test_titles_are_set_correctly(app: Page):
    """Test that page titles work as expected"""
    nav = app.get_by_test_id("stSidebarNav")
    expect(nav.locator("a").nth(0)).to_contain_text("page 2")
    expect(nav.locator("a").nth(1)).to_contain_text("Different Title")
    expect(nav.locator("a").nth(2)).to_contain_text("page 4")
    expect(nav.locator("a").nth(3)).to_contain_text("page 5")
    expect(nav.locator("a").nth(4)).to_contain_text("page 6")
    expect(nav.locator("a").nth(5)).to_contain_text("page 7")
    expect(nav.locator("a").nth(6)).to_contain_text("page 8")
    expect(nav.locator("a").nth(7)).to_contain_text("page 9")
    expect(nav.locator("a").nth(8)).to_contain_text("page 10")
    expect(nav.locator("a").nth(9)).to_contain_text("page 11")
    expect(nav.locator("a").nth(10)).to_contain_text("page 12")


def test_dynamic_pages(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that dynamic pages are defined"""
    themed_app.get_by_test_id("stCheckbox").nth(1).click(delay=50)
    wait_for_app_run(themed_app)

    nav = themed_app.get_by_test_id("stSidebarNav")
    expect(nav.locator("a").nth(0)).to_contain_text("page 2")
    expect(nav.locator("a").nth(1)).to_contain_text("Different Title")
    expect(nav.locator("a").nth(2)).to_contain_text("page 5")
    expect(nav.locator("a").nth(3)).to_contain_text("page 9")

    assert_snapshot(nav, name="dynamic-pages")


def test_show_not_found_dialog(page: Page, app_port: int):
    """Test that we show a not found dialog if the page doesn't exist."""
    page.goto(f"http://localhost:{app_port}/not_a_page")
    wait_for_app_loaded(page)

    expect(page.locator('[role="dialog"]')).to_contain_text("Page not found")


def test_handles_expand_collapse_of_mpa_nav_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that we handle expand/collapse of MPA nav correctly."""

    themed_app.get_by_test_id("stCheckbox").nth(2).click(delay=50)
    wait_for_app_run(themed_app)

    view_button = themed_app.get_by_test_id("stSidebarNavViewButton")

    expect(view_button).to_be_visible()

    # Expand the nav
    view_button.click(force=True)
    # We apply a quick timeout here so that the UI has some time to
    # adjust for the screenshot after the click
    themed_app.wait_for_timeout(250)
    assert_snapshot(
        themed_app.get_by_test_id("stSidebarNav"), name="mpa-sidebar_nav_expanded"
    )

    # Collapse the nav
    view_button.click(force=True)
    themed_app.wait_for_timeout(250)
    assert_snapshot(
        themed_app.get_by_test_id("stSidebarNav"), name="mpa-sidebar_nav_collapsed"
    )

    # Expand the nav again
    view_button.click(force=True)
    themed_app.wait_for_timeout(250)
    assert_snapshot(
        themed_app.get_by_test_id("stSidebarNav"), name="mpa-sidebar_nav_expanded"
    )


def test_switch_page_by_path(app: Page):
    """Test that we can switch between pages by triggering st.switch_page with a path."""

    app.get_by_test_id("stButton").nth(0).locator("button").first.click()
    wait_for_app_run(app)

    expect(app.get_by_test_id("stHeading").nth(1)).to_contain_text("Page 5")


def test_switch_page_by_st_page(app: Page):
    """Test that we can switch between pages by triggering st.switch_page with st.Page."""

    app.get_by_test_id("stButton").nth(1).locator("button").first.click()
    wait_for_app_run(app)

    expect(app.get_by_test_id("stHeading").nth(1)).to_contain_text("Page 9")


def test_switch_page_removes_query_params(page: Page, app_port: int):
    """Test that query params are removed when navigating via st.switch_page"""

    # Start at main page with query params
    page.goto(f"http://localhost:{app_port}/?foo=bar")
    wait_for_app_loaded(page)

    # Trigger st.switch_page
    page.get_by_test_id("stButton").nth(0).locator("button").first.click()
    wait_for_app_loaded(page)
    # Check that query params don't persist
    expect(page).to_have_url(f"http://localhost:{app_port}/page_5")


def test_removes_query_params_when_swapping_pages(page: Page, app_port: int):
    """Test that query params are removed when swapping pages"""

    page.goto(f"http://localhost:{app_port}/page_7?foo=bar")
    wait_for_app_loaded(page)

    page.get_by_test_id("stSidebarNav").locator("a").nth(2).click()
    wait_for_app_loaded(page)
    expect(page).to_have_url(f"http://localhost:{app_port}/page_4")


def test_removes_non_embed_query_params_when_swapping_pages(page: Page, app_port: int):
    """Test that non-embed query params are removed when swapping pages"""

    page.goto(
        f"http://localhost:{app_port}/page_7?foo=bar&embed=True&embed_options=show_toolbar&embed_options=show_colored_line"
    )
    wait_for_app_loaded(page)

    page.get_by_test_id("stSidebarNav").locator("a").nth(2).click()
    wait_for_app_loaded(page)

    expect(page).to_have_url(
        f"http://localhost:{app_port}/page_4?embed=true&embed_options=show_toolbar&embed_options=show_colored_line"
    )


def test_renders_logos(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that logos display properly in sidebar and main sections"""

    # Go to logo page & wait short moment for logo to appear
    app.get_by_test_id("stSidebarNav").locator("a").nth(8).click()
    wait_for_app_loaded(app)

    # Sidebar logo
    expect(app.get_by_test_id("stSidebarHeader").locator("a")).to_have_attribute(
        "href", "https://www.example.com"
    )
    assert_snapshot(app.get_by_test_id("stSidebar"), name="sidebar-logo")

    # Collapse the sidebar
    app.get_by_test_id("stSidebarContent").hover()
    app.get_by_test_id("stSidebarCollapseButton").locator("button").click()
    app.wait_for_timeout(500)

    # Collapsed logo
    expect(app.get_by_test_id("collapsedControl").locator("a")).to_have_attribute(
        "href", "https://www.example.com"
    )
    assert_snapshot(app.get_by_test_id("collapsedControl"), name="collapsed-logo")


def test_page_link_with_path(app: Page):
    """Test st.page_link works with a path"""

    app.get_by_test_id("stPageLink-NavLink").nth(0).click()
    wait_for_app_loaded(app)

    expect(app.get_by_test_id("stHeading").nth(1)).to_contain_text("Page 5")


def test_page_link_with_st_file(app: Page):
    """Test st.page_link works with a st.Page"""

    app.get_by_test_id("stPageLink-NavLink").nth(1).click()
    wait_for_app_loaded(app)

    expect(app.get_by_test_id("stHeading").nth(1)).to_contain_text("Page 9")


def test_hidden_navigation(app: Page):
    """Test position=hidden hides the navigation"""

    expect(app.get_by_test_id("stSidebarNav")).to_be_visible()
    app.get_by_test_id("stCheckbox").nth(2).click(delay=50)
    wait_for_app_run(app)

    app.get_by_test_id("stCheckbox").nth(0).click(delay=50)
    wait_for_app_run(app)

    nav_exists = app.get_by_test_id("stSidebarNav")
    expect(nav_exists).not_to_be_attached()


def test_set_default_navigation(app: Page, app_port: int):
    """Test the default page set will be shown on initial load"""

    expect(app.get_by_test_id("stHeading").nth(1)).to_contain_text("Page 2")
    wait_for_app_run(app)

    app.goto(f"http://localhost:{app_port}/?default=True")
    wait_for_app_loaded(app)

    expect(app.get_by_test_id("stHeading").nth(1)).to_contain_text("Page 6")
