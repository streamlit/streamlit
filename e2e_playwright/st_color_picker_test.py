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

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import (
    ImageCompareFunction,
    build_app_url,
    wait_for_app_loaded,
    wait_for_app_run,
)
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_form_button,
    click_toggle,
    expect_help_tooltip,
    expect_prefixed_markdown,
    get_color_picker,
    get_element_by_key,
)

NUM_COLOR_PICKERS = 15


def test_color_picker_widget_display_themed(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.color_picker renders correctly with theme-dependent styling."""
    color_pickers = themed_app.get_by_test_id("stColorPicker")
    expect(color_pickers).to_have_count(NUM_COLOR_PICKERS)
    assert_snapshot(
        get_color_picker(themed_app, "Default Color"),
        name="st_color_picker-regular",
    )
    assert_snapshot(
        get_color_picker(themed_app, "New Color"),
        name="st_color_picker-default_help",
    )
    assert_snapshot(
        get_color_picker(themed_app, "Disabled"), name="st_color_picker-disabled"
    )
    # Markdown label colors may vary by theme
    assert_snapshot(
        get_element_by_key(themed_app, "color_picker_markdown_label"),
        name="st_color_picker-markdown_label",
    )


def test_color_picker_widget_display_layout(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.color_picker layout variations render correctly (theme-independent)."""
    color_pickers = app.get_by_test_id("stColorPicker")
    expect(color_pickers).to_have_count(NUM_COLOR_PICKERS)
    # Structural layout - single theme sufficient
    assert_snapshot(
        get_element_by_key(app, "color_picker_hidden"),
        name="st_color_picker-hidden_label",
    )
    assert_snapshot(
        get_element_by_key(app, "color_picker_collapsed"),
        name="st_color_picker-collapsed_label",
    )
    # Width configurations
    assert_snapshot(
        get_color_picker(app, "Color picker with content width (default)"),
        name="st_color_picker-width_content",
    )
    assert_snapshot(
        get_color_picker(app, "Color picker with stretch width"),
        name="st_color_picker-width_stretch",
    )
    assert_snapshot(
        get_color_picker(app, "Color picker with 100px width"),
        name="st_color_picker-width_100px",
    )
    assert_snapshot(
        get_element_by_key(app, "color_picker_min_width"),
        name="st_color_picker-width_20px_min_enforced",
    )


def test_color_picker_popover_display(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that color picker popover renders correctly in both themes."""
    get_color_picker(themed_app, "Default Color").get_by_test_id(
        "stColorPickerBlock"
    ).click()

    popover = themed_app.get_by_test_id("stColorPickerPopover")
    expect(popover).to_be_visible()
    assert_snapshot(popover, name="st_color_picker-popover")


def test_help_tooltip_works(app: Page):
    element_with_help = get_color_picker(app, "New Color")
    expect_help_tooltip(app, element_with_help, "help string")


# The coordinates (0, 0) for the click action behaves differently across firefox.
@pytest.mark.skip_browser("firefox")
def test_clicking_color_on_color_picker_works(app: Page):
    # Check that the color is #000000
    expect(app.get_by_text("Color 1 #000000")).to_be_visible()

    default_picker = get_color_picker(app, "Default Color")
    default_picker.get_by_test_id("stColorPickerBlock").click()

    expect(app.get_by_test_id("stColorPickerPopover")).to_be_visible()

    app.get_by_test_id("stColorPickerPopover").click(position={"x": 10, "y": 10})

    # click outside of color picker
    app.get_by_text("Default Color").click()
    wait_for_app_run(app)
    # Make sure the color has changed:
    expect(app.get_by_text("Color 1 #000000")).not_to_be_visible()


def test_typing_new_hex_color_on_color_picker_works_with_callback(
    app: Page, assert_snapshot: ImageCompareFunction
):
    expect(app.get_by_text("Hello world")).to_have_count(0)
    default_picker = get_color_picker(app, "Default Color")
    default_picker.get_by_test_id("stColorPickerBlock").click()

    text_input = app.get_by_test_id("stColorPickerPopover").locator("input")
    text_input.fill("#ffffff")

    # click outside of color picker
    app.get_by_text("Default Color").click()
    wait_for_app_run(app)

    # callback writes "Hello world"
    expect(app.get_by_text("Hello world")).to_be_visible()
    expect(app.get_by_text("#ffffff")).to_be_visible()
    assert_snapshot(default_picker, name="st_color_picker-typed_new_hex_color")


def test_typing_new_rgb_color_on_color_picker_works(
    app: Page, assert_snapshot: ImageCompareFunction
):
    default_picker = get_color_picker(app, "Default Color")
    default_picker.get_by_test_id("stColorPickerBlock").click()

    color_picker_popover = app.get_by_test_id("stColorPickerPopover")

    # click button to swap color picker mode to RGB
    color_picker_popover.locator("svg").click()

    rgb_text_inputs = app.get_by_test_id("stColorPickerPopover").locator("input")
    rgb_text_inputs.nth(0).type("255")
    rgb_text_inputs.nth(1).type("255")
    rgb_text_inputs.nth(2).type("255")

    # click outside of color picker
    app.get_by_text("Default Color").click()
    wait_for_app_run(app)
    expect(app.get_by_text("#ffffff")).to_be_visible()
    assert_snapshot(default_picker, name="st_color_picker-typed_new_rgb_color")


def test_typing_new_hsl_color_on_color_picker_works(
    app: Page, assert_snapshot: ImageCompareFunction
):
    default_picker = get_color_picker(app, "Default Color")
    default_picker.get_by_test_id("stColorPickerBlock").click()

    color_picker_popover = app.get_by_test_id("stColorPickerPopover")

    # click button to swap color picker mode to HSL
    color_picker_input_button = color_picker_popover.locator("svg")
    color_picker_input_button.click()
    color_picker_input_button.click()

    hsl_text_inputs = app.get_by_test_id("stColorPickerPopover").locator("input")
    hsl_text_inputs.nth(0).fill("0%")
    hsl_text_inputs.nth(1).fill("0%")
    hsl_text_inputs.nth(2).fill("100%")

    # click outside of color picker
    app.get_by_text("Default Color").click()
    wait_for_app_run(app)
    expect(app.get_by_text("#ffffff")).to_be_visible()
    assert_snapshot(default_picker, name="st_color_picker-typed_new_hsl_color")


def test_color_picker_query_param_seeding(page: Page, app_base_url: str):
    """Test that color picker value can be seeded from URL query params."""
    # Load app with query param set (URL-encoded # is %23)
    page.goto(build_app_url(app_base_url, query={"bound_color": "#FF5733"}))
    wait_for_app_loaded(page)

    # Color picker should show the seeded color (displayed uppercase)
    expect_prefixed_markdown(page, "bound color value:", "#FF5733")


def test_color_picker_query_param_updates_url(app: Page):
    """Test that changing a bound color picker updates the URL."""
    # Initially default black, no query param in URL
    expect_prefixed_markdown(app, "bound color value:", "#000000")
    expect(app).not_to_have_url(re.compile(r"bound_color"))

    # Change the color
    color_picker = get_color_picker(app, "Bound color (no provided default)")
    color_picker.get_by_test_id("stColorPickerBlock").click()
    text_input = app.get_by_test_id("stColorPickerPopover").locator("input")
    text_input.fill("#00ff00")
    # Click outside to close popover
    app.get_by_text("Bound color (no provided default)").click()
    wait_for_app_run(app)

    # URL should now contain the query param (URL-encoded)
    expect(app).to_have_url(re.compile(r"bound_color=%2300ff00"))
    expect_prefixed_markdown(app, "bound color value:", "#00ff00")

    # Reset to default (black)
    color_picker.get_by_test_id("stColorPickerBlock").click()
    text_input = app.get_by_test_id("stColorPickerPopover").locator("input")
    text_input.fill("#000000")
    app.get_by_text("Bound color (no provided default)").click()
    wait_for_app_run(app)

    # Query param should be removed since value is back to default
    expect(app).not_to_have_url(re.compile(r"bound_color"))
    expect_prefixed_markdown(app, "bound color value:", "#000000")


def test_color_picker_query_param_default_custom(page: Page, app_base_url: str):
    """Test color picker with custom default: seeding and param removal."""
    # Load app with query param overriding the red default
    page.goto(build_app_url(app_base_url, query={"bound_red": "#00FF00"}))
    wait_for_app_loaded(page)

    # Color picker should show green (overriding red default, case preserved from URL)
    expect_prefixed_markdown(page, "bound color red value:", "#00FF00")

    # Change back to default (red) - use lowercase since react-color outputs lowercase
    color_picker = get_color_picker(page, "Bound color (default red)")
    color_picker.get_by_test_id("stColorPickerBlock").click()
    text_input = page.get_by_test_id("stColorPickerPopover").locator("input")
    text_input.fill("#ff0000")
    page.get_by_text("Bound color (default red)").click()
    wait_for_app_run(page)

    # Query param should be removed since value is back to default (red)
    expect(page).not_to_have_url(re.compile(r"bound_red"))
    expect_prefixed_markdown(page, "bound color red value:", "#ff0000")


def test_color_picker_query_param_invalid_value(page: Page, app_base_url: str):
    """Test that invalid URL values are cleared and widget uses default."""
    # Load app with invalid query param value (not a valid hex color)
    page.goto(build_app_url(app_base_url, query={"bound_color": "notacolor"}))
    wait_for_app_loaded(page)

    # Color picker should use default (black), and invalid param should be cleared
    expect_prefixed_markdown(page, "bound color value:", "#000000")
    # Invalid param should be removed from URL
    expect(page).not_to_have_url(re.compile(r"bound_color"))


def test_color_picker_query_param_3char_hex(page: Page, app_base_url: str):
    """Test that 3-char hex shorthand colors (e.g., #F00) work in URL params."""
    # Load app with 3-char hex color (URL-encoded # is %23)
    # #F00 is shorthand for #FF0000 (red)
    page.goto(build_app_url(app_base_url, query={"bound_color": "#F00"}))
    wait_for_app_loaded(page)

    # Color picker should accept the 3-char hex and display it
    # Note: The color picker may expand to 6-char or keep 3-char depending on implementation
    # We just verify it's treated as valid (red color)
    expect_prefixed_markdown(page, "bound color value:", "#F00")


def test_in_form_selection_and_session_state(app: Page):
    expect(app.get_by_text("color_picker-in-form selection: #000000")).to_be_visible()
    expect(
        app.get_by_text("color_picker-in-form selection in session state: #000000")
    ).to_be_visible()

    get_color_picker(app, "Form Color Picker").get_by_test_id(
        "stColorPickerBlock"
    ).click()

    text_input = app.get_by_test_id("stColorPickerPopover").locator("input")
    text_input.fill("#ffffff")

    # click outside of color picker
    app.get_by_text("Default Color").click()
    wait_for_app_run(app)

    click_form_button(app, "Submit")

    expect(app.get_by_text("color_picker-in-form selection: #ffffff")).to_be_visible()
    expect(
        app.get_by_text("color_picker-in-form selection in session state: #ffffff")
    ).to_be_visible()


def test_color_picker_in_fragment(app: Page):
    expect(
        app.get_by_text("color_picker-in-fragment selection: #000000")
    ).to_be_visible()

    get_color_picker(app, "Fragment Color Picker").get_by_test_id(
        "stColorPickerBlock"
    ).click()
    text_input = app.get_by_test_id("stColorPickerPopover").locator("input")
    text_input.fill("#ffffff")

    # click outside of color picker
    app.get_by_text("Default Color").click()

    wait_for_app_run(app)

    expect(
        app.get_by_text("color_picker-in-fragment selection: #ffffff")
    ).to_be_visible()
    expect(app.get_by_text("Runs: 1")).to_be_visible()


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stColorPicker")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "color_picker_1")).to_be_visible()


@pytest.mark.skip_browser("firefox")
def test_dynamic_color_picker_props(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the color picker can be updated dynamically while keeping the state."""
    dynamic_color_picker = get_element_by_key(app, "dynamic_color_picker_with_key")
    expect(dynamic_color_picker).to_be_visible()

    expect(dynamic_color_picker).to_contain_text("Initial dynamic color picker")

    expect_prefixed_markdown(app, "Initial color picker value:", "#ff0000")
    assert_snapshot(dynamic_color_picker, name="st_color_picker-dynamic_initial")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_color_picker, "initial help")

    # Type a color and submit by clicking outside
    dynamic_color_picker.get_by_test_id("stColorPickerBlock").click()
    popover = app.get_by_test_id("stColorPickerPopover")
    text_input = popover.locator("input").first
    text_input.fill("#00aa00")
    # Close the color popover:
    text_input.press("Escape")
    wait_for_app_run(app)

    expect_prefixed_markdown(app, "Initial color picker value:", "#00aa00")

    # Click the toggle to update the color picker props
    click_toggle(app, "Update color picker props")

    # new color picker is visible:
    expect(dynamic_color_picker).to_contain_text("Updated dynamic color picker")

    # Ensure the previously entered value remains visible
    expect_prefixed_markdown(app, "Updated color picker value:", "#00aa00")

    dynamic_color_picker.scroll_into_view_if_needed()
    assert_snapshot(dynamic_color_picker, name="st_color_picker-dynamic_updated")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_color_picker, "updated help")

    # Change color again:
    dynamic_color_picker.get_by_test_id("stColorPickerBlock").click()
    popover = app.get_by_test_id("stColorPickerPopover")
    text_input = popover.locator("input").first
    text_input.fill("#ffffff")
    # Close the color popover:
    text_input.press("Escape")
    wait_for_app_run(app)

    expect_prefixed_markdown(app, "Updated color picker value:", "#ffffff")
