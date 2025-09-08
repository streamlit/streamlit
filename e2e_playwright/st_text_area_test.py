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

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_toggle,
    expect_help_tooltip,
    expect_markdown,
    expect_prefixed_markdown,
    get_element_by_key,
    get_text_area,
)

NUM_TEXT_AREAS = 24


def test_text_area_widget_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the st.text_area widgets are correctly rendered via screenshot matching."""
    text_area_widgets = themed_app.get_by_test_id("stTextArea")
    expect(text_area_widgets).to_have_count(NUM_TEXT_AREAS)

    assert_snapshot(
        get_text_area(themed_app, "text area 1 (default)"), name="st_text_area-default"
    )
    assert_snapshot(
        get_text_area(themed_app, "text area 2 (value='some text')"),
        name="st_text_area-value_some_text",
    )
    assert_snapshot(
        get_text_area(themed_app, "text area 3 (value=1234)"),
        name="st_text_area-value_1234",
    )
    assert_snapshot(
        get_text_area(themed_app, "text area 4 (value=None)"),
        name="st_text_area-value_None",
    )
    assert_snapshot(
        get_text_area(themed_app, "text area 5 (placeholder)"),
        name="st_text_area-placeholder",
    )
    assert_snapshot(
        get_text_area(themed_app, "text area 6 (disabled)"),
        name="st_text_area-disabled",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "text_area_7"), name="st_text_area-hidden_label"
    )
    assert_snapshot(
        get_element_by_key(themed_app, "text_area_8"),
        name="st_text_area-collapsed_label",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "text_area_9"), name="st_text_area-callback_help"
    )
    assert_snapshot(
        get_text_area(themed_app, "text area 10 (max_chars=5)"),
        name="st_text_area-max_chars_5",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "text_area_16"),
        name="st_text_area-markdown_label",
    )


def test_text_area_dimensions(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the st.text_area widgets are correctly rendered via screenshot matching."""
    text_area_widgets = app.get_by_test_id("stTextArea")
    expect(text_area_widgets).to_have_count(NUM_TEXT_AREAS)

    assert_snapshot(
        get_text_area(app, "text area 11 (height=250)"), name="st_text_area-height_250"
    )
    assert_snapshot(
        get_text_area(app, "text area 12 (height=75)"), name="st_text_area-height_75"
    )
    # Expect this to default to the minimum height of 68px
    assert_snapshot(
        get_text_area(app, "text area 13 (height=60)"), name="st_text_area-height_60"
    )
    assert_snapshot(
        get_text_area(app, "text area 17 (width=200px)"),
        name="st_text_area-width_200px",
    )
    assert_snapshot(
        get_text_area(app, "text area 18 (width='stretch')"),
        name="st_text_area-width_stretch",
    )

    # Snapshot the form containing the stretch height text area
    form_container = app.get_by_test_id("stForm").nth(2)  # Third form (form3)
    assert_snapshot(form_container, name="st_text_area-height_stretch")

    # Snapshot the column area containing both text areas
    column_container = app.get_by_test_id("stHorizontalBlock").nth(1)
    assert_snapshot(column_container, name="st_text_area-columns_layout")

    vertical_layout_container = get_element_by_key(app, "layout-horizontal-text-area")
    assert_snapshot(vertical_layout_container, name="st_text_area-horizontal_layout")

    # content height is tested in test_text_area_content_height_expansion


def test_help_tooltip_works(app: Page):
    element_with_help = get_element_by_key(app, "text_area_9")
    expect_help_tooltip(app, element_with_help, "Help text")


def test_text_area_has_correct_initial_values(app: Page):
    """Test that st.text_area has the correct initial values."""
    expect_markdown(app, "value 1: ")
    expect_markdown(app, "value 2: some text")
    expect_markdown(app, "value 3: 1234")
    expect_markdown(app, "value 4: None")
    expect_markdown(app, "value 5: ")
    expect_markdown(app, "value 6: default text")
    expect_markdown(app, "value 7: default text")
    expect_markdown(app, "value 8: default text")
    expect_markdown(app, "value 9: ")
    expect_markdown(app, "text area changed: False")
    expect_markdown(app, "value 10: 1234")
    expect_markdown(app, "value 11: default text")
    expect_markdown(app, "value 12: default text")
    expect_markdown(app, "value 13: default text")
    expect_markdown(app, "text area 14 (value from state) - value: xyz")
    expect_markdown(app, "text area 15 (value from form) - value: ")


def test_text_area_shows_state_value(app: Page):
    expect(
        get_element_by_key(app, "text_area_14").locator("textarea").first
    ).to_have_text("xyz")


