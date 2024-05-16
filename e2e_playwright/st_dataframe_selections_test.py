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

import platform

import pytest
from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run, wait_until

# determined by measuring a screenshot
_first_column_width_px = 30
_column_width_px = 80
_row_height_px = 35

# Meta = Apple's Command Key; for complete list see https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values#special_values
_command_key = "Meta" if platform.system() == "Darwin" else "Control"


def _get_row_position(row_number: int):
    """Get the x,y positions of a row for the very first column."""
    row_middle_height_px = row_number * _row_height_px + (_row_height_px / 2)
    row_middle_width_px = _first_column_width_px / 2
    return row_middle_width_px, row_middle_height_px


def _click_on_row_selector(canvas: Locator, row_number: int):
    """Click on the middle of the row selector. row_number 0 would be the header row."""
    row_middle_width_px, row_middle_height_px = _get_row_position(row_number)
    canvas.click(position={"x": row_middle_width_px, "y": row_middle_height_px})


def _click_on_column_selector(canvas: Locator, column_number: int):
    """Click on the middle of the row selector. column_number must start at 1, because the first column has a different width."""
    row_middle_height_px = _row_height_px / 2
    column_middle_width_px = column_number * _column_width_px + (_column_width_px / 2)
    canvas.click(position={"x": column_middle_width_px, "y": row_middle_height_px})


def _expect_written_text(app: Page, expected_prefix: str, expected_selection: str):
    """Find the markdown with the prefix and then ensure that the `expected_selection` is in the text as well.

    Splitting it into a `filter` and a `to_have_text` check has the advantage that we see the diff in case of a mistmatch;
    this would not be the case if we just used the `filter`.

    Only one markdown-element must be returned, otherwise an error is thrown.
    """
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(
        has_text=expected_prefix
    )
    expected_selection = expected_prefix + " " + expected_selection
    expect(selection_text).to_have_text(expected_selection)


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
    _click_on_row_selector(canvas, 1)
    wait_for_app_run(app)

    expected = (
        "Dataframe single-row selection: {'selection': {'rows': [0], 'columns': []}}"
    )
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)

    _click_on_row_selector(canvas, 2)
    wait_for_app_run(app)
    _expect_written_text(
        app,
        "Dataframe single-row selection:",
        "{'selection': {'rows': [1], 'columns': []}}",
    )


def test_single_column_select(app: Page):
    canvas = _get_single_column_select_df(app)

    _click_on_column_selector(canvas, 1)
    wait_for_app_run(app)

    _expect_written_text(
        app,
        "Dataframe single-column selection:",
        "{'selection': {'rows': [], 'columns': ['col_1']}}",
    )

    _click_on_column_selector(canvas, 2)
    wait_for_app_run(app)
    _expect_written_text(
        app,
        "Dataframe single-column selection:",
        "{'selection': {'rows': [], 'columns': ['col_2']}}",
    )


def test_multi_row_select(app: Page):
    canvas = _get_multi_row_select_df(app)

    _click_on_row_selector(canvas, 1)
    _click_on_row_selector(canvas, 3)
    wait_for_app_run(app)

    _expect_written_text(
        app,
        "Dataframe multi-row selection:",
        "{'selection': {'rows': [0, 2], 'columns': []}}",
    )


def test_multi_row_select_all_at_once(app: Page):
    """Test that all rows are selected when clicking on the top-row checkbox."""
    canvas = _get_multi_row_select_df(app)

    _click_on_row_selector(canvas, 0)
    wait_for_app_run(app)

    _expect_written_text(
        app,
        "Dataframe multi-row selection:",
        "{'selection': {'rows': [0, 1, 2, 3, 4], 'columns': []}}",
    )


def test_multi_row_by_keeping_mouse_pressed(app: Page):
    canvas = _get_multi_row_select_df(app)
    # we have to scroll into view, otherwise the bounding_box is not correct
    canvas.scroll_into_view_if_needed()
    bounding_box = canvas.bounding_box()
    assert bounding_box is not None
    canvas_start_x_px = bounding_box.get("x", 0)
    canvas_start_y_px = bounding_box.get("y", 0)
    x, y = _get_row_position(2)
    app.mouse.move(canvas_start_x_px + x, canvas_start_y_px + y)
    app.mouse.down()
    x, y = _get_row_position(4)
    app.mouse.move(canvas_start_x_px + x, canvas_start_y_px + y)
    app.mouse.up()

    _expect_written_text(
        app,
        "Dataframe multi-row selection:",
        "{'selection': {'rows': [1, 2, 3], 'columns': []}}",
    )


