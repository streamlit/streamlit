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

from __future__ import annotations

from typing import Final

import pytest
from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import expect_prefixed_markdown, get_element_by_key
from e2e_playwright.shared.dataframe_utils import (
    click_on_cell,
    edit_cell_value,
    expect_canvas_to_be_stable,
    expect_canvas_to_be_visible,
    get_open_cell_overlay,
    unfocus_dataframe,
)
from e2e_playwright.shared.react18_utils import (
    take_stable_snapshot,
    wait_for_react_stability,
)

EMPTY_STATE: Final = '{"added_rows": [], "deleted_rows": [], "edited_rows": {}}'


def _get_editor(app: Page, key: str) -> Locator:
    editor = get_element_by_key(app, key).get_by_test_id("stDataFrame").first
    expect(editor).to_be_visible()
    return editor


def _edit_first_cell(app: Page, key: str, value: str) -> None:
    editor = _get_editor(app, key)
    click_on_cell(editor, 1, 0, double_click=True, column_width="small")
    edit_cell_value(app, value)


def _expect_marker(app: Page, test_id: str, value: str) -> None:
    expect(app.locator(f"[data-testid='{test_id}']")).to_have_text(value)


def _click_button(app: Page, name: str) -> None:
    unfocus_dataframe(app)
    app.get_by_role("button", name=name).click(force=True)
    wait_for_app_run(app)


def test_keyed_fixed_editor_preserves_edits_across_source_value_changes(
    app: Page,
) -> None:
    _edit_first_cell(app, "value_editor", "5")

    _expect_marker(app, "value-result-a0", "5")
    _expect_marker(app, "value-result-b1", "20")
    _expect_marker(
        app,
        "value-editor-state",
        '{"added_rows": [], "deleted_rows": [], "edited_rows": {"0": {"a": 5}}}',
    )

    _click_button(app, "Value: update untouched cell")

    _expect_marker(app, "value-result-a0", "5")
    _expect_marker(app, "value-result-b1", "120")
    _expect_marker(
        app,
        "value-editor-state",
        '{"added_rows": [], "deleted_rows": [], "edited_rows": {"0": {"a": 5}}}',
    )
    # Must NOT happen: a value-only source change should not reset the widget
    # and wipe the pending edit.
    expect(app.locator("[data-testid='value-editor-state']")).not_to_have_text(
        EMPTY_STATE
    )

    _click_button(app, "Value: add source row")

    _expect_marker(app, "value-result-a0", "1")
    _expect_marker(app, "value-editor-state", EMPTY_STATE)


def test_edit_is_cleared_when_source_data_catches_up(app: Page) -> None:
    _edit_first_cell(app, "catchup_editor", "20")

    _expect_marker(app, "catchup-result-a0", "20")
    _expect_marker(
        app,
        "catchup-editor-state",
        '{"added_rows": [], "deleted_rows": [], "edited_rows": {"0": {"a": 20}}}',
    )

    _click_button(app, "Catchup: source to edited value")

    _expect_marker(app, "catchup-result-a0", "20")
    _expect_marker(app, "catchup-editor-state", EMPTY_STATE)

    _click_button(app, "Catchup: source moves again")

    _expect_marker(app, "catchup-result-a0", "30")
    _expect_marker(app, "catchup-editor-state", EMPTY_STATE)


# ---------------------------------------------------------------------------
# Row editing: adding/deleting rows and edit-state persistence.
# ---------------------------------------------------------------------------


