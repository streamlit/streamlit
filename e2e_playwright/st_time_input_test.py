# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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


def test_time_input_widget_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the time input widgets are correctly rendered via screenshot matching."""
    time_input_widgets = themed_app.get_by_test_id("stTimeInput")
    expect(time_input_widgets).to_have_count(9)

    assert_snapshot(time_input_widgets.nth(0), name="st_time_input-8_45")
    assert_snapshot(time_input_widgets.nth(1), name="st_time_input-21_15_help")
    assert_snapshot(time_input_widgets.nth(2), name="st_time_input-disabled")
    assert_snapshot(time_input_widgets.nth(3), name="st_time_input-hidden_label")
    assert_snapshot(time_input_widgets.nth(4), name="st_time_input-collapsed_label")
    assert_snapshot(time_input_widgets.nth(5), name="st_time_input-callback")
    assert_snapshot(time_input_widgets.nth(6), name="st_time_input-step_60")
    assert_snapshot(time_input_widgets.nth(7), name="st_time_input-empty")
    assert_snapshot(time_input_widgets.nth(8), name="st_time_input-value_from_state")


def test_time_input_has_correct_initial_values(app: Page):
    """Test that st.time_input returns the correct initial values."""
    markdown_elements = app.get_by_test_id("stMarkdown")
    expect(markdown_elements).to_have_count(10)

    expected = [
        "Value 1: 08:45:00",
        "Value 2: 21:15:00",
        "Value 3: 08:45:00",
        "Value 4: 08:45:00",
        "Value 5: 08:45:00",
        "Value 6: 08:45:00",
        "time input changed: False",
        "Value 7: 08:45:00",
        "Value 8: None",
        "Value 9: 08:50:00",
    ]
    for markdown_element, expected_text in zip(markdown_elements.all(), expected):
        expect(markdown_element).to_have_text(expected_text, use_inner_text=True)


def test_handles_time_selection(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that selection of a time via the dropdown works correctly."""
    app.get_by_test_id("stTimeInput").nth(0).locator("input").click()

    # Take a snapshot of the time selection dropdown:
    selection_dropdown = app.locator('[data-baseweb="popover"]').first
    assert_snapshot(selection_dropdown, name="st_time_input-selection_dropdown")
    # Select the first option:
    selection_dropdown.locator("li").nth(0).click()
    # Check that selection worked:
    expect(app.get_by_test_id("stMarkdown").nth(0)).to_have_text(
        "Value 1: 00:00:00", use_inner_text=True
    )


def test_handles_step_correctly(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the step parameter is correctly applied."""
    app.get_by_test_id("stTimeInput").nth(6).locator("input").click()

    # Take a snapshot of the time selection dropdown:
    selection_dropdown = app.locator('[data-baseweb="popover"]').first
    assert_snapshot(selection_dropdown, name="st_time_input-step_60_dropdown")
    # Select the second option:
    selection_dropdown.locator("li").nth(1).click()
    # Check that selection worked:
    expect(app.get_by_test_id("stMarkdown").nth(7)).to_have_text(
        "Value 7: 00:01:00", use_inner_text=True
    )


def test_handles_time_selection_via_typing(app: Page):
    """Test that selection of a time via typing works correctly."""
    time_input_field = app.get_by_test_id("stTimeInput").first.locator("input")

    # Type an option:
    time_input_field.type("00:15")
    time_input_field.press("Enter")

    # Check that selection worked:
    expect(app.get_by_test_id("stMarkdown").first).to_have_text(
        "Value 1: 00:15:00", use_inner_text=True
    )

    # Type an another option that doesn't exist in the dropdown:
    time_input_field.type("00:16")
    time_input_field.press("Enter")

    # Check that selection worked:
    expect(app.get_by_test_id("stMarkdown").first).to_have_text(
        "Value 1: 00:16:00", use_inner_text=True
    )


def test_empty_time_input_behaves_correctly(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.time_input behaves correctly when empty (no initial value)."""
    empty_time_input = app.get_by_test_id("stTimeInput").nth(7)
    empty_time_input_field = empty_time_input.locator("input")

    # Type an option:
    empty_time_input_field.type("00:15")
    empty_time_input_field.press("Enter")

    expect(app.get_by_test_id("stMarkdown").nth(8)).to_have_text(
        "Value 8: 00:15:00", use_inner_text=True
    )

    assert_snapshot(empty_time_input, name="st_time_input-clearable_input")

    # Clear the input:
    empty_time_input.get_by_test_id("stTimeInputClearButton").click()

    # Should be empty again:
    expect(app.get_by_test_id("stMarkdown").nth(8)).to_have_text(
        "Value 8: None", use_inner_text=True
    )


def test_keeps_value_on_selection_close(app: Page):
    """Test that the selection is kept when the dropdown is closed."""
    app.get_by_test_id("stTimeInput").first.locator("input").click()

    # Take a snapshot of the selection dropdown:
    expect(app.locator('[data-baseweb="popover"]').first).to_be_visible()

    # Click outside to close the dropdown:
    app.get_by_test_id("stMarkdown").first.click()

    # Check if value is still initial value:
    expect(app.get_by_test_id("stMarkdown").first).to_have_text(
        "Value 1: 08:45:00", use_inner_text=True
    )


def test_handles_callback_on_change_correctly(app: Page):
    """Test that it correctly calls the callback on change."""
    # Check initial state:
    expect(app.get_by_test_id("stMarkdown").nth(5)).to_have_text(
        "Value 6: 08:45:00", use_inner_text=True
    )
    expect(app.get_by_test_id("stMarkdown").nth(6)).to_have_text(
        "time input changed: False", use_inner_text=True
    )

    app.get_by_test_id("stTimeInput").nth(5).locator("input").click()

    # Select last option:
    time_dropdown = app.locator('[data-baseweb="popover"]').first
    time_dropdown.locator("li").first.click()

    # Check that selection worked:
    expect(app.get_by_test_id("stMarkdown").nth(5)).to_have_text(
        "Value 6: 00:00:00", use_inner_text=True
    )
    expect(app.get_by_test_id("stMarkdown").nth(6)).to_have_text(
        "time input changed: True", use_inner_text=True
    )

    # Change different input to trigger delta path change
    empty_time_input_field = app.get_by_test_id("stTimeInput").locator("input").first

    # Type an option:
    empty_time_input_field.type("00:15")
    empty_time_input_field.press("Enter")

    expect(app.get_by_test_id("stMarkdown").first).to_have_text(
        "Value 1: 00:15:00", use_inner_text=True
    )
    expect(app.get_by_test_id("stMarkdown").nth(5)).to_have_text(
        "Value 6: 00:00:00", use_inner_text=True
    )
    # The flag should be reset to False:
    expect(app.get_by_test_id("stMarkdown").nth(6)).to_have_text(
        "time input changed: False", use_inner_text=True
    )
