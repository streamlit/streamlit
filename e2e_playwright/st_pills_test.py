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
)


def get_pill_button(locator: Locator, text: str) -> Locator:
    return locator.get_by_test_id(re.compile(r"stBaseButton-pills(Active)?")).filter(
        has_text=text
    )


def test_pills_regression_no_wrap_at_app_start(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test regression for gh-12067: Pills at the start of the app should not wrap.

    The bug caused pills with 3+ options to have their last option wrap to a new line
    when pills were among the first elements rendered in the app. This was due to
    maxWidth: "100%" causing flexbox width calculation errors.
    """
    # This pills is at the very start of the app (before the header)
    # With the bug, the last option ("3") would wrap to a new line
    regression_pills = get_element_by_key(app, "regression_3")

    assert_snapshot(
        regression_pills,
        name="st_pills-regression_no_wrap_3_options",
    )


def test_click_multiple_pills_and_take_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test multiselect pills and take a screenshot.

    Click on same pill multiple times to test unselect.
    """

    pills = get_button_group(themed_app, "pills")
    get_pill_button(pills, "📝").click()
    wait_for_app_run(themed_app)
    # click on second element to test multiselect
    get_pill_button(pills, "🪢").click()
    wait_for_app_run(themed_app)
    expect_markdown(themed_app, "Multi selection: ['📝 Text', '🪢 Graphs']")

    # click on same element to test unselect
    get_pill_button(pills, "🪢").click()
    wait_for_app_run(themed_app)
    expect_markdown(themed_app, "Multi selection: ['📝 Text']")

    # click on same element and take screenshot of multiple selected pills
    get_pill_button(pills, "🪢").click()
    # take away hover focus of button
    themed_app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    wait_for_app_run(themed_app)
    expect_markdown(themed_app, "Multi selection: ['📝 Text', '🪢 Graphs']")

    assert_snapshot(pills, name="st_pills-multiselect")


def test_click_single_icon_pill_and_take_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test icon only pills (via format_func) and take a screenshot.

    Click on same element to test unselect.
    Click on two different elements to validate single select.
    """

    pills = get_button_group(themed_app, "icon_only_pills")

    # the icon's span element has the respective text
    # (e.g. :material/zoom_out_map: -> zoom_out_map)
    get_pill_button(pills, "zoom_out_map").click()
    expect_markdown(themed_app, "Single selection: 3")

    # test unselect in single-select mode
    get_pill_button(pills, "zoom_out_map").click()
    expect_markdown(themed_app, "Single selection: None")

    get_pill_button(pills, "zoom_in").click()
    # take away hover focus of button
    themed_app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    wait_for_app_run(themed_app)
    expect_markdown(themed_app, "Single selection: 1")

    assert_snapshot(pills, name="st_pills-singleselect_icon_only")


def test_pills_are_disabled_and_take_screenshot(
    app: Page, assert_snapshot: ImageCompareFunction
):
    pills = get_button_group(app, "pills_disabled")
    for pill in pills.locator("button").all():
        expect(pill).to_have_js_property("disabled", True)
    selected_pill = get_pill_button(pills, "Air")
    selected_pill.click(force=True)
    wait_for_app_run(app)
    expect(selected_pill).not_to_have_css("color", re.compile(r"rgb\(\d+, \d+, \d+\)"))
    expect_markdown(app, "pills-disabled: None")
    assert_snapshot(pills, name="st_pills-disabled")


def test_pills_are_disabled_and_selected_and_take_screenshot(
    app: Page, assert_snapshot: ImageCompareFunction
):
    pills = get_button_group(app, "pills_disabled-selected")
    for pill in pills.locator("button").all():
        expect(pill).to_have_js_property("disabled", True)
    selected_pill = get_pill_button(pills, "Air")
    selected_pill.click(force=True)
    wait_for_app_run(app)
    expect(selected_pill).not_to_have_css("color", re.compile(r"rgb\(\d+, \d+, \d+\)"))
    expect_markdown(app, "pills-disabled-selected: Water")
    assert_snapshot(pills, name="st_pills-disabled-selected")


def test_pass_default_selections(app: Page):
    """Test that passed defaults are rendered correctly."""
    expect_prefixed_markdown(app, "Pills with default options:", "[]")

    click_checkbox(app, "Set default values")
    expect_prefixed_markdown(
        app,
        "Pills with default options:",
        "['🧰 General widgets', '🎥 Video']",
    )

    click_checkbox(app, "Set default values")
    expect_prefixed_markdown(app, "Pills with default options:", "[]")


def test_selection_via_on_change_callback(app: Page):
    """Test that the on_change callback is triggered when a pill is clicked."""
    pills = get_button_group(app, "pills_on_change")
    get_pill_button(pills, "Air").click()
    wait_for_app_run(app)
    expect_markdown(app, "on_change selection: Air")


def test_pills_work_in_forms(app: Page):
    expect_markdown(app, "pills-in-form: None")
    pills = get_button_group(app, "pills_in_form")
    get_pill_button(pills, "Air").click()
    click_form_button(app, "Submit")
    wait_for_app_run(app)
    expect_markdown(app, "pills-in-form: Air")


def test_pills_work_with_fragments(app: Page):
    expect_markdown(app, "pills-in-fragment: None")
    pills = get_button_group(app, "pills_in_fragment")
    get_pill_button(pills, "Air").click()
    wait_for_app_run(app)
    expect_markdown(app, "pills-in-fragment: Air")
    expect(app.get_by_text("Runs: 1")).to_be_visible()


def test_pills_remount_keep_value(app: Page):
    expect_markdown(app, "pills-after-sleep: None")
    pills = get_button_group(app, "pills_after_sleep")
    selected_pill = get_pill_button(pills, "Air")
    selected_pill.click()
    wait_for_app_run(app)
    expect_markdown(app, "pills-after-sleep: Air")
    click_button(app, "Create some elements to unmount component")
    expect_markdown(app, "pills-after-sleep: Air")


def test_help_tooltip_works(app: Page):
    expect_help_tooltip(
        app, get_button_group(app, "pills"), "This is for choosing options"
    )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stButtonGroup")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "pills")).to_be_visible()


def test_pills_with_labels(app: Page):
    """Test that labels are rendered correctly."""

    # visible label
    visible_label = app.get_by_test_id("stWidgetLabel").filter(
        has_text="Select some options"
    )
    expect(visible_label).to_be_visible()

    # collapsed label
    markdown_el = app.get_by_test_id("stWidgetLabel").filter(
        has_text="Elements (label collapsed)"
    )
    expect(markdown_el).to_be_attached()
    expect(markdown_el).not_to_be_visible()
    expect(markdown_el).to_have_css("display", "none")

    # hidden label
    markdown_el = app.get_by_test_id("stWidgetLabel").filter(
        has_text="Elements (label hidden)"
    )
    expect(markdown_el).to_be_attached()
    expect(markdown_el).not_to_be_visible()
    expect(markdown_el).to_have_css("display", "flex")
    expect(markdown_el).to_have_css("visibility", "hidden")


def test_pills_width_examples(app: Page, assert_snapshot: ImageCompareFunction):
    """Test pills with different width configurations."""

    # The width examples are addressed via their keys
    content_pills = get_button_group(app, "pills_content_width")
    assert_snapshot(content_pills, name="st_pills-width_content")

    stretch_pills = get_button_group(app, "pills_stretch_width")
    assert_snapshot(stretch_pills, name="st_pills-width_stretch")

    pills_300px = get_button_group(app, "pills_300px_width")
    assert_snapshot(pills_300px, name="st_pills-width_300px")


def test_dynamic_pills_props(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the pills can be updated dynamically while keeping the state.

    This tests that:
    1. Options can be changed dynamically when a key is provided
    2. Selection resets to default when selected value is removed from options
    3. Selection is preserved when the selected value exists in new options

    Note: When using dynamic options with a key, the selection is preserved only
    if the formatted value (after applying format_func) exists in the new options.

    Initial options: [apple, banana, mango, orange] with format_func=capitalize, default=apple
    Updated options: [mango, papaya, grape, apple] with format_func=capitalize, default=papaya
    """
    dynamic_pills = get_element_by_key(app, "dynamic_pills_with_key")
    expect(dynamic_pills).to_be_visible()

    # Initial state
    expect(dynamic_pills).to_contain_text("Initial dynamic pills")
    assert_snapshot(dynamic_pills, name="st_pills-dynamic_initial")
    expect_prefixed_markdown(app, "Initial pills value:", "apple")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_pills, "initial help")

    # --- Test 1: Selection RESETS when value is removed from options ---
    # Select "banana" (only exists in initial options, NOT in updated)
    get_pill_button(dynamic_pills, "Banana").click()
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "Initial pills value:", "banana")

    # Toggle to update props - options change from [apple, banana, mango, orange]
    # to [mango, papaya, grape, apple]. "banana" is NOT in updated options.
    click_toggle(app, "Update pills props")

    # Updated pills is visible
    expect(dynamic_pills).to_contain_text("Updated dynamic pills")

    # Selection should RESET to "papaya" (default) since "banana" is not in updated options
    expect_prefixed_markdown(app, "Updated pills value:", "papaya")
    # Negative assertion: ensure "banana" is NOT selected after toggle (regression check)
    expect(dynamic_pills).not_to_contain_text("Banana")

    dynamic_pills.scroll_into_view_if_needed()
    assert_snapshot(dynamic_pills, name="st_pills-dynamic_updated")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_pills, "updated help")

    # --- Test 2: Selection PRESERVED when value exists in both option sets ---
    # Select "mango" - it exists in BOTH option sets at different indices:
    # Initial: index 2 (displayed "Mango"), Updated: index 0 (displayed "Mango")
    # Neither is the default. This ensures we're testing true preservation.
    get_pill_button(dynamic_pills, "Mango").click()
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "Updated pills value:", "mango")

    # Toggle back to initial options - "mango" exists in initial too
    click_toggle(app, "Update pills props")
    expect(dynamic_pills).to_contain_text("Initial dynamic pills")

    # Selection should be PRESERVED since "mango" is in both option sets
    # If this was reset, it would show "apple" (initial default), not "mango"
    expect_prefixed_markdown(app, "Initial pills value:", "mango")