def test_data_editor_toolbar_on_hover(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the toolbar is shown when hovering over a data editor component."""
    data_editor_element = _get_editor(themed_app, "data_editor")
    data_editor_toolbar = data_editor_element.get_by_test_id("stElementToolbar")
    expect(data_editor_toolbar).to_be_attached()

    # Ensure the canvas is stable before proceeding
    expect_canvas_to_be_stable(data_editor_element)

    # Check that it is currently not visible:
    expect(data_editor_toolbar).to_have_css("opacity", "0")

    # Hover over data editor:
    data_editor_element.hover()

    # Check that it is visible
    expect(data_editor_toolbar).to_have_css("opacity", "1")
    themed_app.wait_for_timeout(100)  # Brief wait for any animations to settle

    # Take a snapshot
    take_stable_snapshot(
        themed_app, data_editor_toolbar, assert_snapshot, name="st_data_editor-toolbar"
    )


# The snapshots are flaky on Firefox in CI.
@pytest.mark.skip_browser("firefox")
def test_data_editor_delete_row_via_toolbar(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that a row can be deleted via the toolbar."""
    data_editor_element = _get_editor(themed_app, "data_editor")
    data_editor_toolbar = data_editor_element.get_by_test_id("stElementToolbar")

    # Ensure canvas is stable before any actions
    expect_canvas_to_be_stable(data_editor_element)

    # Select the second row
    data_editor_element.click(position={"x": 10, "y": 100})

    # Wait for the row to be selected
    themed_app.wait_for_timeout(100)

    # Take a snapshot to check if row is selected using stable snapshot:
    take_stable_snapshot(
        themed_app,
        data_editor_element,
        assert_snapshot,
        name="st_data_editor-selected_row_for_deletion",
    )
    expect(data_editor_element).to_have_css("height", "247px")

    # The toolbar should be locked (visible):
    expect(data_editor_toolbar).to_have_css("opacity", "1")
    # Take snapshot to check if trash icon is in toolbar:
    take_stable_snapshot(
        themed_app,
        data_editor_toolbar,
        assert_snapshot,
        name="st_data_editor-row_deletion_toolbar",
    )

    # Click row deletion button:
    delete_row_button = data_editor_toolbar.get_by_test_id(
        "stElementToolbarButton"
    ).get_by_label("Delete row(s)")
    delete_row_button.click()

    wait_for_react_stability(themed_app)
    # The height should reflect that one row is missing (247px-35px=212px):
    expect(data_editor_element).to_have_css("height", "212px")


def test_data_editor_delete_row_via_hotkey(app: Page):
    """Test that a row can be deleted via delete hotkey."""
    data_editor_element = _get_editor(app, "data_editor")
    expect(data_editor_element).to_have_css("height", "247px")

    # Select the second row
    data_editor_element.click(position={"x": 10, "y": 100})

    # Wait for the row to be selected
    app.wait_for_timeout(100)

    # Press backspace to delete row:
    data_editor_element.press("Delete")

    # The height should reflect that one row is missing (247px-35px=212px):
    expect(data_editor_element).to_have_css("height", "212px")


# The snapshots are flaky on Firefox in CI.
@pytest.mark.skip_browser("firefox")
def test_data_editor_add_row_via_toolbar(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that a row can be added via the toolbar."""
    data_editor_element = _get_editor(app, "data_editor")
    expect_canvas_to_be_stable(data_editor_element)

    data_editor_toolbar = data_editor_element.get_by_test_id("stElementToolbar")
    expect(data_editor_element).to_have_css("height", "247px")

    # Activate toolbar:
    data_editor_element.hover()
    # Check that it is visible
    expect(data_editor_toolbar).to_have_css("opacity", "1")

    # Click add row button:
    add_row_button = data_editor_toolbar.get_by_test_id(
        "stElementToolbarButton"
    ).get_by_label("Add row")
    add_row_button.click()
    wait_for_app_run(app)

    # The height should reflect that one row is added (247px+35px=282px):
    expect(data_editor_element).to_have_css("height", "282px")

    # Add six more rows:
    add_row_button.click()
    add_row_button.click()
    add_row_button.click()
    add_row_button.click()
    add_row_button.click()
    add_row_button.click()
    wait_for_app_run(app)

    # Take a snapshot to check if rows are added:
    unfocus_dataframe(app)
    take_stable_snapshot(
        app,
        data_editor_element,
        assert_snapshot,
        name="st_data_editor-added_rows_via_toolbar",
    )


def test_data_editor_add_row_via_trailing_row(app: Page):
    """Test that a row can be added by clicking on the trailing row."""
    data_editor_element = _get_editor(app, "data_editor")
    expect(data_editor_element).to_have_css("height", "247px")

    # Click on the trailing row:
    data_editor_element.click(position={"x": 40, "y": 220})

    # Wait for the row to be selected
    app.wait_for_timeout(100)

    # The height should reflect that one row is added (247px+35px=282px):
    expect(data_editor_element).to_have_css("height", "282px")


def test_data_editor_keeps_state_after_unmounting(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the data editor keeps state correctly after unmounting."""
    data_editor_element = _get_editor(app, "data_editor")
    data_editor_toolbar = data_editor_element.get_by_test_id("stElementToolbar")
    expect(data_editor_element).to_have_css("height", "247px")

    # Check that the toolbar is currently not visible:
    expect(data_editor_toolbar).to_have_css("opacity", "0")

    # Activate toolbar:
    data_editor_element.hover()
    # Check that it is visible
    expect(data_editor_toolbar).to_have_css("opacity", "1")

    # Click add row button:
    add_row_button = data_editor_toolbar.get_by_test_id(
        "stElementToolbarButton"
    ).get_by_label("Add row")
    add_row_button.click()

    # The height should reflect that one row is added (247px+35px=282px):
    expect(data_editor_element).to_have_css("height", "282px")
    # The added row will trigger a rerun after a bounce, so we need to wait
    # for the app to finish running before we unmount the component.
    wait_for_app_run(app, 500)

    # Click button to unmount the component:
    app.get_by_role("button", name="Create some elements to unmount component").click()
    wait_for_app_run(app, 4000)

    expect(data_editor_element).to_be_visible()
    expect_canvas_to_be_stable(data_editor_element)
    # Check the height again, the row should be still attached:
    expect(data_editor_element).to_have_css("height", "282px")

    # Take a screenshot after unmounting:
    assert_snapshot(
        data_editor_element,
        name="st_data_editor-after_unmounting",
    )


# ---------------------------------------------------------------------------
# Cell editing: editing individual cell values via the cell overlay.
# ---------------------------------------------------------------------------


def _test_number_cell_editing(
    themed_app: Page,
    assert_snapshot: ImageCompareFunction,
    *,
    skip_snapshot: bool = False,
):
    """Test that the number cell can be edited."""
    cell_editor = _get_editor(themed_app, "cell_editor")
    expect_canvas_to_be_visible(cell_editor)

    # Click on the first cell of the table
    click_on_cell(cell_editor, 1, 0, double_click=True, column_width="medium")
    cell_overlay = get_open_cell_overlay(themed_app)
    # On some browsers the cell content is highlighted, so we enforce it to make the
    # test consistent and stable across all browsers
    cell_overlay.click()
    cell_overlay.press("ControlOrMeta+A")

    # Get the (number) input element and check the value
    expect(cell_overlay.locator(".gdg-input")).to_have_attribute("value", "1231231.41")
    if not skip_snapshot:
        assert_snapshot(cell_overlay, name="st_data_editor-number_col_editor")

    # Change the value
    cell_overlay.locator(".gdg-input").fill("9876.54")
    # Press Enter to apply the change
    themed_app.keyboard.press("Enter")
    wait_for_app_run(themed_app)

    # Check if that the value was submitted
    expect_prefixed_markdown(themed_app, "Edited DF:", "9876.54", exact_match=False)


def test_number_cell_editing(themed_app: Page, assert_snapshot: ImageCompareFunction):
    _test_number_cell_editing(themed_app, assert_snapshot)


@pytest.mark.performance
def test_number_cell_editing_performance(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the number cell can be edited."""
    _test_number_cell_editing(app, assert_snapshot, skip_snapshot=True)


def test_text_cell_editing(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the text cell can be edited."""
    cell_editor = _get_editor(themed_app, "cell_editor")
    expect_canvas_to_be_visible(cell_editor)

    # Click on the first cell of the table
    click_on_cell(cell_editor, 1, 1, double_click=True, column_width="medium")
    cell_overlay = get_open_cell_overlay(themed_app)

    # On some browsers the cell content is highlighted, so we enforce it to make the
    # test consistent and stable across all browsers
    cell_overlay.click()
    cell_overlay.press("ControlOrMeta+A")
    # Get the (text) input element and check the value
    expect(cell_overlay.locator(".gdg-input")).to_have_text("hello\nworld")
    assert_snapshot(cell_overlay, name="st_data_editor-text_col_editor")

    # Change the value
    cell_overlay.locator(".gdg-input").fill("edited value")
    # Press Enter to apply the change
    themed_app.keyboard.press("Enter")
    wait_for_app_run(themed_app)

    # Check if that the value was submitted
    expect_prefixed_markdown(
        themed_app, "Edited DF:", "edited value", exact_match=False
    )


def test_list_cell_editing(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the list cell can be edited."""
    cell_editor = _get_editor(app, "cell_editor")
    expect_canvas_to_be_visible(cell_editor)

    # Click on the first cell of the list column
    click_on_cell(cell_editor, 1, 2, double_click=True, column_width="medium")

    cell_overlay = get_open_cell_overlay(app)
    expect(cell_overlay).to_contain_text("hello")
    assert_snapshot(cell_overlay, name="st_data_editor-list_col_editor")

    # Change the value
    cell_overlay.locator("input").fill("new val")
    # Press Enter to insert the text as list value:
    app.keyboard.press("Enter")
    # Press Enter again to apply the change to the dataframe:
    app.keyboard.press("Enter")
    wait_for_app_run(app)

    # Check if that the value was submitted
    expect_prefixed_markdown(app, "Edited DF:", "new val", exact_match=False)


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "data_editor")).to_be_visible()
