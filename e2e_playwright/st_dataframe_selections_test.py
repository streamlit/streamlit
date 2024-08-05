# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
from e2e_playwright.shared.app_utils import COMMAND_KEY, expect_prefixed_markdown
from e2e_playwright.shared.dataframe_utils import (
    calc_middle_cell_position,
    select_column,
    select_row,
    sort_column,
)


def _get_single_row_select_df(app: Page) -> Locator:
    return app.get_by_test_id("stDataFrame").nth(0)


def _get_single_column_select_df(app: Page) -> Locator:
    return app.get_by_test_id("stDataFrame").nth(1)


def _get_multi_row_select_df(app: Page) -> Locator:
    return app.get_by_test_id("stDataFrame").nth(2)


def _get_multi_column_select_df(app: Page) -> Locator:
    return app.get_by_test_id("stDataFrame").nth(3)


def _get_multi_row_and_column_select_df(app: Page) -> Locator:
    return app.get_by_test_id("stDataFrame").nth(4)


def _get_in_form_df(app: Page) -> Locator:
    return app.get_by_test_id("stDataFrame").nth(5)


def _get_callback_df(app: Page) -> Locator:
    return app.get_by_test_id("stDataFrame").nth(6)


def _get_fragment_df(app: Page) -> Locator:
    return app.get_by_test_id("stDataFrame").nth(7)


def _get_df_with_index(app: Page) -> Locator:
    return app.get_by_test_id("stDataFrame").nth(8)


def test_single_row_select(app: Page):
    canvas = _get_single_row_select_df(app)

    # select first row
    select_row(canvas, 1)
    wait_for_app_run(app)

    expected = (
        "Dataframe single-row selection: {'selection': {'rows': [0], 'columns': []}}"
    )
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)

    select_row(canvas, 2)
    wait_for_app_run(app)
    expect_prefixed_markdown(
        app,
        "Dataframe single-row selection:",
        "{'selection': {'rows': [1], 'columns': []}}",
    )


def test_single_row_select_with_sorted_column(app: Page):
    canvas = _get_single_row_select_df(app)
    # select first row
    select_row(canvas, 1)
    wait_for_app_run(app)
    # The dataframe is not sorted yet, so the first row is the first row:
    expected = (
        "Dataframe single-row selection: {'selection': {'rows': [0], 'columns': []}}"
    )
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)

    # Sort the first column
    # this is expected to clear the previous row selection:
    sort_column(canvas, 1, has_row_marker_col=True)
    wait_for_app_run(app)

    # The dataframe selection should be cleared
    expected = (
        "Dataframe single-row selection: {'selection': {'rows': [], 'columns': []}}"
    )
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)

    # select first row again:
    select_row(canvas, 1)
    wait_for_app_run(app)

    # The first row got selected, but the real numerical row index
    # should be different since the first column is sorted
    expected = (
        "Dataframe single-row selection: {'selection': {'rows': [4], 'columns': []}}"
    )
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)


def test_single_column_select(app: Page):
    canvas = _get_single_column_select_df(app)

    select_column(canvas, 1)
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Dataframe single-column selection:",
        "{'selection': {'rows': [], 'columns': ['col_1']}}",
        exact_match=True,
    )

    select_column(canvas, 2)
    wait_for_app_run(app)
    expect_prefixed_markdown(
        app,
        "Dataframe single-column selection:",
        "{'selection': {'rows': [], 'columns': ['col_2']}}",
        exact_match=True,
    )


def test_multi_row_select(app: Page):
    canvas = _get_multi_row_select_df(app)

    select_row(canvas, 1)
    select_row(canvas, 3)
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Dataframe multi-row selection:",
        "{'selection': {'rows': [0, 2], 'columns': []}}",
        exact_match=True,
    )


def test_multi_row_select_all_at_once(app: Page):
    """Test that all rows are selected when clicking on the top-row checkbox."""
    canvas = _get_multi_row_select_df(app)

    select_row(canvas, 0)
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Dataframe multi-row selection:",
        "{'selection': {'rows': [0, 1, 2, 3, 4], 'columns': []}}",
        exact_match=True,
    )


def test_multi_row_by_keeping_mouse_pressed(app: Page):
    canvas = _get_multi_row_select_df(app)
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
        "{'selection': {'rows': [1, 2, 3], 'columns': []}}",
        exact_match=True,
    )


def test_multi_column_select(app: Page):
    canvas = _get_multi_column_select_df(app)

    select_column(canvas, 1)
    app.keyboard.down(COMMAND_KEY)
    select_column(canvas, 3)
    select_column(canvas, 4)
    app.keyboard.up(COMMAND_KEY)
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Dataframe multi-column selection:",
        "{'selection': {'rows': [], 'columns': ['col_1', 'col_3', 'col_4']}}",
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
        "{'selection': {'rows': [0, 2], 'columns': ['col_1', 'col_3', 'col_4']}}",
        exact_match=True,
    )


def test_multi_row_and_multi_column_select(app: Page):
    canvas = _get_multi_row_and_column_select_df(app)
    _select_some_rows_and_columns(app, canvas)
    _expect_multi_row_multi_column_selection(app)


def test_clear_selection_via_escape(app: Page):
    canvas = _get_multi_row_and_column_select_df(app)
    _select_some_rows_and_columns(app, canvas)

    # make sure we have something selected before clearing it to avoid false-positives
    _expect_multi_row_multi_column_selection(app)

    app.keyboard.press("Escape")
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Dataframe multi-row-multi-column selection:",
        "{'selection': {'rows': [], 'columns': []}}",
        exact_match=True,
    )


