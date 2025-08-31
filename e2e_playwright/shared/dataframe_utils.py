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

from __future__ import annotations

import time
from typing import Final, Literal

from playwright.sync_api import (
    Locator,
    Page,
    Position,
    expect,
)

from e2e_playwright.shared.react18_utils import wait_for_react_stability

# Determined by measuring a screenshot
ROW_MARKER_COLUMN_WIDTH_PX: Final = 30

# These values are defined in useColumnLoader of the DataFrame component:
COLUMN_SIZE_MAPPING: Final = {
    "small": 75,
    "medium": 200,
    "large": 400,
}

# This value is defined in useTableSizer of the DataFrame component:
ROW_HEIGHT_PX: Final = 35

# The column headers are in row 0
HEADER_ROW_INDEX: Final = 0


def calc_middle_cell_position(
    row_pos: int,
    col_pos: int,
    column_width: Literal["small", "medium", "large"] = "small",
    has_row_marker_col: bool = False,
) -> tuple[float, float]:
    """Calculate the middle position of a cell in the dataframe.

    Parameters
    ----------
    row_pos : int
        The row number to use for the calculation. Starts at 0 with the header row.

    col_pos : int
        The column number to use for the calculation. Starts with 0 with the first
        column. If has_row_marker_col is True, the first column is the row marker
        column.

    column_width : "small" | "medium" | "large"
        The shared width setting of all columns. Can be "small", "medium" or "large".
        This needs to be enforced in the dataframe via column config.

    has_row_marker_col : bool
        Whether the dataframe has a row marker column (used when row selections are
        activated).


    Returns
    -------
    tuple[int, int]
        The x and y positions of the middle of the cell.
    """
    column_width_px = COLUMN_SIZE_MAPPING[column_width]

    row_middle_height_px = row_pos * ROW_HEIGHT_PX + (ROW_HEIGHT_PX / 2)
    if has_row_marker_col:
        if col_pos == 0:
            column_middle_width_px = ROW_MARKER_COLUMN_WIDTH_PX / 2
        else:
            column_middle_width_px = (
                ROW_MARKER_COLUMN_WIDTH_PX
                + max(col_pos - 1, 0) * column_width_px
                + (column_width_px / 2)
            )
    else:
        column_middle_width_px = col_pos * column_width_px + (column_width_px / 2)

    return column_middle_width_px, row_middle_height_px


def unfocus_dataframe(page: Page) -> None:
    """Unfocus the dataframe.

    This can be used to clear all selections and remove the focus and hovering from
    the dataframe element. This can be useful before taking screenshots.
    """
    page.keyboard.press("Escape")
    # Click somewhere to clear the focus from elements:
    page.get_by_test_id("stApp").click(position={"x": 0, "y": 0})


def open_column_menu(
    dataframe_element: Locator,
    col_pos: int,
    column_width: Literal["small", "medium", "large"] = "small",
    has_row_marker_col: bool = False,
) -> None:
    """Open the column menu for the specified column.

    This function uses a robust approach to click on the column header menu icon
    by directly interacting with the canvas element. It includes retry logic to
    handle potential timing issues with canvas rendering.

    Parameters
    ----------
    dataframe_element : Locator
        The dataframe element to open the column menu for.

    col_pos : int
        The column number to open the column menu for.

    column_width : "small" | "medium" | "large"
        The shared width setting of all columns. Can be "small", "medium" or "large".
        This needs to be enforced in the dataframe via column config.

    has_row_marker_col : bool
        Whether the dataframe has a row marker column (used when row selections are
        activated).
    """
    # First ensure the canvas is stable
    expect_canvas_to_be_stable(dataframe_element)

    canvas = dataframe_element.locator("canvas").first
    expect(canvas).to_be_visible()

    def attempt_open_menu():
        # Get the bounding box of the canvas
        bbox = canvas.bounding_box()
        if not bbox:
            raise Exception("Canvas bounding box not found")

        column_middle_width_px, row_middle_height_px = calc_middle_cell_position(
            0, col_pos, column_width, has_row_marker_col
        )

        canvas.click(
            position={
                # We need to click on the menu icon on the right side of the column header:
                "x": column_middle_width_px
                + (COLUMN_SIZE_MAPPING[column_width] / 2)
                - 10,
                "y": row_middle_height_px,
            },
            force=True,
        )

        wait_for_react_stability(dataframe_element.page)

        # Verify the column menu appeared
        menu = dataframe_element.page.get_by_test_id("stDataFrameColumnMenu")
        if not menu.is_visible():
            raise Exception("Column menu did not appear after click")
        return True

    retry_interaction(attempt_open_menu)


