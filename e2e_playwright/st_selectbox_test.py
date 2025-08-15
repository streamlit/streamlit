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
from __future__ import annotations

import re
from re import Pattern
from typing import TYPE_CHECKING

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    expect_help_tooltip,
    expect_markdown,
    get_element_by_key,
    get_selectbox,
)

if TYPE_CHECKING:
    from e2e_playwright.conftest import ImageCompareFunction


NUM_SELECTBOXES = 19


def get_selectbox_input(locator: Locator | Page, label: str | Pattern[str]) -> Locator:
    """Get the input of a selectbox with the given label.

    Parameters
    ----------
    locator : Locator | Page
        The locator to search for the element.

    Returns
    -------
    Locator
        The input of the element.
    """
    return get_selectbox(locator, label).locator("input").first


def test_selectbox_widget_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the selectbox widgets are correctly rendered via screenshot matching."""
    selectbox_widgets = themed_app.get_by_test_id("stSelectbox")
    expect(selectbox_widgets).to_have_count(NUM_SELECTBOXES)

    assert_snapshot(
        get_selectbox(themed_app, "selectbox 1 (default)"), name="st_selectbox-default"
    )
    assert_snapshot(
        get_selectbox(themed_app, "selectbox 2 (formatted options)"),
        name="st_selectbox-formatted_options",
    )
    assert_snapshot(
        get_selectbox(themed_app, "selectbox 3 (no options)"),
        name="st_selectbox-no_options",
    )
    assert_snapshot(
        get_selectbox(themed_app, "selectbox 4 (more options)"),
        name="st_selectbox-more_options",
    )
    assert_snapshot(
        get_selectbox(themed_app, "selectbox 5 (disabled)"),
        name="st_selectbox-disabled",
    )
    assert_snapshot(
        get_selectbox(themed_app, "selectbox 6 (hidden label)"),
        name="st_selectbox-hidden_label",
    )
    assert_snapshot(
        get_selectbox(themed_app, "selectbox 7 (collapsed label)"),
        name="st_selectbox-collapsed_label",
    )
    assert_snapshot(
        get_selectbox(themed_app, "selectbox 8 (with callback, help)"),
        name="st_selectbox-callback_help",
    )
    assert_snapshot(
        get_selectbox(themed_app, "selectbox 9 (empty selection)"),
        name="st_selectbox-empty_selection",
    )
    assert_snapshot(
        get_selectbox(themed_app, "selectbox 10 (empty, custom placeholder)"),
        name="st_selectbox-empty_selection_placeholder",
    )
    assert_snapshot(
        get_selectbox(themed_app, "selectbox 11 (options from dataframe)"),
        name="st_selectbox-dataframe_options",
    )
    assert_snapshot(
        get_selectbox(themed_app, "selectbox 12 (empty, value from state)"),
        name="st_selectbox-value_from_state",
    )
    assert_snapshot(
        get_selectbox(themed_app, re.compile(r"^selectbox 13")),
        name="st_selectbox-markdown_label",
    )
    assert_snapshot(
        get_selectbox(themed_app, "selectbox 18 (width=200px)"),
        name="st_selectbox-width_200px",
    )
    assert_snapshot(
        get_selectbox(themed_app, "selectbox 19 (width='stretch')"),
        name="st_selectbox-width_stretch",
    )


def test_selectbox_has_correct_initial_values(app: Page):
    """Test that st.selectbox returns the correct initial values."""
    expect_markdown(app, "value 1: male")
    expect_markdown(app, "value 2: female")
    expect_markdown(app, "value 3: None")
    expect_markdown(app, "value 4: e2e/scripts/components_iframe.py")
    expect_markdown(app, "value 5: male")
    expect_markdown(app, "value 6: male")
    expect_markdown(app, "value 7: male")
    expect_markdown(app, "value 8: female")
    expect_markdown(app, "selectbox changed: False")
    expect_markdown(app, "value 9: None")
    expect_markdown(app, "value 10: None")
    expect_markdown(app, "value 11: male")
    expect_markdown(app, "value 12: female")
    expect_markdown(app, "value 14: male")
    expect_markdown(app, "value 15: male")
    expect_markdown(app, "value 15 (session_state): male")
    expect_markdown(app, "value 16: female")
    expect_markdown(app, "value 17: None")


def test_handles_option_selection(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that selection of an option via the dropdown works correctly."""
    get_selectbox_input(app, "selectbox 4 (more options)").click()

    # Take a snapshot of the selection dropdown:
    selection_dropdown = app.locator('[data-baseweb="popover"]').first
    assert_snapshot(selection_dropdown, name="st_selectbox-selection_dropdown")
    # Select last option:
    selection_dropdown.locator("li").nth(1).click()
    # Check that selection worked:
    expect_markdown(app, "value 4: e2e/scripts/st_warning.py")


def test_handles_option_selection_via_typing(app: Page):
    """Test that selection of an option via typing works correctly."""
    selectbox_input = get_selectbox_input(app, "selectbox 4 (more options)")

    # Type an option:
    selectbox_input.type("e2e/scripts/st_warning.py")
    selectbox_input.press("Enter")

    # Check that selection worked:
    expect_markdown(app, "value 4: e2e/scripts/st_warning.py")


