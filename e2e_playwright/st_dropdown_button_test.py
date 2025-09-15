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

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_checkbox,
    get_element_by_key,
    wait_for_app_run,
)

TOTAL_DROPDOWN_BUTTONS = 15


def test_dropdown_button_widget_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the dropdown button widgets are correctly rendered via screenshot matching."""
    dropdown_elements = themed_app.get_by_test_id("stDropdownButton")
    expect(dropdown_elements).to_have_count(TOTAL_DROPDOWN_BUTTONS)

    # Test basic dropdown button
    assert_snapshot(dropdown_elements.nth(0), name="st_dropdown_button-default")

    # Test different button types
    assert_snapshot(dropdown_elements.nth(2), name="st_dropdown_button-primary")
    assert_snapshot(dropdown_elements.nth(3), name="st_dropdown_button-secondary")
    assert_snapshot(dropdown_elements.nth(4), name="st_dropdown_button-tertiary")

    # Test disabled state
    assert_snapshot(dropdown_elements.nth(5), name="st_dropdown_button-disabled")

    # Test with icons
    assert_snapshot(dropdown_elements.nth(6), name="st_dropdown_button-emoji_icon")
    assert_snapshot(dropdown_elements.nth(7), name="st_dropdown_button-material_icon")

    # Test container width
    assert_snapshot(dropdown_elements.nth(8), name="st_dropdown_button-container_width")

    # Test with help
    assert_snapshot(dropdown_elements.nth(9), name="st_dropdown_button-help")

    # Test custom placeholder
    assert_snapshot(
        dropdown_elements.nth(10), name="st_dropdown_button-custom_placeholder"
    )

    # Test empty options
    assert_snapshot(dropdown_elements.nth(11), name="st_dropdown_button-empty_options")


def test_dropdown_button_opens_menu_on_click(app: Page):
    """Test that clicking dropdown button opens the menu."""
    dropdown_button = app.get_by_test_id("stDropdownButton").first
    button_element = dropdown_button.locator("button")

    # Initially menu should be closed
    menu = dropdown_button.locator("[role='listbox']")
    expect(menu).not_to_be_visible()

    # Click to open menu
    button_element.click()
    expect(menu).to_be_visible()

    # Menu should contain the expected options
    options = menu.locator("div")
    expect(options).to_have_count(3)
    expect(options.nth(0)).to_have_text("Save")
    expect(options.nth(1)).to_have_text("Load")
    expect(options.nth(2)).to_have_text("Delete")


def test_dropdown_button_option_selection(app: Page):
    """Test that selecting an option updates the value and closes menu."""
    dropdown_button = app.get_by_test_id("stDropdownButton").first
    button_element = dropdown_button.locator("button")

    # Open dropdown
    button_element.click()

    # Select "Load" option
    menu = dropdown_button.locator("[role='listbox']")
    load_option = menu.locator("div").nth(1)
    load_option.click()

    # Wait for app to update
    wait_for_app_run(app)

    # Check that value was updated
    expect(app.get_by_test_id("stMarkdown").nth(0)).to_have_text("value 1: Load")

    # Menu should be closed
    expect(menu).not_to_be_visible()


def test_dropdown_button_callback_execution(app: Page):
    """Test that selecting an option triggers the callback."""
    dropdown_button = app.get_by_test_id("stDropdownButton").nth(1)
    button_element = dropdown_button.locator("button")

    # Open dropdown and select "Export"
    button_element.click()
    menu = dropdown_button.locator("[role='listbox']")
    export_option = menu.locator("div").nth(2)
    export_option.click()

    wait_for_app_run(app)

    # Check callback was executed
    expect(app.get_by_text("Dropdown was clicked: 1 times")).to_be_visible()
    expect(app.get_by_text("Last selected option: Export")).to_be_visible()


def test_dropdown_button_disabled_state(app: Page):
    """Test that disabled dropdown button cannot be interacted with."""
    disabled_dropdown = app.get_by_test_id("stDropdownButton").nth(5)
    button_element = disabled_dropdown.locator("button")

    # Button should be disabled
    expect(button_element).to_be_disabled()

    # Clicking should not open menu
    button_element.click(force=True)
    menu = disabled_dropdown.locator("[role='listbox']")
    expect(menu).not_to_be_visible()


def test_dropdown_button_state_persistence(app: Page):
    """Test that dropdown button value is retained when other widgets change."""
    # Select an option from first dropdown
    dropdown_button = app.get_by_test_id("stDropdownButton").first
    button_element = dropdown_button.locator("button")

    button_element.click()
    menu = dropdown_button.locator("[role='listbox']")
    save_option = menu.locator("div").nth(0)
    save_option.click()

    wait_for_app_run(app)

    # Verify value is set
    expect(app.get_by_test_id("stMarkdown").nth(0)).to_have_text("value 1: Save")

    # Click the reset checkbox to trigger rerun
    click_checkbox(app, "Reset dropdown values")

    # Value should still be preserved
    expect(app.get_by_test_id("stMarkdown").nth(0)).to_have_text("value 1: Save")


def test_dropdown_button_empty_options(app: Page):
    """Test dropdown button behavior with empty options list."""
    empty_dropdown = app.get_by_test_id("stDropdownButton").nth(11)
    button_element = empty_dropdown.locator("button")

    # Click to open menu
    button_element.click()

    # Menu should be visible but empty
    menu = empty_dropdown.locator("[role='listbox']")
    expect(menu).to_be_visible()

    # Should have no option elements
    options = menu.locator("div")
    expect(options).to_have_count(0)


def test_dropdown_button_long_options_list(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test dropdown button with many options."""
    long_dropdown = app.get_by_test_id("stDropdownButton").nth(12)
    button_element = long_dropdown.locator("button")

    # Open dropdown
    button_element.click()

    # Menu should contain all 20 options
    menu = long_dropdown.locator("[role='listbox']")
    options = menu.locator("div")
    expect(options).to_have_count(20)

    # Check first and last options
    expect(options.nth(0)).to_have_text("Option 1")
    expect(options.nth(19)).to_have_text("Option 20")

    # Take snapshot of long menu
    assert_snapshot(menu, name="st_dropdown_button-long_options_menu")


