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
    click_checkbox,
    expect_help_tooltip,
    get_element_by_key,
)

MULTISELECT_COUNT = 19


def select_for_kth_multiselect(
    page: Page, option_text: str, k: int, close_after_selecting: bool
) -> None:
    """Select an option from a multiselect widget.

    Parameters
    ----------
    page : Page
        The playwright page to use.
    option_text : str
        The text of the option to select.
    k : int
        The index of the multiselect widget to select from.
    close_after_selecting : bool
        Whether to close the dropdown after selecting the option.
    """

    multiselect_elem = page.get_by_test_id("stMultiSelect").nth(k)
    multiselect_elem.locator("input").click()
    page.locator("li").filter(has_text=option_text).first.click()
    if close_after_selecting:
        page.keyboard.press("Escape")
    wait_for_app_run(page)


def del_from_kth_multiselect(page: Page, option_text: str, k: int):
    """Delete an option from a multiselect widget.

    Parameters
    ----------
    page : Page
        The playwright page to use.
    option_text : str
        The text of the option to delete.
    k : int
        The index of the multiselect widget to delete from.
    """
    multiselect_elem = page.get_by_test_id("stMultiSelect").nth(k)
    multiselect_elem.locator(
        f'span[data-baseweb="tag"] span[title="{option_text}"] + span[role="presentation"]'
    ).first.click()


