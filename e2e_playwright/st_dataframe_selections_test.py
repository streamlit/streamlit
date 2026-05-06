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


import pytest
from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    COMMAND_KEY,
    click_button,
    click_form_button,
    expect_prefixed_markdown,
    get_element_by_key,
)
from e2e_playwright.shared.dataframe_utils import (
    calc_middle_cell_position,
    click_on_cell,
    expect_canvas_to_be_visible,
    open_column_menu,
    select_column,
    select_row,
    sort_column,
)


def _get_single_row_select_df(app: Page) -> Locator:
    return get_element_by_key(app, "single_row_select").get_by_test_id("stDataFrame")


def _get_single_row_required_select_df(app: Page) -> Locator:
    return get_element_by_key(app, "single_row_required_select").get_by_test_id(
        "stDataFrame"
    )


def _get_combined_row_col_select_df(app: Page) -> Locator:
    return get_element_by_key(app, "combined_row_col_select").get_by_test_id(
        "stDataFrame"
    )


def _get_single_column_select_df(app: Page) -> Locator:
    return get_element_by_key(app, "single_column_select").get_by_test_id("stDataFrame")


def _get_multi_row_select_df(app: Page) -> Locator:
    return get_element_by_key(app, "multi_row_select").get_by_test_id("stDataFrame")


def _get_multi_column_select_df(app: Page) -> Locator:
    return get_element_by_key(app, "multi_column_select").get_by_test_id("stDataFrame")


def _get_multi_row_and_column_select_df(app: Page) -> Locator:
    return get_element_by_key(app, "multi_row_multi_column_select").get_by_test_id(
        "stDataFrame"
    )


def _get_single_row_and_column_select_df(app: Page) -> Locator:
    return get_element_by_key(app, "single_row_single_column_select").get_by_test_id(
        "stDataFrame"
    )


def _get_in_form_df(app: Page) -> Locator:
    return get_element_by_key(app, "df_selection_in_form").get_by_test_id("stDataFrame")


def _get_callback_df(app: Page) -> Locator:
    return get_element_by_key(app, "df_selection").get_by_test_id("stDataFrame")


def _get_fragment_df(app: Page) -> Locator:
    return get_element_by_key(app, "inside_fragment").get_by_test_id("stDataFrame")


def _get_df_with_index(app: Page) -> Locator:
    return get_element_by_key(app, "with_index").get_by_test_id("stDataFrame")


def _get_single_cell_select_df(app: Page) -> Locator:
    return get_element_by_key(app, "single_cell_select").get_by_test_id("stDataFrame")


def _get_multi_cell_select_df(app: Page) -> Locator:
    return get_element_by_key(app, "multi_cell_select").get_by_test_id("stDataFrame")


def _get_multi_row_and_single_cell_select_df(app: Page) -> Locator:
    return get_element_by_key(app, "multi_row_single_cell_select").get_by_test_id(
        "stDataFrame"
    )


def _get_multi_row_column_and_cell_select_df(app: Page) -> Locator:
    return get_element_by_key(
        app, "multi_row_multi_column_multi_cell_select"
    ).get_by_test_id("stDataFrame")


def test_single_row_select(app: Page):
    canvas = _get_single_row_select_df(app)
    expect_canvas_to_be_visible(canvas)

    # select first row
    select_row(canvas, 1)
    wait_for_app_run(app)

    expected = "Dataframe single-row selection: {'selection': {'rows': [0], 'columns': [], 'cells': []}}"
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)

    select_row(canvas, 2)
    wait_for_app_run(app)
    expect_prefixed_markdown(
        app,
        "Dataframe single-row selection:",
        "{'selection': {'rows': [1], 'columns': [], 'cells': []}}",
    )


def test_single_row_select_with_sorted_column(app: Page):
    canvas = _get_single_row_select_df(app)
    expect_canvas_to_be_visible(canvas)

    # select first row
    select_row(canvas, 1)
    wait_for_app_run(app)
    # The dataframe is not sorted yet, so the first row is the first row:
    expected = "Dataframe single-row selection: {'selection': {'rows': [0], 'columns': [], 'cells': []}}"
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)

    # Sort the first column
    # this is expected to clear the previous row selection:
    sort_column(canvas, 1, has_row_marker_col=True)
    wait_for_app_run(app)

    # The dataframe selection should be cleared
    expected = "Dataframe single-row selection: {'selection': {'rows': [], 'columns': [], 'cells': []}}"
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)

    # select first row again:
    select_row(canvas, 1)
    wait_for_app_run(app)

    # The first row got selected, but the real numerical row index
    # should be different since the first column is sorted
    expected = "Dataframe single-row selection: {'selection': {'rows': [4], 'columns': [], 'cells': []}}"
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)


