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

from e2e_playwright.conftest import (
    ImageCompareFunction,
    wait_for_app_loaded,
    wait_for_app_run,
)
from e2e_playwright.shared.app_utils import (
    click_button,
    get_button_group,
    get_segment_button,
    goto_app,
    wait_for_all_images_to_be_loaded,
)
from e2e_playwright.shared.react18_utils import take_stable_snapshot


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
    goto_app(page, f"http://localhost:{app_port}/page2")

    expect(page.get_by_test_id("stHeading")).to_contain_text("Page 2")


def test_can_switch_between_pages_and_edit_widgets(app: Page):
    """Test that we can switch between pages and edit widgets."""
    slider = app.locator('.stSlider [role="slider"]')
    slider.click()
    slider.press("ArrowRight")
    wait_for_app_run(app, wait_delay=500)

    app.get_by_test_id("stSidebarNav").locator("a").nth(2).click()
    wait_for_app_run(app, wait_delay=1000)
    expect(app.get_by_role("heading", name="Page 3")).to_be_visible()

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


def test_runs_the_first_page_with_a_duplicate_name_if_navigating_via_url(
    page: Page, app_port: int
):
    """Test that we run the first page with a duplicate name if navigating via URL."""
    goto_app(page, f"http://localhost:{app_port}/page_with_duplicate_name")

    expect(page.get_by_test_id("stHeading")).to_contain_text("Page 4")


def test_show_not_found_dialog(page: Page, app_port: int):
    """Test that we show a not found dialog if the page doesn't exist."""
    goto_app(page, f"http://localhost:{app_port}/not_a_page")

    expect(page.locator('[role="dialog"]')).to_contain_text("Page not found")


def test_handles_expand_collapse_of_mpa_nav_correctly(
    page: Page, app_port: int, assert_snapshot: ImageCompareFunction
):
    """Test that we handle expand/collapse of MPA nav correctly."""

    goto_app(page, f"http://localhost:{app_port}/page_7")

    view_button = page.get_by_test_id("stSidebarNavViewButton")

    expect(view_button).to_be_visible()

    # Expand the nav
    view_button.click(force=True)
    # We apply a quick timeout here so that the UI has some time to
    # adjust for the screenshot after the click
    page.wait_for_timeout(250)
    # move the mouse out of the way to avoid hover effects
    page.mouse.move(0, 0)
    assert_snapshot(
        page.get_by_test_id("stSidebarNav"), name="mpa-sidebar_nav_expanded"
    )

    # Collapse the nav
    view_button.click(force=True)
    page.wait_for_timeout(250)
    # move the mouse out of the way to avoid hover effects
    page.mouse.move(0, 0)
    assert_snapshot(
        page.get_by_test_id("stSidebarNav"), name="mpa-sidebar_nav_collapsed"
    )

    # Expand the nav again
    view_button.click(force=True)
    page.wait_for_timeout(250)
    # move the mouse out of the way to avoid hover effects
    page.mouse.move(0, 0)
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
    click_button(app, "pages/06_page_6.py")
    expect(app.get_by_test_id("stHeading")).to_contain_text("Page 6")

    # st.switch_page using relative path & leading ./
    click_button(app, "./mpa_basics.py")
    expect(app.get_by_test_id("stHeading")).to_contain_text("Main Page")


def test_switch_page_preserves_embed_params(page: Page, app_port: int):
    """Test that st.switch_page only preserves embed params."""

    # Start at main page with embed & other query params
    goto_app(
        page,
        f"http://localhost:{app_port}/?embed=true&embed_options=light_theme&bar=foo",
    )
    expect(page.get_by_test_id("stJson")).to_contain_text('{"bar":"foo"}')

    # Trigger st.switch_page
    page.get_by_test_id("stButton").nth(0).locator("button").first.click()
    wait_for_app_loaded(page)

    # Check that only embed query params persist
    expect(page).to_have_url(
        f"http://localhost:{app_port}/page2?embed=true&embed_options=light_theme"
    )
    expect(page.get_by_test_id("stJson")).not_to_contain_text('{"bar":"foo"}')


