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

from playwright.sync_api import Page, expect

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
    get_datetime_input,
    get_element_by_key,
    type_date,
)

NUM_DATETIME_INPUTS = 18


def test_datetime_input_widget_rendering(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the datetime input widgets are correctly rendered via screenshot matching."""
    datetime_inputs = app.get_by_test_id("stDateTimeInput")
    expect(datetime_inputs).to_have_count(NUM_DATETIME_INPUTS)

    assert_snapshot(
        get_datetime_input(app, "Datetime input 1 (base)"),
        name="st_datetime_input-base",
    )
    assert_snapshot(
        get_datetime_input(app, "Datetime input 2 (help)"),
        name="st_datetime_input-help",
    )
    assert_snapshot(
        get_datetime_input(app, "Datetime input 3 (disabled)"),
        name="st_datetime_input-disabled",
    )
    assert_snapshot(
        get_datetime_input(app, "Datetime input 4 (hidden label)"),
        name="st_datetime_input-hidden_label",
    )
    assert_snapshot(
        get_datetime_input(app, "Datetime input 5 (collapsed label)"),
        name="st_datetime_input-collapsed_label",
    )
    assert_snapshot(
        get_datetime_input(app, "Datetime input 6 (with callback)"),
        name="st_datetime_input-callback",
    )
    assert_snapshot(
        get_datetime_input(app, "Datetime input 7 (step=60)"),
        name="st_datetime_input-step_60",
    )
    assert_snapshot(
        get_datetime_input(app, "Datetime input 8 (empty)"),
        name="st_datetime_input-empty",
    )
    assert_snapshot(
        get_datetime_input(app, "Datetime input 9 (empty, from state)"),
        name="st_datetime_input-state",
    )
    assert_snapshot(
        get_datetime_input(
            app,
            re.compile(r"^Datetime input 10"),
        ),
        name="st_datetime_input-markdown_label",
    )
    assert_snapshot(
        get_datetime_input(app, "Datetime input 11 (width=200px)"),
        name="st_datetime_input-width_200px",
    )
    assert_snapshot(
        get_datetime_input(app, "Datetime input 12 (width='stretch')"),
        name="st_datetime_input-width_stretch",
    )


def test_datetime_input_dropdown(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the datetime input dropdown is correctly rendered."""
    datetime_input = get_datetime_input(app, "Datetime input 1 (base)")
    datetime_input.get_by_test_id("stDateTimeInputField").get_by_role(
        "spinbutton"
    ).first.click()

    # Wait for the calendar to be visible
    calendar = app.get_by_test_id("stDateTimeInputCalendar")
    expect(calendar).to_be_visible()

    assert_snapshot(calendar, name="st_datetime_input-dropdown")


def test_help_tooltip(app: Page):
    element_with_help = get_datetime_input(app, "Datetime input 2 (help)")
    expect_help_tooltip(app, element_with_help, "Help text")


def test_datetime_input_initial_values(app: Page):
    expect_markdown(app, "Value 1: 2025-11-19 16:45:00")
    expect_markdown(app, "Value 2: 2025-11-19 18:45:00")
    expect_markdown(app, "Value 3: 2025-11-19 16:45:00")
    expect_markdown(app, "Value 4: 2025-11-19 16:45:00")
    expect_markdown(app, "Value 5: 2025-11-19 16:45:00")
    expect_markdown(app, "Value 6: 2025-11-19 16:45:00")
    expect_markdown(app, "datetime input changed: False")
    expect_markdown(app, "Value 7: 2025-11-19 16:45:00")
    expect_markdown(app, "Value 8: None")
    expect_markdown(app, "Value 9: 2025-11-19 16:50:00")


def test_handles_typing_selection(app: Page):
    datetime_field = get_datetime_input(app, "Datetime input 1 (base)").get_by_test_id(
        "stDateTimeInputField"
    )

    # Type into segments: year, month, day, hour, minute
    type_date(datetime_field, "2026", "01", "01", "09", "30")
    wait_for_app_run(app)

    expect_markdown(app, "Value 1: 2026-01-01 09:30:00")


def test_handles_datetime_selection_with_popover(app: Page):
    datetime_input = get_datetime_input(app, "Datetime input 1 (base)")
    datetime_field = datetime_input.get_by_test_id("stDateTimeInputField")

    # Click into segments to open the calendar popover
    datetime_field.get_by_role("spinbutton").first.click()
    calendar = app.get_by_test_id("stDateTimeInputCalendar")
    expect(calendar).to_be_visible()

    # Select a date in the calendar — popover stays open
    calendar.get_by_role("button", name=re.compile(r"November 25")).click()
    expect(calendar).to_be_visible()

    # Edit time via the popover TimeField
    time_row = app.get_by_test_id("stDateTimeInputPopoverTime")
    hour_segment = time_row.get_by_role("spinbutton").first
    hour_segment.click()
    # Type new hour value
    hour_segment.press("ArrowDown")  # 16 -> 15

    # Close popover by clicking outside
    app.get_by_text("Value 1:").click()
    expect(calendar).not_to_be_visible()
    wait_for_app_run(app)

    expect_markdown(app, "Value 1: 2025-11-25 15:45:00")


def test_popover_time_only_change(app: Page):
    """Test that changing only the time via popover TimeField commits correctly."""
    datetime_input = get_datetime_input(app, "Datetime input 1 (base)")
    datetime_field = datetime_input.get_by_test_id("stDateTimeInputField")

    # Open popover
    datetime_field.get_by_role("spinbutton").first.click()
    calendar = app.get_by_test_id("stDateTimeInputCalendar")
    expect(calendar).to_be_visible()

    # Edit only the time in the popover (don't select a date)
    time_row = app.get_by_test_id("stDateTimeInputPopoverTime")
    minute_segment = time_row.get_by_role("spinbutton").last
    minute_segment.click()
    minute_segment.press("ArrowUp")  # 45 -> 46

    # Close popover
    app.get_by_text("Value 1:").click()
    expect(calendar).not_to_be_visible()
    wait_for_app_run(app)

    expect_markdown(app, "Value 1: 2025-11-19 16:46:00")


def test_step_interval_applied(app: Page):
    datetime_field = get_datetime_input(
        app, "Datetime input 7 (step=60)"
    ).get_by_test_id("stDateTimeInputField")

    # Type into segments: year, month, day, hour, minute
    type_date(datetime_field, "2025", "11", "19", "16", "46")
    wait_for_app_run(app)

    expect_markdown(app, "Value 7: 2025-11-19 16:46:00")


def test_clearable_datetime_input(app: Page):
    datetime_input = get_datetime_input(app, "Datetime input 8 (empty)")
    datetime_field = datetime_input.get_by_test_id("stDateTimeInputField")

    # Type into segments: year, month, day, hour, minute
    type_date(datetime_field, "2025", "11", "19", "10", "15")
    wait_for_app_run(app)
    expect_markdown(app, "Value 8: 2025-11-19 10:15:00")

    # Click the clear button to reset to None
    datetime_input.get_by_test_id("stDateTimeInputClearButton").click()
    wait_for_app_run(app)
    expect_markdown(app, "Value 8: None")


def test_callback_invoked(app: Page):
    datetime_field = get_datetime_input(
        app, "Datetime input 6 (with callback)"
    ).get_by_test_id("stDateTimeInputField")

    # Type into segments: year, month, day, hour, minute
    type_date(datetime_field, "2025", "12", "01", "08", "00")
    wait_for_app_run(app)

    expect_markdown(app, "datetime input changed: True")


def test_form_submission_resets_value(app: Page):
    form_field = get_datetime_input(app, "Datetime input 13 (form)").get_by_test_id(
        "stDateTimeInputField"
    )
    # Type into segments (type_date commits via Escape)
    type_date(form_field, "2025", "12", "24", "12", "00")

    # Click submit button to submit the form (no rerun until form submit in st.form)
    app.get_by_role("button", name="Submit datetime form").click()
    wait_for_app_run(app)
    expect_markdown(app, "Form submitted value: 2025-12-24 12:00:00")


def test_fragment_reruns(app: Page):
    """Test that datetime input works correctly inside a fragment."""
    fragment_field = get_datetime_input(
        app, "Datetime input 14 (fragment)"
    ).get_by_test_id("stDateTimeInputField")

    # Type a value in the fragment datetime input segments
    type_date(fragment_field, "2025", "11", "19", "09", "00")
    wait_for_app_run(app)

    # Verify that other inputs are not affected (value1 should still be the original)
    expect_markdown(app, "Value 1: 2025-11-19 16:45:00")


def test_top_level_class_for_key(app: Page):
    """Check that custom CSS class is applied via key."""
    datetime_input = get_element_by_key(app, "dynamic_datetime_input_with_key")
    expect(datetime_input).to_be_visible()
    check_top_level_class(app, "stDateTimeInput")


def test_dynamic_props_update(app: Page):
    """Test that the datetime input can be updated dynamically while keeping the state."""
    # First verify the initial state
    expect_prefixed_markdown(
        app, "Initial datetime input value:", "2025-11-19 16:45:00"
    )

    # Verify the dynamic datetime input exists
    dynamic_input = get_element_by_key(app, "dynamic_datetime_input_with_key")
    expect(dynamic_input).to_be_visible()

    # Type a new value into the datetime input via segmented field
    input_field = dynamic_input.get_by_test_id("stDateTimeInputField")
    type_date(input_field, "2025", "12", "01", "14", "30")
    wait_for_app_run(app)
    expect(app.get_by_test_id("stDateTimeInputCalendar")).not_to_be_visible()

    expect_prefixed_markdown(
        app, "Initial datetime input value:", "2025-12-01 14:30:00"
    )

    # Click the toggle to update the datetime input props
    click_toggle(app, "Update datetime input props")

    # new datetime input is visible:
    expect(dynamic_input).to_contain_text("Updated dynamic datetime input")

    # Ensure the previously entered value remains visible
    expect_prefixed_markdown(
        app, "Updated datetime input value:", "2025-12-01 14:30:00"
    )

    # Test dynamic min/max behavior when bounds change:
    # Toggle back to initial bounds (2010-2030)
    click_toggle(app, "Update datetime input props")
    expect_prefixed_markdown(
        app, "Initial datetime input value:", "2025-12-01 14:30:00"
    )

    # Set value to 2028/01/01 which is valid in initial bounds (2010-2030)
    type_date(input_field, "2028", "01", "01", "10", "00")
    wait_for_app_run(app)
    expect_prefixed_markdown(
        app, "Initial datetime input value:", "2028-01-01 10:00:00"
    )

    # Toggle to updated bounds (2020-2025) - value 2028 is outside, should reset to default
    click_toggle(app, "Update datetime input props")
    # The default value for updated state is BASE_DATETIME + 3h15m = 2025-11-19 20:00:00
    expect_prefixed_markdown(
        app, "Updated datetime input value:", "2025-11-19 20:00:00"
    )
    # Anti-regression: ensure the old out-of-bounds value is not retained
    expect(app.get_by_text("2028-01-01")).not_to_be_visible()


# --- Query param binding tests ---


def test_datetime_input_query_param_seeding(page: Page, app_base_url: str):
    """Test that datetime input value can be seeded from URL query params using ISO format."""
    page.goto(build_app_url(app_base_url, query={"bound_datetime": "2025-11-20T10:30"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound datetime:", "2025-11-20 10:30:00")
    expect(page).to_have_url(re.compile(r"bound_datetime=2025-11-20T10%3A30"))


def test_datetime_input_query_param_clearable_empty(page: Page, app_base_url: str):
    """Test that a clearable datetime input (value=None) can be seeded as empty from URL."""
    page.goto(build_app_url(app_base_url, query={"bound_clearable_dt": ""}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound clearable datetime:", "None")


def test_datetime_input_query_param_invalid_reverts_to_default(
    page: Page, app_base_url: str
):
    """Test that an invalid URL value reverts to the default."""
    page.goto(build_app_url(app_base_url, query={"bound_datetime": "not-a-datetime"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound datetime:", "2025-11-19 16:45:00")
    expect(page).not_to_have_url(re.compile(r"[?&]bound_datetime="))


def test_datetime_input_query_param_out_of_range_resets(page: Page, app_base_url: str):
    """Test that out-of-bounds datetime values revert to default."""
    page.goto(
        build_app_url(app_base_url, query={"bound_minmax_dt": "2024-06-15T12:00"})
    )
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound minmax datetime:", "2025-11-19 16:45:00")
    expect(page).not_to_have_url(re.compile(r"[?&]bound_minmax_dt="))