def test_multiselect_on_load(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Should show widgets correctly when loaded."""
    multiselect_elements = themed_app.get_by_test_id("stMultiSelect")
    expect(multiselect_elements).to_have_count(MULTISELECT_COUNT)

    assert_snapshot(multiselect_elements.nth(0), name="st_multiselect-placeholder_help")
    assert_snapshot(multiselect_elements.nth(1), name="st_multiselect-format_func")
    assert_snapshot(multiselect_elements.nth(2), name="st_multiselect-empty_list")
    assert_snapshot(multiselect_elements.nth(3), name="st_multiselect-initial_value")
    assert_snapshot(multiselect_elements.nth(4), name="st_multiselect-long_values")
    assert_snapshot(multiselect_elements.nth(5), name="st_multiselect-disabled")
    assert_snapshot(multiselect_elements.nth(6), name="st_multiselect-hidden_label")
    assert_snapshot(multiselect_elements.nth(7), name="st_multiselect-collapsed_label")
    # The other multiselect widgets do not need to be screenshot tested since they
    # don't have any visually interesting differences.
    assert_snapshot(multiselect_elements.nth(11), name="st_multiselect-narrow_column")
    assert_snapshot(multiselect_elements.nth(12), name="st_multiselect-markdown_label")
    assert_snapshot(multiselect_elements.nth(16), name="st_multiselect-maxHeight")
    assert_snapshot(multiselect_elements.nth(17), name="st_multiselect-width_300px")
    assert_snapshot(multiselect_elements.nth(18), name="st_multiselect-width_stretch")


def test_help_tooltip_works(app: Page):
    element_with_help = app.get_by_test_id("stMultiSelect").nth(0)
    expect_help_tooltip(app, element_with_help, "Help text")


def test_multiselect_initial_value(app: Page):
    """Should show the correct initial values."""
    text_elements = app.get_by_test_id("stText")
    # -3 because the last three multiselects do not have accompanying text elements
    expect(text_elements).to_have_count(MULTISELECT_COUNT - 3)

    expected = [
        "value 1: []",
        "value 2: []",
        "value 3: []",
        "value 4: ['tea', 'water']",
        "value 5: []",
        "value 6: []",
        "value 7: []",
        "value 8: []",
        "value 9: []",
        "value 10: []",
        "value 11: []",
        "multiselect changed: False",
        "value 12: ['A long option']",
        "value 14: []",
        "value 15: ['apple', 'orange']",
        "value 16: []",
    ]

    for text_element, expected_text in zip(text_elements.all(), expected):
        expect(text_element).to_have_text(expected_text, use_inner_text=True)


def test_multiselect_clear_all(app: Page):
    """Should clear all options when clicking clear all."""
    select_for_kth_multiselect(app, "Female", 1, True)
    app.locator('.stMultiSelect [role="button"][aria-label="Clear all"]').first.click()
    expect(app.get_by_test_id("stText").nth(1)).to_have_text("value 2: []")


def test_multiselect_show_values_in_dropdown(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Screenshot test to check that values are shown in dropdown."""
    multiselect_elem = app.get_by_test_id("stMultiSelect").nth(0)
    multiselect_elem.locator("input").click()
    wait_for_app_run(app)
    dropdown_elements = app.locator("li")
    expect(dropdown_elements).to_have_count(2)
    assert_snapshot(dropdown_elements.nth(0), name="st_multiselect-dropdown_0")
    assert_snapshot(dropdown_elements.nth(1), name="st_multiselect-dropdown_1")


def test_multiselect_long_values_in_dropdown(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Should show long values correctly (with ellipses) in the dropdown menu."""
    multiselect_elem = app.get_by_test_id("stMultiSelect").nth(4)
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
    multiselect_elem = app.get_by_test_id("stMultiSelect").nth(11)
    wait_for_app_run(app)
    # Wait for list items to be loaded in
    app.locator("li").all()
    assert_snapshot(multiselect_elem, name="st_multiselect-dropdown_narrow_column")


def test_multiselect_register_callback(app: Page):
    """Should call the callback when an option is selected."""
    app.get_by_test_id("stMultiSelect").nth(10).locator("input").click()
    app.locator("li").first.click()
    expect(app.get_by_test_id("stText").nth(10)).to_have_text("value 11: ['male']")
    expect(app.get_by_test_id("stText").nth(11)).to_have_text(
        "multiselect changed: True"
    )


def test_multiselect_max_selections_form(app: Page):
    """Should apply max selections when used in form."""
    select_for_kth_multiselect(app, "male", 8, False)
    expect(app.locator("li")).to_have_text(
        "You can only select up to 1 option. Remove an option first.",
        use_inner_text=True,
    )


def test_multiselect_max_selections_1(app: Page):
    """Should show the correct text when maxSelections is reached and closing after
    selecting.
    """
    select_for_kth_multiselect(app, "male", 9, True)
    app.get_by_test_id("stMultiSelect").nth(9).click()
    expect(app.locator("li")).to_have_text(
        "You can only select up to 1 option. Remove an option first.",
        use_inner_text=True,
    )


def test_multiselect_max_selections_2(app: Page):
    """Should show the correct text when maxSelections is reached and not closing after
    selecting.
    """
    select_for_kth_multiselect(app, "male", 9, False)
    expect(app.locator("li")).to_have_text(
        "You can only select up to 1 option. Remove an option first.",
        use_inner_text=True,
    )


def test_multiselect_valid_options(app: Page):
    """Should allow selections when there are valid options."""
    expect(app.get_by_test_id("stMultiSelect").first).to_have_text(
        "multiselect 1\n\nPlease select", use_inner_text=True
    )


def test_multiselect_no_valid_options(app: Page):
    """Should show that their are no options."""
    expect(app.get_by_test_id("stMultiSelect").nth(2)).to_have_text(
        "multiselect 3\n\nNo options to select", use_inner_text=True
    )


def test_multiselect_single_selection(app: Page, assert_snapshot: ImageCompareFunction):
    """Should allow selections."""
    select_for_kth_multiselect(app, "Female", 1, True)
    expect(app.get_by_test_id("stMultiSelect").locator("span").nth(1)).to_have_text(
        "Female", use_inner_text=True
    )
    assert_snapshot(
        app.get_by_test_id("stMultiSelect").nth(1), name="st_multiselect-selection"
    )
    expect(app.get_by_test_id("stText").nth(1)).to_have_text(
        "value 2: ['female']", use_inner_text=True
    )


def test_multiselect_deselect_option(app: Page):
    """Should deselect an option when deselecting it."""
    select_for_kth_multiselect(app, "Female", 1, True)
    select_for_kth_multiselect(app, "Male", 1, True)
    del_from_kth_multiselect(app, "Female", 1)
    expect(app.get_by_test_id("stText").nth(1)).to_have_text("value 2: ['male']")


def test_multiselect_option_over_max_selections(app: Page):
    """Should show an error when more than max_selections got selected."""
    click_checkbox(app, "set_multiselect_9")
    expect(app.get_by_test_id("stException")).to_contain_text(
        "Multiselect has 2 options selected but max_selections is set to 1"
    )


def test_multiselect_double_selection(app: Page):
    """Should allow multiple selections."""
    select_for_kth_multiselect(app, "Female", 1, True)
    select_for_kth_multiselect(app, "Male", 1, True)
    expect(app.get_by_test_id("stText").nth(1)).to_have_text(
        "value 2: ['female', 'male']"
    )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stMultiSelect")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "multiselect 9")).to_be_visible()


def test_multiselect_accept_new_options(app: Page):
    """Should allow adding new options when accept_new_options is True and respect
    max_selections.
    """
    # Get the last multiselect (index 13)
    multiselect_elem = app.get_by_test_id("stMultiSelect").nth(13)

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
    expect(app.get_by_test_id("stText").nth(13)).to_have_text(
        "value 14: ['mango', 'grape', 'apple']"
    )
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
    expect(app.get_by_test_id("stText").nth(13)).to_have_text(
        "value 14: ['mango', 'grape', 'apple']"
    )

    # Remove one option
    del_from_kth_multiselect(app, "mango", 13)
    wait_for_app_run(app)

    # Verify we can add another option after removing one
    multiselect_elem.locator("input").click()
    input_elem.fill("kiwi")
    input_elem.press("Enter")
    wait_for_app_run(app)

    # Verify final selections are correct
    expect(app.get_by_test_id("stText").nth(13)).to_have_text(
        "value 14: ['grape', 'apple', 'kiwi']"
    )


def test_multiselect_preset_session_state(app: Page):
    """Should display values from session_state."""
    # Check the initial values from session_state
    expect(app.get_by_test_id("stText").nth(14)).to_have_text(
        "value 15: ['apple', 'orange']"
    )
    multiselect_elem = app.get_by_test_id("stMultiSelect").nth(14)
    selections_button = multiselect_elem.locator('[data-baseweb="tag"]')
    expect(selections_button).to_have_count(2)
    expect(selections_button.get_by_text("apple")).to_be_visible()
    expect(selections_button.get_by_text("orange")).to_be_visible()


def test_multiselect_empty_options_with_accept_new_options(app: Page):
    """Should allow adding new options when options list is empty but accept_new_options is True."""
    # Get the multiselect with empty options but accept_new_options=True (index 15)
    multiselect_elem = app.get_by_test_id("stMultiSelect").nth(15)

    # Verify the initial placeholder shows "Add options"
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
    expect(app.get_by_test_id("stText").nth(15)).to_have_text(
        "value 16: ['strawberry', 'blueberry']"
    )

    # Verify the selections are visible in the UI
    selections_button = multiselect_elem.locator('[data-baseweb="tag"]')
    expect(selections_button).to_have_count(2)
    expect(selections_button.get_by_text("strawberry")).to_be_visible()
    expect(selections_button.get_by_text("blueberry")).to_be_visible()

    # Remove one option
    del_from_kth_multiselect(app, "strawberry", 15)
    wait_for_app_run(app)

    # Verify one option was removed
    expect(app.get_by_test_id("stText").nth(15)).to_have_text("value 16: ['blueberry']")
