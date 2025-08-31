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

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    expect_help_tooltip,
    expect_markdown,
    get_element_by_key,
    get_text_input,
)

TEXT_INPUT_ELEMENTS = 18


def test_text_input_widget_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the st.text_input widgets are correctly rendered via screenshot matching."""
    text_input_widgets = themed_app.get_by_test_id("stTextInput")
    expect(text_input_widgets).to_have_count(TEXT_INPUT_ELEMENTS)

    assert_snapshot(
        get_text_input(themed_app, "text input 1 (default)"),
        name="st_text_input-default",
    )
    assert_snapshot(
        get_text_input(themed_app, "text input 2 (value='some text')"),
        name="st_text_input-value_some_text",
    )
    assert_snapshot(
        get_text_input(themed_app, "text input 3 (value=1234)"),
        name="st_text_input-value_1234",
    )
    assert_snapshot(
        get_text_input(themed_app, "text input 4 (value=None)"),
        name="st_text_input-value_None",
    )
    assert_snapshot(
        get_text_input(themed_app, "text input 5 (placeholder)"),
        name="st_text_input-placeholder",
    )
    assert_snapshot(
        get_text_input(themed_app, "text input 6 (disabled)"),
        name="st_text_input-disabled",
    )
    assert_snapshot(
        get_text_input(themed_app, "text input 7 (hidden label)"),
        name="st_text_input-hidden_label",
    )
    assert_snapshot(
        get_text_input(themed_app, "text input 8 (collapsed label)"),
        name="st_text_input-collapsed_label",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "text_input_9"),
        name="st_text_input-callback_help",
    )
    assert_snapshot(
        get_text_input(themed_app, "text input 10 (max_chars=5)"),
        name="st_text_input-max_chars_5",
    )
    assert_snapshot(
        get_text_input(themed_app, "text input 11 (type=password)"),
        name="st_text_input-type_password",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "text_input_14"),
        name="st_text_input-markdown_label",
    )
    assert_snapshot(
        get_text_input(themed_app, "text input 15 - emoji icon"),
        name="st_text_input-emoji_icon",
    )
    assert_snapshot(
        get_text_input(themed_app, "text input 16 - material icon"),
        name="st_text_input-material_icon",
    )
    assert_snapshot(
        get_text_input(themed_app, "text input 17 (width=200px)"),
        name="st_text_input-width_200px",
    )
    assert_snapshot(
        get_text_input(themed_app, "text input 18 (width='stretch')"),
        name="st_text_input-width_stretch",
    )


def test_text_input_has_correct_initial_values(app: Page):
    """Test that st.text_input has the correct initial values."""
    expect_markdown(app, "value 1: ")
    expect_markdown(app, "value 2: some text")
    expect_markdown(app, "value 3: 1234")
    expect_markdown(app, "value 4: None")
    expect_markdown(app, "value 5: ")
    expect_markdown(app, "value 6: default text")
    expect_markdown(app, "value 7: default text")
    expect_markdown(app, "value 8: default text")
    expect_markdown(app, "value 9: ")
    expect_markdown(app, "text input changed: False")
    expect_markdown(app, "value 10: 1234")
    expect_markdown(app, "value 11: my password")
    expect_markdown(app, "text input 12 (value from state) - value: xyz")
    expect_markdown(app, "text input 13 (value from form) - value:")
    expect_markdown(app, "Rerun counter: 1")


def test_text_input_shows_instructions_when_dirty(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.text_input shows the instructions correctly when dirty."""
    text_input = get_text_input(app, "text input 10 (max_chars=5)")

    text_input_field = text_input.locator("input").first
    expect(text_input_field).to_be_visible()
    text_input_field.fill("123")
    expect(text_input.get_by_test_id("InputInstructions")).to_have_text(
        "Press Enter to apply3/5"
    )

    assert_snapshot(text_input, name="st_text_input-input_instructions")


def test_text_input_limits_input_via_max_chars(app: Page):
    """Test that st.text_input correctly limits the number of characters via max_chars."""
    text_input_field = (
        get_text_input(app, "text input 10 (max_chars=5)").locator("input").first
    )
    expect(text_input_field).to_be_visible()
    text_input_field.clear()
    expect(text_input_field).to_have_value("")
    text_input_field.type("12345678")
    text_input_field.press("Enter")

    expect_markdown(app, "value 10: 12345")

    # Try filling in everything at once:
    text_input_field.focus()
    text_input_field.fill("12345678")
    text_input_field.press("Enter")

    expect_markdown(app, "value 10: 12345")


