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

"""E2E tests for data_editor state persistence with session state feedback loop.

Tests the fix for issue #7749:
https://github.com/streamlit/streamlit/issues/7749

Also tests Phase 2: User-initiated row changes (additions/deletions via UI)
should preserve valid edits to other cells.
"""

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import (
    expect_prefixed_markdown,
    get_element_by_key,
)
from e2e_playwright.shared.dataframe_utils import (
    click_on_cell,
    expect_canvas_to_be_stable,
    expect_canvas_to_be_visible,
    get_open_cell_overlay,
    select_row,
)


def test_data_editor_preserves_edit_in_session_state_feedback_loop(app: Page) -> None:
    """Test that edits persist when data_editor is used in a session state feedback loop.

    This tests the fix for issue #7749 where edits would "disappear" when the
    underlying data was modified programmatically (e.g., computing a column).

    The test workflow:
    1. Edit a cell in the "In" column
    2. Verify the edit persists after the app reruns (with computed "Out" column)
    3. Verify the computed column reflects the edit
    """
    # Get the feedback loop data editor
    editor = get_element_by_key(app, "feedback_editor").get_by_test_id("stDataFrame")
    expect_canvas_to_be_visible(editor)

    # Initial state should have sum = 0 + 1 + 2 = 3
    expect_prefixed_markdown(app, "Sum of In column:", "3")

    # Click on the first cell of the "In" column (row 1, column 0 since index is hidden)
    # Row 0 is header, so we click on row 1 which is the first data row
    # Column layout with hide_index=True: 0=In, 1=Out
    click_on_cell(editor, row_pos=1, col_pos=0, double_click=True, column_width="small")

    # Get the cell overlay and type a new value
    cell_overlay = get_open_cell_overlay(app)
    expect(cell_overlay).to_be_visible()

    # Clear the cell and type a new value (5)
    cell_overlay.locator("input").fill("5")
    app.keyboard.press("Enter")
    wait_for_app_run(app)

    # After the edit, sum should be 5 + 1 + 2 = 8
    # This is the key test - previously this would show 3 (edit lost) on first try
    expect_prefixed_markdown(app, "Sum of In column:", "8")


def test_data_editor_simple_edit_persists(app: Page) -> None:
    """Test that simple edits persist without a computed column (baseline test)."""
    # Get the simple data editor
    editor = get_element_by_key(app, "simple_editor").get_by_test_id("stDataFrame")
    expect_canvas_to_be_visible(editor)

    # Initial state should have sum = 1 + 2 + 3 = 6
    expect_prefixed_markdown(app, "Sum of A column:", "6")

    # Click on the first cell of column "A" (row 1, column 0 since index is hidden)
    # Column layout with hide_index=True: 0=A, 1=B
    click_on_cell(editor, row_pos=1, col_pos=0, double_click=True, column_width="small")

    # Get the cell overlay and type a new value
    cell_overlay = get_open_cell_overlay(app)
    expect(cell_overlay).to_be_visible()

    # Clear the cell and type a new value (10)
    cell_overlay.locator("input").fill("10")
    app.keyboard.press("Enter")
    wait_for_app_run(app)

    # After the edit, sum should be 10 + 2 + 3 = 15
    expect_prefixed_markdown(app, "Sum of A column:", "15")


def test_data_editor_preserves_edit_after_row_deletion(app: Page) -> None:
    """Test that edits to remaining rows are preserved after deleting a row via UI.

    This tests Phase 2: User-initiated row changes. When a user deletes a row
    through the data_editor UI, edits to other rows should be preserved with
    adjusted indices.

    Workflow:
    1. Edit a cell in the first row (row 0)
    2. Delete a different row (row 1) via the UI
    3. Verify the edit to row 0 is still preserved
    """
    # Get the delete test data editor
    editor = get_element_by_key(app, "delete_editor").get_by_test_id("stDataFrame")
    expect_canvas_to_be_visible(editor)
    toolbar = editor.get_by_test_id("stElementToolbar")

    # Initial state: 4 rows, total = 100 + 200 + 300 + 400 = 1000
    expect_prefixed_markdown(app, "Delete test row count:", "4")
    expect_prefixed_markdown(app, "Delete test total:", "1000")

    # Step 1: Edit the first row's Score (change 100 to 500)
    # Row 1 is the first data row (row 0 is header), column 1 is Score
    click_on_cell(editor, row_pos=1, col_pos=1, double_click=True, column_width="small")
    cell_overlay = get_open_cell_overlay(app)
    expect(cell_overlay).to_be_visible()
    cell_overlay.locator("input").fill("500")
    app.keyboard.press("Enter")
    wait_for_app_run(app)

    # After edit: total = 500 + 200 + 300 + 400 = 1400
    expect_prefixed_markdown(app, "Delete test total:", "1400")

    # Step 2: Delete the second row (Bob, 200)
    expect_canvas_to_be_stable(editor)
    select_row(editor, row_pos=2, column_width="small")

    # Click the delete button in toolbar
    editor.hover()
    expect(toolbar).to_have_css("opacity", "1")
    delete_button = toolbar.get_by_test_id("stElementToolbarButton").get_by_label(
        "Delete row(s)"
    )
    expect(delete_button).to_be_visible()
    delete_button.click()
    wait_for_app_run(app)

    # Step 3: Verify the edit to row 0 (Alice's score = 500) is preserved
    # After deletion: 3 rows, total = 500 + 300 + 400 = 1200
    expect_prefixed_markdown(app, "Delete test row count:", "3")
    expect_prefixed_markdown(app, "Delete test total:", "1200")


def test_data_editor_preserves_edit_after_row_addition(app: Page) -> None:
    """Test that existing edits are preserved after adding a row via UI.

    This tests Phase 2: User-initiated row changes. When a user adds a row
    through the data_editor UI, edits to existing rows should be preserved.

    Workflow:
    1. Edit a cell in an existing row
    2. Add a new row via the UI
    3. Verify the original edit is preserved
    """
    # Get the add test data editor
    editor = get_element_by_key(app, "add_editor").get_by_test_id("stDataFrame")
    expect_canvas_to_be_visible(editor)
    toolbar = editor.get_by_test_id("stElementToolbar")

    # Initial state: 2 rows, total = 10 + 20 = 30
    expect_prefixed_markdown(app, "Add test row count:", "2")
    expect_prefixed_markdown(app, "Add test total:", "30")

    # Step 1: Edit the first row's Value (change 10 to 50)
    click_on_cell(editor, row_pos=1, col_pos=1, double_click=True, column_width="small")
    cell_overlay = get_open_cell_overlay(app)
    expect(cell_overlay).to_be_visible()
    cell_overlay.locator("input").fill("50")
    app.keyboard.press("Enter")
    wait_for_app_run(app)

    # After edit: total = 50 + 20 = 70
    expect_prefixed_markdown(app, "Add test total:", "70")

    # Step 2: Add a new row via toolbar
    expect_canvas_to_be_stable(editor)
    editor.hover()
    expect(toolbar).to_have_css("opacity", "1")
    add_button = toolbar.get_by_test_id("stElementToolbarButton").get_by_label(
        "Add row"
    )
    expect(add_button).to_be_visible()
    add_button.click()
    wait_for_app_run(app)

    # After adding row: 3 rows, total = 50 + 20 + 0 = 70 (new row has default 0)
    expect_prefixed_markdown(app, "Add test row count:", "3")
    # The edit to row 0 (Value = 50) should be preserved
    expect_prefixed_markdown(app, "Add test total:", "70")
