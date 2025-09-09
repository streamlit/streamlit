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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_toggle,
    expect_help_tooltip,
    expect_markdown,
    expect_prefixed_markdown,
    get_date_input,
    get_element_by_key,
    reset_focus,
)

NUM_DATE_INPUTS = 18


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
    get_date_input(app, "Single date").locator("input").click()

    # Select '1970/01/02':
    app.locator(
        '[data-baseweb="calendar"] [aria-label^="Choose Friday, January 2nd 1970."]'
    ).first.click()

    expect_markdown(app, "Value 1: 1970-01-02")


def test_handle_value_changes(app: Page):
    """Test that st.date_input has the correct value after typing in a date."""
    first_date_input_field = get_date_input(app, "Single date").locator("input")
    first_date_input_field.fill("1970/01/02")
    first_date_input_field.blur()
    expect_markdown(app, "Value 1: 1970-01-02")


def test_empty_date_input_behaves_correctly(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.date_input behaves correctly when empty."""
    empty_date_element = get_date_input(app, "Empty value")
    empty_data_input = empty_date_element.locator("input")
    # Since no min value set, min selectable date 10 years before today
    empty_data_input.type("2025/01/02", delay=50)
    empty_data_input.press("Enter")
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

    # Press escape to clear value:
    empty_number_input = get_date_input(app, "Empty value").locator("input")
    empty_number_input.focus()
    empty_number_input.press("Escape")
    # Click outside to enter value:
    reset_focus(app)

    # Should be empty again:
    expect_markdown(app, "Value 13: None")


def test_handles_range_end_date_changes(app: Page):
    """Test that it correctly handles changes to the end date of a range."""
    get_date_input(app, "Range, one date").locator("input").click()

    # Select '2019/07/10'
    app.locator(
        '[data-baseweb="calendar"] [aria-label^="Choose Wednesday, July 10th 2019."]'
    ).first.click()

    expect_markdown(
        app, "Value 4: (datetime.date(2019, 7, 6), datetime.date(2019, 7, 10))"
    )


def test_handles_range_start_end_date_changes(app: Page):
    """Test that it correctly handles changes to the start and end date of a range."""
    get_date_input(app, "Range, two dates").locator("input").click()

    # Select start date: '2019/07/10'
    app.locator(
        '[data-baseweb="calendar"] [aria-label^="Choose Wednesday, July 10th 2019."]'
    ).first.click()

    expect_markdown(app, "Value 5: (datetime.date(2019, 7, 10),)")

    # Select end date: '2019/07/12'
    app.locator(
        '[data-baseweb="calendar"] [aria-label^="Choose Friday, July 12th 2019."]'
    ).first.click()

    expect_markdown(
        app, "Value 5: (datetime.date(2019, 7, 10), datetime.date(2019, 7, 12))"
    )


def test_calls_callback_on_change(app: Page):
    """Test that it correctly calls the callback on change."""
    get_element_by_key(app, "date_input_12").locator("input").click()

    # Select '1970/01/02'
    calendar = app.locator(
        '[data-baseweb="calendar"] [aria-label^="Choose Friday, January 2nd 1970."]'
    ).first
    expect(calendar).to_be_visible()
    calendar.click()
    wait_for_app_run(app)

    expect_markdown(app, "Value 12: 1970-01-02")
    expect_markdown(app, "Date Input Changed: True")

    # Change different date input to trigger delta path change
    first_date_input_field = get_date_input(app, "Single date").locator("input")
    first_date_input_field.fill("1971/01/03")
    wait_for_app_run(app)

    expect_markdown(app, "Value 1: 1971-01-03")

    # Test if value is still correct after delta path change
    expect_markdown(app, "Value 12: 1970-01-02")
    expect_markdown(app, "Date Input Changed: False")


def test_single_date_calendar_picker_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the single value calendar picker renders correctly via screenshots matching."""
    get_date_input(themed_app, "Single date").locator("input").click()
    assert_snapshot(
        themed_app.locator('[data-baseweb="calendar"]').first,
        name="st_date_input-single_date_calendar",
    )


def test_range_date_calendar_picker_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the range calendar picker renders correctly via screenshots matching."""
    get_date_input(themed_app, "Range, two dates").locator("input").click()
    assert_snapshot(
        themed_app.locator('[data-baseweb="calendar"]').first,
        name="st_date_input-range_two_dates_calendar",
    )


def test_resets_to_default_single_value_if_calendar_closed_empty(app: Page):
    """Test that single value is reset to default if calendar closed empty."""
    get_date_input(app, "Single date").locator("input").click()

    # Select '1970/01/02'
    app.locator(
        '[data-baseweb="calendar"] [aria-label^="Choose Friday, January 2nd 1970."]'
    ).first.click()

    expect_markdown(app, "Value 1: 1970-01-02")

    # Close calendar without selecting a date
    date_input_field = get_date_input(app, "Single date").locator("input")
    date_input_field.focus()
    date_input_field.clear()

    # Click on the large markdown element at the end to submit the cleared value
    reset_focus(app)

    # Value should be reset to default
    expect_markdown(app, "Value 1: 1970-01-01")


def test_range_is_empty_if_calendar_closed_empty(app: Page):
    """Test that range value is empty of calendar closed empty."""
    get_date_input(app, "Range, two dates").locator("input").click()

    # Select start date: '2019/07/10'
    app.locator(
        '[data-baseweb="calendar"] [aria-label^="Choose Wednesday, July 10th 2019."]'
    ).first.click()

    expect_markdown(app, "Value 5: (datetime.date(2019, 7, 10),)")

    # Select end date: '2019/07/12'
    app.locator(
        '[data-baseweb="calendar"] [aria-label^="Choose Friday, July 12th 2019."]'
    ).first.click()

    expect_markdown(
        app, "Value 5: (datetime.date(2019, 7, 10), datetime.date(2019, 7, 12))"
    )

    # Close calendar without selecting a date
    date_input_field = get_date_input(app, "Range, two dates").locator("input")
    date_input_field.focus()
    date_input_field.clear()

    # Click on the large markdown element at the end to submit the cleared value
    reset_focus(app)

    # Range should be empty
    expect_markdown(app, "Value 5: ()")


def test_single_date_input_error_state(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the single date input error state works correctly."""
    # The first date input is set to 1970/01/01 by default, with min also set to 1970/01/01
    first_date_input = get_date_input(themed_app, "Single date")
    first_date_input_field = first_date_input.locator("input")

    # Set date to 1960/01/01, which is outside of the allowed min date
    first_date_input_field.fill("1960/01/01")
    first_date_input_field.blur()

    # Check that the value update is not committed
    expect_markdown(themed_app, "Value 1: 1970-01-01")

    # Click outside of the date input to exit calendar picker (reduce snapshot flakiness)
    first_date_input_field.press("Escape")

    # Check that the error icon is now shown in the date input
    error_icon = first_date_input.get_by_test_id("stTooltipErrorHoverTarget")
    expect(error_icon).to_be_visible()
    # Hover over the error tooltip target
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
    # The fifth date input is set to 2019/07/06 - 2019/07/08 by default, with no set min/max
    # So we set the min to 2009/07/06 (10 years before start date) and max to 2029/07/08
    # (10 years after end date)
    fifth_date_input = get_date_input(themed_app, "Range, two dates")
    fifth_date_input_field = fifth_date_input.locator("input")

    # Clear the input field and set date range to 2008/07/06 - 2019/07/08
    # which is outside of the allowed min value of range
    fifth_date_input_field.clear()
    fifth_date_input_field.fill("2008/07/06 - 2019/07/08")
    # Click outside of the date input to exit calendar picker (reduce snapshot flakiness)
    fifth_date_input_field.press("Escape")

    # Check that the value update is not committed
    expect_markdown(themed_app, "Value 5: ()")

    # Check that the error icon is now shown in the date input
    error_icon = fifth_date_input.get_by_test_id("stTooltipErrorHoverTarget")
    expect(error_icon).to_be_visible()
    # Hover over the error tooltip target
    error_icon.hover()
    # Check that the expected error tooltip message for start date error is shown
    tooltip = themed_app.get_by_test_id("stTooltipErrorContent")
    expect(tooltip).to_have_text(
        "Error: Start date set outside allowed range. Please select a date after 2009/07/06.",
        use_inner_text=True,
    )

    # Snapshot test of date input in error state
    assert_snapshot(fifth_date_input, name="st_date_input-range_date_input_error")


def test_range_date_input_end_error_state(themed_app: Page):
    """Test that the range date input error state works correctly."""
    # The fifth date input is set to 2019/07/06 - 2019/07/08 by default, with no set min/max
    # So we set the min to 2009/07/06 (10 years before start date) and max to 2029/07/08
    # (10 years after end date)
    fifth_date_input = get_date_input(themed_app, "Range, two dates")
    fifth_date_input_field = fifth_date_input.locator("input")

    # Clear the input field and set date range to 2008/07/06 - 2019/07/08
    fifth_date_input_field.clear()
    fifth_date_input_field.fill("2019/07/06 - 2030/07/08")
    # Click outside of the date input to exit calendar picker (reduce snapshot flakiness)
    fifth_date_input_field.press("Escape")

    # Check that the value update is not committed
    expect_markdown(themed_app, "Value 5: ()")

    # Check that the error icon is now shown in the date input
    error_icon = fifth_date_input.get_by_test_id("stTooltipErrorHoverTarget")
    expect(error_icon).to_be_visible()
    # Hover over the error tooltip target
    error_icon.hover()
    # Check that the expected error tooltip message for end date error is shown
    tooltip = themed_app.get_by_test_id("stTooltipErrorContent")
    expect(tooltip).to_have_text(
        "Error: End date set outside allowed range. Please select a date before 2029/07/08.",
        use_inner_text=True,
    )
    # Skip snapshot test since similar enough to start date error snapshot


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
    input_field = dynamic_date_input.locator("input")
    input_field.type("2020/01/02", delay=50)
    input_field.press("Enter")
    input_field.press("Escape")
    wait_for_app_run(app)
    expect(app.locator('[data-baseweb="calendar"]')).not_to_be_visible()

    expect_prefixed_markdown(app, "Initial date input value:", "2020-01-02")

    # Click the toggle to update the date input props
    click_toggle(app, "Update date input props")

    # new date input is visible:
    expect(dynamic_date_input).to_contain_text("Updated dynamic date input")

    # Ensure the previously entered value remains visible
    expect_prefixed_markdown(app, "Updated date input value:", "2020-01-02")

    dynamic_date_input.scroll_into_view_if_needed()
    assert_snapshot(dynamic_date_input, name="st_date_input-dynamic_updated")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_date_input, "updated help")


def test_quick_select_feature_visibility(app: Page):
    """Test that quick select is visible for range inputs and hidden for single inputs."""
    # Test range input
    range_date_input = get_date_input(app, "Range, no date")
    range_date_input.locator("input").click()

    # Quick select should be visible for range inputs
    quick_select = app.locator('[data-baseweb="select"]')
    expect(quick_select).to_be_visible()

    # Close the calendar
    app.keyboard.press("Escape")

    # Test single date input
    single_date_input = get_date_input(app, "Single date")
    single_date_input.locator("input").click()

    # Quick select should not be visible for single date inputs
    expect(quick_select).not_to_be_visible()