def test_single_row_required_selection(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test single-row-required mode: auto-selection, no clearing, selection change, and visual style."""
    canvas = _get_single_row_required_select_df(app)
    expect_canvas_to_be_visible(canvas)

    # On first load, the first row should be automatically selected
    expect_prefixed_markdown(
        app,
        "Dataframe single-row-required selection:",
        "{'selection': {'rows': [0], 'columns': [], 'cells': []}}",
        exact_match=True,
    )

    # Toolbar should NOT have the clear selection button (only 4 standard buttons)
    dataframe_toolbar = canvas.get_by_test_id("stElementToolbar")
    toolbar_buttons = dataframe_toolbar.get_by_test_id("stElementToolbarButton")
    expect(toolbar_buttons).to_have_count(4)
    expect(toolbar_buttons.get_by_label("Clear selection")).to_have_count(0)

    # Verify circle checkbox style (radio-like appearance) via snapshot
    canvas.scroll_into_view_if_needed()
    assert_snapshot(canvas, name="st_dataframe-single_row_required_selection")

    # Pressing Escape should NOT clear the selection
    canvas.click()  # Focus the canvas first
    app.keyboard.press("Escape")
    # glide-data-grid renders to canvas, so selection state isn't observable via DOM.
    # We need to give time for any potential state change to propagate before asserting.
    app.wait_for_timeout(200)
    expect_prefixed_markdown(
        app,
        "Dataframe single-row-required selection:",
        "{'selection': {'rows': [0], 'columns': [], 'cells': []}}",
        exact_match=True,
    )

    # Clicking on the already selected row should NOT deselect it
    select_row(canvas, 1)
    # glide-data-grid renders to canvas, so selection state isn't observable via DOM.
    # We need to give time for any potential state change to propagate before asserting.
    app.wait_for_timeout(200)
    expect_prefixed_markdown(
        app,
        "Dataframe single-row-required selection:",
        "{'selection': {'rows': [0], 'columns': [], 'cells': []}}",
        exact_match=True,
    )

    # Wait for glide-data-grid to fully sync the selection before changing it
    app.wait_for_timeout(250)

    # Clicking on a different row should change the selection
    select_row(canvas, 3)
    wait_for_app_run(app)
    expect_prefixed_markdown(
        app,
        "Dataframe single-row-required selection:",
        "{'selection': {'rows': [2], 'columns': [], 'cells': []}}",
        exact_match=True,
    )

    # Negative assertion: row 0 should no longer be selected
    selection_md = app.get_by_test_id("stMarkdown").filter(
        has_text="Dataframe single-row-required selection:"
    )
    expect(selection_md).not_to_contain_text("'rows': [0]")


def test_single_row_required_select_and_sort(app: Page):
    """Test that sorting preserves the row selection in single-row-required mode."""
    canvas = _get_single_row_required_select_df(app)
    expect_canvas_to_be_visible(canvas)

    # Row 0 should be auto-selected
    expect_prefixed_markdown(
        app,
        "Dataframe single-row-required selection:",
        "{'selection': {'rows': [0], 'columns': [], 'cells': []}}",
        exact_match=True,
    )

    # Sort the dataframe via the column header (ascending)
    sort_column(canvas, 1, has_row_marker_col=True)
    wait_for_app_run(app)

    # After sorting, the selection still reports the original row index (0)
    # because selections track original data rows, not display positions.
    expect_prefixed_markdown(
        app,
        "Dataframe single-row-required selection:",
        "{'selection': {'rows': [0], 'columns': [], 'cells': []}}",
        exact_match=True,
    )


def test_single_column_select(app: Page):
    canvas = _get_single_column_select_df(app)
    expect_canvas_to_be_visible(canvas)

    select_column(canvas, 1)
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Dataframe single-column selection:",
        "{'selection': {'rows': [], 'columns': ['col_1'], 'cells': []}}",
        exact_match=True,
    )

    select_column(canvas, 2)
    wait_for_app_run(app)
    expect_prefixed_markdown(
        app,
        "Dataframe single-column selection:",
        "{'selection': {'rows': [], 'columns': ['col_2'], 'cells': []}}",
        exact_match=True,
    )

    # Clicking on an already selected column should unselect it:
    select_column(canvas, 2)
    wait_for_app_run(app)
    expect_prefixed_markdown(
        app,
        "Dataframe single-column selection:",
        "{'selection': {'rows': [], 'columns': [], 'cells': []}}",
        exact_match=True,
    )


def test_multi_row_select(app: Page):
    canvas = _get_multi_row_select_df(app)
    expect_canvas_to_be_visible(canvas)
    canvas.scroll_into_view_if_needed()

    select_row(canvas, 1)
    select_row(canvas, 3)
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Dataframe multi-row selection:",
        "{'selection': {'rows': [0, 2], 'columns': [], 'cells': []}}",
        exact_match=True,
    )


def test_multi_row_select_all_at_once(app: Page):
    """Test that all rows are selected when clicking on the top-row checkbox."""
    canvas = _get_multi_row_select_df(app)
    expect_canvas_to_be_visible(canvas)

    select_row(canvas, 0)
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Dataframe multi-row selection:",
        "{'selection': {'rows': [0, 1, 2, 3, 4], 'columns': [], 'cells': []}}",
        exact_match=True,
    )


def test_multi_row_by_keeping_mouse_pressed(app: Page):
    canvas = _get_multi_row_select_df(app)
    expect_canvas_to_be_visible(canvas)

    # we have to scroll into view, otherwise the bounding_box is not correct
    canvas.scroll_into_view_if_needed()
    bounding_box = canvas.bounding_box()
    assert bounding_box is not None
    canvas_start_x_px = bounding_box.get("x", 0)
    canvas_start_y_px = bounding_box.get("y", 0)
    x, y = calc_middle_cell_position(2, 0, has_row_marker_col=True)
    app.mouse.move(canvas_start_x_px + x, canvas_start_y_px + y)
    app.mouse.down()
    x, y = calc_middle_cell_position(4, 0, has_row_marker_col=True)
    app.mouse.move(canvas_start_x_px + x, canvas_start_y_px + y)
    app.mouse.up()

    expect_prefixed_markdown(
        app,
        "Dataframe multi-row selection:",
        "{'selection': {'rows': [1, 2, 3], 'columns': [], 'cells': []}}",
        exact_match=True,
    )


def test_multi_column_select(app: Page):
    canvas = _get_multi_column_select_df(app)
    expect_canvas_to_be_visible(canvas)

    select_column(canvas, 1)
    app.keyboard.down(COMMAND_KEY)
    select_column(canvas, 3)
    select_column(canvas, 4)
    app.keyboard.up(COMMAND_KEY)
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Dataframe multi-column selection:",
        "{'selection': {'rows': [], 'columns': ['col_1', 'col_3', 'col_4'], 'cells': []}}",
        exact_match=True,
    )

    # Clicking on an already selected column should unselect this column:
    select_column(canvas, 1)
    wait_for_app_run(app)
    expect_prefixed_markdown(
        app,
        "Dataframe multi-column selection:",
        "{'selection': {'rows': [], 'columns': ['col_3', 'col_4'], 'cells': []}}",
        exact_match=True,
    )


def _select_some_rows_and_columns(app: Page, canvas: Locator):
    select_row(canvas, 1)
    # Column 0 is the row marker column
    select_column(canvas, 2, has_row_marker_col=True)
    app.keyboard.down(COMMAND_KEY)
    select_column(canvas, 4, has_row_marker_col=True)
    select_column(canvas, 5, has_row_marker_col=True)
    app.keyboard.up(COMMAND_KEY)
    select_row(canvas, 3)
    wait_for_app_run(app)


def _expect_multi_row_multi_column_selection(app: Page):
    expect_prefixed_markdown(
        app,
        "Dataframe multi-row-multi-column selection:",
        "{'selection': {'rows': [0, 2], 'columns': ['col_1', 'col_3', 'col_4'], 'cells': []}}",
        exact_match=True,
    )


def test_multi_row_and_multi_column_select(app: Page):
    canvas = _get_multi_row_and_column_select_df(app)
    expect_canvas_to_be_visible(canvas)

    _select_some_rows_and_columns(app, canvas)
    _expect_multi_row_multi_column_selection(app)


def test_single_row_select_and_sort(app: Page):
    canvas = _get_single_row_select_df(app)
    expect_canvas_to_be_visible(canvas)

    # Select a single row
    select_row(canvas, 1)
    wait_for_app_run(app)

    # The row selection should be returned
    expect_prefixed_markdown(
        app,
        "Dataframe single-row selection:",
        "{'selection': {'rows': [0], 'columns': [], 'cells': []}}",
        exact_match=True,
    )

    # Sort the dataframe via the column header
    sort_column(canvas, 1, has_row_marker_col=True)
    wait_for_app_run(app)

    # The row selection should be cleared
    expect_prefixed_markdown(
        app,
        "Dataframe single-row selection:",
        "{'selection': {'rows': [], 'columns': [], 'cells': []}}",
        exact_match=True,
    )


# Issue #11345: Test for behavior consistency with sorting via column menu
# and sorting via column header (above) with selections
def test_single_row_and_single_column_select_and_sort(app: Page):
    canvas = _get_single_row_and_column_select_df(app)
    expect_canvas_to_be_visible(canvas)

    # Select a single row and a single column from the dataframe
    select_row(canvas, 1)
    wait_for_app_run(app)

    select_column(canvas, 2, has_row_marker_col=True)
    wait_for_app_run(app)

    # The row & column selections should be returned
    expect_prefixed_markdown(
        app,
        "Dataframe single-row-single-column selection:",
        "{'selection': {'rows': [0], 'columns': ['col_1'], 'cells': []}}",
        exact_match=True,
    )

    # Open the column menu and sort the column
    open_column_menu(canvas, 1, "small", has_row_marker_col=True)
    app.get_by_test_id("stDataFrameColumnMenu").get_by_text("Sort ascending").click()
    wait_for_app_run(app)

    # The row selection should be cleared, but the column selection should remain
    expect_prefixed_markdown(
        app,
        "Dataframe single-row-single-column selection:",
        "{'selection': {'rows': [], 'columns': ['col_1'], 'cells': []}}",
        exact_match=True,
    )


def test_clear_selection_via_escape(app: Page):
    canvas = _get_multi_row_and_column_select_df(app)
    expect_canvas_to_be_visible(canvas)

    _select_some_rows_and_columns(app, canvas)

    # make sure we have something selected before clearing it to avoid false-positives
    _expect_multi_row_multi_column_selection(app)

    app.keyboard.press("Escape")
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Dataframe multi-row-multi-column selection:",
        "{'selection': {'rows': [], 'columns': [], 'cells': []}}",
        exact_match=True,
    )


def test_clear_selection_via_toolbar(app: Page):
    canvas = _get_multi_row_and_column_select_df(app)
    expect_canvas_to_be_visible(canvas)

    # toolbar has three buttons: visibility, download, search, fullscreen
    dataframe_toolbar = canvas.get_by_test_id("stElementToolbar")
    toolbar_buttons = dataframe_toolbar.get_by_test_id("stElementToolbarButton")
    expect(toolbar_buttons).to_have_count(4)

    _select_some_rows_and_columns(app, canvas)
    _expect_multi_row_multi_column_selection(app)
    # toolbar has one more button now: clear selection
    toolbar_buttons = dataframe_toolbar.get_by_test_id("stElementToolbarButton")
    expect(toolbar_buttons).to_have_count(5)
    # click on the clear-selection button in the toolbar
    toolbar_buttons.get_by_label("Clear selection").click()
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Dataframe multi-row-multi-column selection:",
        "{'selection': {'rows': [], 'columns': [], 'cells': []}}",
        exact_match=True,
    )


def test_in_form_selection_and_session_state(app: Page):
    canvas = _get_in_form_df(app)
    expect_canvas_to_be_visible(canvas)
    _select_some_rows_and_columns(app, canvas)

    _markdown_prefix = "Dataframe-in-form selection:"
    # nothing should be shown yet because we did not submit the form
    expect_prefixed_markdown(
        app,
        _markdown_prefix,
        "{'selection': {'rows': [], 'columns': [], 'cells': []}}",
        exact_match=True,
    )

    # submit the form. The selection uses a debounce of 200ms; if we click too early,
    # the state is not updated correctly and we submit the old, unselected values
    app.wait_for_timeout(210)
    click_form_button(app, "Submit")

    expect_prefixed_markdown(
        app,
        _markdown_prefix,
        "{'selection': {'rows': [0, 2], 'columns': ['col_1', 'col_3', 'col_4'], 'cells': []}}",
        exact_match=True,
    )

    expect_prefixed_markdown(
        app,
        "Dataframe-in-form selection in session state:",
        "{'selection': {'rows': [0, 2], 'columns': ['col_1', 'col_3', 'col_4'], 'cells': []}}",
        exact_match=True,
    )


# Skipping because the test is flaky on webkit. I validated it manually in
# Safari and it works as expected. Getting automated validation in Chromium +
# Firefox should be enough.
@pytest.mark.skip_browser("webkit")
def test_multi_row_and_multi_column_selection_with_callback(app: Page):
    canvas = _get_callback_df(app)
    expect_canvas_to_be_visible(canvas)
    canvas.scroll_into_view_if_needed()
    _select_some_rows_and_columns(app, canvas)

    expect_prefixed_markdown(
        app,
        "Dataframe selection callback:",
        "{'selection': {'rows': [0, 2], 'columns': ['col_1', 'col_3', 'col_4'], 'cells': []}}",
        exact_match=True,
    )


def test_multi_row_and_multi_column_select_snapshot(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Take a snapshot of multi-select to ensure visual consistency."""
    canvas = _get_multi_row_and_column_select_df(app)
    expect_canvas_to_be_visible(canvas)

    _select_some_rows_and_columns(app, canvas)
    _expect_multi_row_multi_column_selection(app)

    canvas.scroll_into_view_if_needed()
    assert_snapshot(canvas, name="st_dataframe-multi_row_multi_column_selection")


# Only run on chromium - firefox has slightly different snapshot sizes,
# webkit has canvas rendering inconsistencies with Playwright 1.59+
@pytest.mark.only_browser("chromium")
def test_selection_state_remains_after_unmounting(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the selection state remains after unmounting the component."""
    canvas = _get_multi_row_and_column_select_df(app)
    expect_canvas_to_be_visible(canvas)

    _select_some_rows_and_columns(app, canvas)
    _expect_multi_row_multi_column_selection(app)

    # Click button to unmount the component
    app.get_by_role("button", name="Create some elements to").click()
    wait_for_app_run(app, 4000)

    expect(canvas).to_be_visible()
    # Check that the selection is still returned correctly
    _expect_multi_row_multi_column_selection(app)

    canvas.scroll_into_view_if_needed()
    # Use the same snapshot name as the previous test to ensure visual consistency
    assert_snapshot(canvas, name="st_dataframe-multi_row_multi_column_selection")


def test_multi_row_and_multi_column_selection_in_fragment(app: Page):
    runs_element = app.get_by_test_id("stMarkdownContainer").filter(has_text="Runs:")
    expect(runs_element).to_have_text("Runs: 1")

    canvas = _get_fragment_df(app)
    canvas.scroll_into_view_if_needed()
    expect(canvas).to_be_visible()
    _select_some_rows_and_columns(app, canvas)

    expect_prefixed_markdown(
        app,
        "Dataframe-in-fragment selection:",
        "{'selection': {'rows': [0, 2], 'columns': ['col_1', 'col_3', 'col_4'], 'cells': []}}",
        exact_match=True,
    )

    # Check that the main script has NOT re-run after the fragment selection.
    # Fragment selections should only rerun the fragment, not the full script.
    expect(runs_element).to_have_text("Runs: 1")


# Skipping because the test is flaky on webkit. I validated it manually in
# Safari and it works as expected. Getting automated validation in Chromium +
# Firefox should be enough.
@pytest.mark.skip_browser("webkit")
def test_that_index_cannot_be_selected(app: Page):
    canvas = _get_df_with_index(app)
    expect_canvas_to_be_visible(canvas)

    canvas.scroll_into_view_if_needed()
    # Try select a selectable column
    select_column(canvas, 2)
    wait_for_app_run(app)

    # Check selection:
    expect_prefixed_markdown(
        app,
        "No selection on index column:",
        "{'selection': {'rows': [], 'columns': ['col_3'], 'cells': []}}",
        exact_match=True,
    )

    # Select index column:
    select_column(canvas, 0)
    wait_for_app_run(app)

    # The selection is kept the same:
    expect_prefixed_markdown(
        app,
        "No selection on index column:",
        "{'selection': {'rows': [], 'columns': ['col_3'], 'cells': []}}",
        exact_match=True,
    )

    # Try to click on another column and check that in can be selected:
    select_column(canvas, 1)
    wait_for_app_run(app)

    # Check selection:
    expect_prefixed_markdown(
        app,
        "No selection on index column:",
        "{'selection': {'rows': [], 'columns': ['col_1', 'col_3'], 'cells': []}}",
        exact_match=True,
    )


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "df_selection")).to_be_visible()


def test_single_cell_select(app: Page):
    """Test single cell selection mode."""
    canvas = _get_single_cell_select_df(app)
    expect_canvas_to_be_visible(canvas)
    canvas.scroll_into_view_if_needed()

    # Click on cell at row 1, column 1 (col_1)
    click_on_cell(canvas, 1, 1, column_width="small", has_row_marker_col=False)
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Dataframe single-cell selection:",
        "{'selection': {'rows': [], 'columns': [], 'cells': [(0, 'col_1')]}}",
        exact_match=True,
    )

    # Click on another cell at row 2, column 3 (col_3)
    click_on_cell(canvas, 2, 3, column_width="small", has_row_marker_col=False)
    wait_for_app_run(app)

    # Only the new cell should be selected
    expect_prefixed_markdown(
        app,
        "Dataframe single-cell selection:",
        "{'selection': {'rows': [], 'columns': [], 'cells': [(1, 'col_3')]}}",
        exact_match=True,
    )


def test_multi_cell_select_by_dragging(app: Page):
    """Test multi cell selection by dragging."""
    canvas = _get_multi_cell_select_df(app)
    expect_canvas_to_be_visible(canvas)
    canvas.scroll_into_view_if_needed()

    # Get canvas bounding box for mouse operations
    bounding_box = canvas.bounding_box()
    assert bounding_box is not None
    canvas_start_x_px = bounding_box.get("x", 0)
    canvas_start_y_px = bounding_box.get("y", 0)

    # Drag from cell (1,1) to cell (3,3) - that's (row 0, col_1) to (row 2, col_3)
    x1, y1 = calc_middle_cell_position(1, 1, has_row_marker_col=False)
    x2, y2 = calc_middle_cell_position(3, 3, has_row_marker_col=False)

    app.mouse.move(canvas_start_x_px + x1, canvas_start_y_px + y1)
    app.mouse.down()
    app.mouse.move(canvas_start_x_px + x2, canvas_start_y_px + y2)
    app.mouse.up()
    wait_for_app_run(app)

    # Should select a rectangular region of cells from (0, col_1) to (2, col_3)
    expect_prefixed_markdown(
        app,
        "Dataframe multi-cell selection:",
        "{'selection': {'rows': [], 'columns': [], 'cells': ["
        "(0, 'col_1'), (0, 'col_2'), (0, 'col_3'), (1, 'col_1'), (1, 'col_2'), "
        "(1, 'col_3'), (2, 'col_1'), (2, 'col_2'), (2, 'col_3')]}}",
        exact_match=True,
    )


def test_multi_row_and_single_cell_select(app: Page):
    """Test combined multi-row and single-cell selection mode."""
    canvas = _get_multi_row_and_single_cell_select_df(app)
    expect_canvas_to_be_visible(canvas)
    canvas.scroll_into_view_if_needed()

    # Select multiple rows first
    select_row(canvas, 1)
    select_row(canvas, 3)
    wait_for_app_run(app)

    # Then select a single cell (row 2, col 3 accounting for row marker = row 1, col_2)
    click_on_cell(canvas, 2, 3, column_width="small", has_row_marker_col=True)
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Dataframe multi-row & single-cell selection:",
        "{'selection': {'rows': [0, 2], 'columns': [], 'cells': [(1, 'col_2')]}}",
        exact_match=True,
    )

    # Click on another cell should replace the cell selection but keep rows
    # (row 4, col 2 with row marker = row 3, col_1)
    click_on_cell(canvas, 4, 2, column_width="small", has_row_marker_col=True)
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Dataframe multi-row & single-cell selection:",
        "{'selection': {'rows': [0, 2], 'columns': [], 'cells': [(3, 'col_1')]}}",
        exact_match=True,
    )


@pytest.mark.skip_browser(
    "firefox"  # Firefox runs into sub-pixel flakiness, but functionally everything is working fine with Firefox.
)
def test_multi_row_column_and_cell_select(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test combined multi-row, multi-column and multi-cell selection mode."""
    canvas = _get_multi_row_column_and_cell_select_df(app)
    expect_canvas_to_be_visible(canvas)
    canvas.scroll_into_view_if_needed()

    # Select some rows
    select_row(canvas, 1)
    select_row(canvas, 2)

    # Select some columns (with command key)
    app.keyboard.down(COMMAND_KEY)
    select_column(canvas, 2, has_row_marker_col=True)
    wait_for_app_run(app)
    select_column(canvas, 3, has_row_marker_col=True)
    app.keyboard.up(COMMAND_KEY)
    wait_for_app_run(app)
    canvas.scroll_into_view_if_needed()

    # Select some individual cells
    # Get canvas bounding box for mouse operations
    bounding_box = canvas.bounding_box()
    assert bounding_box is not None
    canvas_start_x_px = bounding_box.get("x", 0)
    canvas_start_y_px = bounding_box.get("y", 0)

    # Drag from cell (1,1) to cell (3,3) - that's (row 0, col_1) to (row 2, col_3)
    x1, y1 = calc_middle_cell_position(1, 1, has_row_marker_col=False)
    x2, y2 = calc_middle_cell_position(3, 3, has_row_marker_col=False)

    app.mouse.move(canvas_start_x_px + x1, canvas_start_y_px + y1)
    app.mouse.down()
    app.mouse.move(canvas_start_x_px + x2, canvas_start_y_px + y2)
    app.mouse.up()
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Dataframe multi-row, multi-column & multi-cell selection:",
        "{'selection': {'rows': [0, 1], 'columns': ['col_1', 'col_2'], 'cells': [(0, 'col_1'), "
        "(0, 'col_2'), (0, 'col_3'), (1, 'col_1'), (1, 'col_2'), (1, 'col_3'), "
        "(2, 'col_1'), (2, 'col_2'), (2, 'col_3')]}}",
        exact_match=True,
    )

    # Take a snapshot to ensure visual consistency:
    assert_snapshot(canvas, name="st_dataframe-multi_row_column_and_cell_select")

    # Press Escape to clear
    app.keyboard.press("Escape")
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Dataframe multi-row, multi-column & multi-cell selection:",
        "{'selection': {'rows': [], 'columns': [], 'cells': []}}",
        exact_match=True,
    )