def click_on_cell(
    dataframe_element: Locator,
    row_pos: int,
    col_pos: int,
    column_width: Literal["small", "medium", "large"] = "small",
    has_row_marker_col: bool = False,
    double_click: bool = False,
    wait_after_ms: int = 200,
) -> None:
    """Click on the middle of the specified cell.

    Parameters
    ----------
    dataframe_element : Locator
        The dataframe element to click on.

    row_pos : int
        The row number to click on. Starts at 0 with the header row.

    col_pos : int
        The column number to click on. Starts with 0 with the first column.
        If has_row_marker_col is True, the first column is the row marker column.

    column_width : "small" | "medium" | "large"
        The shared width setting of all columns. Can be "small", "medium" or "large".
        This needs to be enforced in the dataframe via column config.

    has_row_marker_col : bool
        Whether the dataframe has a row marker column (used when row selections are
        activated).

    double_click : bool
        Whether to double click on the cell.

    wait_after_ms : int
        Time to wait after clicking in milliseconds
    """
    # First ensure the canvas is stable
    expect_canvas_to_be_stable(dataframe_element)

    column_middle_width_px, row_middle_height_px = calc_middle_cell_position(
        row_pos, col_pos, column_width, has_row_marker_col
    )
    position: Position = {"x": column_middle_width_px, "y": row_middle_height_px}

    def do_click():
        if double_click:
            dataframe_element.dblclick(position=position)
        else:
            dataframe_element.click(position=position)

    # Use retry logic for the click operation
    retry_interaction(do_click)

    # Wait longer to ensure the interaction is registered and applied
    dataframe_element.page.wait_for_timeout(wait_after_ms)


def select_row(
    dataframe_element: Locator,
    row_pos: int,
    column_width: Literal["small", "medium", "large"] = "small",
) -> None:
    """Select the specified row in the dataframe.

    This expects row selections to be activated.

    Parameters
    ----------
    dataframe_element : Locator
        The dataframe element to select the row in.

    row_pos : int
        The row number to select. Starts at 0 with the header row.

    column_width : "small" | "medium" | "large"
        The shared width setting of all columns. Can be "small", "medium" or "large".
        This needs to be enforced in the dataframe via column config.
    """
    click_on_cell(dataframe_element, row_pos, 0, column_width, has_row_marker_col=True)


def sort_column(
    dataframe_element: Locator,
    col_pos: int,
    column_width: Literal["small", "medium", "large"] = "small",
    has_row_marker_col: bool = False,
) -> None:
    """Sort the specified column in the dataframe.

    Parameters
    ----------
    dataframe_element : Locator
        The dataframe element to select the column in.

    col_pos : int
        The column number to select. Starts with 0 with the first column.
        If has_row_marker_col is True, the first column is the row marker column.

    column_width : "small" | "medium" | "large"
        The shared width setting of all columns. Can be "small", "medium" or "large".
        This needs to be enforced in the dataframe via column config.

    has_row_marker_col : bool
        Whether the dataframe has a row marker column (used when row selections are
        activated).
    """
    click_on_cell(
        dataframe_element,
        HEADER_ROW_INDEX,
        col_pos,
        column_width,
        has_row_marker_col=has_row_marker_col,
    )


def select_column(
    dataframe_element: Locator,
    col_pos: int,
    column_width: Literal["small", "medium", "large"] = "small",
    has_row_marker_col: bool = False,
) -> None:
    """Select the specified column in the dataframe.

    This expects column selections to be activated.

    Parameters
    ----------
    dataframe_element : Locator
        The dataframe element to select the column in.

    col_pos : int
        The column number to select. Starts with 0 with the first column.
        If has_row_marker_col is True, the first column is the row marker column.

    column_width : "small" | "medium" | "large"
        The shared width setting of all columns. Can be "small", "medium" or "large".
        This needs to be enforced in the dataframe via column config.

    has_row_marker_col : bool
        Whether the dataframe has a row marker column (used when row selections are
        activated).
    """
    click_on_cell(
        dataframe_element,
        HEADER_ROW_INDEX,
        col_pos,
        column_width,
        has_row_marker_col=has_row_marker_col,
    )


