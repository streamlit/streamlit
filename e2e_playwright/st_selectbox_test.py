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


def test_selectbox_widget_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the selectbox widgets are correctly rendered via screenshot matching."""
    selectbox_widgets = themed_app.get_by_test_id("stSelectbox")
    expect(selectbox_widgets).to_have_count(12)

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


def test_selectbox_has_correct_initial_values(app: Page):
    """Test that st.selectbox returns the correct initial values."""
    markdown_elements = app.get_by_test_id("stMarkdown")
    expect(markdown_elements).to_have_count(13)

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
