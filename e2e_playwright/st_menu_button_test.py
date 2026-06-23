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

import re

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_checkbox,
    expect_markdown,
    get_element_by_key,
)


def get_menu_button(locator: Page | Locator, label: str | re.Pattern[str]) -> Locator:
    """Get the menu button element by label."""
    page = locator if isinstance(locator, Page) else locator.page
    return (
        locator.get_by_test_id("stMenuButton").filter(has=page.get_by_text(label)).first
    )


def open_menu_button(locator: Page | Locator, label: str | re.Pattern[str]) -> Locator:
    """Open the menu button and return the popover body."""
    page = locator if isinstance(locator, Page) else locator.page
    menu_button = get_menu_button(locator, label)
    menu_button.get_by_test_id("stMenuButtonButton").click()
    return page.get_by_test_id("stMenuButtonBody")


def select_menu_option(page: Page, label: str, option: str):
    """Select an option from the menu button."""
    menu_body = open_menu_button(page, label)
    expect(menu_body).to_be_visible()
    menu_body.get_by_text(option, exact=True).click()
    wait_for_app_run(page)


TOTAL_MENU_BUTTONS = 19  # Including sidebar, fragment, and menu-style icons


def test_menu_button_rendering(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the menu button widgets are correctly rendered via screenshot matching."""
    # Main app should have all menu buttons except sidebar one
    expect(themed_app.get_by_test_id("stMenuButton")).to_have_count(TOTAL_MENU_BUTTONS)

    assert_snapshot(
        get_menu_button(themed_app, "Actions"),
        name="st_menu_button-default",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "secondary_button"),
        name="st_menu_button-secondary",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "primary_button"),
        name="st_menu_button-primary",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "tertiary_button"),
        name="st_menu_button-tertiary",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "disabled_button"),
        name="st_menu_button-disabled",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "material_icon_button"),
        name="st_menu_button-material_icon",
    )


def test_menu_button_dropdown_behavior(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test dropdown opening, closing, and option display."""
    # Open menu and verify options are visible
    menu_body = open_menu_button(app, "Actions")
    expect(menu_body).to_be_visible()
    expect(menu_body.get_by_text("Edit")).to_be_visible()
    expect(menu_body.get_by_text("Delete")).to_be_visible()
    expect(menu_body.get_by_text("Copy")).to_be_visible()

    assert_snapshot(menu_body, name="st_menu_button-dropdown_open")

    # Test clicking outside closes the menu
    app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    expect(menu_body).not_to_be_visible()

    # Test pressing Escape closes the menu
    menu_body = open_menu_button(app, "Actions")
    expect(menu_body).to_be_visible()
    app.keyboard.press("Escape")
    expect(menu_body).not_to_be_visible()


def test_menu_button_selection_returns_value(app: Page):
    """Test that selecting an option returns the correct value."""
    expect_markdown(app, "value: None")

    select_menu_option(app, "Actions", "Edit")
    expect_markdown(app, "value: Edit")


def test_menu_button_trigger_behavior(app: Page):
    """Test that menu button value resets to None after rerun (trigger behavior)."""
    expect_markdown(app, "value: None")

    # Click an option
    select_menu_option(app, "Actions", "Delete")
    expect_markdown(app, "value: Delete")

    # Trigger a rerun without clicking the menu button
    click_checkbox(app, "trigger rerun")
    expect_markdown(app, "value: None")


def test_menu_button_callback(app: Page):
    """Test on_click callback with args and multiple clicks incrementing count."""
    expect_markdown(app, "Button was clicked: False")

    # First click - verify callback is called with correct args
    select_menu_option(app, "Actions", "Copy")
    expect_markdown(app, "Button was clicked: True")
    expect_markdown(app, "times clicked: 1")
    expect_markdown(app, "arg value: 1")
    expect_markdown(app, "kwarg value: 2")

    # Additional clicks - verify count increments
    select_menu_option(app, "Actions", "Edit")
    expect_markdown(app, "times clicked: 2")

    select_menu_option(app, "Actions", "Delete")
    expect_markdown(app, "times clicked: 3")


def test_menu_button_basic_properties(app: Page):
    """Test basic properties: disabled state, sidebar, CSS class, and cursor."""
    # Disabled button should not be clickable
    disabled_button = get_element_by_key(app, "disabled_button")
    button = disabled_button.get_by_test_id("stMenuButtonButton")
    expect(button).to_be_disabled()

    # Sidebar menu button should be visible
    sidebar_menu = app.get_by_test_id("stSidebar").get_by_test_id("stMenuButton")
    expect(sidebar_menu).to_be_visible()

    # CSS class assignment via key and top-level class
    check_top_level_class(app, "stMenuButton")
    expect(get_element_by_key(app, "menu_button")).to_be_visible()

    # Cursor should be pointer on hover
    menu_button = get_menu_button(app, "Actions")
    button = menu_button.get_by_test_id("stMenuButtonButton")
    expect(button).to_have_css("cursor", "pointer")


def test_menu_button_help_tooltip(app: Page):
    """Test that help tooltip shows on hover."""
    menu_button = get_menu_button(app, "Button with Help")
    # Use first button due to duplicate rendering for mobile/desktop tooltip views
    menu_button.get_by_test_id("stMenuButtonButton").first.hover()

    expect(app.get_by_test_id("stTooltipContent")).to_have_text("This is helpful text")


def test_menu_button_width_examples(app: Page, assert_snapshot: ImageCompareFunction):
    """Test menu button width variations."""
    assert_snapshot(
        get_element_by_key(app, "stretch_width_container"),
        name="st_menu_button-width_stretch",
    )

    # Verify fixed width button has approximately 200px width
    fixed_button = get_element_by_key(app, "fixed_width")
    button_element = fixed_button.get_by_test_id("stMenuButtonButton")
    bounding_box = button_element.bounding_box()
    assert bounding_box is not None
    # Allow small tolerance for browser rendering differences
    assert 198 <= bounding_box["width"] <= 202


def test_menu_button_format_func(app: Page):
    """Test that format_func correctly displays and returns original values."""
    menu_body = open_menu_button(app, "With Format Func")

    # Check formatted options are shown
    expect(menu_body.get_by_text("ID 1: First Option")).to_be_visible()
    expect(menu_body.get_by_text("ID 2: Second Option")).to_be_visible()
    expect(menu_body.get_by_text("ID 3: Third Option")).to_be_visible()

    # Select an option and verify original object is returned, not formatted string
    menu_body.get_by_text("ID 2: Second Option", exact=True).click()
    wait_for_app_run(app)
    expect_markdown(app, "format_func selected id: 2")


def test_menu_button_in_columns(app: Page, assert_snapshot: ImageCompareFunction):
    """Test menu buttons in columns layout."""
    columns_container = get_element_by_key(app, "columns_container")
    expect(columns_container.get_by_test_id("stMenuButton")).to_have_count(2)

    assert_snapshot(columns_container, name="st_menu_button-in_columns")


def test_menu_button_markdown_options(app: Page, assert_snapshot: ImageCompareFunction):
    """Test menu button with markdown options (material icons) and value return."""
    menu_body = open_menu_button(app, "Markdown Options")

    # Check that markdown options are visible (material icons should render)
    # Use exact=True to avoid matching the icon text (e.g., "edit") along with option text ("Edit")
    expect(menu_body.get_by_text("Edit", exact=True)).to_be_visible()
    expect(menu_body.get_by_text("Delete", exact=True)).to_be_visible()
    expect(menu_body.get_by_text("Copy", exact=True)).to_be_visible()
    expect(menu_body.get_by_text("Share", exact=True)).to_be_visible()

    assert_snapshot(menu_body, name="st_menu_button-markdown_options")

    # Click the Edit option and verify the full string value is returned
    menu_body.get_by_text("Edit", exact=True).click()
    wait_for_app_run(app)
    # Material icons in the returned value get rendered again when displayed with st.write
    # So ":material/edit: Edit" renders as "edit Edit" (icon + text)
    expect_markdown(app, "markdown_selected: edit Edit")


def test_menu_button_short_options(app: Page, assert_snapshot: ImageCompareFunction):
    """Test menu button with short options adapts width to content."""
    # Use key selector to avoid matching "Short" in other menu options
    short_button = get_element_by_key(app, "short_options_button")
    short_button.get_by_test_id("stMenuButtonButton").click()
    menu_body = app.get_by_test_id("stMenuButtonBody")
    expect(menu_body).to_be_visible()

    # Check that short options are visible (not exact match due to markdown rendering)
    expect(menu_body.get_by_role("menuitem").filter(has_text="A")).to_be_visible()
    expect(menu_body.get_by_role("menuitem").filter(has_text="B")).to_be_visible()
    expect(menu_body.get_by_role("menuitem").filter(has_text="C")).to_be_visible()

    # Menu should be narrower than default
    assert_snapshot(menu_body, name="st_menu_button-short_options")


def test_menu_button_in_fragment(app: Page):
    """Test that menu button works correctly inside a fragment."""
    # Initial state should show None
    expect_markdown(app, "menu_button-in-fragment selection: None")

    # Select an option from the fragment menu button
    select_menu_option(app, "Fragment Menu", "Fragment B")

    # Fragment should show the selected value
    expect_markdown(app, "menu_button-in-fragment selection: Fragment B")


def test_menu_button_menu_style_icons_hide_chevron(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that menu-style icon labels hide the chevron (expand/collapse icon)."""
    container = get_element_by_key(app, "menu_style_icons_container")

    # Verify all three menu buttons are visible
    menu_buttons = container.get_by_test_id("stMenuButton")
    expect(menu_buttons).to_have_count(3)

    # Check that chevron icons are NOT present in these buttons
    # The chevron uses expand_more/expand_less material icons
    menu_icon_button = get_element_by_key(app, "menu_icon_button")
    more_vert_button = get_element_by_key(app, "more_vert_icon_button")
    more_horiz_button = get_element_by_key(app, "more_horiz_icon_button")

    # None of these buttons should have expand_more or expand_less icons
    expect(menu_icon_button.get_by_text("expand_more")).not_to_be_visible()
    expect(more_vert_button.get_by_text("expand_more")).not_to_be_visible()
    expect(more_horiz_button.get_by_text("expand_more")).not_to_be_visible()

    # Verify that regular buttons DO have the chevron (for contrast)
    regular_button = get_menu_button(app, "Actions")
    expect(regular_button.get_by_text("expand_more")).to_be_visible()

    # Snapshot the container with all three menu-style icon buttons
    assert_snapshot(container, name="st_menu_button-menu_style_icons")
