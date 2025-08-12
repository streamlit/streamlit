/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { useCallback, useState } from "react"

import { CompactSelection, GridSelection } from "@glideapps/glide-data-grid"
import isEqual from "lodash/isEqual"

import { Arrow as ArrowProto } from "@streamlit/protobuf"

import { BaseColumn } from "~lib/components/widgets/DataFrame/columns"

export type SelectionHandlerReturn = {
  // The current selection state
  gridSelection: GridSelection
  // True, if row selection is activated
  isRowSelectionActivated: boolean
  // True, if multi row selection is activated
  isMultiRowSelectionActivated: boolean
  // True, if column selection is activated
  isColumnSelectionActivated: boolean
  // True, if multi column selections is activated
  isMultiColumnSelectionActivated: boolean
  // True, if cell selection is activated
  isCellSelectionActivated: boolean
  // True, if multi cell selection is activated
  isMultiCellSelectionActivated: boolean
  // True, if at least one row is selected
  isRowSelected: boolean
  // True, if at least one column is selected
  isColumnSelected: boolean
  // True, if at least one cell is selected
  isCellSelected: boolean
  // Callback to clear selections
  clearSelection: (keepRows?: boolean, keepColumns?: boolean) => void
  // Callback to process selection changes from the grid
  processSelectionChange: (newSelection: GridSelection) => void
}

/**
 * Custom hook that handles all selection capabilities for the interactive data table.
 *
 * @param element - The Arrow proto message
 * @param isEmptyTable - Whether the table is empty
 * @param isDisabled - Whether the table is disabled
 * @param columns - The columns of the table.
 * @param syncSelectionState - The callback to sync the selection state
 *
 * @returns the selection handler return object
 */