# --- Query parameter binding tests ---


def test_pills_query_param_seeding_single(page: Page, app_base_url: str):
    """Test that single-select pills value can be seeded from URL query params."""
    page.goto(build_app_url(app_base_url, query={"bound_pills": "dog"}))
    wait_for_app_loaded(page)

    expect_text(page, "bound_pills: dog")
    expect(page).to_have_url(re.compile(r"\?bound_pills=dog"))
    expect(page).not_to_have_url(re.compile(r"bound_pills_default="))
    expect(page).not_to_have_url(re.compile(r"bound_pills_fmt="))


def test_pills_query_param_seeding_multi(page: Page, app_base_url: str):
    """Test that multi-select pills values can be seeded from URL query params."""
    page.goto(build_app_url(app_base_url, query={"bound_pills_multi": ["Red", "Blue"]}))
    wait_for_app_loaded(page)

    expect_text(page, "bound_pills_multi: ['Red', 'Blue']")
    expect(page).to_have_url(
        re.compile(r"bound_pills_multi=Red&bound_pills_multi=Blue")
    )


def test_pills_query_param_updates_url_single(app: Page):
    """Test that selecting, deselecting, and switching pills updates the URL."""
    bound_group = get_element_by_key(app, "bound_pills")
    get_pill_button(bound_group, "cat").click()
    wait_for_app_run(app)

    expect_text(app, "bound_pills: cat")
    expect(app).to_have_url(re.compile(r"\?bound_pills=cat"))

    # Switch selection: clicking a different pill replaces the URL value
    get_pill_button(bound_group, "dog").click()
    wait_for_app_run(app)

    expect_text(app, "bound_pills: dog")
    expect(app).to_have_url(re.compile(r"\?bound_pills=dog"))
    expect(app).not_to_have_url(re.compile(r"bound_pills=cat"))

    # Deselect (toggle off) clears URL param
    get_pill_button(bound_group, "dog").click()
    wait_for_app_run(app)

    expect_text(app, "bound_pills: None")
    expect(app).not_to_have_url(re.compile(r"bound_pills="))


