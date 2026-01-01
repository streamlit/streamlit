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
)

NUM_DATETIME_INPUTS = 15


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
    datetime_input.locator("input").click()

    # Wait for the calendar to be visible
    calendar = app.locator('[data-baseweb="calendar"]')
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
    datetime_input_field = get_datetime_input(app, "Datetime input 1 (base)").locator(
        "input"
    )

    datetime_input_field.type("2026/01/01, 09:30")
    datetime_input_field.press("Enter")
    # Click on the label of another widget to close the popover and commit the value
    get_datetime_input(app, "Datetime input 2 (help)").click()
    wait_for_app_run(app)

    expect_markdown(app, "Value 1: 2026-01-01 09:30:00")


def test_handles_datetime_selection_with_popover(app: Page):
    datetime_input = get_datetime_input(app, "Datetime input 1 (base)")
    datetime_input_field = datetime_input.locator("input")

    # Clear the input and type the new value
    datetime_input_field.click()
    datetime_input_field.fill("")
    datetime_input_field.type("2025/11/25, 09:30")
    datetime_input_field.press("Enter")
    # Click on another element to close the popover and commit the value
    get_datetime_input(app, "Datetime input 2 (help)").click()
    wait_for_app_run(app)

    expect_markdown(app, "Value 1: 2025-11-25 09:30:00")


def test_step_interval_applied(app: Page):
    datetime_input_field = get_datetime_input(
        app, "Datetime input 7 (step=60)"
    ).locator("input")

    datetime_input_field.type("2025/11/19, 16:46")
    datetime_input_field.press("Enter")
    # Click on another element to close the popover and commit the value
    get_datetime_input(app, "Datetime input 1 (base)").click()
    wait_for_app_run(app)

    expect_markdown(app, "Value 7: 2025-11-19 16:46:00")


def test_clearable_datetime_input(app: Page):
    datetime_input = get_datetime_input(app, "Datetime input 8 (empty)")
    datetime_input_field = datetime_input.locator("input")

    datetime_input_field.type("2025/11/19, 10:15")
    datetime_input_field.press("Enter")
    # Click on another element to close the popover and commit the value
    get_datetime_input(app, "Datetime input 1 (base)").click()
    wait_for_app_run(app)
    expect_markdown(app, "Value 8: 2025-11-19 10:15:00")

    datetime_input.get_by_role("button", name="Clear value").click()
    # Click on another element to close the popover and commit the cleared value
    get_datetime_input(app, "Datetime input 1 (base)").click()
    wait_for_app_run(app)
    expect_markdown(app, "Value 8: None")


def test_callback_invoked(app: Page):
    datetime_input_field = get_datetime_input(
        app, "Datetime input 6 (with callback)"
    ).locator("input")

    datetime_input_field.type("2025/12/01, 08:00")
    datetime_input_field.press("Enter")
    # Click on another element to close the popover and commit the value, triggering callback
    get_datetime_input(app, "Datetime input 1 (base)").click()
    wait_for_app_run(app)

    expect_markdown(app, "datetime input changed: True")


def test_form_submission_resets_value(app: Page):
    form_input = get_datetime_input(app, "Datetime input 13 (form)").locator("input")
    form_input.type("2025/12/24, 12:00")
    form_input.press("Enter")

    # Click submit button which will close the popover and submit the form
    app.get_by_role("button", name="Submit datetime form").click()
    wait_for_app_run(app)
    expect_markdown(app, "Form submitted value: 2025-12-24 12:00:00")


def test_fragment_reruns(app: Page):
    """Test that datetime input works correctly inside a fragment."""
    fragment_input = get_datetime_input(app, "Datetime input 14 (fragment)")
    fragment_input_field = fragment_input.locator("input")

    # Type a value in the fragment datetime input
    fragment_input_field.type("2025/11/19, 09:00")
    fragment_input_field.press("Enter")
    # Click on another element to close the popover and commit the value
    get_datetime_input(app, "Datetime input 1 (base)").click()
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

    # Type a new value into the datetime input
    input_field = dynamic_input.locator("input")
    input_field.type("2025/12/01, 14:30", delay=50)
    input_field.press("Enter")
    # Click on a markdown element to close the popover without toggling
    app.get_by_text("Dynamic datetime input:").click()
    wait_for_app_run(app)
    expect(app.locator('[data-baseweb="calendar"]')).not_to_be_visible()

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
