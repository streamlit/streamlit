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
    expect(app.get_by_test_id("stHeading")).to_contain_text("Main Page")


def test_renders_sidebar_nav_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the sidebar nav is rendered correctly."""
    assert_snapshot(themed_app.get_by_test_id("stSidebarNav"), name="mpa-sidebar_nav")


def test_can_switch_between_pages_by_clicking_on_sidebar_links(app: Page):
    """Test that we can switch between pages by clicking on sidebar links."""
    app.get_by_test_id("stSidebarNav").locator("a").nth(1).click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stHeading")).to_contain_text("Page 2")


def test_supports_navigating_to_page_directly_via_url(page: Page, app_port: int):
    """Test that we can navigate to a page directly via URL."""
    page.goto(f"http://localhost:{app_port}/page2")
    wait_for_app_loaded(page)

    expect(page.get_by_test_id("stHeading")).to_contain_text("Page 2")


def test_can_switch_between_pages_and_edit_widgets(app: Page):
    """Test that we can switch between pages and edit widgets."""
    slider = app.locator('.stSlider [role="slider"]')
    slider.click()
    slider.press("ArrowRight")
    wait_for_app_run(app, wait_delay=500)

    app.get_by_test_id("stSidebarNav").locator("a").nth(2).click()
    wait_for_app_run(app, wait_delay=1000)

    expect(app.get_by_test_id("stHeading")).to_contain_text("Page 3")
    expect(app.get_by_test_id("stMarkdown")).to_contain_text("x is 0")

    slider.click()
    slider.press("ArrowRight")
    wait_for_app_run(app)

    expect(app.get_by_test_id("stMarkdown")).to_contain_text("x is 1")


def test_can_switch_to_the_first_page_with_a_duplicate_name(app: Page):
    """Test that we can switch to the first page with a duplicate name."""
    app.get_by_test_id("stSidebarNav").locator("a").nth(3).click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stHeading")).to_contain_text("Page 4")


def test_can_switch_to_the_second_page_with_a_duplicate_name(app: Page):
    """Test that we can switch to the second page with a duplicate name."""
    app.get_by_test_id("stSidebarNav").locator("a").nth(4).click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stHeading")).to_contain_text("Page 5")


def test_runs_the_first_page_with_a_duplicate_name_if_navigating_via_url(
    page: Page, app_port: int
):
    """Test that we run the first page with a duplicate name if navigating via URL."""
    page.goto(f"http://localhost:{app_port}/page_with_duplicate_name")
    wait_for_app_loaded(page)

    expect(page.get_by_test_id("stHeading")).to_contain_text("Page 4")


def test_show_not_found_dialog(page: Page, app_port: int):
    """Test that we show a not found dialog if the page doesn't exist."""
    page.goto(f"http://localhost:{app_port}/not_a_page")
    wait_for_app_loaded(page)

    expect(page.locator('[role="dialog"]')).to_contain_text("Page not found")


def test_handles_expand_collapse_of_mpa_nav_correctly(
    page: Page, app_port: int, assert_snapshot: ImageCompareFunction
):
    """Test that we handle expand/collapse of MPA nav correctly."""

    page.goto(f"http://localhost:{app_port}/page_7")
    wait_for_app_loaded(page)

    view_button = page.get_by_test_id("stSidebarNavViewButton")

    expect(view_button).to_be_visible()

    # Expand the nav
    view_button.click(force=True)
    # We apply a quick timeout here so that the UI has some time to
    # adjust for the screenshot after the click
    page.wait_for_timeout(250)
    assert_snapshot(
        page.get_by_test_id("stSidebarNav"), name="mpa-sidebar_nav_expanded"
    )

    # Collapse the nav
    view_button.click(force=True)
    page.wait_for_timeout(250)
    assert_snapshot(
        page.get_by_test_id("stSidebarNav"), name="mpa-sidebar_nav_collapsed"
    )

    # Expand the nav again
    view_button.click(force=True)
    page.wait_for_timeout(250)
    assert_snapshot(
        page.get_by_test_id("stSidebarNav"), name="mpa-sidebar_nav_expanded"
    )


def test_switch_page(app: Page):
    """Test that we can switch between pages by triggering st.switch_page."""

    # Click the button to trigger st.switch_page using relative path
    app.get_by_test_id("stButton").nth(0).locator("button").first.click()
    wait_for_app_run(app)

    # Check that we are on the correct page
    expect(app.get_by_test_id("stHeading")).to_contain_text("Page 2")

    # st.switch_page using relative path & leading /
    app.get_by_test_id("baseButton-secondary").click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stHeading")).to_contain_text("Page 6")

    # st.switch_page using relative path & leading ./
    app.get_by_test_id("baseButton-secondary").click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stHeading")).to_contain_text("Main Page")