def test_pills_query_param_updates_url_multi(app: Page):
    """Test that selecting multiple pills updates the URL."""
    bound_group = get_element_by_key(app, "bound_pills_multi")
    get_pill_button(bound_group, "Red").click()
    wait_for_app_run(app)

    expect_text(app, "bound_pills_multi: ['Red']")
    expect(app).to_have_url(re.compile(r"\?bound_pills_multi=Red"))

    get_pill_button(bound_group, "Blue").click()
    wait_for_app_run(app)

    expect_text(app, "bound_pills_multi: ['Red', 'Blue']")
    expect(app).to_have_url(re.compile(r"bound_pills_multi=Red&bound_pills_multi=Blue"))


def test_pills_query_param_default_override(page: Page, app_base_url: str):
    """Test default override: URL overrides default, invalid reverts, revert clears."""
    # Invalid URL reverts to default ("Red"), not to None
    page.goto(build_app_url(app_base_url, query={"bound_pills_default": "Invalid"}))
    wait_for_app_loaded(page)
    expect_text(page, "bound_pills_default: Red")
    expect(page).not_to_have_url(re.compile(r"bound_pills_default="))

    # Valid URL overrides default
    page.goto(build_app_url(app_base_url, query={"bound_pills_default": "Blue"}))
    wait_for_app_loaded(page)

    expect_text(page, "bound_pills_default: Blue")
    expect(page).to_have_url(re.compile(r"bound_pills_default=Blue"))

    # Revert to default by selecting "Red" clears URL param
    bound_group = get_element_by_key(page, "bound_pills_default")
    get_pill_button(bound_group, "Red").click()
    wait_for_app_run(page)

    expect_text(page, "bound_pills_default: Red")
    expect(page).not_to_have_url(re.compile(r"bound_pills_default="))