def test_shows_correct_options_via_fuzzy_search(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the fuzzy matching of options via typing works correctly."""
    selectbox_input = get_selectbox_input(app, "selectbox 4 (more options)")

    # Start typing:
    selectbox_input.type("exp")

    # Check filtered options
    selection_dropdown = app.locator('[data-baseweb="popover"]').first
    assert_snapshot(selection_dropdown, name="st_selectbox-fuzzy_matching")


def test_empty_selectbox_behaves_correctly(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.selectbox behaves correctly when empty (no initial selection)."""
    empty_selectbox_input = get_selectbox_input(app, "selectbox 9 (empty selection)")

    # Type an option:
    empty_selectbox_input.type("male")
    empty_selectbox_input.press("Enter")

    expect_markdown(app, "value 9: male")

    assert_snapshot(
        get_selectbox(app, "selectbox 9 (empty selection)"),
        name="st_selectbox-clearable_input",
    )

    empty_selectbox_input.focus()
    empty_selectbox_input.press("Escape")

    # Should be empty again:
    expect_markdown(app, "value 9: None")


def test_keeps_value_on_selection_close(app: Page):
    """Test that the selection is kept when the dropdown is closed."""
    get_selectbox_input(app, "selectbox 4 (more options)").click()

    # Take a snapshot of the selection dropdown:
    expect(app.locator('[data-baseweb="popover"]').first).to_be_visible()

    # Click outside to close the dropdown:
    app.get_by_test_id("stMarkdown").first.click()

    # Check if value is still initial value:
    expect_markdown(app, "value 4: e2e/scripts/components_iframe.py")


def test_handles_callback_on_change_correctly(app: Page):
    """Test that it correctly calls the callback on change."""
    # Check initial state:
    expect_markdown(app, "value 8: female")
    expect_markdown(app, "selectbox changed: False")

    get_selectbox_input(app, "selectbox 8 (with callback, help)").click()

    # Select last option:
    selection_dropdown = app.locator('[data-baseweb="popover"]').first
    selection_dropdown.locator("li").first.click()

    # Check that selection worked:
    expect_markdown(app, "value 8: male")
    expect_markdown(app, "selectbox changed: True")
    expect(
        app.get_by_text("Selectbox widget callback triggered: x=1, y=2, z=3")
    ).to_be_visible()

    # Change different input to trigger delta path change
    empty_selectbox_input = get_selectbox_input(app, "selectbox 1 (default)")

    # Type an option:
    empty_selectbox_input.type("female")
    empty_selectbox_input.press("Enter")

    expect_markdown(app, "value 1: female")
    expect_markdown(app, "value 8: male")
    expect_markdown(app, "selectbox changed: False")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stSelectbox")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "selectbox8")).to_be_visible()


def test_dismiss_change_by_clicking_away(app: Page):
    """Test that pressing ESC during editing restores the original value."""
    # Initial check
    expect_markdown(app, "value 14: male")

    # Get selectbox input
    selectbox_element = get_selectbox(app, "selectbox 14 (test dismiss behavior)")
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
    expect_markdown(app, "value 14: male")


def test_accept_new_options_feature(app: Page):
    """Test that the accept_new_options feature works correctly.
    When it's True, the user must be able to enter a new option that doesn't exist in
    the original options.
    """
    # Get the selectbox with accept_new_options=True
    selectbox_input = get_selectbox_input(app, "selectbox 15 (accept new options)")

    # Type a new option that doesn't exist in the original options
    selectbox_input.click()
    selectbox_input.fill("")  # Clear the input
    selectbox_input.type("new_custom_option")
    selectbox_input.press("Enter")

    # Check that the new option was accepted and selected
    expect_markdown(app, "value 15: new_custom_option")
    expect_markdown(app, "value 15 (session_state): new_custom_option")


def test_does_not_accept_new_options_feature(app: Page):
    """Test that the accept_new_options feature works correctly.
    When it's False, the user must not be able to enter a new option that doesn't exist
    in the original options.
    """
    # Get any selectbox with accept_new_options=False
    selectbox_input = get_selectbox_input(app, "selectbox 1 (default)")
    expect_markdown(app, "value 1: male")

    # Type a new option that doesn't exist in the original options
    selectbox_input.click()
    selectbox_input.fill("")  # Clear the input
    selectbox_input.type("new_custom_option")
    selectbox_input.press("Enter")

    expect_markdown(app, "value 1: male")


def test_selectbox_preset_session_state(app: Page):
    """Should display values from session_state."""
    expect_markdown(app, "value 16: female")
    selectbox = get_selectbox(app, "selectbox 16 - session_state values")
    expect(selectbox.get_by_text("female", exact=True)).to_be_visible()


def test_selectbox_empty_options_with_accept_new_options(app: Page):
    """Should allow adding new options when options list is empty but
    accept_new_options is True.
    """
    # Get the selectbox with empty options but accept_new_options=True
    selectbox_elem = get_selectbox(
        app, "selectbox 17 - empty options with accept_new_options"
    )
    selectbox_input = selectbox_elem.locator("input")

    # Verify the initial placeholder shows a message about adding an option
    expect(selectbox_elem).to_contain_text("Add an option")

    # Click to focus the input field
    selectbox_input.click()

    # Type and add a new option "new_option"
    selectbox_input.fill("new_option")
    selectbox_input.press("Enter")

    # Verify new option was added and selected successfully
    expect_markdown(app, "value 17: new_option")

    # Verify the new option is visible in the input field
    expect(selectbox_elem.get_by_text("new_option", exact=True)).to_be_visible()

    # Add another option to replace the first one
    selectbox_input.click()
    selectbox_input.fill("another_option")
    selectbox_input.press("Enter")

    # Verify the new option replaced the previous one
    expect_markdown(app, "value 17: another_option")
    expect(selectbox_elem.get_by_text("another_option", exact=True)).to_be_visible()


def test_help_tooltip_works(app: Page):
    element_with_help = get_selectbox(app, "selectbox 8 (with callback, help)")
    expect_help_tooltip(app, element_with_help, "Help text")
