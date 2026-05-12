/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Cell provider abstractions for the DataFrame component.
 *
 * This module provides a layered architecture for cell content resolution:
 * 1. Base cell provider - reads raw cells from the underlying data source (Quiver)
 * 2. Editing overlay - handles edited cells and added rows
 * 3. Cell formatter - converts raw Arrow data to Glide GridCell format
 * 4. Error boundary - catches and handles lookup/formatting errors
 *
 * This layering allows for future extensibility (e.g., lazy loading) by
 * replacing only the base cell provider while preserving editing, formatting,
 * and error handling behavior.
 */

import { GridCell } from "@glideapps/glide-data-grid"

import { getCellFromArrow } from "~lib/components/widgets/DataFrame/arrowUtils"
import {
  BaseColumn,
  getErrorCell,
} from "~lib/components/widgets/DataFrame/columns"
import { getStyledCell, StyledCell } from "~lib/dataframes/pandasStylerUtils"
import { DataFrameCell, Quiver } from "~lib/dataframes/Quiver"
import { notNullOrUndefined } from "~lib/util/utils"

import EditingState from "./EditingState"

/**
 * Raw cell data from the base data source before formatting.
 */
export interface RawCellData {
  /** The raw cell content from Arrow. */
  arrowCell: DataFrameCell
  /** Pandas styler information, if present. */
  styledCell: StyledCell | undefined
  /** CSS styles from pandas styler, if present. */
  cssStyles: string | undefined
}

/**
 * Result from the editing overlay layer.
 * Either returns an already-formatted edited cell, or raw data to be formatted.
 */
export type EditingOverlayResult =
  | { type: "edited"; cell: GridCell }
  | { type: "raw"; data: RawCellData }
  | { type: "error"; cell: GridCell }

/**
 * Interface for base cell data providers.
 * Implementations provide raw cell data from a data source (e.g., Quiver, lazy chunks).
 */
export interface BaseCellProvider {
  /**
   * Get raw cell data for the given position.
   * @param originalRow - The original (unmapped) row index
   * @param originalCol - The column index
   * @returns Raw cell data or undefined if the cell cannot be retrieved
   */
  getRawCell(originalRow: number, originalCol: number): RawCellData | undefined
}

/**
 * Base cell provider that reads from a Quiver (Arrow) data source.
 */
export function createQuiverCellProvider(data: Quiver): BaseCellProvider {
  return {
    getRawCell(originalRow: number, originalCol: number): RawCellData {
      const arrowCell = data.getCell(originalRow, originalCol)
      const styledCell = getStyledCell(data, originalRow, originalCol)
      return {
        arrowCell,
        styledCell,
        cssStyles: data.styler?.cssStyles,
      }
    },
  }
}

/**
 * Apply the editing overlay to cell retrieval.
 * Checks if a cell has been edited or is part of an added row,
 * returning the edited cell if so, otherwise delegating to the base provider.
 */
export function applyEditingOverlay(
  row: number,
  column: BaseColumn,
  editingState: EditingState,
  baseCellProvider: BaseCellProvider
): EditingOverlayResult {
  const originalCol = column.indexNumber
  const originalRow = editingState.getOriginalRowIndex(row)
  const isAddedRow = editingState.isAddedRow(originalRow)

  if (column.isEditable || isAddedRow) {
    const editedCell = editingState.getCell(originalCol, originalRow)
    if (notNullOrUndefined(editedCell)) {
      return {
        type: "edited",
        cell: {
          ...column.getCell(column.getCellValue(editedCell), false),
          lastUpdated: editedCell.lastUpdated,
        },
      }
    }

    if (isAddedRow) {
      return {
        type: "error",
        cell: getErrorCell(
          "Error during cell creation",
          "This error should never happen. Please report this bug. " +
            `No cell found for an added row: col=${originalCol}; row=${originalRow}`
        ),
      }
    }
  }

  const rawData = baseCellProvider.getRawCell(originalRow, originalCol)
  if (!rawData) {
    return {
      type: "error",
      cell: getErrorCell(
        "Error loading cell data",
        `Could not load data for cell: col=${originalCol}; row=${originalRow}`
      ),
    }
  }

  return { type: "raw", data: rawData }
}

/** Format raw cell data into a Glide GridCell. */
export function formatCell(
  column: BaseColumn,
  rawData: RawCellData
): GridCell {
  return getCellFromArrow(
    column,
    rawData.arrowCell,
    rawData.styledCell,
    rawData.cssStyles
  )
}

/**
 * Wrap cell retrieval with error boundary handling.
 * Catches any errors during cell lookup or formatting and returns an error cell.
 */
export function withErrorBoundary(fn: () => GridCell): GridCell {
  try {
    return fn()
  } catch (error) {
    return getErrorCell(
      "Error during cell creation",
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `This error should never happen. Please report this bug. \nError: ${error}`
    )
  }
}

/**
 * Complete cell content resolution using all layers.
 * This is the main entry point that combines bounds checking, editing overlay,
 * cell formatting, and error boundary handling.
 */
export function resolveCellContent(
  col: number,
  row: number,
  columns: BaseColumn[],
  numRows: number,
  editingState: EditingState,
  baseCellProvider: BaseCellProvider
): GridCell {
  if (col > columns.length - 1) {
    return getErrorCell(
      "Column index out of bounds",
      "This error should never happen. Please report this bug."
    )
  }

  if (row > numRows - 1) {
    return getErrorCell(
      "Row index out of bounds",
      "This error should never happen. Please report this bug."
    )
  }

  return withErrorBoundary(() => {
    const column = columns[col]
    const overlayResult = applyEditingOverlay(
      row,
      column,
      editingState,
      baseCellProvider
    )

    switch (overlayResult.type) {
      case "edited":
      case "error":
        return overlayResult.cell
      case "raw":
        return formatCell(column, overlayResult.data)
    }
  })
}