def test_switch_page_removes_query_params(page: Page, app_port: int):
    """Test that query params are removed when navigating via st.switch_page."""

    # Start at main page with query params
    goto_app(page, f"http://localhost:{app_port}/?foo=bar")

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

    expect(app.get_by_role("heading", name="Page 3")).to_be_visible()

    slider = app.locator('.stSlider [role="slider"]')
    slider.click()
    slider.press("ArrowRight")
    wait_for_app_run(app, wait_delay=500)
    expect(app.get_by_test_id("stMarkdown")).to_contain_text("x is 1")

    # Switch to the slow page
    app.get_by_test_id("stSidebarNav").locator("a").nth(7).click()

    expect(app.get_by_role("heading", name="slow page")).to_be_visible()

    # Wait for the view container and main menu to appear (like in wait_for_app_loaded),
    # but don't wait for the script to finish running.
    app.wait_for_selector(
        "[data-testid='stAppViewContainer']", timeout=30000, state="attached"
    )
    app.wait_for_selector("[data-testid='stMainMenu']", timeout=20000, state="attached")

    # Back to page 3
    app.get_by_test_id("stSidebarNav").locator("a").nth(2).click()
    expect(app.get_by_role("heading", name="Page 3")).to_be_visible()
    wait_for_app_run(app, wait_delay=500)

    # Slider reset
    expect(app.get_by_test_id("stMarkdown")).to_contain_text("x is 0")


def test_removes_query_params_when_swapping_pages(page: Page, app_port: int):
    """Test that query params are removed when swapping pages."""

    goto_app(page, f"http://localhost:{app_port}/page_7?foo=bar")

    page.get_by_test_id("stSidebarNav").locator("a").nth(2).click()
    wait_for_app_loaded(page)
    expect(page).to_have_url(f"http://localhost:{app_port}/page3")


def test_removes_non_embed_query_params_when_swapping_pages(page: Page, app_port: int):
    """Test that query params are removed when swapping pages."""

    goto_app(
        page,
        f"http://localhost:{app_port}/page_7?foo=bar&embed=True&embed_options=show_toolbar&embed_options=show_colored_line",
    )

    page.get_by_test_id("stSidebarNav").locator("a").nth(2).click()
    wait_for_app_loaded(page)

    expect(page).to_have_url(
        f"http://localhost:{app_port}/page3?embed=true&embed_options=show_toolbar&embed_options=show_colored_line"
    )


