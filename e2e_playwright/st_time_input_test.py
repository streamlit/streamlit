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

from __future__ import annotations

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
    click_toggle,
    expect_help_tooltip,
    expect_markdown,
    expect_prefixed_markdown,
    get_element_by_key,
    get_time_input,
    type_time,
)
from e2e_playwright.shared.theme_utils import apply_theme_via_window

NUM_TIME_INPUTS = 20


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
    assert_snapshot(
        get_time_input(themed_app, "Time input (step=30, seconds)"),
        name="st_time_input-seconds_step30",
    )
    assert_snapshot(
        get_time_input(themed_app, "Time input (12-hour)"),
        name="st_time_input-hour_cycle_12",
    )
    assert_snapshot(
        get_time_input(themed_app, "Time input (12h + seconds)"),
        name="st_time_input-12h_seconds",
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


def test_handles_time_selection(app: Page):
    """Test that selection of a time via the segmented input works correctly."""
    time_display = get_time_input(app, "Time input 1 (8:45)").get_by_test_id(
        "stTimeInputTimeDisplay"
    )
    type_time(time_display, "00", "00")
    wait_for_app_run(app)
    # Check that selection worked:
    expect_markdown(app, "Value 1: 00:00:00")


def test_focused_segment_colors(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the focused segment uses the correct theme colors."""
    time_input = get_time_input(themed_app, "Time input 1 (8:45)")
    time_display = time_input.get_by_test_id("stTimeInputTimeDisplay")
    time_display.locator("[role='spinbutton']").first.click()

    # Take a screenshot of the time input with its segment focused:
    assert_snapshot(time_input, name="st_time_input-focused_segment")


def test_handles_step_correctly(app: Page):
    """Test that the step parameter allows any minute-precision value to be entered."""
    time_display = get_time_input(app, "Time input 7 (step=60)").get_by_test_id(
        "stTimeInputTimeDisplay"
    )
    type_time(time_display, "00", "01")
    wait_for_app_run(app)
    # Check that selection worked (step does not restrict entered values):
    expect_markdown(app, "Value 7: 00:01:00")


def test_arrow_keys_respect_step(app: Page):
    """Test that ArrowUp/Down snap to step boundaries on the minute segment.

    step=900 (15 min, the default): ArrowUp from 08:45 → 09:00 (next 15-min
    boundary above), ArrowDown → 08:45 again.
    step=60  (1 min): ArrowUp gives the react-aria default of ±1 minute.
    """
    # --- step=900 (default, Time input 1 starts at 08:45) ---
    minute_sp = (
        get_time_input(app, "Time input 1 (8:45)")
        .get_by_test_id("stTimeInputTimeDisplay")
        .locator("[role='spinbutton']")
        .last  # minute segment
    )
    minute_sp.click()
    minute_sp.press("ArrowUp")
    wait_for_app_run(app)
    # floor(525/15)*15 + 15 = 525 + 15 = 540 → 09:00
    expect_markdown(app, "Value 1: 09:00:00")

    minute_sp.press("ArrowDown")
    wait_for_app_run(app)
    # ceil(540/15)*15 - 15 = 540 - 15 = 525 → 08:45
    expect_markdown(app, "Value 1: 08:45:00")

    # --- step=60 (Time input 7 starts at 08:45): react-aria default ±1 min ---
    minute_sp_60 = (
        get_time_input(app, "Time input 7 (step=60)")
        .get_by_test_id("stTimeInputTimeDisplay")
        .locator("[role='spinbutton']")
        .last
    )
    minute_sp_60.click()
    minute_sp_60.press("ArrowUp")
    wait_for_app_run(app)
    expect_markdown(app, "Value 7: 08:46:00")


def test_handles_time_selection_via_typing(app: Page):
    """Test that entering a time via keyboard works correctly."""
    time_display = get_time_input(app, "Time input 1 (8:45)").get_by_test_id(
        "stTimeInputTimeDisplay"
    )

    # Type 00:15 using digit keys:
    type_time(time_display, "00", "15")
    wait_for_app_run(app)
    expect_markdown(app, "Value 1: 00:15:00")

    # Re-focus the hour segment, then type a different value:
    type_time(time_display, "00", "16")
    wait_for_app_run(app)
    expect_markdown(app, "Value 1: 00:16:00")


def test_empty_time_input_behaves_correctly(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.time_input behaves correctly when empty (no initial value)."""
    empty_time_input = get_time_input(app, "Time input 8 (empty)")
    time_display = empty_time_input.get_by_test_id("stTimeInputTimeDisplay")

    type_time(time_display, "00", "15")
    wait_for_app_run(app)
    expect_markdown(app, "Value 8: 00:15:00")

    assert_snapshot(empty_time_input, name="st_time_input-clearable_input")

    # Clear the input via the clear button:
    empty_time_input.get_by_test_id("stTimeInputClearButton").click()

    # Should be empty again:
    expect_markdown(app, "Value 8: None")


def test_keeps_value_on_blur_without_edit(app: Page):
    """Test that clicking away without editing leaves the value unchanged."""
    time_display = get_time_input(app, "Time input 1 (8:45)").get_by_test_id(
        "stTimeInputTimeDisplay"
    )
    # Focus a spinbutton directly so blur is meaningful
    segment = time_display.locator("[role='spinbutton']").first
    segment.click()
    expect(segment).to_be_focused()

    # Click outside to blur the input without making any changes:
    app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})

    # Value should remain the initial value:
    expect_markdown(app, "Value 1: 08:45:00")