def test_pills_query_param_single_edge_cases(page: Page, app_base_url: str):
    """Test single-select edge cases: invalid, empty, and multiple URL values."""
    # Invalid URL value reverts to default (None when no default)
    page.goto(build_app_url(app_base_url, query={"bound_pills": "Invalid"}))
    wait_for_app_loaded(page)
    expect_text(page, "bound_pills: None")
    expect(page).not_to_have_url(re.compile(r"bound_pills="))

    # Empty URL param clears to None (clearable widget)
    page.goto(build_app_url(app_base_url, query={"bound_pills": ""}))
    wait_for_app_loaded(page)
    expect_text(page, "bound_pills: None")
    expect(page).not_to_have_url(re.compile(r"bound_pills="))

    # Multiple URL values truncated to first for single-select
    page.goto(build_app_url(app_base_url, query={"bound_pills": ["cat", "dog"]}))
    wait_for_app_loaded(page)
    expect_text(page, "bound_pills: cat")
    expect(page).to_have_url(re.compile(r"\?bound_pills=cat"))
    expect(page).not_to_have_url(re.compile(r"bound_pills=dog"))


def test_pills_query_param_format_func(page: Page, app_base_url: str):
    """Test that formatted option strings work in URL."""
    page.goto(build_app_url(app_base_url, query={"bound_pills_fmt": "DOG"}))
    wait_for_app_loaded(page)

    expect_text(page, "bound_pills_fmt: dog")
    expect(page).to_have_url(re.compile(r"bound_pills_fmt=DOG"))


