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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import (
    ImageCompareFunction,
    build_app_url,
    wait_for_app_loaded,
    wait_for_app_run,
)
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_button,
    click_checkbox,
    click_form_button,
    click_toggle,
    expect_help_tooltip,
    expect_markdown,
    expect_prefixed_markdown,
    expect_text,
    get_button_group,
    get_element_by_key,
    get_markdown,
    get_segment_button,
)


def test_click_multiple_segmented_control_button_and_take_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test multi-select segmented control and take a screenshot.

    Click on the same button multiple times to test unselect.
    """

    segmented_control = get_button_group(
        themed_app, "segmented_control_multi_selection"
    )
    get_segment_button(segmented_control, "Foobar").click()
    wait_for_app_run(themed_app)

    # click on second element to test multiselect
    get_segment_button(segmented_control, "Charts").click()
    wait_for_app_run(themed_app)
    expect_markdown(themed_app, "Multi selection: ['Foobar', '📊 Charts']")

    # click on same element to test unselect
    get_segment_button(segmented_control, "Charts").click()
    wait_for_app_run(themed_app)
    expect_markdown(themed_app, "Multi selection: ['Foobar']")

    # click on same element and take screenshot of multiple selected segmented control buttons
    get_segment_button(segmented_control, "Charts").click()
    # take away hover focus of button
    themed_app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    wait_for_app_run(themed_app)
    expect_markdown(themed_app, "Multi selection: ['Foobar', '📊 Charts']")

    assert_snapshot(segmented_control, name="st_segmented_control-multiselect")


def test_click_single_segment_and_take_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test single select segmented control and take a screenshot.

    Click on same element to test unselect.
    Click on two different elements to validate single select.
    """

    segmented_control = get_button_group(
        themed_app, "segmented_control_single_selection"
    )
    get_segment_button(segmented_control, "Foobar").click()
    text = get_markdown(themed_app, "Single selection: Foobar")
    expect(text).to_be_visible()

    assert_snapshot(segmented_control, name="st_segmented_control-singleselect")

    # take away hover focus of button
    themed_app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    wait_for_app_run(themed_app)
    text = get_markdown(themed_app, "Single selection: Foobar")
    expect(text).to_be_visible()

    # test unselect in single-select mode
    get_segment_button(segmented_control, "Foobar").click()
    text = get_markdown(themed_app, "Single selection: None")
    expect(text).to_be_visible()


