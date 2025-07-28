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
    get_element_by_key,
)


def test_selectbox_widget_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the selectbox widgets are correctly rendered via screenshot matching."""
    selectbox_widgets = themed_app.get_by_test_id("stSelectbox")
    expect(selectbox_widgets).to_have_count(19)

    assert_snapshot(selectbox_widgets.nth(0), name="st_selectbox-default")
    assert_snapshot(selectbox_widgets.nth(1), name="st_selectbox-formatted_options")
    assert_snapshot(selectbox_widgets.nth(2), name="st_selectbox-no_options")
    assert_snapshot(selectbox_widgets.nth(3), name="st_selectbox-more_options")
    assert_snapshot(selectbox_widgets.nth(4), name="st_selectbox-disabled")
    assert_snapshot(selectbox_widgets.nth(5), name="st_selectbox-hidden_label")
    assert_snapshot(selectbox_widgets.nth(6), name="st_selectbox-collapsed_label")
    assert_snapshot(selectbox_widgets.nth(7), name="st_selectbox-callback_help")
    assert_snapshot(selectbox_widgets.nth(8), name="st_selectbox-empty_selection")
    assert_snapshot(
        selectbox_widgets.nth(9), name="st_selectbox-empty_selection_placeholder"
    )
    assert_snapshot(selectbox_widgets.nth(10), name="st_selectbox-dataframe_options")
    assert_snapshot(selectbox_widgets.nth(11), name="st_selectbox-value_from_state")
    assert_snapshot(selectbox_widgets.nth(12), name="st_selectbox-markdown_label")
    assert_snapshot(selectbox_widgets.nth(17), name="st_selectbox-width_200px")
    assert_snapshot(selectbox_widgets.nth(18), name="st_selectbox-width_stretch")


def test_selectbox_has_correct_initial_values(app: Page):
    """Test that st.selectbox returns the correct initial values."""
    markdown_elements = app.get_by_test_id("stMarkdown")
    expect(markdown_elements).to_have_count(18)

    expected = [
        "value 1: male",
        "value 2: female",
        "value 3: None",
        "value 4: e2e/scripts/components_iframe.py",
        "value 5: male",
        "value 6: male",
        "value 7: male",
        "value 8: female",
        "selectbox changed: False",
        "value 9: None",
        "value 10: None",
        "value 11: male",
        "value 12: female",
        "value 14: male",
        "value 15: male",
        "value 15 (session_state): male",
        "value 16: female",
        "value 17: None",
    ]

    for markdown_element, expected_text in zip(markdown_elements.all(), expected):
        expect(markdown_element).to_have_text(expected_text, use_inner_text=True)


def test_handles_option_selection(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that selection of an option via the dropdown works correctly."""
    app.get_by_test_id("stSelectbox").nth(3).locator("input").click()

    # Take a snapshot of the selection dropdown:
    selection_dropdown = app.locator('[data-baseweb="popover"]').first
    assert_snapshot(selection_dropdown, name="st_selectbox-selection_dropdown")
    # Select last option:
    selection_dropdown.locator("li").nth(1).click()
    # Check that selection worked:
    expect(app.get_by_test_id("stMarkdown").nth(3)).to_have_text(
        "value 4: e2e/scripts/st_warning.py", use_inner_text=True
    )


def test_handles_option_selection_via_typing(app: Page):
    """Test that selection of an option via typing works correctly."""
    selectbox_input = app.get_by_test_id("stSelectbox").nth(3).locator("input")

    # Type an option:
    selectbox_input.type("e2e/scripts/st_warning.py")
    selectbox_input.press("Enter")

    # Check that selection worked:
    expect(app.get_by_test_id("stMarkdown").nth(3)).to_have_text(
        "value 4: e2e/scripts/st_warning.py", use_inner_text=True
    )