def test_multi_column_select(app: Page):
    canvas = _get_multi_column_select_df(app)

    _click_on_column_selector(canvas, 1)
    app.keyboard.down(_command_key)
    _click_on_column_selector(canvas, 3)
    _click_on_column_selector(canvas, 4)
    app.keyboard.up(_command_key)
    wait_for_app_run(app)

    _expect_written_text(
        app,
        "Dataframe multi-column selection:",
        "{'selection': {'rows': [], 'columns': ['col_1', 'col_3', 'col_4']}}",
    )


def _select_some_rows_and_columns(app: Page, canvas: Locator):
    _click_on_row_selector(canvas, 1)
    _click_on_column_selector(canvas, 1)
    app.keyboard.down(_command_key)
    _click_on_column_selector(canvas, 3)
    _click_on_column_selector(canvas, 4)
    app.keyboard.up(_command_key)
    _click_on_row_selector(canvas, 3)
    wait_for_app_run(app)


def _expect_multi_row_multi_column_selection(app: Page):
    _expect_written_text(
        app,
        "Dataframe multi-row-multi-column selection:",
        "{'selection': {'rows': [0, 2], 'columns': ['col_1', 'col_3', 'col_4']}}",
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

    _expect_written_text(
        app,
        "Dataframe multi-row-multi-column selection:",
        "{'selection': {'rows': [], 'columns': []}}",
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

    _expect_written_text(
        app,
        "Dataframe multi-row-multi-column selection:",
        "{'selection': {'rows': [], 'columns': []}}",
    )


def test_in_form_selection_and_session_state(app: Page):
    canvas = _get_in_form_df(app)
    _select_some_rows_and_columns(app, canvas)

    _markdown_prefix = "Dataframe-in-form selection:"
    # nothing should be shown yet because we did not submit the form
    _expect_written_text(
        app,
        _markdown_prefix,
        "{'selection': {'rows': [], 'columns': []}}",
    )

    # submit the form. The selection uses a debounce of 200ms; if we click too early, the state is not updated correctly and we submit the old, unselected values
    app.wait_for_timeout(210)
    app.get_by_test_id("baseButton-secondaryFormSubmit").click()
    wait_for_app_run(app)

    _expect_written_text(
        app,
        _markdown_prefix,
        "{'selection': {'rows': [0, 2], 'columns': ['col_1', 'col_3', 'col_4']}}",
    )

    _expect_written_text(
        app,
        "Dataframe-in-form selection in session state:",
        "{'selection': {'rows': [0, 2], 'columns': ['col_1', 'col_3', 'col_4']}}",
    )


def test_multi_row_and_multi_column_selection_with_callback(app: Page):
    canvas = _get_callback_df(app)
    _select_some_rows_and_columns(app, canvas)

    _expect_written_text(
        app,
        "Dataframe selection callback:",
        "{'selection': {'rows': [0, 2], 'columns': ['col_1', 'col_3', 'col_4']}}",
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
    _select_some_rows_and_columns(app, canvas)

    _expect_written_text(
        app,
        "Dataframe-in-fragment selection:",
        "{'selection': {'rows': [0, 2], 'columns': ['col_1', 'col_3', 'col_4']}}",
    )

    # Check that the main script:
    expect(app.get_by_text("Runs: 1")).to_be_visible()


def test_that_index_cannot_be_selected(app: Page):
    canvas = _get_df_with_index(app)
    canvas.scroll_into_view_if_needed()
    # Try select a selectable columnÖ
    _click_on_column_selector(canvas, 2)
    wait_for_app_run(app)

    # Check selection:
    _expect_written_text(
        app,
        "No selection on index column:",
        "{'selection': {'rows': [], 'columns': ['col_3']}}",
    )

    # Select index column:
    _click_on_column_selector(canvas, 0)
    wait_for_app_run(app)

    # Nothing should be selected:
    _expect_written_text(
        app,
        "No selection on index column:",
        "{'selection': {'rows': [], 'columns': []}}",
    )

    # Try to click on another column and check that in can be selected:
    _click_on_column_selector(canvas, 1)
    wait_for_app_run(app)

    # Check selection:
    _expect_written_text(
        app,
        "No selection on index column:",
        "{'selection': {'rows': [], 'columns': ['col_1']}}",
    )