def test_click_single_icon_segment_and_take_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test icon only segmented control (via format_func) and take a screenshot.

    Click on same element to test unselect.
    Click on two different elements to validate single select.
    """
    segmented_control = get_button_group(
        themed_app, "segmented_control_single_icon_selection"
    )

    # the icon's span element has the respective text
    # (e.g. :material/zoom_out_map: -> zoom_out_map)
    get_segment_button(segmented_control, "zoom_out_map").click()
    text = get_markdown(themed_app, "Single icon selection: 3")
    expect(text).to_be_visible()

    get_segment_button(segmented_control, "zoom_in").click()
    text = get_markdown(themed_app, "Single icon selection: 1")
    expect(text).to_be_visible()

    assert_snapshot(
        segmented_control, name="st_segmented_control-singleselect_icon_only"
    )

    # take away hover focus of button
    themed_app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    wait_for_app_run(themed_app)
    text = get_markdown(themed_app, "Single icon selection: 1")
    expect(text).to_be_visible()

    # test unselect in single-select mode
    get_segment_button(segmented_control, "zoom_in").click()
    text = get_markdown(themed_app, "Single icon selection: None")
    expect(text).to_be_visible()


def test_pass_default_selections(app: Page):
    """Test that passed defaults are rendered correctly."""
    expect_prefixed_markdown(app, "Segmented control with default options:", "[]")

    click_checkbox(app, "Set default values")
    wait_for_app_run(app)
    expect_prefixed_markdown(
        app,
        "Segmented control with default options:",
        "['🧰 General widgets', '🎥 Video']",
    )

    click_checkbox(app, "Set default values")
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "Segmented control with default options:", "[]")


def test_selection_via_on_change_callback(app: Page):
    """Test that the on_change callback is triggered when a segmented control butoon is clicked."""
    segmented_control = get_button_group(app, "segmented_control_on_change")
    get_segment_button(segmented_control, "Sadness").click()
    wait_for_app_run(app)
    expect_markdown(app, "on_change selection: Sadness")
    expect(segmented_control.get_by_text("Select an emotion:")).to_be_visible()


def test_segmented_control_are_disabled_and_label_collapsed(app: Page):
    segmented_control = get_button_group(app, "segmented_control_disabled")
    for button in segmented_control.locator("button").all():
        expect(button).to_have_js_property("disabled", True)
    selected_button = get_segment_button(segmented_control, "Sadness")
    selected_button.click(force=True)
    wait_for_app_run(app)
    expect(selected_button).not_to_have_css(
        "color", re.compile(r"rgb\(\d+, \d+, \d+\)")
    )
    expect_markdown(app, "segmented-control-disabled: None")
    expect(segmented_control.get_by_text("Select an emotion:")).not_to_be_visible()


def test_segmented_control_work_in_forms(app: Page):
    expect_markdown(app, "segmented-control-in-form: []")
    segmented_control = get_button_group(app, "segmented_control_in_form")
    get_segment_button(segmented_control, "Sadness").click()
    click_form_button(app, "Submit")
    wait_for_app_run(app)
    expect_markdown(app, "segmented-control-in-form: ['Sadness']")


def test_segmented_control_work_with_fragments(app: Page):
    expect_markdown(app, "segmented-control-in-fragment: None")
    segmented_control = get_button_group(app, "segmented_control_in_fragment")
    get_segment_button(segmented_control, "Sadness").click()
    wait_for_app_run(app)
    expect_markdown(app, "segmented-control-in-fragment: Sadness")
    expect(app.get_by_text("Runs: 1")).to_be_visible()


def test_segmented_control_remount_keep_value(app: Page):
    expect_markdown(app, "segmented-control-after-sleep: None")
    segmented_control = get_button_group(app, "segmented_control_after_sleep")
    selected_button = get_segment_button(segmented_control, "Sadness")
    selected_button.click()
    wait_for_app_run(app)
    expect_markdown(app, "segmented-control-after-sleep: Sadness")
    click_button(app, "Create some elements to unmount component")
    expect_markdown(app, "segmented-control-after-sleep: Sadness")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stButtonGroup")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "segmented_control_multi_selection")).to_be_visible()


def test_help_tooltip(app: Page):
    expect_help_tooltip(
        app,
        get_button_group(app, "segmented_control_multi_selection"),
        "You can choose multiple options",
    )


def test_segmented_control_width_examples(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test segmented control with different width configurations."""

    content_segmented_control = get_button_group(app, "segmented_control_content_width")
    assert_snapshot(
        content_segmented_control, name="st_segmented_control-width_content"
    )

    stretch_segmented_control = get_button_group(app, "segmented_control_stretch_width")
    assert_snapshot(
        stretch_segmented_control, name="st_segmented_control-width_stretch"
    )

    segmented_control_300px = get_button_group(app, "segmented_control_300px_width")
    assert_snapshot(segmented_control_300px, name="st_segmented_control-width_300px")