def test_pills_query_param_multi_default_override(page: Page, app_base_url: str):
    """Test multiselect pills: URL overrides default, reverting clears param."""
    page.goto(
        build_app_url(
            app_base_url,
            query={"bound_pills_multi_default": ["Yellow", "Blue"]},
        )
    )
    wait_for_app_loaded(page)

    expect_text(page, "bound_pills_multi_default: ['Yellow', 'Blue']")
    expect(page).to_have_url(re.compile(r"bound_pills_multi_default="))

    # Revert to default ["Red", "Green"] by deselecting Yellow, Blue
    # then selecting Red, Green
    bound_group = get_element_by_key(page, "bound_pills_multi_default")
    get_pill_button(bound_group, "Yellow").click()
    wait_for_app_run(page)
    get_pill_button(bound_group, "Blue").click()
    wait_for_app_run(page)
    get_pill_button(bound_group, "Red").click()
    wait_for_app_run(page)
    get_pill_button(bound_group, "Green").click()
    wait_for_app_run(page)

    expect_text(page, "bound_pills_multi_default: ['Red', 'Green']")
    expect(page).not_to_have_url(re.compile(r"bound_pills_multi_default="))


def test_pills_query_param_multi_edge_cases(page: Page, app_base_url: str):
    """Test multi-select edge cases: invalid filtering, empty, and duplicates."""
    # Partial invalid values are filtered out, keeping valid ones
    page.goto(
        build_app_url(
            app_base_url,
            query={"bound_pills_multi": ["Red", "Invalid", "Blue"]},
        )
    )
    wait_for_app_loaded(page)
    expect_text(page, "bound_pills_multi: ['Red', 'Blue']")
    expect(page).to_have_url(
        re.compile(r"bound_pills_multi=Red&bound_pills_multi=Blue")
    )
    expect(page).not_to_have_url(re.compile(r"Invalid"))

    # All-invalid URL values clear to empty list and remove param
    page.goto(
        build_app_url(
            app_base_url,
            query={"bound_pills_multi": ["Invalid1", "Invalid2"]},
        )
    )
    wait_for_app_loaded(page)
    expect_text(page, "bound_pills_multi: []")
    expect(page).not_to_have_url(re.compile(r"bound_pills_multi="))

    # Empty URL param on multi-select with no default clears the URL
    page.goto(build_app_url(app_base_url, query={"bound_pills_multi": ""}))
    wait_for_app_loaded(page)
    expect_text(page, "bound_pills_multi: []")
    expect(page).not_to_have_url(re.compile(r"bound_pills_multi="))

    # Duplicate URL values are deduplicated
    page.goto(
        build_app_url(
            app_base_url,
            query={"bound_pills_multi": ["Red", "Blue", "Red"]},
        )
    )
    wait_for_app_loaded(page)
    expect_text(page, "bound_pills_multi: ['Red', 'Blue']")
    expect(page).to_have_url(
        re.compile(r"bound_pills_multi=Red&bound_pills_multi=Blue")
    )
    expect(page).not_to_have_url(
        re.compile(
            r"bound_pills_multi=Red&bound_pills_multi=Blue&bound_pills_multi=Red"
        )
    )


def test_pills_query_param_multi_empty_overrides_nonempty_default(
    page: Page, app_base_url: str
):
    """Test that empty URL param overrides a non-empty default to [] and persists."""
    page.goto(build_app_url(app_base_url, query={"bound_pills_multi_default": ""}))
    wait_for_app_loaded(page)

    expect_text(page, "bound_pills_multi_default: []")
    expect(page).to_have_url(re.compile(r"bound_pills_multi_default="))