def _get_persistent_selection_df(app: Page) -> Locator:
    return get_element_by_key(app, "persistent_selection_df").get_by_test_id(
        "stDataFrame"
    )


def _get_selection_default_df(app: Page) -> Locator:
    return get_element_by_key(app, "selection_default_df").get_by_test_id("stDataFrame")


def test_selection_persists_after_data_update(app: Page):
    """Test that row selections persist when data changes but key remains the same.

    This verifies the key_as_main_identity feature for st.dataframe selections.
    When a key is provided and selection_mode stays the same, selections should
    be preserved even when the underlying data changes.
    """
    # First scroll to the bottom of the page to ensure the test section is loaded
    update_button = get_element_by_key(app, "update_data_btn").locator("button")
    update_button.scroll_into_view_if_needed()
    expect(update_button).to_be_visible()

    canvas = _get_persistent_selection_df(app)
    expect_canvas_to_be_visible(canvas)
    canvas.scroll_into_view_if_needed()

    # Initially no selection
    expect_prefixed_markdown(
        app,
        "Persistent selection:",
        "{'selection': {'rows': [], 'columns': [], 'cells': []}}",
        exact_match=True,
    )
    expect_prefixed_markdown(app, "Data update count:", "0", exact_match=True)

    # Select rows 0 and 2
    select_row(canvas, 1)
    select_row(canvas, 3)
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Persistent selection:",
        "{'selection': {'rows': [0, 2], 'columns': [], 'cells': []}}",
        exact_match=True,
    )

    # Click the button to update data (changes the dataframe content)
    # Scroll to button again after dataframe selections (page may have scrolled)
    update_button.scroll_into_view_if_needed()
    expect(update_button).to_be_visible()
    update_button.click()
    wait_for_app_run(app)

    # Data update count should be incremented
    expect_prefixed_markdown(app, "Data update count:", "1", exact_match=True)

    # Selection should persist after data update
    expect_prefixed_markdown(
        app,
        "Persistent selection:",
        "{'selection': {'rows': [0, 2], 'columns': [], 'cells': []}}",
        exact_match=True,
    )


