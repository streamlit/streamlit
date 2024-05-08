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

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run

# determined by measuring a screenshot
_first_column_width_px = 30
_column_width_px = 80
_row_height_px = 35


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


def test_single_row_select(app: Page):
    canvas = _get_single_row_select_df(app)
    # bounding_box = canvas.bounding_box()

    # select first row
    _click_on_row_selector(canvas, 1)
    wait_for_app_run(app)

    expected = (
        "Dataframe single-row selection: {'select': {'rows': [0], 'columns': []}}"
    )
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)

    _click_on_row_selector(canvas, 2)
    wait_for_app_run(app)
    expected = (
        "Dataframe single-row selection: {'select': {'rows': [1], 'columns': []}}"
    )
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)


def test_single_column_select(app: Page):
    canvas = _get_single_column_select_df(app)

    _click_on_column_selector(canvas, 1)
    wait_for_app_run(app)

    expected = "Dataframe single-column selection: {'select': {'rows': [], 'columns': ['col_1']}}"
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)

    _click_on_column_selector(canvas, 2)
    wait_for_app_run(app)
    expected = "Dataframe single-column selection: {'select': {'rows': [], 'columns': ['col_2']}}"
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)


def test_multi_row_select(app: Page):
    canvas = _get_multi_row_select_df(app)

    _click_on_row_selector(canvas, 1)
    _click_on_row_selector(canvas, 3)
    wait_for_app_run(app)

    expected = (
        "Dataframe multi-row selection: {'select': {'rows': [0, 2], 'columns': []}}"
    )
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)


def test_multi_row_select_all_at_once(app: Page):
    """Test that all rows are selected when clicking on the top-row checkbox."""
    canvas = _get_multi_row_select_df(app)

    _click_on_row_selector(canvas, 0)
    wait_for_app_run(app)

    expected = "Dataframe multi-row selection: {'select': {'rows': [0, 1, 2, 3, 4], 'columns': []}}"
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)


# def test_multi_row_by_keeping_mouse_pressed(app: Page):
#     canvas = _get_multi_row_select_df(app)

#     bounding_box = canvas.bounding_box()
#     assert bounding_box is not None
#     print(f"BOUNDING BOX: {bounding_box}")
#     canvas_start_x_px = bounding_box.get("x", 0)
#     canvas_start_y_px = bounding_box.get("y", 0)

#     x, y = _get_row_position(2)
#     row_x_px = canvas_start_x_px + x
#     row_y_px = canvas_start_y_px + y
#     print(f"CLICK: {row_x_px},{row_y_px}")
#     app.mouse.move(row_x_px, row_y_px)
#     app.mouse.down()
#     x, y = _get_row_position(4)
#     app.mouse.move(canvas_start_x_px + x, canvas_start_y_px + y)

#     app.mouse.up()

#     expected = (
#         "Dataframe multi-row selection: {'select': {'rows': [1, 2, 3], 'columns': []}}"
#     )
#     selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
#     expect(selection_text).to_have_count(1)


def test_multi_column_select(app: Page):
    canvas = _get_multi_column_select_df(app)

    _click_on_column_selector(canvas, 1)
    # Meta = Apple's Command Key; for complete list see https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values#special_values
    app.keyboard.down("ControlOrMeta")
    _click_on_column_selector(canvas, 3)
    _click_on_column_selector(canvas, 4)
    app.keyboard.up("ControlOrMeta")
    wait_for_app_run(app)

    expected = "Dataframe multi-column selection: {'select': {'rows': [], 'columns': ['col_1', 'col_3', 'col_4']}}"
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)


def _select_some_rows_and_columns(app: Page, canvas: Locator):
    _click_on_row_selector(canvas, 1)
    _click_on_column_selector(canvas, 1)
    # Meta = Apple's Command Key; for complete list see https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values#special_values
    app.keyboard.down("ControlOrMeta")
    _click_on_column_selector(canvas, 3)
    _click_on_column_selector(canvas, 4)
    app.keyboard.up("ControlOrMeta")
    _click_on_row_selector(canvas, 3)
    wait_for_app_run(app)


def _expect_multi_row_multi_column_selection(app: Page):
    expected = "Dataframe multi-row-multi-column selection: {'select': {'rows': [0, 2], 'columns': ['col_1', 'col_3', 'col_4']}}"
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)


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
    expected = "Dataframe multi-row-multi-column selection: {'select': {'rows': [], 'columns': []}}"
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)


def test_clear_selection_via_toolbar(app: Page):
    canvas = _get_multi_row_and_column_select_df(app)

    # toolbar has three buttons: download, search, fullscreen
    data_editor_toolbar = canvas.get_by_test_id("stElementToolbar")
    toolbar_buttons = data_editor_toolbar.get_by_test_id("stElementToolbarButton")
    expect(toolbar_buttons).to_have_count(3)

    _select_some_rows_and_columns(app, canvas)
    _expect_multi_row_multi_column_selection(app)
    # toolbar has one more button now: clear selection
    toolbar_buttons = data_editor_toolbar.get_by_test_id("stElementToolbarButton")
    expect(toolbar_buttons).to_have_count(4)
    # click on the clear-selection button which is the first in the toolbar
    toolbar_buttons.nth(0).click()
    wait_for_app_run(app)
    expected = "Dataframe multi-row-multi-column selection: {'select': {'rows': [], 'columns': []}}"
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)


def test_in_form_selection_and_session_state(app: Page):
    canvas = _get_in_form_df(app)
    _select_some_rows_and_columns(app, canvas)

    # nothing should be shown yet because we did not submit the form
    expected = "Dataframe-in-form selection: {'select': {'rows': [], 'columns': []}}"
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)

    # submit the form
    app.get_by_test_id("baseButton-secondaryFormSubmit").click()
    wait_for_app_run(app)

    expected = "Dataframe-in-form selection: {'select': {'rows': [0, 2], 'columns': ['col_1', 'col_3', 'col_4']}}"
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)

    expected = "Dataframe-in-form selection in session state: {'select': {'rows': [0, 2], 'columns': ['col_1', 'col_3', 'col_4']}}"
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)


def test_multi_row_and_multi_column_selection_with_callback(app: Page):
    canvas = _get_callback_df(app)
    _select_some_rows_and_columns(app, canvas)

    expected = "Dataframe selection callback: {'select': {'rows': [0, 2], 'columns': ['col_1', 'col_3', 'col_4']}}"
    selection_text = app.get_by_test_id("stMarkdownContainer").filter(has_text=expected)
    expect(selection_text).to_have_count(1)


def test_multi_row_and_multi_column_select_snapshot(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Take a snapshot of multi-select to ensure visual consistency."""
    canvas = _get_multi_row_and_column_select_df(app)
    _select_some_rows_and_columns(app, canvas)
    _expect_multi_row_multi_column_selection(app)

    assert_snapshot(canvas, name="st_data_editor-multi_row_multi_column_selection")
