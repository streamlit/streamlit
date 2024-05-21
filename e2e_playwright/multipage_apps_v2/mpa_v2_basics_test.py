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


def main_heading(app: Page):
    return app.get_by_test_id("stHeading").nth(0)


def page_heading(app: Page):
    return app.get_by_test_id("stHeading").nth(1)


def check_field(
    app: Page, *, hide_sidebarnav=False, dynamic_pages=False, add_sidebar_elements=False
):
    checkboxes = app.get_by_test_id("stCheckbox")

    if hide_sidebarnav:
        checkboxes.nth(0).click(delay=50)

    if dynamic_pages:
        checkboxes.nth(1).click(delay=50)

    if add_sidebar_elements:
        checkboxes.nth(2).click(delay=50)


expected_page_order = [
    "page 2",
    "Different Title",
    "page 4",
    "page 5",
    "page 6",
    "page 7",
    "page 8",
    "page 9",
    "page 10",
    "page 11",
    "page 12",
]


def get_page_link(
    app: Page, page_name: str, page_order: list[str] = expected_page_order
):
    return (
        app.get_by_test_id("stSidebarNav").locator("a").nth(page_order.index(page_name))
    )


def expect_page_order(app: Page, page_order: list[str] = expected_page_order):
    """Test that the page order is correct"""
    nav = app.get_by_test_id("stSidebarNav")
    for i, title in enumerate(page_order):
        expect(nav.locator("a").nth(i)).to_contain_text(title)


def test_loads_main_script_on_initial_page_load(app: Page):
    """Test that the main script is loaded on initial page load."""
    expect(main_heading(app)).to_contain_text("Main Page")


def test_renders_sidebar_nav_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the sidebar nav is rendered correctly."""
    assert_snapshot(themed_app.get_by_test_id("stSidebarNav"), name="mpa-sidebar_nav")


def test_can_switch_between_pages_by_clicking_on_sidebar_links(app: Page):
    """Test that we can switch between pages by clicking on sidebar links."""
    get_page_link(app, "Different Title").click()
    wait_for_app_run(app)
    expect(page_heading(app)).to_contain_text("Page 3")


def test_main_script_persists_across_page_changes(app: Page):
    """Test that we can switch between pages and content from main script persists."""
    get_page_link(app, "Different Title").click()
    wait_for_app_run(app)
    expect(main_heading(app)).to_contain_text("Main Page")


def test_main_script_widgets_persist_across_page_changes(app: Page):
    """Test that we can switch between pages and widgets from main script persists."""
    slider = app.locator('.stSlider [role="slider"]')
    slider.click()
    slider.press("ArrowRight")
    wait_for_app_run(app, wait_delay=500)

    get_page_link(app, "page 5").click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stMarkdown").nth(0)).to_contain_text("x is 1")


def test_supports_navigating_to_page_directly_via_url(app: Page, app_port: int):
    """Test that we can navigate to a page directly via URL."""
    app.goto(f"http://localhost:{app_port}/page_5")
    wait_for_app_loaded(app)

    expect(page_heading(app)).to_contain_text("Page 5")


def test_supports_navigating_to_page_directly_via_url_path(app: Page, app_port: int):
    """Test that we can navigate to a page directly via URL. using the url_path."""
    app.goto(f"http://localhost:{app_port}/my_url_path")
    wait_for_app_loaded(app)
    expect(app).to_have_url(f"http://localhost:{app_port}/my_url_path")
    expect(page_heading(app)).to_contain_text("Page 8")


def test_can_switch_between_pages_and_edit_widgets(app: Page):
    """Test that we can switch between pages and page widgets do not persist."""
    get_page_link(app, "Different Title").click()
    wait_for_app_run(app, wait_delay=1000)

    slider = app.locator('.stSlider [role="slider"]').nth(1)
    slider.click()
    slider.press("ArrowRight")
    wait_for_app_run(app)
    expect(app.get_by_test_id("stMarkdown").nth(1)).to_contain_text("x is 1")

    get_page_link(app, "page 2").click()
    wait_for_app_run(app, wait_delay=1000)

    get_page_link(app, "Different Title").click()
    wait_for_app_run(app, wait_delay=1000)

    expect(app.get_by_test_id("stMarkdown").nth(1)).to_contain_text("x is 0")


def test_titles_are_set_correctly(app: Page):
    """Test that page titles work as expected"""
    expect_page_order(app)


def test_dynamic_pages(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that dynamic pages are defined"""
    check_field(themed_app, dynamic_pages=True)
    wait_for_app_run(themed_app)

    nav = themed_app.get_by_test_id("stSidebarNav")
    expect_page_order(themed_app, ["page 2", "Different Title", "page 5", "page 9"])

    assert_snapshot(nav, name="dynamic-pages")


def test_show_not_found_dialog(app: Page, app_port: int):
    """Test that we show a not found dialog if the page doesn't exist."""
    app.goto(f"http://localhost:{app_port}/not_a_page")
    wait_for_app_loaded(app)

    expect(app.locator('[role="dialog"]')).to_contain_text("Page not found")