def test_renders_logos(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that logos display properly in sidebar and main sections."""

    # Go to logo page & wait short moment for logo to appear
    app.get_by_test_id("stSidebarNav").locator("a").nth(8).click()
    wait_for_app_loaded(app)

    expect(app.get_by_role("heading", name="Logo page")).to_be_visible()

    # Sidebar logo
    expect(app.get_by_test_id("stSidebarHeader").locator("a")).to_have_attribute(
        "href", "https://www.example.com"
    )
    wait_for_all_images_to_be_loaded(app)
    take_stable_snapshot(
        app,
        app.get_by_test_id("stSidebar"),
        assert_snapshot,
        name="sidebar-logo",
    )

    # Collapse the sidebar
    app.get_by_test_id("stSidebarContent").hover()
    collapse_button = app.get_by_test_id("stSidebarCollapseButton").locator("button")
    expect(collapse_button).to_be_visible()
    collapse_button.click()

    app.wait_for_timeout(1000)
    # Wait for sidebar to be collapsed, the expand button should now be visible in the header
    expect(app.get_by_test_id("stExpandSidebarButton")).to_be_visible()

    # Collapsed logo should be in the header
    header_element = app.get_by_test_id("stHeader")
    logo_link_element = header_element.get_by_test_id("stLogoLink")
    expect(logo_link_element).to_be_visible()
    expect(logo_link_element).to_have_attribute("href", "https://www.example.com")

    collapsed_logo_image = logo_link_element.get_by_test_id("stHeaderLogo")
    expect(collapsed_logo_image).to_be_visible()
    wait_for_all_images_to_be_loaded(app)
    take_stable_snapshot(
        app,
        collapsed_logo_image,
        assert_snapshot,
        name="collapsed-header-logo",
    )


def test_renders_small_logos(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that small logos display properly in sidebar and main sections."""

    # Go to small logo page & wait short moment for logo to appear
    app.get_by_test_id("stSidebarNav").locator("a").nth(9).click()
    wait_for_app_loaded(app)

    expect(app.get_by_role("heading", name="Logo page")).to_be_visible()

    # Sidebar logo
    expect(app.get_by_test_id("stSidebarHeader").locator("a")).to_have_attribute(
        "href", "https://www.example.com"
    )
    assert_snapshot(app.get_by_test_id("stSidebar"), name="small-sidebar-logo")


def test_renders_large_logos(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that large logos display properly in sidebar and main sections."""

    # Go to large logo page & wait short moment for logo to appear
    app.get_by_test_id("stSidebarNav").locator("a").nth(10).click()
    wait_for_app_loaded(app)

    expect(app.get_by_role("heading", name="Logo page")).to_be_visible()

    # Sidebar logo
    expect(app.get_by_test_id("stSidebarHeader").locator("a")).to_have_attribute(
        "href", "https://www.example.com"
    )
    wait_for_all_images_to_be_loaded(app)
    take_stable_snapshot(
        app,
        app.get_by_test_id("stSidebar"),
        assert_snapshot,
        name="large-sidebar-logo",
    )

    # Collapse the sidebar
    app.get_by_test_id("stSidebarContent").hover()
    collapse_button = app.get_by_test_id("stSidebarCollapseButton").locator("button")
    expect(collapse_button).to_be_visible()
    collapse_button.click()

    app.wait_for_timeout(1000)

    # Wait for sidebar to be collapsed, the expand button should now be visible in the header
    expect(app.get_by_test_id("stExpandSidebarButton")).to_be_visible()

    # Collapsed logo should be in the header
    header_element = app.get_by_test_id("stHeader")
    logo_link_element = header_element.get_by_test_id("stLogoLink")
    expect(logo_link_element).to_be_visible()
    expect(logo_link_element).to_have_attribute("href", "https://www.example.com")

    collapsed_logo_image = logo_link_element.get_by_test_id("stHeaderLogo")
    expect(collapsed_logo_image).to_be_visible()
    wait_for_all_images_to_be_loaded(app)
    take_stable_snapshot(
        app,
        collapsed_logo_image,
        assert_snapshot,
        name="large-collapsed-header-logo",
    )


def test_completes_script_lifecycle(app: Page):
    app.get_by_test_id("stSidebarNav").locator("a").nth(11).click()
    wait_for_app_loaded(app)
    # Verify initial state is set correctly
    expect(app.get_by_text("radio value: A, state value: A")).to_be_visible()

    # Update the radio button and verify the state is updated
    radio_button = app.get_by_test_id("stRadio").first
    radio_option = radio_button.locator('label[data-baseweb="radio"]').nth(1)
    radio_option.click(delay=50)
    wait_for_app_run(app)
    expect(app.get_by_text("radio value: B, state value: B")).to_be_visible()

    # Switch the segmented control to remove the radio button
    segmented_control = get_button_group(app, "layout_mode")
    get_segment_button(segmented_control, "layout2").click()
    wait_for_app_run(app)

    # Switch back to the layout with the radio button
    get_segment_button(segmented_control, "layout1").click()
    wait_for_app_run(app)

    # Expect the state to be reset to the initial state
    expect(app.get_by_text("radio value: A, state value: A")).to_be_visible()
