# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from playwright.sync_api import Locator, Page, expect

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
    expect_canvas_to_be_stable,
    expect_canvas_to_be_visible,
    get_open_cell_overlay,
    select_row,
)


def _get_editor(app: Page, key: str) -> Locator:
    """Helper to get a data editor element by key."""
    data_editor = get_element_by_key(app, key).get_by_test_id("stDataFrame").first
    expect(data_editor).to_be_visible()
    return data_editor


def test_data_editor_supports_various_configurations(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Screenshot test that st.data_editor supports various configuration options."""
    # The dataframe component might require a bit more time for rendering the canvas
    app.wait_for_timeout(500)

    assert_snapshot(
        _get_editor(app, "disabled-all"), name="st_data_editor-disabled_all_columns"
    )
    assert_snapshot(
        _get_editor(app, "disabled-two"), name="st_data_editor-disabled_two_columns"
    )
    assert_snapshot(_get_editor(app, "hide-index"), name="st_data_editor-hide_index")
    assert_snapshot(_get_editor(app, "show-index"), name="st_data_editor-show_index")
    assert_snapshot(
        _get_editor(app, "column-order"), name="st_data_editor-custom_column_order"
    )
    assert_snapshot(
        _get_editor(app, "column-labels"), name="st_data_editor-column_labels"
    )
    assert_snapshot(
        _get_editor(app, "hide-columns"), name="st_data_editor-hide_columns"
    )
    assert_snapshot(
        _get_editor(app, "column-width"), name="st_data_editor-set_column_width"
    )
    assert_snapshot(
        _get_editor(app, "help-tooltips"), name="st_data_editor-help_tooltips"
    )
    assert_snapshot(_get_editor(app, "text-column"), name="st_data_editor-text_column")
    assert_snapshot(
        _get_editor(app, "number-column"), name="st_data_editor-number_column"
    )
    assert_snapshot(
        _get_editor(app, "checkbox-column"), name="st_data_editor-checkbox_column"
    )
    assert_snapshot(
        _get_editor(app, "selectbox-column"), name="st_data_editor-selectbox_column"
    )
    assert_snapshot(_get_editor(app, "link-column"), name="st_data_editor-link_column")
    assert_snapshot(
        _get_editor(app, "datetime-column"), name="st_data_editor-datetime_column"
    )
    assert_snapshot(_get_editor(app, "date-column"), name="st_data_editor-date_column")
    assert_snapshot(_get_editor(app, "time-column"), name="st_data_editor-time_column")
    assert_snapshot(
        _get_editor(app, "progress-column"), name="st_data_editor-progress_column"
    )
    assert_snapshot(_get_editor(app, "list-column"), name="st_data_editor-list_column")
    assert_snapshot(
        _get_editor(app, "bar-chart-column"), name="st_data_editor-bar_chart_column"
    )
    assert_snapshot(
        _get_editor(app, "line-chart-column"), name="st_data_editor-line_chart_column"
    )
    assert_snapshot(
        _get_editor(app, "image-column"), name="st_data_editor-image_column"
    )
    assert_snapshot(
        _get_editor(app, "multiselect-column"), name="st_data_editor-multiselect_column"
    )
    assert_snapshot(
        _get_editor(app, "missing-placeholder"),
        name="st_data_editor-missing_placeholder",
    )


def test_multiselect_cell_editing(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the multiselect cell can be edited."""
    multiselect_column_df = _get_editor(themed_app, "multiselect-column")
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
    multiselect_column_df = _get_editor(app, "multiselect-column")
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


def test_data_editor_add_only_mode(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that num_rows='add' mode only allows adding rows, not deleting."""
    add_only_editor = (
        get_element_by_key(app, "add-only-editor").get_by_test_id("stDataFrame").first
    )
    expect(add_only_editor).to_be_visible()
    expect_canvas_to_be_stable(add_only_editor)

    toolbar = add_only_editor.get_by_test_id("stElementToolbar")

    # Initial height with 2 rows
    initial_height = add_only_editor.evaluate("el => el.offsetHeight")

    # Hover to activate toolbar
    add_only_editor.hover()
    expect(toolbar).to_have_css("opacity", "1")

    # Verify "Add row" button exists
    add_row_button = toolbar.get_by_test_id("stElementToolbarButton").get_by_label(
        "Add row"
    )
    expect(add_row_button).to_be_visible()

    # Add a row via toolbar
    add_row_button.click()
    wait_for_app_run(app)

    # Verify height increased (row was added)
    new_height = add_only_editor.evaluate("el => el.offsetHeight")
    assert new_height > initial_height, "Height should increase after adding a row"

    # Take a snapshot to check if the row was added:
    assert_snapshot(add_only_editor, name="st_data_editor-add_only_mode")

    # Now select a row and verify delete button is NOT shown
    select_row(add_only_editor, 1)

    # The toolbar should NOT have a delete button in add-only mode
    delete_button = toolbar.get_by_test_id("stElementToolbarButton").get_by_label(
        "Delete row(s)"
    )
    expect(delete_button).not_to_be_visible()


def test_data_editor_delete_only_mode(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that num_rows='delete' mode only allows deleting rows, not adding."""
    delete_only_editor = (
        get_element_by_key(app, "delete-only-editor")
        .get_by_test_id("stDataFrame")
        .first
    )
    expect(delete_only_editor).to_be_visible()
    expect_canvas_to_be_stable(delete_only_editor)

    toolbar = delete_only_editor.get_by_test_id("stElementToolbar")

    # Initial height with 3 rows
    initial_height = delete_only_editor.evaluate("el => el.offsetHeight")

    # Hover to activate toolbar
    delete_only_editor.hover()
    expect(toolbar).to_have_css("opacity", "1")

    # Verify "Add row" button does NOT exist in delete-only mode
    add_row_button = toolbar.get_by_test_id("stElementToolbarButton").get_by_label(
        "Add row"
    )
    expect(add_row_button).not_to_be_visible()

    # Select a row
    select_row(delete_only_editor, 1)

    # Verify "Delete row(s)" button exists
    delete_button = toolbar.get_by_test_id("stElementToolbarButton").get_by_label(
        "Delete row(s)"
    )
    expect(delete_button).to_be_visible()

    # Delete the row
    delete_button.click()
    wait_for_app_run(app)

    # Verify height decreased (row was deleted)
    new_height = delete_only_editor.evaluate("el => el.offsetHeight")
    assert new_height < initial_height, "Height should decrease after deleting a row"

    assert_snapshot(delete_only_editor, name="st_data_editor-delete_only_mode")


def test_data_editor_dynamic_mode(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that num_rows='dynamic' mode allows both adding and deleting rows."""
    dynamic_editor = (
        get_element_by_key(app, "dynamic-editor").get_by_test_id("stDataFrame").first
    )
    expect(dynamic_editor).to_be_visible()
    expect_canvas_to_be_stable(dynamic_editor)

    toolbar = dynamic_editor.get_by_test_id("stElementToolbar")

    # Initial height with 2 rows
    initial_height = dynamic_editor.evaluate("el => el.offsetHeight")

    # Hover to activate toolbar
    dynamic_editor.hover()
    expect(toolbar).to_have_css("opacity", "1")

    # Verify "Add row" button exists in dynamic mode
    add_row_button = toolbar.get_by_test_id("stElementToolbarButton").get_by_label(
        "Add row"
    )
    expect(add_row_button).to_be_visible()

    # Add a row via toolbar
    add_row_button.click()
    wait_for_app_run(app)

    # Verify height increased (row was added)
    height_after_add = dynamic_editor.evaluate("el => el.offsetHeight")
    assert height_after_add > initial_height, (
        "Height should increase after adding a row"
    )

    # Take a snapshot after adding a row
    assert_snapshot(dynamic_editor, name="st_data_editor-dynamic_mode_after_add")

    # Now select a row and verify delete button IS shown (unlike add-only mode)
    select_row(dynamic_editor, 1)

    # Verify "Delete row(s)" button exists in dynamic mode
    delete_button = toolbar.get_by_test_id("stElementToolbarButton").get_by_label(
        "Delete row(s)"
    )
    expect(delete_button).to_be_visible()

    # Delete the row
    delete_button.click()
    wait_for_app_run(app)

    # Verify height decreased (row was deleted)
    height_after_delete = dynamic_editor.evaluate("el => el.offsetHeight")
    assert height_after_delete < height_after_add, (
        "Height should decrease after deleting a row"
    )

    assert_snapshot(dynamic_editor, name="st_data_editor-dynamic_mode_after_delete")


def test_editing_empty_column_returns_scalar_not_list(app: Page):
    """Test that editing and adding rows in empty (None-only) columns returns scalars.

    Regression test for GitHub issues #13305 and #13307 where editing cells in
    columns that start with None values would incorrectly wrap the edited value
    in a list (e.g., entering "42" would return [42] instead of 42).

    The app outputs the dataframe as str(.to_dict()) for deterministic verification.
    """
    data_editor = _get_editor(app, "empty-column-editor")
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