function useSelectionHandler(
  element: ArrowProto,
  isEmptyTable: boolean,
  isDisabled: boolean,
  columns: BaseColumn[],
  syncSelectionState: (
    newSelection: GridSelection,
    syncCellSelections: boolean
  ) => void
): SelectionHandlerReturn {
  const [gridSelection, setGridSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
    current: undefined,
  })

  const isRowSelectionActivated =
    !isEmptyTable &&
    !isDisabled &&
    (element.selectionMode.includes(ArrowProto.SelectionMode.MULTI_ROW) ||
      element.selectionMode.includes(ArrowProto.SelectionMode.SINGLE_ROW))
  const isMultiRowSelectionActivated =
    isRowSelectionActivated &&
    element.selectionMode.includes(ArrowProto.SelectionMode.MULTI_ROW)

  const isColumnSelectionActivated =
    !isEmptyTable &&
    !isDisabled &&
    (element.selectionMode.includes(ArrowProto.SelectionMode.SINGLE_COLUMN) ||
      element.selectionMode.includes(ArrowProto.SelectionMode.MULTI_COLUMN))
  const isMultiColumnSelectionActivated =
    isColumnSelectionActivated &&
    element.selectionMode.includes(ArrowProto.SelectionMode.MULTI_COLUMN)

  const isCellSelectionActivated =
    !isEmptyTable &&
    !isDisabled &&
    (element.selectionMode.includes(ArrowProto.SelectionMode.SINGLE_CELL) ||
      element.selectionMode.includes(ArrowProto.SelectionMode.MULTI_CELL))

  const isMultiCellSelectionActivated =
    isCellSelectionActivated &&
    element.selectionMode.includes(ArrowProto.SelectionMode.MULTI_CELL)

  const isRowSelected = gridSelection.rows.length > 0
  const isColumnSelected = gridSelection.columns.length > 0
  const isCellSelected = gridSelection.current !== undefined

  /**
   * This callback is used to process selection changes and - if activated -
   * trigger a sync of the state with the widget state
   */
  const processSelectionChange = useCallback(
    (newSelection: GridSelection) => {
      const rowSelectionChanged = !isEqual(
        newSelection.rows.toArray(),
        gridSelection.rows.toArray()
      )

      const columnSelectionChanged = !isEqual(
        newSelection.columns.toArray(),
        gridSelection.columns.toArray()
      )

      const cellSelectionChanged = !isEqual(
        newSelection.current,
        gridSelection.current
      )

      // A flag to determine if the selection should be synced with the widget state
      let syncSelection =
        (isRowSelectionActivated && rowSelectionChanged) ||
        (isColumnSelectionActivated && columnSelectionChanged) ||
        (isCellSelectionActivated && cellSelectionChanged)

      let updatedSelection = newSelection
      if (
        (isRowSelectionActivated || isColumnSelectionActivated) &&
        newSelection.current !== undefined &&
        cellSelectionChanged
      ) {
        // The default behavior is that row/column selections are cleared when a cell is selected.
        // This is not desired when row selection is activated. Instead, we want to keep the
        // row/column selection and only update the cell selection.
        updatedSelection = {
          ...newSelection,
          rows:
            newSelection.rows.length === 0
              ? gridSelection.rows
              : newSelection.rows,
          columns:
            newSelection.columns.length === 0
              ? gridSelection.columns
              : newSelection.columns,
        }

        // Sync selections with widget state if cell selections are activated.
        // Otherwise, treat this as normal grid navigation with UI only updates.
        syncSelection = isCellSelectionActivated
      }

      if (
        rowSelectionChanged &&
        newSelection.rows.length > 0 &&
        columnSelectionChanged &&
        newSelection.columns.length === 0
      ) {
        // Keep the column selection if row selection was changed
        updatedSelection = {
          ...updatedSelection,
          rows: newSelection.rows,
          columns: gridSelection.columns,
        }
        syncSelection = true
      }

      if (
        columnSelectionChanged &&
        newSelection.columns.length > 0 &&
        rowSelectionChanged &&
        newSelection.rows.length === 0
      ) {
        // Keep the row and cell selection if column selection was changed
        updatedSelection = {
          ...updatedSelection,
          columns: newSelection.columns,
          rows: gridSelection.rows,
          current: gridSelection.current,
        }

        syncSelection = true
      }

      if (columnSelectionChanged && updatedSelection.columns.length >= 0) {
        // Remove all index columns from the column selection
        // We don't want to allow selection of index columns.
        let cleanedColumns = updatedSelection.columns
        columns.forEach((column, idx) => {
          if (column.isIndex) {
            cleanedColumns = cleanedColumns.remove(idx)
          }
        })
        if (cleanedColumns.length < updatedSelection.columns.length) {
          updatedSelection = {
            ...updatedSelection,
            columns: cleanedColumns,
          }
        }
      }

      // Update the UI with the final selection state
      setGridSelection(updatedSelection)

      if (syncSelection) {
        // Sync this selection with the widget state / backend
        syncSelectionState(updatedSelection, isCellSelectionActivated)
      }
    },
    [
      gridSelection,
      isRowSelectionActivated,
      isColumnSelectionActivated,
      isCellSelectionActivated,
      syncSelectionState,
      columns,
    ]
  )

  /**
   * This callback is used to selections (row/column/cell)
   * and sync the state with the widget state if column or row selections
   * are activated and the selection has changed.
   *
   * @param keepRows - Whether to keep the row selection (default: false)
   * @param keepColumns - Whether to keep the column selection (default: false)
   */
  const clearSelection = useCallback(
    (keepRows = false, keepColumns = false) => {
      const emptySelection: GridSelection = {
        columns: keepColumns
          ? gridSelection.columns
          : CompactSelection.empty(),
        rows: keepRows ? gridSelection.rows : CompactSelection.empty(),
        current: undefined,
      }
      setGridSelection(emptySelection)

      if (
        (!keepRows && isRowSelectionActivated) ||
        (!keepColumns && isColumnSelectionActivated) ||
        isCellSelectionActivated
      ) {
        syncSelectionState(emptySelection, isCellSelectionActivated)
      }
    },
    [
      gridSelection,
      isRowSelectionActivated,
      isColumnSelectionActivated,
      isCellSelectionActivated,
      syncSelectionState,
    ]
  )

  return {
    gridSelection,
    isRowSelectionActivated,
    isMultiRowSelectionActivated,
    isColumnSelectionActivated,
    isMultiColumnSelectionActivated,
    isCellSelectionActivated,
    isMultiCellSelectionActivated,
    isRowSelected,
    isColumnSelected,
    isCellSelected,
    clearSelection,
    processSelectionChange,
  }
}

export default useSelectionHandler
