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


import re

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_toggle,
    expect_help_tooltip,
    expect_prefixed_markdown,
    fill_number_input,
    get_element_by_key,
    get_number_input,
)

NUMBER_INPUT_COUNT = 18


def test_number_input_widget_display(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.number_input renders correctly."""
    expect(themed_app.get_by_test_id("stNumberInput")).to_have_count(NUMBER_INPUT_COUNT)

    assert_snapshot(
        get_number_input(themed_app, "number input 1 (default)"),
        name="st_number_input-default",
    )
    assert_snapshot(
        get_number_input(themed_app, "number input 2 (value=1)"),
        name="st_number_input-value_1",
    )
    assert_snapshot(
        get_number_input(themed_app, "number input 3 (min & max)"),
        name="st_number_input-min_max",
    )
    assert_snapshot(
        get_number_input(themed_app, "number input 4 (step=2)"),
        name="st_number_input-step_2",
    )
    assert_snapshot(
        get_number_input(themed_app, "number input 5 (max=10)"),
        name="st_number_input-max_10",
    )
    assert_snapshot(
        get_number_input(themed_app, "number input 6 (disabled=True)"),
        name="st_number_input-disabled_true",
    )
    assert_snapshot(
        get_number_input(themed_app, "number input 7 (label=hidden)"),
        name="st_number_input-label_hidden",
    )
    assert_snapshot(
        get_number_input(themed_app, "number input 8 (label=collapsed)"),
        name="st_number_input-label_collapsed",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "number_input_9"),
        name="st_number_input-on_change",
    )
    assert_snapshot(
        get_number_input(themed_app, "number input 10 (small width)"),
        name="st_number_input-small_width",
    )
    assert_snapshot(
        get_number_input(themed_app, "number input 11 (value=None)"),
        name="st_number_input-value_none",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "number_input_12"),
        name="st_number_input-value_none_min_1",
    )
    # Use regex to avoid matching full markdown label text
    assert_snapshot(
        get_number_input(themed_app, re.compile(r"^number input 13")),
        name="st_number_input-markdown_label",
    )
    assert_snapshot(
        get_number_input(themed_app, "number input 14 - emoji icon"),
        name="st_number_input-emoji_icon",
    )
    assert_snapshot(
        get_number_input(themed_app, "number input 15 - material icon"),
        name="st_number_input-material_icon",
    )
    assert_snapshot(
        get_number_input(themed_app, "number input 16 (width=200px)"),
        name="st_number_input-width_200px",
    )
    assert_snapshot(
        get_number_input(themed_app, "number input 17 (width='stretch')"),
        name="st_number_input-width_stretch",
    )


def test_help_tooltip_works(app: Page):
    expect_help_tooltip(
        app, get_number_input(app, "number input 1 (default)"), "Help text"
    )


def test_number_input_has_correct_default_values(app: Page):
    """Test that st.number_input has the correct initial values."""
    expect_prefixed_markdown(app, "number input 1 (default) - value:", "0.0")
    expect_prefixed_markdown(app, "number input 2 (value=1) - value:", "1")
    expect_prefixed_markdown(app, "number input 3 (min & max) - value:", "1")
    expect_prefixed_markdown(app, "number input 4 (step=2) - value:", "0")
    expect_prefixed_markdown(app, "number input 5 (max=10) - value:", "0")
    expect_prefixed_markdown(app, "number input 6 (disabled=True) - value:", "0.0")
    expect_prefixed_markdown(app, "number input 7 (label=hidden) - value:", "0.0")
    expect_prefixed_markdown(app, "number input 8 (label=collapsed) - value:", "0.0")
    expect_prefixed_markdown(app, "number input 9 (on_change) - value:", "0.0")
    expect_prefixed_markdown(app, "number input 9 (on_change) - changed:", "False")
    expect_prefixed_markdown(app, "number input 10 (small width) - value:", "0")
    expect_prefixed_markdown(app, "number input 11 (value=None) - value:", "None")
    expect_prefixed_markdown(
        app, "number input 12 (value from state & min=1) - value:", "10"
    )


def test_number_input_shows_instructions_when_dirty(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.number_input shows the instructions correctly when dirty."""
    number_input_el = get_number_input(app, "number input 1 (default)")
    number_input_el.locator("input").first.fill("10")
    assert_snapshot(number_input_el, name="st_number_input-input_instructions")


def test_number_input_updates_value_correctly_on_enter(app: Page):
    """Test that st.number_input updates the value correctly on enter."""
    fill_number_input(app, "number input 1 (default)", 10)
    expect_prefixed_markdown(app, "number input 1 (default) - value:", "10.0")


def test_number_input_has_correct_value_on_increment_click(app: Page):
    """Test that st.number_input has the correct value on increment click."""

    def click_step_up(label: str) -> None:
        el = get_number_input(app, label)
        btn = el.get_by_test_id("stNumberInputStepUp").first
        expect(btn).to_be_visible()

        # Force click if the button is disabled
        btn.click(force=not btn.is_enabled())
        wait_for_app_run(app)

    click_step_up("number input 1 (default)")
    click_step_up("number input 2 (value=1)")
    click_step_up("number input 3 (min & max)")
    click_step_up("number input 4 (step=2)")
    click_step_up("number input 5 (max=10)")
    click_step_up("number input 6 (disabled=True)")
    click_step_up("number input 7 (label=hidden)")
    click_step_up("number input 8 (label=collapsed)")
    click_step_up("number input 9 (on_change)")
    click_step_up("number input 12 (value from state & min=1)")

    expect_prefixed_markdown(app, "number input 1 (default) - value:", "0.01")
    expect_prefixed_markdown(app, "number input 2 (value=1) - value:", "2")
    expect_prefixed_markdown(app, "number input 3 (min & max) - value:", "2")
    expect_prefixed_markdown(app, "number input 4 (step=2) - value:", "2")
    expect_prefixed_markdown(app, "number input 5 (max=10) - value:", "1")
    expect_prefixed_markdown(app, "number input 6 (disabled=True) - value:", "0.0")
    expect_prefixed_markdown(app, "number input 7 (label=hidden) - value:", "0.01")
    expect_prefixed_markdown(app, "number input 8 (label=collapsed) - value:", "0.01")
    expect_prefixed_markdown(app, "number input 9 (on_change) - value:", "0.01")
    expect_prefixed_markdown(app, "number input 9 (on_change) - changed:", "True")
    expect_prefixed_markdown(app, "number input 10 (small width) - value:", "0")
    expect_prefixed_markdown(app, "number input 11 (value=None) - value:", "None")
    expect_prefixed_markdown(
        app, "number input 12 (value from state & min=1) - value:", "11"
    )


def test_number_input_has_correct_value_on_arrow_up(app: Page):
    """Test that st.number_input has the correct value on arrow up."""
    first_number_input_field = (
        get_number_input(app, "number input 1 (default)").locator("input").first
    )
    first_number_input_field.press("ArrowUp")
    expect_prefixed_markdown(app, "number input 1 (default) - value:", "0.01")


def test_number_input_has_correct_value_on_blur(app: Page):
    """Test that st.number_input has the correct value on blur."""
    first_number_input_field = (
        get_number_input(app, "number input 1 (default)").locator("input").first
    )
    first_number_input_field.focus()
    first_number_input_field.fill("10")
    first_number_input_field.blur()
    expect_prefixed_markdown(app, "number input 1 (default) - value:", "10.0")


def test_number_input_typing_decimal_via_keyboard(app: Page):
    """Typing a decimal value using the keyboard should work and commit correctly."""
    first_number_input_field = app.get_by_label("number input 1 (default)")
    first_number_input_field.click()
    first_number_input_field.select_text()
    first_number_input_field.type("12.34")
    first_number_input_field.press("Enter")
    wait_for_app_run(app)

    expect_prefixed_markdown(app, "number input 1 (default) - value:", "12.34")


def test_empty_number_input_behaves_correctly(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.number_input behaves correctly when empty."""
    # Enter 10 in the first empty input:
    empty_number_input = get_number_input(app, "number input 11 (value=None)")
    empty_number_input_field = empty_number_input.locator("input").first
    empty_number_input_field.fill("10")
    empty_number_input_field.press("Enter")

    expect_prefixed_markdown(app, "number input 11 (value=None) - value:", "10.0")

    assert_snapshot(empty_number_input, name="st_number_input-clearable_input")

    # Press escape to clear value:
    empty_number_input_field.focus()
    empty_number_input_field.press("Escape")
    empty_number_input_field.press("Enter")

    # Should be empty again:
    expect_prefixed_markdown(app, "number input 11 (value=None) - value:", "None")

    # Check with second empty input, this one should be integer since the min_value was
    # set to an integer:
    empty_number_input_with_min = (
        get_number_input(app, "number input 12 (value from state & min=1)")
        .locator("input")
        .first
    )
    empty_number_input_with_min.fill("15")
    empty_number_input_with_min.press("Enter")

    expect_prefixed_markdown(
        app, "number input 12 (value from state & min=1) - value:", "15"
    )


def test_number_input_does_not_allow_wheel_events(app: Page):
    """Test that st.number_input does not allow wheel events."""
    number_input = (
        get_number_input(app, "number input 2 (value=1)")
        .locator("input[type='number']")
        .first
    )

    # Click/focus needed to bring mouse to center of input
    number_input.click()
    # Scroll a little at a time to see the effect of a wheel event
    # Negative y delta scrolls up, would increase value if wheel event was allowed
    app.mouse.wheel(0, -50)
    number_input.focus()
    app.mouse.wheel(0, -50)
    number_input.focus()
    app.mouse.wheel(0, -50)
    number_input.press("Enter")

    expect(number_input).to_have_value("1")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "number_input_9")).to_be_visible()


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stNumberInput")


# Firefox has some issues with sub-pixel flakiness
# but functional everything is working fine with firefox.
@pytest.mark.skip_browser("firefox")
def test_dynamic_number_input_props(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the number input can be updated dynamically while keeping the state."""
    dynamic_number_input = get_element_by_key(app, "dynamic_number_input_with_key")
    expect(dynamic_number_input).to_be_visible()

    expect(dynamic_number_input).to_contain_text("Initial dynamic number input")
    assert_snapshot(dynamic_number_input, name="st_number_input-dynamic_initial")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_number_input, "initial help")

    # Type something and submit
    input_field = dynamic_number_input.locator("input").first
    input_field.fill("7")
    input_field.press("Enter")
    wait_for_app_run(app)

    expect_prefixed_markdown(app, "Initial number input value:", "7")

    # Click the toggle to update the number input props

    click_toggle(app, "Update number input props")

    # new number input is visible:
    expect(dynamic_number_input).to_contain_text("Updated dynamic number input")

    # Ensure the previously entered value remains visible
    expect_prefixed_markdown(app, "Updated number input value:", "7")

    dynamic_number_input.scroll_into_view_if_needed()
    assert_snapshot(dynamic_number_input, name="st_number_input-dynamic_updated")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_number_input, "updated help")


def test_number_input_tab_focus_behavior(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.number_input tab focus behavior works correctly.

    Regression test for issue #12526: tab selects full existing value
    with non-integer values
    """
    # Need to tab to a number input with a non-integer value, like the sixth one,
    # so starting at the fifth one
    fifth_number_input_field = (
        get_number_input(app, "number input 5 (max=10)").locator("input").first
    )
    fifth_number_input_field.click()
    fifth_number_input_field.press("Tab")

    seventh_number_input = get_number_input(app, "number input 7 (label=hidden)")
    assert_snapshot(seventh_number_input, name="st_number_input-tab_focus")