def get_open_cell_overlay(page: Page | Locator) -> Locator:
    """Get the currently open cell overlay / editor.

    Parameters
    ----------
    app : Locator
        The app.

    Returns
    -------
    Locator
        The open cell overlay.
    """
    # This is currently the best way to get the cell overlay
    # We should eventually add a stable test ID to the cell overlay
    # within glide-data-grid to better target it.
    cell_overlay = page.get_by_test_id("portal").locator(".gdg-clip-region")
    expect(cell_overlay).to_be_visible()
    return cell_overlay


def expect_canvas_to_be_stable(
    locator: Locator, timeout_ms: int = 2000, stability_ms: int = 300
):
    """
    Wait for canvas to become stable (no visual changes).

    This helps ensure canvas is fully rendered before interactions.

    Parameters
    ----------
    locator : Locator
        The dataframe locator containing the canvas
    timeout_ms : int
        Maximum time to wait for stability in milliseconds
    stability_ms : int
        Time the canvas needs to remain unchanged to be considered stable
    """
    canvas = locator.locator("canvas").first
    expect(canvas).to_be_visible()

    # Wait for canvas to be stable in size and position
    start_time = time.time()
    end_time = start_time + (timeout_ms / 1000)
    last_change_time = start_time
    last_box = None

    while time.time() < end_time:
        current_box = canvas.bounding_box()
        if current_box is None:
            time.sleep(0.05)
            continue

        if last_box is None:
            last_box = current_box
            continue

        # Check if dimensions or position changed
        changed = (
            abs(current_box["x"] - last_box["x"]) > 1
            or abs(current_box["y"] - last_box["y"]) > 1
            or abs(current_box["width"] - last_box["width"]) > 1
            or abs(current_box["height"] - last_box["height"]) > 1
        )

        if changed:
            last_change_time = time.time()
            last_box = current_box
        elif time.time() - last_change_time > (stability_ms / 1000):
            # Canvas is stable for required period
            return

        time.sleep(0.05)

    # If we get here, we timed out waiting for stability
    # Continue anyway - the test may still succeed


def expect_canvas_to_be_visible(locator: Locator):
    """Expect canvas to be visible.

    Should be used before trying to click on it or similar.

    Parameters
    ----------
    locator : Locator
    """
    expect(locator.locator("canvas").first).to_be_visible()
    # Ensure we see a stable canvas before allowing interactions
    expect_canvas_to_be_stable(locator)


def retry_interaction(func, max_attempts=3, delay_ms=100):
    """
    Retry a potentially flaky interaction.

    This function is particularly useful for handling transient issues in
    Playwright tests. Common scenarios where retries are helpful include:

    - Race conditions where elements aren't fully rendered or ready for interaction
    - Canvas rendering issues where click targets may shift slightly
    - DOM changes that occur between finding an element and interacting with it
    - Timing issues with animations, transitions, or loading states
    - Menu interactions where dropdowns may not appear immediately

    Specific Playwright exceptions that may be caught and retried:
    - TimeoutError: When an operation exceeds its time limit (most common)
    - Error: Base class for Playwright exceptions
      - ElementHandleError: When operations on element handles fail
      - TargetClosedError: When interacting with a closed target
      - NavigationError: When navigation fails or times out
    - AssertionError: From expect() assertions that fail due to timing issues

    Parameters
    ----------
    func : callable
        The function to retry
    max_attempts : int
        Maximum number of attempts
    delay_ms : int
        Delay between attempts in milliseconds

    Returns
    -------
    Result of the function if successful

    Raises
    ------
    The last exception if all attempts fail
    """
    last_exception = None

    for attempt in range(max_attempts):
        try:
            return func()
        except Exception as e:
            last_exception = e
            if attempt < max_attempts - 1:
                time.sleep(delay_ms / 1000)

    if last_exception:
        raise last_exception