def test_shows_correct_options_via_fuzzy_search(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the fuzzy matching of options via typing works correctly."""
    selectbox_input = app.get_by_test_id("stSelectbox").nth(3).locator("input")

    # Start typing:
    selectbox_input.type("exp")

    # Check filtered options
    selection_dropdown = app.locator('[data-baseweb="popover"]').first
    assert_snapshot(selection_dropdown, name="st_selectbox-fuzzy_matching")


def test_empty_selectbox_behaves_correctly(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.selectbox behaves correctly when empty (no initial selection)."""
    empty_selectbox_input = app.get_by_test_id("stSelectbox").locator("input").nth(8)

    # Type an option:
    empty_selectbox_input.type("male")
    empty_selectbox_input.press("Enter")

    expect(app.get_by_test_id("stMarkdown").nth(9)).to_have_text(
        "value 9: male", use_inner_text=True
    )

    assert_snapshot(
        app.get_by_test_id("stSelectbox").nth(8), name="st_selectbox-clearable_input"
    )

    empty_selectbox_input.focus()
    empty_selectbox_input.press("Escape")

    # Should be empty again:
    expect(app.get_by_test_id("stMarkdown").nth(9)).to_have_text(
        "value 9: None", use_inner_text=True
    )


def test_keeps_value_on_selection_close(app: Page):
    """Test that the selection is kept when the dropdown is closed."""
    app.get_by_test_id("stSelectbox").nth(3).locator("input").click()

    # Take a snapshot of the selection dropdown:
    expect(app.locator('[data-baseweb="popover"]').first).to_be_visible()

    # Click outside to close the dropdown:
    app.get_by_test_id("stMarkdown").first.click()

    # Check if value is still initial value:
    expect(app.get_by_test_id("stMarkdown").nth(3)).to_have_text(
        "value 4: e2e/scripts/components_iframe.py", use_inner_text=True
    )


def test_handles_callback_on_change_correctly(app: Page):
    """Test that it correctly calls the callback on change."""
    # Check initial state:
    expect(app.get_by_test_id("stMarkdown").nth(7)).to_have_text(
        "value 8: female", use_inner_text=True
    )
    expect(app.get_by_test_id("stMarkdown").nth(8)).to_have_text(
        "selectbox changed: False", use_inner_text=True
    )

    app.get_by_test_id("stSelectbox").nth(7).locator("input").click()

    # Select last option:
    selection_dropdown = app.locator('[data-baseweb="popover"]').first
    selection_dropdown.locator("li").first.click()

    # Check that selection worked:
    expect(app.get_by_test_id("stMarkdown").nth(7)).to_have_text(
        "value 8: male", use_inner_text=True
    )
    expect(app.get_by_test_id("stMarkdown").nth(8)).to_have_text(
        "selectbox changed: True", use_inner_text=True
    )
    expect(
        app.get_by_text("Selectbox widget callback triggered: x=1, y=2, z=3")
    ).to_be_visible()

    # Change different input to trigger delta path change
    empty_selectbox_input = app.get_by_test_id("stSelectbox").locator("input").first

    # Type an option:
    empty_selectbox_input.type("female")
    empty_selectbox_input.press("Enter")

    expect(app.get_by_test_id("stMarkdown").first).to_have_text(
        "value 1: female", use_inner_text=True
    )
    expect(app.get_by_test_id("stMarkdown").nth(7)).to_have_text(
        "value 8: male", use_inner_text=True
    )
    expect(app.get_by_test_id("stMarkdown").nth(8)).to_have_text(
        "selectbox changed: False", use_inner_text=True
    )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stSelectbox")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "selectbox8")).to_be_visible()


def test_dismiss_change_by_clicking_away(app: Page):
    """Test that pressing ESC during editing restores the original value."""
    # Initial check
    markdown_result_element = app.get_by_test_id("stMarkdown").nth(13)
    expect(markdown_result_element).to_have_text("value 14: male", use_inner_text=True)

    # Get selectbox input
    selectbox_element = app.get_by_test_id("stSelectbox").nth(13)
    selectbox_input = selectbox_element.locator("input")

    # Click to focus the input
    selectbox_input.click()

    # Clear part of the text and type something else
    selectbox_input.press("Backspace")
    selectbox_input.press("Backspace")
    selectbox_input.press("Backspace")
    selectbox_input.type("xyz")
    # Verify the input value is indeed updated
    expect(selectbox_input).to_have_value("mxyz")

    # Press click outside of the input field to close the dropdown and stop editing
    app.get_by_test_id("stMarkdownContainer").get_by_text(
        "selectbox 14 (test dismiss behavior)"
    ).click()

    # Verify original value is restored
    # We use contain_text because the selectbox_element's text also includes the label
    expect(selectbox_element).to_contain_text("male")
    expect(markdown_result_element).to_have_text("value 14: male", use_inner_text=True)


def test_accept_new_options_feature(app: Page):
    """Test that the accept_new_options feature works correctly.
    When it's True, the user must be able to enter a new option that doesn't exist in
    the original options.
    """
    # Get the selectbox with accept_new_options=True
    selectbox_input = app.get_by_test_id("stSelectbox").nth(14).locator("input")

    # Type a new option that doesn't exist in the original options
    selectbox_input.click()
    selectbox_input.fill("")  # Clear the input
    selectbox_input.type("new_custom_option")
    selectbox_input.press("Enter")

    # Check that the new option was accepted and selected
    expect(app.get_by_test_id("stMarkdown").nth(14)).to_have_text(
        "value 15: new_custom_option", use_inner_text=True
    )
    # Check that the new option was accepted and selected
    expect(app.get_by_test_id("stMarkdown").nth(15)).to_have_text(
        "value 15 (session_state): new_custom_option", use_inner_text=True
    )


def test_does_not_accept_new_options_feature(app: Page):
    """Test that the accept_new_options feature works correctly.
    When it's False, the user must not be able to enter a new option that doesn't exist
    in the original options.
    """
    # Get any selectbox with accept_new_options=False
    selectbox_input = app.get_by_test_id("stSelectbox").nth(0).locator("input")
    # Check that the new option was accepted and selected
    expect(app.get_by_test_id("stMarkdown").nth(0)).to_have_text(
        "value 1: male", use_inner_text=True
    )

    # Type a new option that doesn't exist in the original options
    selectbox_input.click()
    selectbox_input.fill("")  # Clear the input
    selectbox_input.type("new_custom_option")
    selectbox_input.press("Enter")

    expect(app.get_by_test_id("stMarkdown").nth(0)).to_have_text(
        "value 1: male", use_inner_text=True
    )


def test_selectbox_preset_session_state(app: Page):
    """Should display values from session_state."""
    expect(app.get_by_test_id("stMarkdown").nth(16)).to_have_text("value 16: female")
    selectbox = app.get_by_test_id("stSelectbox").nth(15)
    expect(selectbox.get_by_text("female")).to_be_visible()


def test_selectbox_empty_options_with_accept_new_options(app: Page):
    """Should allow adding new options when options list is empty but
    accept_new_options is True.
    """
    # Get the selectbox with empty options but accept_new_options=True (index 16)
    selectbox_elem = app.get_by_test_id("stSelectbox").nth(16)
    selectbox_input = selectbox_elem.locator("input")

    # Verify the initial placeholder shows a message about adding an option
    expect(selectbox_elem).to_contain_text("Add an option")

    # Click to focus the input field
    selectbox_input.click()

    # Type and add a new option "new_option"
    selectbox_input.fill("new_option")
    selectbox_input.press("Enter")

    # Verify new option was added and selected successfully
    expect(app.get_by_test_id("stMarkdown").nth(17)).to_have_text(
        "value 17: new_option"
    )

    # Verify the new option is visible in the input field
    expect(selectbox_elem.get_by_text("new_option", exact=True)).to_be_visible()

    # Add another option to replace the first one
    selectbox_input.click()
    selectbox_input.fill("another_option")
    selectbox_input.press("Enter")

    # Verify the new option replaced the previous one
    expect(app.get_by_test_id("stMarkdown").nth(17)).to_have_text(
        "value 17: another_option"
    )
    expect(selectbox_elem.get_by_text("another_option")).to_be_visible()