def test_handles_callback_on_change_correctly(app: Page):
    """Test that it correctly calls the callback on change."""
    # Check initial state:
    expect_markdown(app, "Value 6: 08:45:00")
    expect_markdown(app, "time input changed: False")

    callback_input = get_time_input(app, "Time input 6 (with callback)").get_by_test_id(
        "stTimeInputTimeDisplay"
    )
    type_time(callback_input, "00", "00")
    # Wait for app to process the change before checking values:
    wait_for_app_run(app)

    # Check that selection worked:
    expect_markdown(app, "Value 6: 00:00:00")
    expect_markdown(app, "time input changed: True")

    # Change a different input to trigger delta path change:
    other_input = get_time_input(app, "Time input 1 (8:45)").get_by_test_id(
        "stTimeInputTimeDisplay"
    )
    type_time(other_input, "00", "15")
    # Wait for app to process the change before checking values:
    wait_for_app_run(app)

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

    # Type a new time via the segmented input:
    time_display = dynamic_time_input.get_by_test_id("stTimeInputTimeDisplay")
    type_time(time_display, "00", "15")
    wait_for_app_loaded(app)

    expect_prefixed_markdown(app, "Initial time input value:", "00:15:00")

    # Click the toggle to update the time input props
    click_toggle(app, "Update time input props")

    # new time input is visible:
    expect(dynamic_time_input).to_contain_text("Updated dynamic time input")

    # Ensure the previously entered value remains visible
    expect_prefixed_markdown(app, "Updated time input value:", "00:15:00")

    # Ensure element is scrolled into view and stable before snapshot
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

    time_input = get_time_input(app, "Time input 1 (8:45)")

    # Take a snapshot of the time input with the custom theme:
    assert_snapshot(time_input, name="st_time_input-custom-theme")

    # Click the hour spinbutton to focus it and snapshot the active/focused state:
    time_input.get_by_test_id("stTimeInputTimeDisplay").locator(
        "[role='spinbutton']"
    ).first.click()
    assert_snapshot(time_input, name="st_time_input-focused-custom-theme")


# --- Query param binding tests ---