def test_dropdown_button_long_option_names(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test dropdown button with very long option names."""
    long_names_dropdown = app.get_by_test_id("stDropdownButton").nth(13)
    button_element = long_names_dropdown.locator("button")

    # Open dropdown
    button_element.click()

    # Take snapshot to verify text wrapping
    menu = long_names_dropdown.locator("[role='listbox']")
    assert_snapshot(menu, name="st_dropdown_button-long_option_names")


def test_dropdown_button_fragment_context(app: Page):
    """Test dropdown button works correctly within a fragment."""
    fragment_dropdown = app.get_by_test_id("stDropdownButton").nth(14)
    button_element = fragment_dropdown.locator("button")

    # Open dropdown and select option
    button_element.click()
    menu = fragment_dropdown.locator("[role='listbox']")
    option1 = menu.locator("div").nth(0)
    option1.click()

    wait_for_app_run(app)

    # Check that fragment value was updated
    expect(app.get_by_text("Fragment value: Fragment Option 1")).to_be_visible()


def test_dropdown_button_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "basic_dropdown")).to_be_visible()


def test_dropdown_button_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stDropdownButton")


def test_dropdown_button_initial_values(app: Page):
    """Test that dropdown buttons return correct initial values (None)."""
    # All dropdown buttons should initially return None
    markdown_elements = app.get_by_test_id("stMarkdown")

    # Check first few values are None initially
    expect(markdown_elements.nth(0)).to_have_text("value 1: None")
    expect(markdown_elements.nth(1)).to_have_text("value 2: None")
    expect(markdown_elements.nth(2)).to_have_text("value 3: None")


def test_dropdown_button_placeholder_text(app: Page):
    """Test that custom placeholder text is displayed correctly."""
    placeholder_dropdown = app.get_by_test_id("stDropdownButton").nth(10)
    button_element = placeholder_dropdown.locator("button")

    # Button should show custom placeholder
    expect(button_element).to_contain_text("Pick a color")


def test_dropdown_button_menu_closes_on_option_click(app: Page):
    """Test that menu closes after selecting an option."""
    dropdown_button = app.get_by_test_id("stDropdownButton").first
    button_element = dropdown_button.locator("button")

    # Open menu
    button_element.click()
    menu = dropdown_button.locator("[role='listbox']")
    expect(menu).to_be_visible()

    # Select an option
    option = menu.locator("div").nth(0)
    option.click()

    # Menu should close
    expect(menu).not_to_be_visible()


def test_dropdown_button_hover_effects(app: Page):
    """Test hover effects on dropdown button options."""
    dropdown_button = app.get_by_test_id("stDropdownButton").first
    button_element = dropdown_button.locator("button")

    # Open menu
    button_element.click()
    menu = dropdown_button.locator("[role='listbox']")

    # Hover over an option - should show hover styling
    option = menu.locator("div").nth(0)
    option.hover()

    # Check that option has hover styling (this will depend on your CSS)
    expect(option).to_have_css("cursor", "pointer")