def test_text_input_has_correct_value_on_blur(app: Page):
    """Test that st.text_input has the correct value on blur."""

    first_text_input_field = (
        get_text_input(app, "text input 1 (default)").locator("input").first
    )
    first_text_input_field.focus()
    first_text_input_field.fill("hello world")
    first_text_input_field.blur()

    expect_markdown(app, "value 1: hello world")


def test_text_input_has_correct_value_on_enter(app: Page):
    """Test that st.text_input has the correct value on enter."""

    first_text_input_field = (
        get_text_input(app, "text input 1 (default)").locator("input").first
    )
    first_text_input_field.focus()
    first_text_input_field.fill("hello world")
    first_text_input_field.press("Enter")

    expect_markdown(app, "value 1: hello world")


def test_text_input_has_correct_value_on_click_outside(app: Page):
    """Test that st.text_input has the correct value on click outside."""

    first_text_input_field = (
        get_text_input(app, "text input 1 (default)").locator("input").first
    )
    first_text_input_field.focus()
    first_text_input_field.fill("hello world")
    app.get_by_test_id("stMarkdown").first.click()

    expect_markdown(app, "value 1: hello world")


def test_text_input_does_not_trigger_rerun_when_value_does_not_change_and_click_outside(
    app: Page,
):
    """Test that st.text_input has the correct value on click outside."""

    expect_markdown(app, "Rerun counter: 1")

    first_text_input_field = (
        get_text_input(app, "text input 1 (default)").locator("input").first
    )
    first_text_input_field.focus()
    first_text_input_field.fill("hello world")
    app.get_by_test_id("stMarkdown").first.click()

    expect_markdown(app, "value 1: hello world")
    expect_markdown(app, "Rerun counter: 2")

    first_text_input_field.focus()
    app.get_by_test_id("stMarkdown").first.click()
    expect_markdown(app, "Rerun counter: 2")


def test_empty_text_input_behaves_correctly(app: Page):
    """Test that st.text_input behaves correctly when empty."""
    # Should return None as value:
    expect_markdown(app, "value 4: None")

    # Enter value in the empty widget:
    empty_text_input = get_text_input(app, "text input 4 (value=None)")
    empty_text_input_field = empty_text_input.locator("input").first
    empty_text_input_field.fill("hello world")
    empty_text_input_field.press("Enter")

    expect_markdown(app, "value 4: hello world")

    # Press escape to clear value:
    empty_text_input_field.focus()
    empty_text_input_field.clear()
    empty_text_input_field.press("Enter")

    # Should be set to empty string (we don't clear to None for text input):
    expect_markdown(app, "value 4: ")


def test_text_input_shows_state_value(app: Page):
    expect(get_element_by_key(app, "text_input_12").locator("input")).to_have_value(
        "xyz"
    )


def test_calls_callback_on_change(app: Page):
    """Test that it correctly calls the callback on change."""
    text_input_field = get_element_by_key(app, "text_input_9").locator("input").first

    text_input_field.fill("hello world")
    text_input_field.press("Enter")

    expect_markdown(app, "value 9: hello world")
    expect_markdown(app, "text input changed: True")

    # Change differentwidget to trigger delta path change
    first_text_input_field = (
        get_text_input(app, "text input 1 (default)").locator("input").first
    )
    first_text_input_field.fill("hello world")
    first_text_input_field.press("Enter")

    expect_markdown(app, "value 1: hello world")

    # Test if value is still correct after delta path change
    expect_markdown(app, "value 9: hello world")
    expect_markdown(app, "text input changed: False")


def test_text_input_in_form_with_submit_by_enter(app: Page):
    """Test that text area in form can be submitted by pressing Command+Enter."""
    text_area_field = (
        get_text_input(app, "text input 13 (value from form)").locator("input").first
    )
    text_area_field.fill("hello world")
    text_area_field.press("Enter")
    expect_markdown(app, "text input 13 (value from form) - value: hello world")


def test_help_tooltip_works(app: Page):
    """Test that the help tooltip is displayed on hover."""
    element_with_help = get_element_by_key(app, "text_input_9")
    expect_help_tooltip(app, element_with_help, "Help text")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stTextInput")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "text_input_9")).to_be_visible()