def test_switch_page_preserves_embed_params(page: Page, app_port: int):
    """Test that st.switch_page only preserves embed params."""

    # Start at main page with embed & other query params
    page.goto(
        f"http://localhost:{app_port}/?embed=true&embed_options=light_theme&bar=foo"
    )
    wait_for_app_loaded(page, embedded=True)
    expect(page.get_by_test_id("stJson")).to_contain_text('{"bar":"foo"}')

    # Trigger st.switch_page
    page.get_by_test_id("stButton").nth(0).locator("button").first.click()
    wait_for_app_loaded(page, embedded=True)

    # Check that only embed query params persist
    expect(page).to_have_url(
        f"http://localhost:{app_port}/page2?embed=true&embed_options=light_theme"
    )
    expect(page.get_by_test_id("stJson")).not_to_contain_text('{"bar":"foo"}')


def test_switch_page_removes_query_params(page: Page, app_port: int):
    """Test that query params are removed when navigating via st.switch_page"""

    # Start at main page with query params
    page.goto(f"http://localhost:{app_port}/?foo=bar")
    wait_for_app_loaded(page)

    # Trigger st.switch_page
    page.get_by_test_id("stButton").nth(0).locator("button").first.click()
    wait_for_app_loaded(page)
    # Check that query params don't persist
    expect(page).to_have_url(f"http://localhost:{app_port}/page2")


def test_switch_page_switches_immediately_if_second_page_is_slow(app: Page):
    app.get_by_test_id("stButton").nth(1).locator("button").first.click()

    # Wait for the view container and main menu to appear (like in wait_for_app_loaded),
    # but don't wait for the script to finish running.
    app.wait_for_selector(
        "[data-testid='stAppViewContainer']", timeout=30000, state="attached"
    )
    app.wait_for_selector("[data-testid='stMainMenu']", timeout=20000, state="attached")

    # We expect to see the page transition to the slow page by the time this call times
    # out in 5s. Otherwise, the page contents aren't being rendered until the script has
    # fully completed, and we've run into https://github.com/streamlit/streamlit/issues/7954
    expect(app.get_by_test_id("stHeading")).to_contain_text("Slow page")


def test_widget_state_reset_on_page_switch(app: Page):
    # Regression test for GH issue 7338

    # Page 3
    app.get_by_test_id("stSidebarNav").locator("a").nth(2).click()

    slider = app.locator('.stSlider [role="slider"]')
    slider.click()
    slider.press("ArrowRight")
    wait_for_app_run(app, wait_delay=500)
    expect(app.get_by_test_id("stMarkdown")).to_contain_text("x is 1")

    # Switch to the slow page
    app.get_by_test_id("stSidebarNav").locator("a").nth(7).click()

    # Wait for the view container and main menu to appear (like in wait_for_app_loaded),
    # but don't wait for the script to finish running.
    app.wait_for_selector(
        "[data-testid='stAppViewContainer']", timeout=30000, state="attached"
    )
    app.wait_for_selector("[data-testid='stMainMenu']", timeout=20000, state="attached")

    # Back to page 3
    app.get_by_test_id("stSidebarNav").locator("a").nth(2).click()
    wait_for_app_run(app, wait_delay=500)

    # Slider reset
    expect(app.get_by_test_id("stMarkdown")).to_contain_text("x is 0")


def test_removes_query_params_when_swapping_pages(page: Page, app_port: int):
    """Test that query params are removed when swapping pages"""

    page.goto(f"http://localhost:{app_port}/page_7?foo=bar")
    wait_for_app_loaded(page)

    page.get_by_test_id("stSidebarNav").locator("a").nth(2).click()
    wait_for_app_loaded(page)
    expect(page).to_have_url(f"http://localhost:{app_port}/page3")


def test_removes_non_embed_query_params_when_swapping_pages(page: Page, app_port: int):
    """Test that query params are removed when swapping pages"""

    page.goto(
        f"http://localhost:{app_port}/page_7?foo=bar&embed=True&embed_options=show_toolbar&embed_options=show_colored_line"
    )
    wait_for_app_loaded(page)

    page.get_by_test_id("stSidebarNav").locator("a").nth(2).click()
    wait_for_app_loaded(page)

    expect(page).to_have_url(
        f"http://localhost:{app_port}/page3?embed=true&embed_options=show_toolbar&embed_options=show_colored_line"
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