def test_dynamic_segmented_control_props(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the segmented control can be updated dynamically while keeping the state.

    This tests that:
    1. Options can be changed dynamically when a key is provided
    2. Format function can be changed dynamically
    3. Selection resets to default when selected value is removed from options
    4. Selection is preserved when the selected value exists in new options

    Note: When using dynamic options with a key, the selection is preserved only
    if the formatted value (after applying format_func) exists in the new options.

    Initial options: [apple, banana, mango, orange] with format_func=capitalize, default=apple
    Updated options: [mango, papaya, grape, apple] with format_func=capitalize, default=papaya
    """
    dynamic_segmented = get_element_by_key(app, "dynamic_segmented_control_with_key")
    expect(dynamic_segmented).to_be_visible()

    # Initial state
    expect(dynamic_segmented).to_contain_text("Initial dynamic segmented control")
    assert_snapshot(dynamic_segmented, name="st_segmented_control-dynamic_initial")
    expect_prefixed_markdown(app, "Initial segmented control value:", "apple")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_segmented, "initial help")

    # --- Test 1: Selection RESETS when value is removed from options ---
    # Select "banana" (only exists in initial options, NOT in updated)
    get_segment_button(dynamic_segmented, "Banana").click()
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "Initial segmented control value:", "banana")

    # Toggle to update props - options change from [apple, banana, mango, orange]
    # to [mango, papaya, grape, apple]. "banana" is NOT in updated options.
    click_toggle(app, "Update segmented control props")

    # Updated segmented control is visible
    expect(dynamic_segmented).to_contain_text("Updated dynamic segmented control")

    # Selection should RESET to "papaya" (default) since "banana" is not in updated options
    expect_prefixed_markdown(app, "Updated segmented control value:", "papaya")
    # Negative assertion: ensure "banana" is NOT selected after toggle (regression check)
    expect(dynamic_segmented).not_to_contain_text("Banana")

    dynamic_segmented.scroll_into_view_if_needed()
    assert_snapshot(dynamic_segmented, name="st_segmented_control-dynamic_updated")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_segmented, "updated help")

    # --- Test 2: Selection PRESERVED when value exists in both option sets ---
    # Select "mango" - it exists in BOTH option sets at different indices:
    # Initial: index 2 (displayed "Mango"), Updated: index 0 (displayed "Mango")
    # Neither is the default. This ensures we're testing true preservation.
    get_segment_button(dynamic_segmented, "Mango").click()
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "Updated segmented control value:", "mango")

    # Toggle back to initial options - "mango" exists in initial too
    click_toggle(app, "Update segmented control props")
    expect(dynamic_segmented).to_contain_text("Initial dynamic segmented control")

    # Selection should be PRESERVED since "mango" is in both option sets
    # If this was reset, it would show "apple" (initial default), not "mango"
    expect_prefixed_markdown(app, "Initial segmented control value:", "mango")


# --- Query parameter binding tests ---


def test_segmented_control_query_param_seeding_single(page: Page, app_base_url: str):
    """Test that single-select segmented control can be seeded from URL."""
    page.goto(build_app_url(app_base_url, query={"bound_sc": "dog"}))
    wait_for_app_loaded(page)

    expect_text(page, "bound_sc: dog")
    expect(page).to_have_url(re.compile(r"\?bound_sc=dog"))


def test_segmented_control_query_param_updates_url(app: Page):
    """Test that selecting a segment updates the URL."""
    bound_group = get_element_by_key(app, "bound_sc")
    get_segment_button(bound_group, "cat").click()
    wait_for_app_run(app)

    expect_text(app, "bound_sc: cat")
    expect(app).to_have_url(re.compile(r"\?bound_sc=cat"))

    # Deselect (toggle off) clears URL param
    get_segment_button(bound_group, "cat").click()
    wait_for_app_run(app)

    expect_text(app, "bound_sc: None")
    expect(app).not_to_have_url(re.compile(r"bound_sc="))


def test_segmented_control_query_param_edge_cases(page: Page, app_base_url: str):
    """Smoke test: invalid value handling for single and multi-select."""
    # Single-select: invalid URL reverts to default (None when no default)
    page.goto(build_app_url(app_base_url, query={"bound_sc": "Invalid"}))
    wait_for_app_loaded(page)
    expect_text(page, "bound_sc: None")
    expect(page).not_to_have_url(re.compile(r"bound_sc="))

    # Multi-select: partial invalid values filtered, valid ones kept
    page.goto(
        build_app_url(
            app_base_url,
            query={"bound_sc_multi": ["Red", "Invalid", "Blue"]},
        )
    )
    wait_for_app_loaded(page)
    expect_text(page, "bound_sc_multi: ['Red', 'Blue']")
    expect(page).to_have_url(re.compile(r"bound_sc_multi=Red&bound_sc_multi=Blue"))
    expect(page).not_to_have_url(re.compile(r"Invalid"))

    # Multi-select: all-invalid clears to empty list
    page.goto(
        build_app_url(
            app_base_url,
            query={"bound_sc_multi": ["Invalid1", "Invalid2"]},
        )
    )
    wait_for_app_loaded(page)
    expect_text(page, "bound_sc_multi: []")
    expect(page).not_to_have_url(re.compile(r"bound_sc_multi="))


def test_segmented_control_query_param_default_override(page: Page, app_base_url: str):
    """Test that URL overrides default, and reverting to default clears URL param."""
    page.goto(build_app_url(app_base_url, query={"bound_sc_default": "Blue"}))
    wait_for_app_loaded(page)

    expect_text(page, "bound_sc_default: Blue")
    expect(page).to_have_url(re.compile(r"bound_sc_default=Blue"))

    bound_group = get_element_by_key(page, "bound_sc_default")
    get_segment_button(bound_group, "Red").click()
    wait_for_app_run(page)

    expect_text(page, "bound_sc_default: Red")
    expect(page).not_to_have_url(re.compile(r"bound_sc_default="))