def test_text_area_shows_instructions_when_dirty(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.text_area shows the instructions correctly when dirty."""
    text_area = get_text_area(app, "text area 10 (max_chars=5)")

    text_area_field = text_area.locator("textarea").first
    text_area_field.fill("123")

    assert_snapshot(text_area, name="st_text_area-input_instructions")


def test_text_area_limits_input_via_max_chars(app: Page):
    """Test that st.text_area correctly limits the number of characters via max_chars."""
    text_area = get_text_area(app, "text area 10 (max_chars=5)")
    text_area_field = text_area.locator("textarea").first
    # Try typing in char by char:
    text_area_field.clear()
    text_area_field.type("12345678")
    text_area_field.press("Control+Enter")

    expect_markdown(app, "value 10: 12345")

    # Try filling in everything at once:
    text_area_field.focus()
    text_area_field.fill("12345678")
    text_area_field.press("Control+Enter")

    expect_markdown(app, "value 10: 12345")


def test_text_area_has_correct_value_on_blur(app: Page):
    """Test that st.text_area has the correct value on blur."""

    first_text_area = get_text_area(app, "text area 1 (default)")
    first_text_area_field = first_text_area.locator("textarea").first
    first_text_area_field.focus()
    first_text_area_field.fill("hello world")
    first_text_area_field.blur()

    expect_markdown(app, "value 1: hello world")


@pytest.mark.skip_browser(
    "firefox"  # The meta key + enter press doesn't work in the playwright firefox test
)
def test_text_area_has_correct_value_on_enter(app: Page):
    """Test that st.text_area has the correct value on enter."""

    first_text_area = get_text_area(app, "text area 1 (default)")
    first_text_area_field = first_text_area.locator("textarea").first
    # Test control + enter:
    first_text_area_field.focus()
    first_text_area_field.fill("hello world")
    first_text_area_field.press("Control+Enter")

    expect_markdown(app, "value 1: hello world")

    # Test command (Meta key) + enter:
    first_text_area_field.focus()
    first_text_area_field.fill("different value")
    first_text_area_field.press("Meta+Enter")

    expect_markdown(app, "value 1: different value")


def test_text_area_has_correct_value_on_click_outside(app: Page):
    """Test that st.text_area has the correct value on click outside."""

    first_text_area = get_text_area(app, "text area 1 (default)")
    first_text_area_field = first_text_area.locator("textarea").first
    first_text_area_field.focus()
    first_text_area_field.fill("hello world")
    app.get_by_test_id("stMarkdown").first.click()

    expect_markdown(app, "value 1: hello world")


def test_empty_text_area_behaves_correctly(app: Page):
    """Test that st.text_area behaves correctly when empty."""
    # Should return None as value:
    expect_markdown(app, "value 4: None")

    # Enter value in the empty widget:
    empty_text_area = get_text_area(app, "text area 4 (value=None)")
    empty_text_area_field = empty_text_area.locator("textarea").first
    empty_text_area_field.fill("hello world")
    empty_text_area_field.press("Control+Enter")

    expect_markdown(app, "value 4: hello world")

    # Press escape to clear value:
    empty_text_area_field.focus()
    empty_text_area_field.clear()
    empty_text_area_field.press("Control+Enter")

    # Should be set to empty string (we don't clear to None for text area):
    expect_markdown(app, "value 4: ")


def test_calls_callback_on_change(app: Page):
    """Test that it correctly calls the callback on change."""
    text_area = get_element_by_key(app, "text_area_9")
    text_area_field = text_area.locator("textarea").first

    text_area_field.fill("hello world")
    text_area_field.press("Control+Enter")

    expect_markdown(app, "value 9: hello world")
    expect_markdown(app, "text area changed: True")

    # Change different widget to trigger delta path change
    first_text_area = get_text_area(app, "text area 1 (default)")
    first_text_area_field = first_text_area.locator("textarea").first
    first_text_area_field.fill("hello world")
    first_text_area_field.press("Control+Enter")

    expect_markdown(app, "value 1: hello world")

    # Test if value is still correct after delta path change
    expect_markdown(app, "value 9: hello world")
    expect_markdown(app, "text area changed: False")


def test_text_area_in_form_with_submit_by_enter(app: Page):
    """Test that text area in form can be submitted by pressing Command+Enter."""
    text_area = get_element_by_key(app, "text_area_15")
    text_area_field = text_area.locator("textarea").first
    text_area_field.fill("hello world")
    text_area_field.press("Control+Enter")
    expect_markdown(app, "text area 15 (value from form) - value: hello world")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stTextArea")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "text_area_9")).to_be_visible()


def test_dynamic_text_area_props(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the text area can be updated dynamically while keeping the state."""
    dynamic_text_area = get_element_by_key(app, "dynamic_text_area_with_key")
    expect(dynamic_text_area).to_be_visible()

    expect(dynamic_text_area).to_contain_text("Initial dynamic text area")

    expect_prefixed_markdown(app, "Initial text area value:", "initial")

    assert_snapshot(dynamic_text_area, name="st_text_area-dynamic_initial")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_text_area, "initial help")

    # Type something and submit
    ta_field = dynamic_text_area.locator("textarea").first
    ta_field.fill("foo")
    ta_field.press("Control+Enter")
    wait_for_app_run(app)

    expect_prefixed_markdown(app, "Initial text area value:", "foo")

    # Click the toggle to update the text area props
    click_toggle(app, "Update text area props")

    # new text area is visible:
    expect(dynamic_text_area).to_contain_text("Updated dynamic text area")

    # Ensure the previously entered value remains visible
    expect_prefixed_markdown(app, "Updated text area value:", "foo")

    dynamic_text_area.scroll_into_view_if_needed()
    assert_snapshot(dynamic_text_area, name="st_text_area-dynamic_updated")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_text_area, "updated help")

    # Type something different and submit
    ta_field.fill("bar")
    ta_field.press("Control+Enter")
    wait_for_app_run(app)

    expect_prefixed_markdown(app, "Updated text area value:", "bar")


def test_text_area_content_height_expansion(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.text_area with height='content' expands correctly when content is added."""
    content_height_form = app.get_by_test_id("stForm").nth(1)

    # Take initial snapshot
    assert_snapshot(content_height_form, name="st_text_area-content_height_initial")

    # Add content that should trigger expansion
    content_height_form.locator("textarea").first.fill(
        "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8"
    )

    # Take snapshot after expansion
    assert_snapshot(content_height_form, name="st_text_area-content_height_expanded")

    # Test reducing content and verify it shrinks back
    content_height_form.locator("textarea").first.fill("Line 1\nLine 2")
    assert_snapshot(content_height_form, name="st_text_area-content_height_reduced")