def test_selection_default_initial_value(app: Page):
    """Test that selection_default is applied to initial UI selection state."""
    canvas = _get_selection_default_df(app)
    expect_canvas_to_be_visible(canvas)
    canvas.scroll_into_view_if_needed()

    # On first render the backend return value already reflects the default.
    expect_prefixed_markdown(
        app,
        "Selection default row selection:",
        "{'selection': {'rows': [1, 3], 'columns': [], 'cells': []}}",
        exact_match=True,
    )

    # Row position 2 maps to row index 1. This row is part of the default
    # selection [1, 3], so clicking it should toggle it off and keep row 3.
    select_row(canvas, 2)
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Selection default row selection:",
        "{'selection': {'rows': [3], 'columns': [], 'cells': []}}",
        exact_match=True,
    )

    # Negative assertion: the full default [1, 3] must not persist after toggle.
    default_md = app.get_by_test_id("stMarkdown").filter(has_text="Selection default")
    expect(default_md).not_to_contain_text("'rows': [1, 3]")


def _get_programmatic_row_selection_df(app: Page) -> Locator:
    return get_element_by_key(app, "programmatic_row_selection_df").get_by_test_id(
        "stDataFrame"
    )


def test_programmatic_row_selection_via_session_state(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that selections can be pre-set and changed programmatically via session state.

    This verifies the feature that allows users to set dataframe selections via
    st.session_state["key"] = {"selection": {"rows": [...], ...}}.
    """
    canvas = _get_programmatic_row_selection_df(app)
    expect_canvas_to_be_visible(canvas)
    canvas.scroll_into_view_if_needed()

    # Initially, the selection should be pre-set to rows [1, 3] via session state
    expect_prefixed_markdown(
        app,
        "Programmatic row selection:",
        "{'selection': {'rows': [1, 3], 'columns': [], 'cells': []}}",
        exact_match=True,
    )

    # Verify attribute access works (regression test for #14454).
    expect_prefixed_markdown(
        app, "Programmatic row selection rows:", "[1, 3]", exact_match=True
    )

    # Verify the UI shows the correct row checkmarks for the pre-set selection
    assert_snapshot(canvas, name="st_dataframe-programmatic_row_selection")

    # Click the button to change selection programmatically to rows [0, 2, 4]
    click_button(app, "Set selection to rows 0, 2, 4")

    # Selection should now be [0, 2, 4]
    expect_prefixed_markdown(
        app,
        "Programmatic row selection:",
        "{'selection': {'rows': [0, 2, 4], 'columns': [], 'cells': []}}",
        exact_match=True,
    )

    expect_prefixed_markdown(
        app, "Programmatic row selection rows:", "[0, 2, 4]", exact_match=True
    )

    # Negative assertion: the previous selection [1, 3] must NOT be present anymore
    programmatic_md = app.get_by_test_id("stMarkdown").filter(
        has_text="Programmatic row selection:"
    )
    expect(programmatic_md).not_to_contain_text("'rows': [1, 3]")

    # User can still modify the selection manually after a programmatic change.
    # Row position 2 in the grid corresponds to row index 1 (since hide_index=True
    # and position 1 is the header). Clicking it should toggle (add) row 1.
    canvas.scroll_into_view_if_needed()
    # Wait for glide-data-grid to apply the programmatic selection internally.
    # The selection debounce is 150ms and the React effect that applies the
    # programmatic selection runs after DOM commit. We cannot use expect/wait_until
    # here because glide-data-grid renders to a <canvas> — selected-row state is
    # not exposed as a DOM attribute, CSS class, or ARIA property that Playwright
    # could observe. Without this wait the subsequent click may land before the
    # grid has updated its internal selection, producing wrong results.
    app.wait_for_timeout(250)
    select_row(canvas, 2)
    wait_for_app_run(app)

    # Since [0, 2, 4] were selected and we clicked row position 2 (row index 1),
    # row 1 gets added to the selection: [0, 1, 2, 4]
    expect_prefixed_markdown(
        app,
        "Programmatic row selection:",
        "{'selection': {'rows': [0, 1, 2, 4], 'columns': [], 'cells': []}}",
        exact_match=True,
    )


def test_programmatic_clear_row_selection_via_session_state(app: Page):
    """Test that selections can be cleared programmatically via session state."""
    # Scroll to the test section and verify initial pre-set selection
    expect_prefixed_markdown(
        app,
        "Programmatic row selection:",
        "{'selection': {'rows': [1, 3], 'columns': [], 'cells': []}}",
        exact_match=True,
    )

    # Click the button to clear the selection programmatically
    click_button(app, "Clear dataframe selection")

    # Selection should now be empty
    expect_prefixed_markdown(
        app,
        "Programmatic row selection:",
        "{'selection': {'rows': [], 'columns': [], 'cells': []}}",
        exact_match=True,
    )

    # Verify that the empty selection is not the same as the initial pre-set one
    # (negative assertion: rows [1, 3] should NOT be in the output)
    programmatic_md = app.get_by_test_id("stMarkdown").filter(
        has_text="Programmatic row selection:"
    )
    expect(programmatic_md).not_to_contain_text("[1, 3]")


def test_programmatic_column_and_cell_selection(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that column and cell selections can be pre-set programmatically via session state."""
    col_cell_df = get_element_by_key(app, "programmatic_col_cell_df").get_by_test_id(
        "stDataFrame"
    )
    col_cell_df.scroll_into_view_if_needed()
    expect_canvas_to_be_visible(col_cell_df)

    # Verify the pre-set selection includes both columns and a cell
    expect_prefixed_markdown(
        app,
        "Column+cell selection:",
        "{'selection': {'rows': [], 'columns': ['col_1', 'col_3'], 'cells': [(2, 'col_0')]}}",
        exact_match=True,
    )

    # Verify the UI shows the correct column highlights and cell selection
    assert_snapshot(col_cell_df, name="st_dataframe-programmatic_col_cell_selection")

    # Negative assertion: rows must be empty (no row selection mode is active)
    col_cell_md = app.get_by_test_id("stMarkdown").filter(
        has_text="Column+cell selection:"
    )
    expect(col_cell_md).not_to_contain_text("'rows': [1")


def test_single_row_required_with_column_selection(app: Page):
    """Test single-row-required combined with multi-column: default, interaction, and programmatic changes."""
    canvas = _get_combined_row_col_select_df(app)
    canvas.scroll_into_view_if_needed()
    expect_canvas_to_be_visible(canvas)

    # Verify the default selection: row 1 and columns col_1, col_3
    expect_prefixed_markdown(
        app,
        "Combined row+col selection:",
        "{'selection': {'rows': [1], 'columns': ['col_1', 'col_3'], 'cells': []}}",
        exact_match=True,
    )

    # Click on a different column to change column selection
    # This should add the column while preserving the row
    select_column(canvas, 3, has_row_marker_col=True)
    wait_for_app_run(app)

    # Row should still be selected, columns updated
    combined_md = app.get_by_test_id("stMarkdown").filter(
        has_text="Combined row+col selection:"
    )
    expect(combined_md).to_contain_text("'rows': [1]")
    expect(combined_md).to_contain_text("'col_2'")

    # Click the button to programmatically change selection to row 3, cols 2+4
    click_button(app, "Change to row 3, cols 2+4")

    expect_prefixed_markdown(
        app,
        "Combined row+col selection:",
        "{'selection': {'rows': [3], 'columns': ['col_2', 'col_4'], 'cells': []}}",
        exact_match=True,
    )

    # Click button to clear columns only - row should remain (required)
    click_button(app, "Clear columns only")

    expect_prefixed_markdown(
        app,
        "Combined row+col selection:",
        "{'selection': {'rows': [3], 'columns': [], 'cells': []}}",
        exact_match=True,
    )

    # Negative assertion: row should NOT be cleared since it's required
    combined_md = app.get_by_test_id("stMarkdown").filter(
        has_text="Combined row+col selection:"
    )
    expect(combined_md).not_to_contain_text("'rows': []")
