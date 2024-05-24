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

from __future__ import annotations

from typing import Final, Literal

from playwright.sync_api import Locator

# Determined by measuring a screenshot
ROW_MARKER_COLUMN_WIDTH_PX: Final = 30

# These values are defined in useColumnLoader of the DataFrame component:
COLUMN_SMALL_WIDTH_PX: Final = 75
COLUMN_MEDIUM_WIDTH_PX: Final = 200
COLUMN_LARGE_WIDTH_PX: Final = 400

# This value is defined in useTableSizer of the DataFrame component:
ROW_HEIGHT_PX: Final = 35

# The column headers are in row 0
HEADER_ROW_INDEX: Final = 0


def calc_middle_cell_position(
    row_pos: int,
    col_pos: int,
    column_width: Literal["small"] | Literal["medium"] | Literal["large"] = "small",
    has_row_marker_col: bool = False,
) -> tuple[int, int]:
    """Calculate the middle position of a cell in the dataframe.

    Parameters
    ----------

    row_pos : int
        The row number to use for the calculation. Starts at 0 with the header row.

    col_pos : int
        The column number to use for the calculation. Starts with 0 with the first column.
        If has_row_marker_col is True, the first column is the row marker column.

    column_width : "small" | "medium" | "large"
        The shared width setting of all columns. Can be "small", "medium" or "large".
        This needs to be enforced in the dataframe via column config.

    has_row_marker_col : bool
        Whether the dataframe has a row marker column (used when row selections are activated).


    Returns
    -------
    tuple[int, int]
        The x and y positions of the middle of the cell.
    """
    column_width_px = COLUMN_MEDIUM_WIDTH_PX
    if column_width == "small":
        column_width_px = COLUMN_SMALL_WIDTH_PX
    elif column_width == "large":
        column_width_px = COLUMN_LARGE_WIDTH_PX

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


def click_on_cell(
    dataframe_element: Locator,
    row_pos: int,
    col_pos: int,
    column_width: Literal["small"] | Literal["medium"] | Literal["large"] = "small",
    has_row_marker_col: bool = False,
    double_click: bool = False,
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
        Whether the dataframe has a row marker column (used when row selections are activated).

    double_click : bool
        Whether to double click on the cell.
    """
    column_middle_width_px, row_middle_height_px = calc_middle_cell_position(
        row_pos, col_pos, column_width, has_row_marker_col
    )
    position = {"x": column_middle_width_px, "y": row_middle_height_px}

    if double_click:
        dataframe_element.dblclick(position=position)
    else:
        dataframe_element.click(position=position)


def select_row(
    dataframe_element: Locator,
    row_pos: int,
    column_width: Literal["small"] | Literal["medium"] | Literal["large"] = "small",
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
    column_width: Literal["small"] | Literal["medium"] | Literal["large"] = "small",
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
        Whether the dataframe has a row marker column (used when row selections are activated).
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
    column_width: Literal["small"] | Literal["medium"] | Literal["large"] = "small",
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
        Whether the dataframe has a row marker column (used when row selections are activated).
    """
    click_on_cell(
        dataframe_element,
        HEADER_ROW_INDEX,
        col_pos,
        column_width,
        has_row_marker_col=has_row_marker_col,
    )