def test_handles_expand_collapse_of_mpa_nav_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that we handle expand/collapse of MPA nav correctly."""

    check_field(themed_app, add_sidebar_elements=True)
    wait_for_app_run(themed_app)

    view_button = themed_app.get_by_test_id("stSidebarNavViewButton")

    expect(view_button).to_be_visible()

    # Expand the nav
    view_button.click(force=True)
    expect(view_button).to_have_text("View less")
    assert_snapshot(
        themed_app.get_by_test_id("stSidebarNav"), name="mpa-sidebar_nav_expanded"
    )

    # Collapse the nav
    view_button.click(force=True)
    expect(view_button).to_have_text("View more")
    assert_snapshot(
        themed_app.get_by_test_id("stSidebarNav"), name="mpa-sidebar_nav_collapsed"
    )

    # Expand the nav again
    view_button.click(force=True)
    expect(view_button).to_have_text("View less")
    assert_snapshot(
        themed_app.get_by_test_id("stSidebarNav"), name="mpa-sidebar_nav_expanded"
    )


def test_switch_page_by_path(app: Page):
    """Test that we can switch between pages by triggering st.switch_page with a path."""

    app.get_by_test_id("baseButton-secondary").filter(has_text="page 5").click()
    wait_for_app_run(app)

    expect(page_heading(app)).to_contain_text("Page 5")


def test_switch_page_by_st_page(app: Page):
    """Test that we can switch between pages by triggering st.switch_page with st.Page."""

    app.get_by_test_id("baseButton-secondary").filter(has_text="page 9").click()
    wait_for_app_run(app)

    expect(page_heading(app)).to_contain_text("Page 9")


def test_removes_query_params_with_st_switch_page(app: Page, app_port: int):
    """Test that query params are removed when navigating via st.switch_page"""

    # Start at main page with query params
    app.goto(f"http://localhost:{app_port}/?foo=bar")
    wait_for_app_loaded(app)
    expect(app).to_have_url(f"http://localhost:{app_port}/?foo=bar")

    # Trigger st.switch_page
    app.get_by_test_id("baseButton-secondary").filter(has_text="page 5").click()
    wait_for_app_loaded(app)
    # Check that query params don't persist
    expect(app).to_have_url(f"http://localhost:{app_port}/page_5")


def test_removes_query_params_when_clicking_link(app: Page, app_port: int):
    """Test that query params are removed when swapping pages by clicking on a link"""

    app.goto(f"http://localhost:{app_port}/page_7?foo=bar")
    wait_for_app_loaded(app)
    expect(app).to_have_url(f"http://localhost:{app_port}/page_7?foo=bar")

    get_page_link(app, "page 4").click()
    wait_for_app_loaded(app)
    expect(app).to_have_url(f"http://localhost:{app_port}/page_4")


def test_removes_non_embed_query_params_when_swapping_pages(app: Page, app_port: int):
    """Test that non-embed query params are removed when swapping pages"""

    app.goto(
        f"http://localhost:{app_port}/page_7?foo=bar&embed=True&embed_options=show_toolbar&embed_options=show_colored_line"
    )
    wait_for_app_loaded(app)
    expect(app).to_have_url(
        f"http://localhost:{app_port}/page_7?foo=bar&embed=True&embed_options=show_toolbar&embed_options=show_colored_line"
    )

    get_page_link(app, "page 4").click()
    wait_for_app_loaded(app)

    expect(app).to_have_url(
        f"http://localhost:{app_port}/page_4?embed=true&embed_options=show_toolbar&embed_options=show_colored_line"
    )


def test_renders_logos(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that logos display properly in sidebar and main sections"""

    # Go to logo page & wait short moment for logo to appear
    get_page_link(app, "page 8").click()
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

    app.get_by_test_id("stPageLink-NavLink").filter(has_text="page 5 page link").click()
    wait_for_app_loaded(app)

    expect(page_heading(app)).to_contain_text("Page 5")


def test_page_link_with_st_file(app: Page):
    """Test st.page_link works with a st.Page"""

    app.get_by_test_id("stPageLink-NavLink").filter(has_text="page 9 page link").click()
    wait_for_app_loaded(app)

    expect(page_heading(app)).to_contain_text("Page 9")


def test_hidden_navigation(app: Page):
    """Test position=hidden hides the navigation"""

    expect(app.get_by_test_id("stSidebarNav")).to_be_visible()
    check_field(app, add_sidebar_elements=True)
    wait_for_app_run(app)

    check_field(app, hide_sidebarnav=True)
    wait_for_app_run(app)

    nav_exists = app.get_by_test_id("stSidebarNav")
    expect(nav_exists).not_to_be_attached()


def test_set_default_navigation(app: Page, app_port: int):
    """Test the default page set will be shown on initial load"""

    expect(page_heading(app)).to_contain_text("Page 2")
    wait_for_app_run(app)

    app.goto(f"http://localhost:{app_port}/?default=True")
    wait_for_app_loaded(app)

    expect(page_heading(app)).to_contain_text("Page 6")


def test_page_url_path_appears_in_url(app: Page, app_port: int):
    """Test that st.Page's url_path is included in the URL"""
    link = get_page_link(app, "page 8")

    expect(link).to_have_attribute("href", f"http://localhost:{app_port}/my_url_path")
    link.click()
    wait_for_app_loaded(app)
    expect(app).to_have_url(f"http://localhost:{app_port}/my_url_path")
