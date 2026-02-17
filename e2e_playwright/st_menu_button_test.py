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
    get_expander,
)


def get_menu_button(locator: Page | Locator, label: str | re.Pattern[str]) -> Locator:
    """Get the menu button element by label."""
    # Handle both Page and Locator inputs
    page = locator if isinstance(locator, Page) else locator.page
    return (
        locator.get_by_test_id("stMenuButton").filter(has=page.get_by_text(label)).first
    )


def open_menu_button(locator: Page | Locator, label: str | re.Pattern[str]) -> Locator:
    """Open the menu button and return the popover body."""
    # Handle both Page and Locator inputs
    page = locator if isinstance(locator, Page) else locator.page
    menu_button = get_menu_button(locator, label)
    menu_button.get_by_test_id("stMenuButtonButton").click()
    # Return the popover body which contains the menu
    return page.get_by_test_id("stMenuButtonBody")


def select_menu_option(page: Page, label: str, option: str):
    """Select an option from the menu button."""
    menu_body = open_menu_button(page, label)
    expect(menu_body).to_be_visible()
    menu_body.get_by_text(option, exact=True).click()
    wait_for_app_run(page)


TOTAL_MENU_BUTTONS = 18  # Including sidebar


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
    assert_snapshot(
        get_element_by_key(themed_app, "emoji_icon_button"),
        name="st_menu_button-emoji_icon",
    )


def test_menu_button_open_dropdown(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the menu dropdown opens and shows options."""
    menu_body = open_menu_button(app, "Actions")

    # Check that menu is visible with options
    expect(menu_body).to_be_visible()
    expect(menu_body.get_by_text("Edit")).to_be_visible()
    expect(menu_body.get_by_text("Delete")).to_be_visible()
    expect(menu_body.get_by_text("Copy")).to_be_visible()

    assert_snapshot(menu_body, name="st_menu_button-dropdown_open")


def test_menu_button_closes_on_outside_click_and_escape(app: Page):
    """Test that the menu closes when clicking outside or pressing Escape."""
    # Test clicking outside closes the menu
    menu_body = open_menu_button(app, "Actions")
    expect(menu_body).to_be_visible()
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
    """Test that on_click callback is called with correct args."""
    expect_markdown(app, "Button was clicked: False")

    select_menu_option(app, "Actions", "Copy")

    expect_markdown(app, "Button was clicked: True")
    expect_markdown(app, "times clicked: 1")
    expect_markdown(app, "arg value: 1")
    expect_markdown(app, "kwarg value: 2")


def test_menu_button_callback_increment(app: Page):
    """Test that clicking multiple times increments the count."""
    select_menu_option(app, "Actions", "Edit")
    expect_markdown(app, "times clicked: 1")

    select_menu_option(app, "Actions", "Delete")
    expect_markdown(app, "times clicked: 2")

    select_menu_option(app, "Actions", "Copy")
    expect_markdown(app, "times clicked: 3")


def test_menu_button_disabled_not_clickable(app: Page):
    """Test that disabled menu button cannot be opened."""
    disabled_button = get_element_by_key(app, "disabled_button")
    button = disabled_button.get_by_test_id("stMenuButtonButton")

    # Button should be disabled
    expect(button).to_be_disabled()


def test_menu_button_help_tooltip(app: Page):
    """Test that help tooltip shows on hover."""
    menu_button = get_menu_button(app, "Button with Help")
    # Use first button due to duplicate rendering for mobile/desktop tooltip views
    menu_button.get_by_test_id("stMenuButtonButton").first.hover()

    expect(app.get_by_test_id("stTooltipContent")).to_have_text("This is helpful text")


def test_menu_button_width_examples(app: Page, assert_snapshot: ImageCompareFunction):
    """Test menu button width variations."""
    button_expander = get_expander(app, "Width Examples")

    assert_snapshot(
        get_element_by_key(button_expander, "content_width"),
        name="st_menu_button-width_content",
    )
    assert_snapshot(
        get_element_by_key(button_expander, "stretch_width"),
        name="st_menu_button-width_stretch",
    )
    assert_snapshot(
        get_element_by_key(button_expander, "fixed_width"),
        name="st_menu_button-width_200px",
    )


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


def test_menu_button_in_sidebar(app: Page, assert_snapshot: ImageCompareFunction):
    """Test menu button in sidebar."""
    sidebar_menu = app.get_by_test_id("stSidebar").get_by_test_id("stMenuButton")
    expect(sidebar_menu).to_be_visible()

    assert_snapshot(sidebar_menu, name="st_menu_button-sidebar")


def test_css_class_and_top_level_class(app: Page):
    """Test CSS class assignment via key and top-level class."""
    check_top_level_class(app, "stMenuButton")
    expect(get_element_by_key(app, "menu_button")).to_be_visible()


def test_shows_cursor_pointer(app: Page):
    """Test that the menu button shows cursor pointer when hovered."""
    menu_button = get_menu_button(app, "Actions")
    button = menu_button.get_by_test_id("stMenuButtonButton")
    expect(button).to_have_css("cursor", "pointer")


def test_menu_button_markdown_options(app: Page, assert_snapshot: ImageCompareFunction):
    """Test menu button with markdown options (material icons)."""
    menu_body = open_menu_button(app, "Markdown Options")

    # Check that markdown options are visible (material icons should render)
    expect(menu_body.get_by_text("Edit")).to_be_visible()
    expect(menu_body.get_by_text("Delete")).to_be_visible()
    expect(menu_body.get_by_text("Copy")).to_be_visible()
    expect(menu_body.get_by_text("Share")).to_be_visible()

    assert_snapshot(menu_body, name="st_menu_button-markdown_options")


def test_menu_button_markdown_options_returns_value(app: Page):
    """Test that selecting a markdown option returns the full string value."""
    menu_body = open_menu_button(app, "Markdown Options")
    # Click the Edit option (not exact match due to markdown rendering wrapping)
    menu_body.get_by_text("Edit").click()
    wait_for_app_run(app)
    # Material icons in the returned value get rendered again when displayed with st.write
    # So ":material/edit: Edit" renders as "edit Edit" (icon + text)
    expect_markdown(app, "markdown_selected: edit Edit")


def test_menu_button_emoji_options(app: Page, assert_snapshot: ImageCompareFunction):
    """Test menu button with emoji options."""
    menu_body = open_menu_button(app, "Emoji Options")

    # Check that emoji options are visible
    expect(menu_body.get_by_text("Edit")).to_be_visible()
    expect(menu_body.get_by_text("Delete")).to_be_visible()
    expect(menu_body.get_by_text("Copy")).to_be_visible()

    assert_snapshot(menu_body, name="st_menu_button-emoji_options")


def test_menu_button_short_options(app: Page, assert_snapshot: ImageCompareFunction):
    """Test menu button with short options adapts width to content."""
    # Use key selector to avoid matching "Short" in other menu options
    short_button = get_element_by_key(app, "short_options_button")
    short_button.get_by_test_id("stMenuButtonButton").click()
    menu_body = app.get_by_test_id("stMenuButtonBody")
    expect(menu_body).to_be_visible()

    # Check that short options are visible (not exact match due to markdown rendering)
    expect(menu_body.locator("li").filter(has_text="A")).to_be_visible()
    expect(menu_body.locator("li").filter(has_text="B")).to_be_visible()
    expect(menu_body.locator("li").filter(has_text="C")).to_be_visible()

    # Menu should be narrower than default
    assert_snapshot(menu_body, name="st_menu_button-short_options")
