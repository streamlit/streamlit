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
    click_toggle,
    expect_help_tooltip,
    expect_markdown,
    expect_prefixed_markdown,
    get_date_input,
    get_element_by_key,
    reset_focus,
    reset_hovering,
    type_date,
)

NUM_DATE_INPUTS = 22


def test_date_input_rendering(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.date_input renders correctly via screenshots matching."""
    expect(themed_app.get_by_test_id("stDateInput")).to_have_count(NUM_DATE_INPUTS)

    assert_snapshot(
        get_date_input(themed_app, "Single date"), name="st_date_input-single_date"
    )
    assert_snapshot(
        get_date_input(themed_app, "Single datetime"),
        name="st_date_input-single_datetime",
    )
    assert_snapshot(
        get_date_input(themed_app, "Range, no date"),
        name="st_date_input-range_no_date",
    )
    assert_snapshot(
        get_date_input(themed_app, "Range, one date"),
        name="st_date_input-range_one_date",
    )
    assert_snapshot(
        get_date_input(themed_app, "Range, two dates"),
        name="st_date_input-range_two_dates",
    )
    assert_snapshot(
        get_date_input(themed_app, "Disabled, no date"),
        name="st_date_input-disabled_no_date",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "date_input_7"),
        name="st_date_input-label_hidden",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "date_input_8"),
        name="st_date_input-label_collapsed",
    )
    assert_snapshot(
        get_date_input(themed_app, "Single date with format"),
        name="st_date_input-single_date_format",
    )
    assert_snapshot(
        get_date_input(themed_app, "Range, two dates with format"),
        name="st_date_input-range_two_dates_format",
    )
    assert_snapshot(
        get_date_input(themed_app, "Range, no date with format"),
        name="st_date_input-range_no_date_format",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "date_input_12"),
        name="st_date_input-single_date_callback",
    )
    assert_snapshot(
        get_date_input(themed_app, "Empty value"), name="st_date_input-empty_value"
    )
    assert_snapshot(
        get_date_input(themed_app, "Value from state"),
        name="st_date_input-value_from_state",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "date_input_15"),
        name="st_date_input-markdown_label",
    )
    assert_snapshot(
        get_date_input(themed_app, "Date input 16 (width=200px)"),
        name="st_date_input-width_200px",
    )
    assert_snapshot(
        get_date_input(themed_app, "Date input 17 (width='stretch')"),
        name="st_date_input-width_stretch",
    )


def test_help_tooltip_works(app: Page):
    leading_indent_regular_text_tooltip = """
    This is a regular text block!
    Test1
    Test2

    """
    element_with_help = get_date_input(app, "Single date")
    expect_help_tooltip(app, element_with_help, leading_indent_regular_text_tooltip)


def test_date_input_has_correct_initial_values(app: Page):
    """Test that st.date_input has the correct initial values."""
    expect_markdown(app, "Value 1: 1970-01-01")
    expect_markdown(app, "Value 2: 2019-07-06")
    expect_markdown(app, "Value 3: ()")
    expect_markdown(app, "Value 4: (datetime.date(2019, 7, 6),)")
    expect_markdown(
        app, "Value 5: (datetime.date(2019, 7, 6), datetime.date(2019, 7, 8))"
    )
    expect_markdown(app, "Value 6: ()")
    expect_markdown(app, "Value 7: 2019-07-06")
    expect_markdown(app, "Value 8: 2019-07-06")
    expect_markdown(app, "Value 9: 1970-01-01")
    expect_markdown(
        app, "Value 10: (datetime.date(2019, 7, 6), datetime.date(2019, 7, 8))"
    )
    expect_markdown(app, "Value 11: ()")
    expect_markdown(app, "Value 12: 1970-01-01")
    expect_markdown(app, "Date Input Changed: False")
    expect_markdown(app, "Value 13: None")
    expect_markdown(app, "Value 14: 1970-02-03")


def test_handles_date_selection(app: Page):
    """Test that selection of a date on the calendar works as expected."""
    date_field = get_date_input(app, "Single date").get_by_test_id("stDateInputField")
    date_field.get_by_role("spinbutton").first.click()

    # Select '1970/01/02':
    app.get_by_test_id("stDateInputCalendar").get_by_label(
        "Friday, January 2, 1970"
    ).click()

    expect_markdown(app, "Value 1: 1970-01-02")


def test_handle_value_changes(app: Page):
    """Test that st.date_input has the correct value after typing in a date."""
    date_field = get_date_input(app, "Single date").get_by_test_id("stDateInputField")
    type_date(date_field, "1970", "01", "02")
    reset_focus(app)
    expect_markdown(app, "Value 1: 1970-01-02")


def test_handle_value_changes_non_default_format(app: Page):
    """Test typing in a date input with MM-DD-YYYY format."""
    date_field = get_date_input(app, "Single date with format").get_by_test_id(
        "stDateInputField"
    )
    # MM-DD-YYYY format: segments are month, day, year (left-to-right)
    # Use a date within the widget's allowed range (1960/01/01 - 1980/01/01)
    type_date(date_field, "03", "15", "1975")
    reset_focus(app)
    expect_markdown(app, "Value 9: 1975-03-15")


def test_empty_date_input_behaves_correctly(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.date_input behaves correctly when empty."""
    empty_date_element = get_date_input(app, "Empty value")
    empty_date_field = empty_date_element.get_by_test_id("stDateInputField")
    # Since no min value set, min selectable date 10 years before today
    type_date(empty_date_field, "2025", "01", "02")
    wait_for_app_run(app)
    expect_markdown(app, "Value 13: 2025-01-02")

    reset_focus(app)

    empty_date_element.scroll_into_view_if_needed()
    # Screenshot match clearable input:
    assert_snapshot(
        empty_date_element,
        name="st_date_input-clearable_input",
        image_threshold=0.035,
    )

    # Click the clear button to clear the value. (React Aria's segmented
    # DateField doesn't support BaseWeb's "Escape clears the whole value"
    # shortcut on a focused input, so we use the explicit clear button
    # instead, which achieves the same outcome.)
    empty_date_element.get_by_test_id("stDateInputClearButton").click()
    wait_for_app_run(app)

    # Should be empty again:
    expect_markdown(app, "Value 13: None")


def test_handles_range_end_date_changes(app: Page):
    """Test that it correctly handles changes to the end date of a range."""
    date_field = get_date_input(app, "Range, one date").get_by_test_id(
        "stDateInputField"
    )
    date_field.get_by_role("spinbutton").first.click()

    # Select '2019/07/10'
    app.get_by_test_id("stDateInputCalendar").get_by_label(
        "Wednesday, July 10, 2019"
    ).click()

    expect_markdown(
        app, "Value 4: (datetime.date(2019, 7, 6), datetime.date(2019, 7, 10))"
    )


def test_handles_range_start_end_date_changes(app: Page):
    """Test that it correctly handles changes to the start and end date of a range."""
    date_field = get_date_input(app, "Range, two dates").get_by_test_id(
        "stDateInputField"
    )
    date_field.get_by_role("spinbutton").first.click()

    calendar = app.get_by_test_id("stDateInputCalendar")

    # Select start date: '2019/07/10' — clicking any date when a complete
    # range is already selected starts a new range rather than editing it
    calendar.get_by_label("Wednesday, July 10, 2019").click()

    expect_markdown(app, "Value 5: (datetime.date(2019, 7, 10),)")

    # Select end date: '2019/07/12'
    calendar.get_by_label("Friday, July 12, 2019").click()

    expect_markdown(
        app, "Value 5: (datetime.date(2019, 7, 10), datetime.date(2019, 7, 12))"
    )


def test_calls_callback_on_change(app: Page):
    """Test that it correctly calls the callback on change."""
    date_input_12_field = get_element_by_key(app, "date_input_12").get_by_test_id(
        "stDateInputField"
    )
    date_input_12_field.get_by_role("spinbutton").first.click()

    # Select '1970/01/02'
    calendar = app.get_by_test_id("stDateInputCalendar").get_by_label(
        "Friday, January 2, 1970"
    )
    expect(calendar).to_be_visible()
    calendar.click()
    wait_for_app_run(app)

    expect_prefixed_markdown(app, "Value 12:", "1970-01-02")
    expect_prefixed_markdown(app, "Date Input Changed:", "True")

    # Change different date input to trigger delta path change
    first_date_field = get_date_input(app, "Single date").get_by_test_id(
        "stDateInputField"
    )
    type_date(first_date_field, "1971", "01", "03")
    wait_for_app_run(app)

    expect_prefixed_markdown(app, "Value 1:", "1971-01-03")

    # Test if value is still correct after delta path change
    expect_prefixed_markdown(app, "Value 12:", "1970-01-02")
    expect_prefixed_markdown(app, "Date Input Changed:", "False")


def test_single_date_calendar_picker_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the single value calendar picker renders correctly via screenshots matching."""
    date_field = get_date_input(themed_app, "Single date").get_by_test_id(
        "stDateInputField"
    )
    date_field.get_by_role("spinbutton").first.click()
    calendar = themed_app.get_by_test_id("stDateInputCalendar").first
    # Wait for the calendar popup to be fully visible before taking screenshot
    expect(calendar).to_be_visible()
    assert_snapshot(
        calendar,
        name="st_date_input-single_date_calendar",
    )


def test_range_date_calendar_picker_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the range calendar picker renders correctly via screenshots matching."""
    date_field = get_date_input(themed_app, "Range, two dates").get_by_test_id(
        "stDateInputField"
    )
    date_field.get_by_role("spinbutton").first.click()
    calendar = themed_app.get_by_test_id("stDateInputCalendar").first
    # Wait for the calendar popup to be fully visible before taking screenshot
    expect(calendar).to_be_visible()
    assert_snapshot(
        calendar,
        name="st_date_input-range_two_dates_calendar",
    )


def test_resets_to_default_single_value_if_calendar_closed_empty(app: Page):
    """Test that single value is reset to default if calendar closed empty."""
    date_input = get_date_input(app, "Single date")
    date_field = date_input.get_by_test_id("stDateInputField")
    date_field.get_by_role("spinbutton").first.click()

    # Select '1970/01/02'
    app.get_by_test_id("stDateInputCalendar").get_by_label(
        "Friday, January 2, 1970"
    ).click()

    expect_markdown(app, "Value 1: 1970-01-02")

    # Clear every segment via the keyboard (mirrors clearing BaseWeb's
    # free-text input) without selecting a new date. Note: the clear button
    # isn't used here since this widget isn't clearable (it has a non-empty
    # default), so it has no rendered clear button.
    for segment in date_field.get_by_role("spinbutton").all():
        segment.click()
        # A handful of extra presses is a harmless no-op once the segment is
        # already empty; this just needs to cover the longest segment (year).
        for _ in range(4):
            segment.press("Backspace")

    # Click on the large markdown element at the end to close the popover and
    # submit the cleared value
    reset_focus(app)

    # Value should be reset to default
    expect_markdown(app, "Value 1: 1970-01-01")


def test_range_is_empty_if_calendar_closed_empty(app: Page):
    """Test that range value is empty if calendar is closed empty."""
    date_field = get_date_input(app, "Range, two dates").get_by_test_id(
        "stDateInputField"
    )
    date_field.get_by_role("spinbutton").first.click()

    calendar = app.get_by_test_id("stDateInputCalendar")

    # Select start date: '2019/07/10'
    calendar.get_by_label("Wednesday, July 10, 2019").click()

    expect_markdown(app, "Value 5: (datetime.date(2019, 7, 10),)")

    # Select end date: '2019/07/12'
    calendar.get_by_label("Friday, July 12, 2019").click()

    expect_markdown(
        app, "Value 5: (datetime.date(2019, 7, 10), datetime.date(2019, 7, 12))"
    )

    # Clear every segment (both start and end fields) via the keyboard —
    # mirrors test_resets_to_default_single_value_if_calendar_closed_empty —
    # without selecting a new date.
    for segment in date_field.get_by_role("spinbutton").all():
        segment.click()
        for _ in range(4):
            segment.press("Backspace")

    # Click on the large markdown element at the end to close the popover and
    # submit the cleared value
    reset_focus(app)

    # Range should be empty
    expect_markdown(app, "Value 5: ()")


def test_single_date_input_error_state(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the single date input error state works correctly."""
    # The first date input is set to 1970/01/01 by default, with min also set to 1970/01/01
    first_date_input = get_date_input(themed_app, "Single date")
    first_date_field = first_date_input.get_by_test_id("stDateInputField")

    # Set date to 1960/01/01, which is outside of the allowed min date.
    # commit=False: keep popover open so we can check real-time error feedback.
    type_date(first_date_field, "1960", "01", "01", commit=False)

    # Check that the value update is not committed
    expect_markdown(themed_app, "Value 1: 1970-01-01")

    # Press escape to exit calendar picker (reduce snapshot flakiness)
    themed_app.keyboard.press("Escape")

    # Check that the error icon is now shown in the date input
    error_icon = first_date_input.get_by_test_id("stTooltipErrorHoverTarget")
    expect(error_icon).to_be_visible()
    # Hover over the error tooltip target
    reset_hovering(themed_app)
    error_icon.hover()
    # Check that the expected error tooltip message is shown
    tooltip = themed_app.get_by_test_id("stTooltipErrorContent")
    expect(tooltip).to_have_text(
        "Error: Date set outside allowed range. Please select a date between 1970/01/01 and 1980/01/01.",
        use_inner_text=True,
    )

    # Snapshot test of date input in error state
    assert_snapshot(first_date_input, name="st_date_input-single_date_error")


def test_range_date_input_start_error_state(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the range date input error state works correctly."""
    # The fifth date input is set to 2019/07/06 - 2019/07/08 by default, with no explicit
    # min/max, so the auto-computed min is 2009/07/06 (10 years before start date) and the
    # auto-computed max is 2029/07/08 (10 years after end date)
    fifth_date_input = get_date_input(themed_app, "Range, two dates")
    date_field = fifth_date_input.get_by_test_id("stDateInputField")

    # Type date range 2008/07/06 - 2019/07/08 (start segments then end
    # segments, in DOM order), where the start date is outside the allowed
    # min value of the range
    type_date(date_field, "2008", "07", "06", "2019", "07", "08")
    # Press Escape to exit calendar picker (reduce snapshot flakiness)
    themed_app.keyboard.press("Escape")

    # Check that the error icon is now shown in the date input
    error_icon = fifth_date_input.get_by_test_id("stTooltipErrorHoverTarget")
    expect(error_icon).to_be_visible()
    # Hover over the error tooltip target
    reset_hovering(themed_app)
    error_icon.hover()
    # Check that the expected error tooltip message for start date error is shown
    tooltip = themed_app.get_by_test_id("stTooltipErrorContent")
    expect(tooltip).to_have_text(
        "Error: Start date set outside allowed range. Please select a date after 2009/07/06.",
        use_inner_text=True,
    )

    # The committed value should be unchanged (invalid dates are not committed)
    expect_markdown(
        themed_app,
        "Value 5: (datetime.date(2019, 7, 6), datetime.date(2019, 7, 8))",
    )

    # Snapshot test of date input in error state
    assert_snapshot(fifth_date_input, name="st_date_input-range_date_input_error")


def test_range_date_input_end_error_state(themed_app: Page):
    """Test that the range date input error state works correctly."""
    # The fifth date input is set to 2019/07/06 - 2019/07/08 by default, with no explicit
    # min/max, so the auto-computed min is 2009/07/06 (10 years before start date) and the
    # auto-computed max is 2029/07/08 (10 years after end date)
    fifth_date_input = get_date_input(themed_app, "Range, two dates")
    date_field = fifth_date_input.get_by_test_id("stDateInputField")

    # Type date range 2019/07/06 - 2030/07/08 (start segments then end
    # segments, in DOM order), where the end date is outside the allowed
    # max value of the range
    type_date(date_field, "2019", "07", "06", "2030", "07", "08")
    # Press Escape to exit calendar picker (reduce snapshot flakiness)
    themed_app.keyboard.press("Escape")

    # Check that the error icon is now shown in the date input
    error_icon = fifth_date_input.get_by_test_id("stTooltipErrorHoverTarget")
    expect(error_icon).to_be_visible()
    # Hover over the error tooltip target
    reset_hovering(themed_app)
    error_icon.hover()
    # Check that the expected error tooltip message for end date error is shown
    tooltip = themed_app.get_by_test_id("stTooltipErrorContent")
    expect(tooltip).to_have_text(
        "Error: End date set outside allowed range. Please select a date before 2029/07/08.",
        use_inner_text=True,
    )

    # The committed value should be unchanged (invalid dates are not committed)
    expect_markdown(
        themed_app,
        "Value 5: (datetime.date(2019, 7, 6), datetime.date(2019, 7, 8))",
    )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stDateInput")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "date_input_12")).to_be_visible()


def test_dynamic_date_input_props(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the date input can be updated dynamically while keeping the state."""
    dynamic_date_input = get_element_by_key(app, "dynamic_date_input_with_key")
    expect(dynamic_date_input).to_be_visible()

    expect(dynamic_date_input).to_contain_text("Initial dynamic date input")
    expect_prefixed_markdown(app, "Initial date input value:", "2020-01-01")
    assert_snapshot(dynamic_date_input, name="st_date_input-dynamic_initial")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_date_input, "initial help")

    # Type something and submit (select same date via typing)
    date_field = dynamic_date_input.get_by_test_id("stDateInputField")
    type_date(date_field, "2020", "01", "02")
    wait_for_app_run(app)
    expect(app.get_by_test_id("stDateInputCalendar")).not_to_be_visible()

    expect_prefixed_markdown(app, "Initial date input value:", "2020-01-02")

    # Click the toggle to update the date input props
    click_toggle(app, "Update date input props")

    # new date input is visible:
    expect(dynamic_date_input).to_contain_text("Updated dynamic date input")

    # Ensure the previously entered value remains visible (value is within new bounds)
    expect_prefixed_markdown(app, "Updated date input value:", "2020-01-02")

    # Use deterministic scroll positioning ('start') to avoid firefox subpixel
    # rendering inconsistency where the element height varies between 66 and 67
    # pixels depending on the fractional scroll offset.
    dynamic_date_input.evaluate(
        "el => el.scrollIntoView({block: 'start', behavior: 'instant'})"
    )
    reset_focus(app)
    assert_snapshot(dynamic_date_input, name="st_date_input-dynamic_updated")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_date_input, "updated help")

    # Type something different and submit
    type_date(date_field, "2020", "01", "03")
    wait_for_app_run(app)

    expect_prefixed_markdown(app, "Updated date input value:", "2020-01-03")

    # Test dynamic min/max behavior when bounds change:
    # Toggle back to initial bounds (2010-2030)
    click_toggle(app, "Update date input props")
    expect_prefixed_markdown(app, "Initial date input value:", "2020-01-03")

    # Set value to 2028/01/01 which is valid in initial bounds (2010-2030)
    type_date(date_field, "2028", "01", "01")
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "Initial date input value:", "2028-01-01")

    # Toggle to updated bounds (2020-2025) - value 2028 is outside, should reset to default (2023-09-10)
    click_toggle(app, "Update date input props")
    expect_prefixed_markdown(app, "Updated date input value:", "2023-09-10")
    # Anti-regression: ensure the old out-of-bounds value is not retained
    expect(app.get_by_text("2028-01-01")).not_to_be_visible()


def test_quick_select_feature_visibility(app: Page):
    """Test that quick select is visible for range inputs and hidden for single inputs."""
    # Test range input — "Range, no date" has no explicit min, so the
    # auto-computed min falls back to 10 years before today, which is
    # always older than 2 years and enables quick select (see
    # enableQuickSelect in DateInput.tsx).
    range_date_input = get_date_input(app, "Range, no date")
    range_date_input.get_by_test_id("stDateInputField").get_by_role(
        "spinbutton"
    ).first.click()

    # Quick select should be visible for range inputs
    quick_select = app.get_by_role("button", name="Quick select a date range")
    expect(quick_select).to_be_visible()

    # Close the calendar
    app.keyboard.press("Escape")

    # Test single date input
    single_date_field = get_date_input(app, "Single date").get_by_test_id(
        "stDateInputField"
    )
    single_date_field.get_by_role("spinbutton").first.click()

    # Quick select should not be visible for single date inputs
    expect(quick_select).not_to_be_visible()


# --- Query param binding tests ---


def test_date_input_query_param_default_cleared_from_url(page: Page, app_base_url: str):
    """Test that reverting a bound date_input to its default clears the URL param.

    Exercises the frontend shouldClearUrlParam / toStringPrimitive(Date) path
    that compares the current string array value against the Date[] default.
    """
    # Seed bound_date (default=2025-01-15) with a non-default value
    page.goto(build_app_url(app_base_url, query={"bound_date": "2025-06-20"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound date:", "2025-06-20")
    expect(page).to_have_url(re.compile(r"bound_date=2025-06-20"))

    # Change the date back to the default via the UI
    date_input = get_element_by_key(page, "bound_date")
    date_field = date_input.get_by_test_id("stDateInputField")
    type_date(date_field, "2025", "01", "15")
    wait_for_app_run(page)

    # Default value should be removed from the URL
    expect_prefixed_markdown(page, "Bound date:", "2025-01-15")
    expect(page).not_to_have_url(re.compile(r"[?&]bound_date="))


def test_date_input_query_param_seeding(page: Page, app_base_url: str):
    """Test that date input value can be seeded from URL query params using ISO format."""
    page.goto(build_app_url(app_base_url, query={"bound_date": "2025-06-20"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound date:", "2025-06-20")
    expect(page).to_have_url(re.compile(r"bound_date=2025-06-20"))


def test_date_input_query_param_clearable_empty(page: Page, app_base_url: str):
    """Test that a clearable date input (value=None) can be seeded as empty from URL."""
    page.goto(build_app_url(app_base_url, query={"bound_clearable_date": ""}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound clearable date:", "None")


def test_date_input_query_param_invalid_reverts_to_default(
    page: Page, app_base_url: str
):
    """Test that an invalid URL value reverts to the default."""
    page.goto(build_app_url(app_base_url, query={"bound_date": "not-a-date"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound date:", "2025-01-15")
    expect(page).not_to_have_url(re.compile(r"[?&]bound_date="))


def test_date_input_query_param_range_seeding(page: Page, app_base_url: str):
    """Test that a date range can be seeded from repeated URL query params."""
    page.goto(
        build_app_url(
            app_base_url,
            query={"bound_range": ["2025-04-01", "2025-04-10"]},
        )
    )
    wait_for_app_loaded(page)

    expect_prefixed_markdown(
        page,
        "Bound range:",
        "(datetime.date(2025, 4, 1), datetime.date(2025, 4, 10))",
    )
    expect(page).to_have_url(re.compile(r"bound_range=2025-04-01"))
    expect(page).to_have_url(re.compile(r"bound_range=2025-04-10"))


def test_date_input_query_param_out_of_range_resets(page: Page, app_base_url: str):
    """Test that out-of-bounds dates revert to default."""
    page.goto(build_app_url(app_base_url, query={"bound_minmax_date": "2024-01-01"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound minmax:", "2025-06-15")
    expect(page).not_to_have_url(re.compile(r"[?&]bound_minmax_date="))
