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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run


def test_number_input_widget_display(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.number_input renders correctly."""
    number_input_elements = themed_app.get_by_test_id("stNumberInput")
    expect(number_input_elements).to_have_count(12)

    assert_snapshot(number_input_elements.nth(0), name="st_number_input-default")
    assert_snapshot(number_input_elements.nth(1), name="st_number_input-value_1")
    assert_snapshot(number_input_elements.nth(2), name="st_number_input-min_max")
    assert_snapshot(number_input_elements.nth(3), name="st_number_input-step_2")
    assert_snapshot(number_input_elements.nth(4), name="st_number_input-max_10")
    assert_snapshot(number_input_elements.nth(5), name="st_number_input-disabled_true")
    assert_snapshot(number_input_elements.nth(6), name="st_number_input-label_hidden")
    assert_snapshot(
        number_input_elements.nth(7), name="st_number_input-label_collapsed"
    )
    assert_snapshot(number_input_elements.nth(8), name="st_number_input-on_change")
    assert_snapshot(number_input_elements.nth(9), name="st_number_input-small_width")
    assert_snapshot(number_input_elements.nth(10), name="st_number_input-value_none")
    assert_snapshot(
        number_input_elements.nth(11), name="st_number_input-value_none_min_1"
    )


def test_number_input_has_correct_default_values(app: Page):
    """Test that st.number_input has the correct initial values."""
    markdown_elements = app.get_by_test_id("stMarkdown")
    expect(markdown_elements).to_have_count(13)

    expected = [
        "number input 1 (default) - value: 0.0",
        "number input 2 (value=1) - value: 1",
        "number input 3 (min & max) - value: 1",
        "number input 4 (step=2) - value: 0",
        "number input 5 (max=10) - value: 0",
        "number input 6 (disabled=True) - value: 0.0",
        "number input 7 (label=hidden) - value: 0.0",
        "number input 8 (label=collapsed) - value: 0.0",
        "number input 9 (on_change) - value: 0.0",
        "number input 9 (on_change) - changed: False",
        "number input 10 (small width) - value: 0",
        "number input 11 (value=None) - value: None",
        "number input 12 (value from state & min=1) - value: 10",
    ]

    for markdown_element, expected_text in zip(markdown_elements.all(), expected):
        expect(markdown_element).to_have_text(expected_text, use_inner_text=True)


def test_number_input_shows_instructions_when_dirty(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.number_input shows the instructions correctly when dirty."""
    first_number_input = app.get_by_test_id("stNumberInput").first
    first_number_input.locator("input").fill("10")

    assert_snapshot(first_number_input, name="st_number_input-input_instructions")


def test_number_input_updates_value_correctly_on_enter(app: Page):
    """Test that st.number_input updates the value correctly on enter."""
    first_number_input_field = app.locator(".stNumberInput input").nth(0)
    first_number_input_field.fill("10")
    first_number_input_field.press("Enter")

    expect(app.get_by_test_id("stMarkdown").nth(0)).to_have_text(
        "number input 1 (default) - value: 10.0", use_inner_text=True
    )


def test_number_input_has_correct_value_on_increment_click(app: Page):
    """Test that st.number_input has the correct value on increment click."""
    number_input_up_buttons = app.locator(".stNumberInput button.step-up")
    expect(number_input_up_buttons).to_have_count(11)
    for i, button in enumerate(number_input_up_buttons.all()):
        if i not in [5, 9]:
            button.click()
            wait_for_app_run(app)

    markdown_elements = app.get_by_test_id("stMarkdown")

    expected = [
        "number input 1 (default) - value: 0.01",
        "number input 2 (value=1) - value: 2",
        "number input 3 (min & max) - value: 2",
        "number input 4 (step=2) - value: 2",
        "number input 5 (max=10) - value: 1",
        "number input 6 (disabled=True) - value: 0.0",
        "number input 7 (label=hidden) - value: 0.01",
        "number input 8 (label=collapsed) - value: 0.01",
        "number input 9 (on_change) - value: 0.01",
        "number input 9 (on_change) - changed: True",
        "number input 10 (small width) - value: 0",
        "number input 11 (value=None) - value: None",
        "number input 12 (value from state & min=1) - value: 11",
    ]

    for markdown_element, expected_text in zip(markdown_elements.all(), expected):
        expect(markdown_element).to_have_text(expected_text, use_inner_text=True)


def test_number_input_has_correct_value_on_arrow_up(app: Page):
    """Test that st.number_input has the correct value on arrow up."""
    first_number_input_field = app.locator(".stNumberInput input").nth(0)
    first_number_input_field.press("ArrowUp")

    expect(app.get_by_test_id("stMarkdown").nth(0)).to_have_text(
        "number input 1 (default) - value: 0.01", use_inner_text=True
    )


def test_number_input_has_correct_value_on_blur(app: Page):
    """Test that st.number_input has the correct value on blur."""

    first_number_input_field = app.locator(".stNumberInput input").nth(0)
    first_number_input_field.focus()
    first_number_input_field.fill("10")
    first_number_input_field.blur()

    expect(app.get_by_test_id("stMarkdown").nth(0)).to_have_text(
        "number input 1 (default) - value: 10.0", use_inner_text=True
    )


def test_empty_number_input_behaves_correctly(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.number_input behaves correctly when empty."""
    # Enter 10 in the first empty input:
    empty_number_input = app.get_by_test_id("stNumberInput").nth(10)
    empty_number_input_field = empty_number_input.locator("input").first
    empty_number_input_field.fill("10")
    empty_number_input_field.press("Enter")

    expect(app.get_by_test_id("stMarkdown").nth(11)).to_have_text(
        "number input 11 (value=None) - value: 10.0", use_inner_text=True
    )

    assert_snapshot(empty_number_input, name="st_number_input-clearable_input")

    # Press escape to clear value:
    empty_number_input.focus()
    empty_number_input.press("Escape")
    empty_number_input.press("Enter")

    # Should be empty again:
    expect(app.get_by_test_id("stMarkdown").nth(11)).to_have_text(
        "number input 11 (value=None) - value: None", use_inner_text=True
    )

    # Check with second empty input, this one should be integer since the min_value was
    # set to an integer:
    empty_number_input_with_min = (
        app.get_by_test_id("stNumberInput").nth(11).locator("input").first
    )
    empty_number_input_with_min.fill("15")
    empty_number_input_with_min.press("Enter")

    expect(app.get_by_test_id("stMarkdown").nth(12)).to_have_text(
        "number input 12 (value from state & min=1) - value: 15", use_inner_text=True
    )
