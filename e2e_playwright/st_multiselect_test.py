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

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_checkbox,
    click_toggle,
    expect_help_tooltip,
    expect_prefixed_markdown,
    expect_text,
    get_element_by_key,
    get_multiselect,
)

MULTISELECT_COUNT = 20


def _get_multiselect_input(locator: Locator | Page, label: str) -> Locator:
    return get_multiselect(locator, label).locator("input").first


def select_for_multiselect(
    page: Page, label: str, option_text: str, close_after_selecting: bool
) -> None:
    """Select an option from a multiselect widget identified by its label."""
    ms = get_multiselect(page, label)
    ms.locator("input").click()
    page.locator("li").filter(has_text=option_text).first.click()
    if close_after_selecting:
        page.keyboard.press("Escape")
    wait_for_app_run(page)


def del_from_multiselect(page: Page, label: str, option_text: str) -> None:
    ms = get_multiselect(page, label)
    ms.locator(
        f'span[data-baseweb="tag"] span[title="{option_text}"] + span[role="presentation"]'
    ).first.click()
    wait_for_app_run(page)


def test_multiselect_on_load(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Should show widgets correctly when loaded."""
    expect(themed_app.get_by_test_id("stMultiSelect")).to_have_count(MULTISELECT_COUNT)

    assert_snapshot(
        get_multiselect(themed_app, "multiselect 1"),
        name="st_multiselect-placeholder_help",
    )
    assert_snapshot(
        get_multiselect(themed_app, "multiselect 2"), name="st_multiselect-format_func"
    )
    assert_snapshot(
        get_multiselect(themed_app, "multiselect 3"), name="st_multiselect-empty_list"
    )
    assert_snapshot(
        get_multiselect(themed_app, "multiselect 4"),
        name="st_multiselect-initial_value",
    )
    assert_snapshot(
        get_multiselect(themed_app, "multiselect 5"), name="st_multiselect-long_values"
    )
    assert_snapshot(
        get_multiselect(themed_app, "multiselect 6"), name="st_multiselect-disabled"
    )
    assert_snapshot(
        get_multiselect(themed_app, "Hidden label"), name="st_multiselect-hidden_label"
    )
    assert_snapshot(
        get_multiselect(themed_app, "Collapsed label"),
        name="st_multiselect-collapsed_label",
    )
    # The other multiselect widgets do not need to be screenshot tested since they
    # don't have any visually interesting differences.
    assert_snapshot(
        get_multiselect(themed_app, "multiselect 12"),
        name="st_multiselect-narrow_column",
    )
    assert_snapshot(
        get_multiselect(themed_app, re.compile("^multiselect 13")),
        name="st_multiselect-markdown_label",
    )
    assert_snapshot(
        get_multiselect(themed_app, "multiselect 17 - show maxHeight"),
        name="st_multiselect-maxHeight",
    )
    assert_snapshot(
        get_multiselect(themed_app, "multiselect 18 (width=300px)"),
        name="st_multiselect-width_300px",
    )
    assert_snapshot(
        get_multiselect(themed_app, "multiselect 19 (width='stretch')"),
        name="st_multiselect-width_stretch",
    )


def test_help_tooltip_works(app: Page):
    element_with_help = get_multiselect(app, "multiselect 1")
    expect_help_tooltip(app, element_with_help, "Help text")


def test_multiselect_initial_value(app: Page):
    """Should show the correct initial values."""
    expect_text(app, "value 1: []")
    expect_text(app, "value 2: []")
    expect_text(app, "value 3: []")
    expect_text(app, "value 4: ['tea', 'water']")
    expect_text(app, "value 5: []")
    expect_text(app, "value 6: []")
    expect_text(app, "value 7: []")
    expect_text(app, "value 8: []")
    expect_text(app, "value 9: []")
    expect_text(app, "value 10: []")
    expect_text(app, "value 11: []")
    expect_text(app, "multiselect changed: False")
    expect_text(app, "value 12: ['A long option']")
    expect_text(app, "value 14: []")
    expect_text(app, "value 15: ['apple', 'orange']")
    expect_text(app, "value 16: []")


def test_multiselect_clear_all(app: Page):
    """Should clear all options when clicking clear all."""
    select_for_multiselect(app, "multiselect 2", "Female", True)
    get_multiselect(app, "multiselect 2").locator(
        '[role="button"][aria-label="Clear all"]'
    ).first.click()
    expect_text(app, "value 2: []")


def test_multiselect_show_values_in_dropdown(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Screenshot test to check that values are shown in dropdown."""
    multiselect_elem = get_multiselect(app, "multiselect 1")
    multiselect_elem.locator("input").click()
    wait_for_app_run(app)
    dropdown_elements = app.locator("li")
    expect(dropdown_elements).to_have_count(2)
    assert_snapshot(
        dropdown_elements.filter(has_text="male").first,
        name="st_multiselect-dropdown_0",
    )
    assert_snapshot(
        dropdown_elements.filter(has_text="female").first,
        name="st_multiselect-dropdown_1",
    )


def test_multiselect_long_values_in_dropdown(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Should show long values correctly (with ellipses) in the dropdown menu."""
    multiselect_elem = get_multiselect(app, "multiselect 5")
    multiselect_elem.locator("input").click()
    wait_for_app_run(app)
    dropdown_elems = app.locator("li").all()
    for idx, el in enumerate(dropdown_elems):
        assert_snapshot(el, name="st_multiselect-dropdown_long_label_" + str(idx))


def test_multiselect_long_values_in_narrow_column(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Should show long values correctly (with ellipses) when in narrow column
    widths.
    """
    multiselect_elem = get_multiselect(app, "multiselect 12")
    wait_for_app_run(app)
    # Wait for list items to be loaded in
    app.locator("li").all()
    assert_snapshot(multiselect_elem, name="st_multiselect-dropdown_narrow_column")


def test_multiselect_register_callback(app: Page):
    """Should call the callback when an option is selected."""
    _get_multiselect_input(app, "multiselect 11").click()
    app.locator("li").first.click()
    expect_text(app, "value 11: ['male']")
    expect_text(app, "multiselect changed: True")


def test_multiselect_max_selections_form(app: Page):
    """Should apply max selections when used in form."""
    select_for_multiselect(app, "multiselect 10", "male", False)
    expect(app.locator("li")).to_have_text(
        "You can only select up to 1 option. Remove an option first.",
        use_inner_text=True,
    )


def test_multiselect_max_selections_1(app: Page):
    """Should show the correct text when maxSelections is reached and closing after
    selecting.
    """
    select_for_multiselect(app, "multiselect 9", "male", True)
    get_multiselect(app, "multiselect 9").click()
    expect(app.locator("li")).to_have_text(
        "You can only select up to 1 option. Remove an option first.",
        use_inner_text=True,
    )


def test_multiselect_max_selections_2(app: Page):
    """Should show the correct text when maxSelections is reached and not closing after
    selecting.
    """
    select_for_multiselect(app, "multiselect 9", "male", False)
    expect(app.locator("li")).to_have_text(
        "You can only select up to 1 option. Remove an option first.",
        use_inner_text=True,
    )


def test_multiselect_valid_options(app: Page):
    """Should allow selections when there are valid options."""
    expect(get_multiselect(app, "multiselect 1")).to_have_text(
        "multiselect 1\n\nPlease select", use_inner_text=True
    )


def test_multiselect_no_valid_options(app: Page):
    """Should show that their are no options."""
    expect(get_multiselect(app, "multiselect 3")).to_have_text(
        "multiselect 3\n\nNo options to select", use_inner_text=True
    )


def test_multiselect_single_selection(app: Page, assert_snapshot: ImageCompareFunction):
    """Should allow selections."""
    select_for_multiselect(app, "multiselect 2", "Female", True)
    expect(get_multiselect(app, "multiselect 2").locator("span").nth(1)).to_have_text(
        "Female", use_inner_text=True
    )
    assert_snapshot(
        get_multiselect(app, "multiselect 2"), name="st_multiselect-selection"
    )
    expect_text(app, "value 2: ['female']")


def test_multiselect_deselect_option(app: Page):
    """Should deselect an option when deselecting it."""
    select_for_multiselect(app, "multiselect 2", "Female", True)
    select_for_multiselect(app, "multiselect 2", "Male", True)
    del_from_multiselect(app, "multiselect 2", "Female")
    expect_text(app, "value 2: ['male']")


def test_multiselect_option_over_max_selections(app: Page):
    """Should show an error when more than max_selections got selected."""
    click_checkbox(app, "set_multiselect_9")
    expect(app.get_by_test_id("stException")).to_contain_text(
        "Multiselect has 2 options selected but max_selections is set to 1"
    )


def test_multiselect_double_selection(app: Page):
    """Should allow multiple selections."""
    select_for_multiselect(app, "multiselect 2", "Female", True)
    select_for_multiselect(app, "multiselect 2", "Male", True)
    expect_text(app, "value 2: ['female', 'male']")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stMultiSelect")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "multiselect 9")).to_be_visible()


def test_dynamic_multiselect_props(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the multiselect can be updated dynamically while keeping the state."""
    dynamic_ms = get_element_by_key(app, "dynamic_multiselect_with_key")
    expect(dynamic_ms).to_be_visible()

    # Initial state and selection
    expect(dynamic_ms).to_contain_text("Initial dynamic multiselect")
    expect_prefixed_markdown(app, "Initial multiselect value:", "['apple']")
    assert_snapshot(dynamic_ms, name="st_multiselect-dynamic_initial")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_ms, "initial help")

    # Add an item to ensure state exists
    input_el = dynamic_ms.locator("input").first
    input_el.type("banana")
    app.keyboard.press("Enter")
    wait_for_app_run(app)

    expect_prefixed_markdown(app, "Initial multiselect value:", "['apple', 'banana']")

    # Click the toggle to update the multiselect props
    click_toggle(app, "Update multiselect props")

    # new multiselect is visible:
    expect(dynamic_ms).to_contain_text("Updated dynamic multiselect")

    # Ensure updated widget shows and state is preserved
    expect(dynamic_ms).to_contain_text("Updated dynamic multiselect")
    # Ensure the previously entered value remains visible
    expect_prefixed_markdown(app, "Updated multiselect value:", "['apple', 'banana']")

    dynamic_ms.scroll_into_view_if_needed()
    assert_snapshot(dynamic_ms, name="st_multiselect-dynamic_updated")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_ms, "updated help")

    # Type something different and submit
    input_el.type("orange")
    input_el.press("Enter")
    wait_for_app_run(app)
    expect_prefixed_markdown(
        app, "Updated multiselect value:", "['apple', 'banana', 'orange']"
    )


def test_multiselect_accept_new_options(app: Page):
    """Should allow adding new options when accept_new_options is True and respect
    max_selections.
    """
    # Get the last multiselect (index 13)
    multiselect_elem = get_multiselect(app, "multiselect 14 - accept new options")

    # Click to open dropdown
    multiselect_elem.locator("input").click()

    # Type and add new option "mango"
    input_elem = multiselect_elem.locator("input")
    input_elem.fill("mango")
    input_elem.press("Enter")
    wait_for_app_run(app)

    # Type and add another option "grape"
    input_elem.fill("grape")
    input_elem.press("Enter")
    wait_for_app_run(app)

    # Add a third option from original options
    multiselect_elem.locator("input").click()
    options_list = app.locator("li")
    expect(options_list).to_have_count(4)
    options_list.filter(has_text="apple").click()
    wait_for_app_run(app)

    # Verify three options were added successfully
    expect_text(app, "value 14: ['mango', 'grape', 'apple']")
    # Verify that format_func was applied to original option but not to the dynamically
    # added option
    expect(
        multiselect_elem.get_by_role("button").get_by_text("APPLE", exact=True)
    ).to_be_visible()
    expect(
        multiselect_elem.get_by_role("button").get_by_text("grape", exact=True)
    ).to_be_visible()

    # Try to add a fourth option - should be prevented by max_selections
    multiselect_elem.locator("input").click()
    expect(app.locator("li")).to_have_text(
        "You can only select up to 3 options. Remove an option first.",
        use_inner_text=True,
    )
    # Type and add another option "berries" - this should not be added
    input_elem.fill("berries")
    input_elem.press("Enter")
    wait_for_app_run(app)
    # Verify that this option was not added as it would have exceeded max_selections
    expect_text(app, "value 14: ['mango', 'grape', 'apple']")

    # Remove one option
    del_from_multiselect(app, "multiselect 14 - accept new options", "mango")

    # Verify we can add another option after removing one
    multiselect_elem.locator("input").click()
    input_elem.fill("kiwi")
    input_elem.press("Enter")
    wait_for_app_run(app)

    # Verify final selections are correct
    expect_text(app, "value 14: ['grape', 'apple', 'kiwi']")


def test_multiselect_preset_session_state(app: Page):
    """Should display values from session_state."""
    # Check the initial values from session_state
    expect_text(app, "value 15: ['apple', 'orange']")
    multiselect_elem = get_multiselect(app, "multiselect 15 - session_state values")
    selections_button = multiselect_elem.locator('[data-baseweb="tag"]')
    expect(selections_button).to_have_count(2)
    expect(selections_button.get_by_text("apple")).to_be_visible()
    expect(selections_button.get_by_text("orange")).to_be_visible()


def test_multiselect_empty_options_with_accept_new_options(app: Page):
    """Should allow adding new options when options list is empty but accept_new_options is True."""
    # Get the multiselect with empty options but accept_new_options=True (index 15)
    multiselect_elem = get_multiselect(
        app, "multiselect 16 - empty options with accept_new_options"
    )

    # Verify the initial placeholder shows "Add options" (frontend now handles default placeholders)
    expect(multiselect_elem).to_contain_text("Add options")

    # Click to open input field
    multiselect_elem.locator("input").click()

    # Type and add new option "strawberry"
    input_elem = multiselect_elem.locator("input")
    input_elem.fill("strawberry")
    input_elem.press("Enter")
    wait_for_app_run(app)

    # Type and add another option "blueberry"
    input_elem.fill("blueberry")
    input_elem.press("Enter")
    wait_for_app_run(app)

    # Verify options were added successfully
    expect_text(app, "value 16: ['strawberry', 'blueberry']")

    # Verify the selections are visible in the UI
    selections_button = multiselect_elem.locator('[data-baseweb="tag"]')
    expect(selections_button).to_have_count(2)
    expect(selections_button.get_by_text("strawberry")).to_be_visible()
    expect(selections_button.get_by_text("blueberry")).to_be_visible()

    # Remove one option
    del_from_multiselect(
        app, "multiselect 16 - empty options with accept_new_options", "strawberry"
    )

    # Verify one option was removed
    expect_text(app, "value 16: ['blueberry']")


def test_multiselect_empty_options_disabled_when_no_accept_new(app: Page):
    """Should show 'No options to select' placeholder and be disabled when empty and accept_new_options=False."""
    # Get multiselect 3 (index 2) which has empty options and accept_new_options=False (default)
    multiselect_elem = get_multiselect(app, "multiselect 3")

    # Verify the placeholder shows "No options to select"
    expect(multiselect_elem).to_contain_text("No options to select")

    # Verify the input field is disabled
    input_elem = multiselect_elem.locator("input")
    expect(input_elem).to_be_disabled()

    # Verify clicking on the multiselect doesn't open a dropdown
    multiselect_elem.click()
    wait_for_app_run(app)

    # Verify no dropdown options appear
    dropdown_options = app.locator("li[role='option']")
    expect(dropdown_options).to_have_count(0)

    # Verify the widget value remains empty
    expect_text(app, "value 3: []")