def test_time_input_query_param_seeding(page: Page, app_base_url: str):
    """Test that time input value can be seeded from URL query params using HH:MM format."""
    page.goto(build_app_url(app_base_url, query={"bound_time": "14:30"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound time:", "14:30:00")
    expect(page).to_have_url(re.compile(r"bound_time=14%3A30"))


def test_time_input_query_param_clearable_empty(page: Page, app_base_url: str):
    """Test that a clearable time input (value=None) can be seeded as empty from URL."""
    page.goto(build_app_url(app_base_url, query={"bound_clearable_time": ""}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound clearable time:", "None")


def test_time_input_query_param_invalid_reverts_to_default(
    page: Page, app_base_url: str
):
    """Test that an invalid URL value reverts to the default."""
    page.goto(build_app_url(app_base_url, query={"bound_time": "not-a-time"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound time:", "08:45:00")
    expect(page).not_to_have_url(re.compile(r"[?&]bound_time="))


def test_time_input_query_param_step_not_snapped(page: Page, app_base_url: str):
    """Test that URL-seeded time values not aligned to step are accepted as-is."""
    page.goto(build_app_url(app_base_url, query={"bound_step_time": "09:17"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound step time:", "09:17:00")
    expect(page).to_have_url(re.compile(r"bound_step_time=09%3A17"))


# --- Paste behavior tests ---


def _paste_into(locator: Locator, text: str) -> None:
    """Simulate a paste event with the given text on a Playwright locator."""
    locator.evaluate(
        """(el, text) => {
            const dt = new DataTransfer();
            dt.setData('text/plain', text);
            const event = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
            });
            Object.defineProperty(event, 'clipboardData', { value: dt });
            el.dispatchEvent(event);
        }""",
        text,
    )


def test_paste_behavior(app: Page):
    """Test paste scenarios: valid formats, invalid with error/recovery, partial digits, empty field."""
    # --- Valid paste: HH:MM and HHMM ---
    time_input_1 = get_time_input(app, "Time input 1 (8:45)")
    time_display_1 = time_input_1.get_by_test_id("stTimeInputTimeDisplay")
    hour_segment = time_display_1.locator("[role='spinbutton']").first
    minute_segment = time_display_1.locator("[role='spinbutton']").last
    hour_segment.click()

    _paste_into(hour_segment, "14:30")
    wait_for_app_run(app)
    expect_markdown(app, "Value 1: 14:30:00")

    _paste_into(hour_segment, "2215")
    wait_for_app_run(app)
    expect_markdown(app, "Value 1: 22:15:00")

    # --- Invalid paste shows error, does not commit ---
    _paste_into(hour_segment, "08:99")
    expect(time_input_1.get_by_test_id("stTimeInputError")).to_be_visible()
    expect(hour_segment).to_have_text("08")
    expect(minute_segment).to_have_text("99")
    expect_markdown(app, "Value 1: 22:15:00")

    # --- Recovery via valid paste ---
    _paste_into(hour_segment, "10:30")
    wait_for_app_run(app)
    expect(time_input_1.get_by_test_id("stTimeInputError")).not_to_be_visible()
    expect_markdown(app, "Value 1: 10:30:00")

    # --- Arrow key revert after invalid paste ---
    _paste_into(hour_segment, "08:99")
    expect(time_input_1.get_by_test_id("stTimeInputError")).to_be_visible()

    minute_segment.click()
    minute_segment.press("ArrowUp")

    expect(time_input_1.get_by_test_id("stTimeInputError")).not_to_be_visible()
    expect(hour_segment).to_have_text("10")
    expect(minute_segment).to_have_text("30")
    expect_markdown(app, "Value 1: 10:30:00")

    # --- Partial digit into segment ---
    minute_segment.click()
    _paste_into(minute_segment, "22")
    wait_for_app_run(app)
    expect_markdown(app, "Value 1: 10:22:00")

    # --- Paste into empty (cleared) field ---
    time_input_8 = get_time_input(app, "Time input 8 (empty)")
    time_display_8 = time_input_8.get_by_test_id("stTimeInputTimeDisplay")
    hour_segment_8 = time_display_8.locator("[role='spinbutton']").first
    minute_segment_8 = time_display_8.locator("[role='spinbutton']").last
    hour_segment_8.click()

    _paste_into(hour_segment_8, "16:45")
    wait_for_app_run(app)
    expect_markdown(app, "Value 8: 16:45:00")

    minute_segment_8.click()
    _paste_into(minute_segment_8, "30")
    wait_for_app_run(app)
    expect_markdown(app, "Value 8: 16:30:00")


def test_paste_error_state_snapshot(app: Page, assert_snapshot: ImageCompareFunction):
    """Snapshot test for the error visual (red border + error icon)."""
    time_input = get_time_input(app, "Time input 1 (8:45)")
    time_display = time_input.get_by_test_id("stTimeInputTimeDisplay")
    hour_segment = time_display.locator("[role='spinbutton']").first
    hour_segment.click()

    _paste_into(hour_segment, "25:00")

    # Wait for error icon to appear
    expect(time_input.get_by_test_id("stTimeInputError")).to_be_visible()

    assert_snapshot(time_input, name="st_time_input-paste_error_state")


def test_paste_in_form_context(app: Page):
    """Test that paste works inside a form and value is submitted correctly."""
    time_input = get_time_input(app, "Form time input")
    time_display = time_input.get_by_test_id("stTimeInputTimeDisplay")
    hour_segment = time_display.locator("[role='spinbutton']").first
    hour_segment.click()

    # Paste a valid time
    _paste_into(hour_segment, "14:30")

    # Value should NOT commit until form is submitted (form widgets defer)
    expect(app.get_by_text("Form time:")).not_to_be_visible()

    # Submit the form
    app.get_by_role("button", name="Submit").click()
    wait_for_app_run(app)

    expect_markdown(app, "Form time: 14:30:00")

    # Test invalid paste in form doesn't block submission of prior valid value
    hour_segment.click()
    _paste_into(hour_segment, "99:99")
    expect(time_input.get_by_test_id("stTimeInputError")).to_be_visible()

    # Submit form — should still submit the last committed value (14:30)
    app.get_by_role("button", name="Submit").click()
    wait_for_app_run(app)

    expect_markdown(app, "Form time: 14:30:00")


# --- Seconds granularity and hour cycle tests ---


def test_seconds_arrow_key_snaps_to_step(app: Page):
    """ArrowUp/Down on the seconds segment snaps to step boundaries (step=30)."""
    time_input = get_time_input(app, "Time input (step=30, seconds)")
    time_display = time_input.get_by_test_id("stTimeInputTimeDisplay")
    spinbuttons = time_display.get_by_role("spinbutton")
    second_segment = spinbuttons.nth(2)

    # Initial value is 08:45:30. ArrowUp on seconds → next step boundary.
    # totalSecs = 8*3600 + 45*60 + 30 = 31530. floor(31530/30)*30 + 30 = 31560 → 08:46:00
    second_segment.click()
    second_segment.press("ArrowUp")
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "Value seconds:", "08:46:00")

    # ArrowDown → ceil(31560/30)*30 - 30 = 31560 - 30 = 31530 → 08:45:30
    second_segment.press("ArrowDown")
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "Value seconds:", "08:45:30")
