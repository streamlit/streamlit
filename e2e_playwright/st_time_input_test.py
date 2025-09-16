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

from __future__ import annotations

import re

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_loaded
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_toggle,
    expect_help_tooltip,
    expect_markdown,
    expect_prefixed_markdown,
    get_element_by_key,
    get_time_input,
)
from e2e_playwright.shared.theme_utils import apply_theme_via_window

NUM_TIME_INPUTS = 13


def test_time_input_widget_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the time input widgets are correctly rendered via screenshot matching."""
    time_input_widgets = themed_app.get_by_test_id("stTimeInput")
    expect(time_input_widgets).to_have_count(NUM_TIME_INPUTS)

    assert_snapshot(
        get_time_input(themed_app, "Time input 1 (8:45)"), name="st_time_input-8_45"
    )
    assert_snapshot(
        get_time_input(themed_app, "Time input 2 (21:15, help)"),
        name="st_time_input-21_15_help",
    )
    assert_snapshot(
        get_time_input(themed_app, "Time input 3 (disabled)"),
        name="st_time_input-disabled",
    )
    assert_snapshot(
        get_time_input(themed_app, "Time input 4 (hidden label)"),
        name="st_time_input-hidden_label",
    )
    assert_snapshot(
        get_time_input(themed_app, "Time input 5 (collapsed label)"),
        name="st_time_input-collapsed_label",
    )
    assert_snapshot(
        get_time_input(themed_app, "Time input 6 (with callback)"),
        name="st_time_input-callback",
    )
    assert_snapshot(
        get_time_input(themed_app, "Time input 7 (step=60)"),
        name="st_time_input-step_60",
    )
    assert_snapshot(
        get_time_input(themed_app, "Time input 8 (empty)"), name="st_time_input-empty"
    )
    assert_snapshot(
        get_time_input(themed_app, "Time input 9 (empty, from state)"),
        name="st_time_input-value_from_state",
    )
    assert_snapshot(
        get_time_input(
            themed_app,
            re.compile(r"^Time input 10"),
        ),
        name="st_time_input-markdown_label",
    )
    assert_snapshot(
        get_time_input(themed_app, "Time input 11 (width=200px)"),
        name="st_time_input-width_200px",
    )
    assert_snapshot(
        get_time_input(themed_app, "Time input 12 (width='stretch')"),
        name="st_time_input-width_stretch",
    )


def test_help_tooltip_works(app: Page):
    element_with_help = get_time_input(app, "Time input 2 (21:15, help)")
    expect_help_tooltip(app, element_with_help, "Help text")


def test_time_input_has_correct_initial_values(app: Page):
    """Test that st.time_input returns the correct initial values."""
    expect_markdown(app, "Value 1: 08:45:00")
    expect_markdown(app, "Value 2: 21:15:00")
    expect_markdown(app, "Value 3: 08:45:00")
    expect_markdown(app, "Value 4: 08:45:00")
    expect_markdown(app, "Value 5: 08:45:00")
    expect_markdown(app, "Value 6: 08:45:00")
    expect_markdown(app, "time input changed: False")
    expect_markdown(app, "Value 7: 08:45:00")
    expect_markdown(app, "Value 8: None")
    expect_markdown(app, "Value 9: 08:50:00")


def test_handles_time_selection(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that selection of a time via the dropdown works correctly."""
    get_time_input(app, "Time input 1 (8:45)").locator("input").click()

    # Take a snapshot of the time selection dropdown:
    selection_dropdown = app.locator('[data-baseweb="popover"]').first
    assert_snapshot(selection_dropdown, name="st_time_input-selection_dropdown")
    # Select the first option:
    selection_dropdown.get_by_text("00:00").first.click()
    # Check that selection worked:
    expect_markdown(app, "Value 1: 00:00:00")