def test_clear_selection_via_toolbar(app: Page):
    canvas = _get_multi_row_and_column_select_df(app)

    # toolbar has three buttons: download, search, fullscreen
    dataframe_toolbar = canvas.get_by_test_id("stElementToolbar")
    toolbar_buttons = dataframe_toolbar.get_by_test_id("stElementToolbarButton")
    expect(toolbar_buttons).to_have_count(3)

    _select_some_rows_and_columns(app, canvas)
    _expect_multi_row_multi_column_selection(app)
    # toolbar has one more button now: clear selection
    toolbar_buttons = dataframe_toolbar.get_by_test_id("stElementToolbarButton")
    expect(toolbar_buttons).to_have_count(4)
    # click on the clear-selection button which is the first in the toolbar
    toolbar_buttons.nth(0).click()
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Dataframe multi-row-multi-column selection:",
        "{'selection': {'rows': [], 'columns': []}}",
        exact_match=True,
    )


def test_in_form_selection_and_session_state(app: Page):
    canvas = _get_in_form_df(app)
    _select_some_rows_and_columns(app, canvas)

    _markdown_prefix = "Dataframe-in-form selection:"
    # nothing should be shown yet because we did not submit the form
    expect_prefixed_markdown(
        app,
        _markdown_prefix,
        "{'selection': {'rows': [], 'columns': []}}",
        exact_match=True,
    )

    # submit the form. The selection uses a debounce of 200ms; if we click too early, the state is not updated correctly and we submit the old, unselected values
    app.wait_for_timeout(210)
    app.get_by_test_id("baseButton-secondaryFormSubmit").click()
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        _markdown_prefix,
        "{'selection': {'rows': [0, 2], 'columns': ['col_1', 'col_3', 'col_4']}}",
        exact_match=True,
    )

    expect_prefixed_markdown(
        app,
        "Dataframe-in-form selection in session state:",
        "{'selection': {'rows': [0, 2], 'columns': ['col_1', 'col_3', 'col_4']}}",
        exact_match=True,
    )


def test_multi_row_and_multi_column_selection_with_callback(app: Page):
    canvas = _get_callback_df(app)
    _select_some_rows_and_columns(app, canvas)

    expect_prefixed_markdown(
        app,
        "Dataframe selection callback:",
        "{'selection': {'rows': [0, 2], 'columns': ['col_1', 'col_3', 'col_4']}}",
        exact_match=True,
    )


def test_multi_row_and_multi_column_select_snapshot(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Take a snapshot of multi-select to ensure visual consistency."""
    canvas = _get_multi_row_and_column_select_df(app)
    _select_some_rows_and_columns(app, canvas)
    _expect_multi_row_multi_column_selection(app)

    canvas.scroll_into_view_if_needed()
    assert_snapshot(canvas, name="st_dataframe-multi_row_multi_column_selection")


# Skip firefox since it takes a snapshot with a slightly different size
# compared to the one in the test_multi_row_and_multi_column_select_snapshot test
@pytest.mark.skip_browser("firefox")
def test_selection_state_remains_after_unmounting(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the selection state remains after unmounting the component."""
    canvas = _get_multi_row_and_column_select_df(app)
    _select_some_rows_and_columns(app, canvas)
    _expect_multi_row_multi_column_selection(app)

    # Click button to unmount the component
    app.get_by_test_id("stButton").locator("button").click()
    wait_for_app_run(app, 4000)

    expect(canvas).to_be_visible()
    # Check that the selection is still returned correctly
    _expect_multi_row_multi_column_selection(app)

    canvas.scroll_into_view_if_needed()
    # Use the same snapshot name as the previous test to ensure visual consistency
    assert_snapshot(canvas, name="st_dataframe-multi_row_multi_column_selection")


def test_multi_row_and_multi_column_selection_in_fragment(app: Page):
    canvas = _get_fragment_df(app)
    canvas.scroll_into_view_if_needed()
    expect(canvas).to_be_visible()
    _select_some_rows_and_columns(app, canvas)

    expect_prefixed_markdown(
        app,
        "Dataframe-in-fragment selection:",
        "{'selection': {'rows': [0, 2], 'columns': ['col_1', 'col_3', 'col_4']}}",
        exact_match=True,
    )

    # Check that the main script has run once (the initial run), but not after the selection:
    expect(app.get_by_text("Runs: 1")).to_be_visible()


def test_that_index_cannot_be_selected(app: Page):
    canvas = _get_df_with_index(app)
    canvas.scroll_into_view_if_needed()
    # Try select a selectable columnÖ
    select_column(canvas, 2)
    wait_for_app_run(app)

    # Check selection:
    expect_prefixed_markdown(
        app,
        "No selection on index column:",
        "{'selection': {'rows': [], 'columns': ['col_3']}}",
        exact_match=True,
    )

    # Select index column:
    select_column(canvas, 0)
    wait_for_app_run(app)

    # Nothing should be selected:
    expect_prefixed_markdown(
        app,
        "No selection on index column:",
        "{'selection': {'rows': [], 'columns': []}}",
        exact_match=True,
    )

    # Try to click on another column and check that in can be selected:
    select_column(canvas, 1)
    wait_for_app_run(app)

    # Check selection:
    expect_prefixed_markdown(
        app,
        "No selection on index column:",
        "{'selection': {'rows': [], 'columns': ['col_1']}}",
        exact_match=True,
    )
