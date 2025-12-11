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
"""

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import (
    expect_prefixed_markdown,
    get_element_by_key,
)
from e2e_playwright.shared.dataframe_utils import (
    click_on_cell,
    expect_canvas_to_be_visible,
    get_open_cell_overlay,
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