def test_correct_menu_font_colors(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that it uses the correct colors in the popover menu."""
    get_time_input(themed_app, "Time input 1 (8:45)").locator("input").click()

    # Take a snapshot of the time selection dropdown:
    selection_dropdown = themed_app.locator('[data-baseweb="popover"]').first

    # Hover over another option:
    selection_dropdown.get_by_text("08:30").hover()

    # Take a screenshot
    assert_snapshot(selection_dropdown, name="st_time_input-menu_colors")


def test_handles_step_correctly(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the step parameter is correctly applied."""
    get_time_input(app, "Time input 7 (step=60)").locator("input").click()

    # Take a snapshot of the time selection dropdown:
    selection_dropdown = app.locator('[data-baseweb="popover"]').first
    assert_snapshot(selection_dropdown, name="st_time_input-step_60_dropdown")
    # Select the second option:
    selection_dropdown.get_by_text("00:01").first.click()
    # Check that selection worked:
    expect_markdown(app, "Value 7: 00:01:00")


def test_handles_time_selection_via_typing(app: Page):
    """Test that selection of a time via typing works correctly."""
    time_input_field = get_time_input(app, "Time input 1 (8:45)").locator("input")

    # Type an option:
    time_input_field.type("00:15")
    time_input_field.press("Enter")

    # Check that selection worked:
    expect_markdown(app, "Value 1: 00:15:00")

    # Type an another option that doesn't exist in the dropdown:
    time_input_field.type("00:16")
    time_input_field.press("Enter")

    # Check that selection worked:
    expect_markdown(app, "Value 1: 00:16:00")


def test_empty_time_input_behaves_correctly(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.time_input behaves correctly when empty (no initial value)."""
    empty_time_input = get_time_input(app, "Time input 8 (empty)")
    empty_time_input_field = empty_time_input.locator("input")

    # Type an option:
    empty_time_input_field.type("00:15")
    empty_time_input_field.press("Enter")

    expect_markdown(app, "Value 8: 00:15:00")

    assert_snapshot(empty_time_input, name="st_time_input-clearable_input")

    # Clear the input:
    empty_time_input.get_by_test_id("stTimeInputClearButton").click()

    # Should be empty again:
    expect_markdown(app, "Value 8: None")


def test_keeps_value_on_selection_close(app: Page):
    """Test that the selection is kept when the dropdown is closed."""
    get_time_input(app, "Time input 1 (8:45)").locator("input").click()

    # Check if popover is visible:
    expect(app.locator('[data-baseweb="popover"]').first).to_be_visible()

    # Click outside to close the dropdown:
    app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})

    # Check if value is still initial value:
    expect_markdown(app, "Value 1: 08:45:00")


def test_handles_callback_on_change_correctly(app: Page):
    """Test that it correctly calls the callback on change."""
    # Check initial state:
    expect_markdown(app, "Value 6: 08:45:00")
    expect_markdown(app, "time input changed: False")

    get_time_input(app, "Time input 6 (with callback)").locator("input").click()

    # Select last option:
    time_dropdown = app.locator('[data-baseweb="popover"]').first
    time_dropdown.get_by_text("00:00").first.click()

    # Check that selection worked:
    expect_markdown(app, "Value 6: 00:00:00")
    expect_markdown(app, "time input changed: True")

    # Change different input to trigger delta path change
    empty_time_input_field = get_time_input(app, "Time input 1 (8:45)").locator("input")

    # Type an option:
    empty_time_input_field.type("00:15")
    empty_time_input_field.press("Enter")

    expect_markdown(app, "Value 1: 00:15:00")
    expect_markdown(app, "Value 6: 00:00:00")
    # The flag should be reset to False:
    expect_markdown(app, "time input changed: False")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stTimeInput")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "time_input_6")).to_be_visible()


def test_dynamic_time_input_props(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the time input can be updated dynamically while keeping the state."""
    dynamic_time_input = get_element_by_key(app, "dynamic_time_input_with_key")
    expect(dynamic_time_input).to_be_visible()

    expect(dynamic_time_input).to_contain_text("Initial dynamic time input")

    expect_prefixed_markdown(app, "Initial time input value:", "08:45:00")
    assert_snapshot(dynamic_time_input, name="st_time_input-dynamic_initial")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_time_input, "initial help")

    # Type something and submit
    input_field = dynamic_time_input.locator("input")
    input_field.type("00:15")
    input_field.press("Enter")
    wait_for_app_loaded(app)

    expect_prefixed_markdown(app, "Initial time input value:", "00:15:00")

    # Click the toggle to update the time input props
    click_toggle(app, "Update time input props")

    # new time input is visible:
    expect(dynamic_time_input).to_contain_text("Updated dynamic time input")

    # Ensure the previously entered value remains visible
    expect_prefixed_markdown(app, "Updated time input value:", "00:15:00")

    dynamic_time_input.scroll_into_view_if_needed()
    assert_snapshot(dynamic_time_input, name="st_time_input-dynamic_updated")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_time_input, "updated help")


def test_time_input_with_custom_theme(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that time input adjusts for custom theme."""
    # Apply custom theme using window injection
    apply_theme_via_window(
        app,
        base="light",
        primaryColor="#9867C5",
        textColor="#301934",
        secondaryBackgroundColor="#CBC3E3",
    )

    # Reload to apply the theme
    app.reload()
    wait_for_app_loaded(app)

    time_input_widgets = app.get_by_test_id("stTimeInput")
    expect(time_input_widgets).to_have_count(NUM_TIME_INPUTS)

    # Click on the first time input to open the dropdown
    get_time_input(app, "Time input 1 (8:45)").locator("input").click()

    # Hover over the first option:
    selection_dropdown = app.locator('[data-baseweb="popover"]').first
    selection_dropdown.get_by_text("00:00").first.hover()

    # Take a snapshot of the time selection dropdown:
    assert_snapshot(selection_dropdown, name="st_time_input-dropdown-custom-theme")
    # Take a snapshot of the time input:
    assert_snapshot(
        get_time_input(app, "Time input 1 (8:45)"), name="st_time_input-custom-theme"
    )
