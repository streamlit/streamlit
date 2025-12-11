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
    expect_prefixed_markdown,
    get_element_by_key,
    reset_focus,
)
from e2e_playwright.shared.dataframe_utils import (
    click_on_cell,
    edit_cell_value,
    expect_canvas_to_be_visible,
    get_open_cell_overlay,
)

_NUM_DATAFRAME_ELEMENTS = 24


def test_data_editor_supports_various_configurations(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Screenshot test that st.data_editor supports various configuration options."""
    # The dataframe config test is already testing with themed apps, so using the
    # default theme only is fine here.
    elements = app.get_by_test_id("stDataFrame")
    expect(elements).to_have_count(_NUM_DATAFRAME_ELEMENTS)

    # The dataframe component might require a bit more time for rendering the canvas
    app.wait_for_timeout(500)

    assert_snapshot(elements.nth(0), name="st_data_editor-disabled_all_columns")
    assert_snapshot(elements.nth(1), name="st_data_editor-disabled_two_columns")
    assert_snapshot(elements.nth(2), name="st_data_editor-hide_index")
    assert_snapshot(elements.nth(3), name="st_data_editor-show_index")
    assert_snapshot(elements.nth(4), name="st_data_editor-custom_column_order")
    assert_snapshot(elements.nth(5), name="st_data_editor-column_labels")
    assert_snapshot(elements.nth(6), name="st_data_editor-hide_columns")
    assert_snapshot(elements.nth(7), name="st_data_editor-set_column_width")
    assert_snapshot(elements.nth(8), name="st_data_editor-help_tooltips")
    assert_snapshot(elements.nth(9), name="st_data_editor-text_column")
    assert_snapshot(elements.nth(10), name="st_data_editor-number_column")
    assert_snapshot(elements.nth(11), name="st_data_editor-checkbox_column")
    assert_snapshot(elements.nth(12), name="st_data_editor-selectbox_column")
    assert_snapshot(elements.nth(13), name="st_data_editor-link_column")
    assert_snapshot(elements.nth(14), name="st_data_editor-datetime_column")
    assert_snapshot(elements.nth(15), name="st_data_editor-date_column")
    assert_snapshot(elements.nth(16), name="st_data_editor-time_column")
    assert_snapshot(elements.nth(17), name="st_data_editor-progress_column")
    assert_snapshot(elements.nth(18), name="st_data_editor-list_column")
    assert_snapshot(elements.nth(19), name="st_data_editor-bar_chart_column")
    assert_snapshot(elements.nth(20), name="st_data_editor-line_chart_column")
    assert_snapshot(elements.nth(21), name="st_data_editor-image_column")
    assert_snapshot(elements.nth(22), name="st_data_editor-multiselect_column")
    assert_snapshot(elements.nth(23), name="st_data_editor-missing_placeholder")


def test_multiselect_cell_editing(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the multiselect cell can be edited."""
    multiselect_column_df = themed_app.get_by_test_id("stDataFrame").nth(22)
    expect_canvas_to_be_visible(multiselect_column_df)

    # Click on the first cell of the list column
    click_on_cell(multiselect_column_df, 1, 0, double_click=True, column_width="medium")

    # Get the cell overlay and check if it looks correct:
    cell_overlay = get_open_cell_overlay(themed_app)
    expect(cell_overlay).to_contain_text("Exploration")
    assert_snapshot(cell_overlay, name="st_data_editor-multiselect_col_editor")

    # Change the value
    cell_overlay.locator("input").fill("geography")
    # Press Enter to insert the text as list value:
    themed_app.keyboard.press("Enter")
    expect(cell_overlay).to_contain_text("Geography")

    # Press Enter again to apply the change to the dataframe:
    themed_app.keyboard.press("Enter")
    # Reset focus to ensure that the overlay is closed:
    reset_focus(themed_app)
    wait_for_app_run(themed_app)

    # Check if that the value was submitted
    expect_prefixed_markdown(
        themed_app, "Multiselect column return:", "geography", exact_match=False
    )


def test_multiselect_cell_editing_with_new_options(app: Page):
    """Test that the multiselect allows adding new values when accept_new_options is True."""
    multiselect_column_df = app.get_by_test_id("stDataFrame").nth(22)
    expect_canvas_to_be_visible(multiselect_column_df)

    # Click on the first cell of the second multiselect column
    click_on_cell(multiselect_column_df, 1, 1, double_click=True, column_width="medium")

    # Get the cell overlay and check if it looks correct:
    cell_overlay = get_open_cell_overlay(app)
    expect(cell_overlay).to_contain_text("Option a")

    # Type in a new value:
    cell_overlay.locator("input").fill("new value")
    # Press Enter to insert the text as list value:
    app.keyboard.press("Enter")
    expect(cell_overlay).to_contain_text("new value")

    # Press Enter again to apply the change to the dataframe:
    app.keyboard.press("Enter")
    # Reset focus to ensure that the overlay is closed:
    reset_focus(app)
    wait_for_app_run(app)

    # Check if that the value was submitted
    expect_prefixed_markdown(
        app, "Multiselect column return:", "new value", exact_match=False
    )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stDataFrame")


def test_editing_empty_column_returns_scalar_not_list(app: Page):
    """Test that editing and adding rows in empty (None-only) columns returns scalars.

    Regression test for GitHub issues #13305 and #13307 where editing cells in
    columns that start with None values would incorrectly wrap the edited value
    in a list (e.g., entering "42" would return [42] instead of 42).

    The app outputs the dataframe as str(.to_dict()) for deterministic verification.
    """
    data_editor = (
        get_element_by_key(app, "empty-column-editor")
        .get_by_test_id("stDataFrame")
        .first
    )
    expect_canvas_to_be_visible(data_editor)

    # Test editing the number column (first column)
    click_on_cell(data_editor, 1, 0, double_click=True, column_width="medium")
    edit_cell_value(app, "42")

    # Verify the complete dict output with scalar value 42 (not [42])
    expect_prefixed_markdown(
        app,
        "Empty column result:",
        "{'number_col': {0: 42}, 'text_col': {0: None}}",
        exact_match=True,
    )

    # Test editing the text column (second column)
    click_on_cell(data_editor, 1, 1, double_click=True, column_width="medium")
    edit_cell_value(app, "hello")

    # Verify the complete dict output with scalar 'hello' (not ['hello'])
    expect_prefixed_markdown(
        app,
        "Empty column result:",
        "{'number_col': {0: 42}, 'text_col': {0: 'hello'}}",
        exact_match=True,
    )

    # Test adding a new row with values - should also return scalars
    toolbar = data_editor.get_by_test_id("stElementToolbar")
    data_editor.hover()
    expect(toolbar).to_have_css("opacity", "1")

    add_row_button = toolbar.get_by_test_id("stElementToolbarButton").get_by_label(
        "Add row"
    )
    add_row_button.click()
    wait_for_app_run(app)

    # Edit the new row's number column (row index 2)
    click_on_cell(data_editor, 2, 0, double_click=True, column_width="medium")
    edit_cell_value(app, "99")

    # Verify the complete dict output with new row scalar 99 (not [99])
    expect_prefixed_markdown(
        app,
        "Empty column result:",
        "{'number_col': {0: 42, 1: 99}, 'text_col': {0: 'hello', 1: None}}",
        exact_match=True,
    )
