/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React from "react"

import { GridSelection, CompactSelection } from "@glideapps/glide-data-grid"
import isEqual from "lodash/isEqual"

import { Arrow as ArrowProto } from "@streamlit/lib/src/proto"

export type SelectionHandlerReturn = {
  gridSelection: GridSelection
  isRowSelectionActivated: boolean
  isMultiRowSelectionActivated: boolean
  isColumnSelectionActivated: boolean
  isMultiColumnSelectionActivated: boolean
  isRowSelected: boolean
  isColumnSelected: boolean
  isCellSelected: boolean
  clearSelection: () => void
  clearCellSelection: () => void
  processSelectionChange: (newSelection: GridSelection) => void
}

/**
 * Custom hook that handles all selection capabilities for the interactive data table.
 *
 * @param element - The Arrow proto message
 * @param isEmptyTable - Whether the table is empty
 * @param isDisabled - Whether the table is disabled
 * @param syncSelectionState - The callback to sync the selection state
 *
 * @returns the selection handler return object
 */
function useSelectionHandler(
  element: ArrowProto,
  isEmptyTable: boolean,
  isDisabled: boolean,
  syncSelectionState: (newSelection: GridSelection) => void
): SelectionHandlerReturn {
  const [gridSelection, setGridSelection] = React.useState<GridSelection>({
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

  const isRowSelected = gridSelection.rows.length > 0
  const isColumnSelected = gridSelection.columns.length > 0
  const isCellSelected = gridSelection.current !== undefined

  const processSelectionChange = React.useCallback(
    (newSelection: GridSelection) => {
      const rowSelectionChanged = !isEqual(
        newSelection.rows.toArray(),
        gridSelection.rows.toArray()
      )

      const columnSelectionChanged = !isEqual(
        newSelection.columns.toArray(),
        gridSelection.columns.toArray()
      )

      let updatedSelection = newSelection
      if (
        (isRowSelectionActivated || isColumnSelectionActivated) &&
        newSelection.current !== undefined
      ) {
        // The default behavior is that row selections are cleared when a cell is selected.
        // This is not desired when row selection is activated. Instead, we want to keep the
        // row selection and only update the cell selection.
        updatedSelection = {
          ...newSelection,
          rows: gridSelection.rows,
          columns: gridSelection.columns,
        }
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
          columns: gridSelection.columns,
        }
      }
      if (
        columnSelectionChanged &&
        newSelection.columns.length > 0 &&
        rowSelectionChanged &&
        newSelection.rows.length === 0
      ) {
        // Keep the row selection if column selection was changed
        updatedSelection = {
          ...updatedSelection,
          rows: gridSelection.rows,
        }
      }

      setGridSelection(updatedSelection)

      if (
        (isRowSelectionActivated && rowSelectionChanged) ||
        (isColumnSelectionActivated && columnSelectionChanged)
      ) {
        syncSelectionState(updatedSelection)
      }
    },
    [
      gridSelection,
      isRowSelectionActivated,
      isColumnSelectionActivated,
      syncSelectionState,
    ]
  )

  // This callback is used to clear all selections (row/column/cell)
  const clearSelection = React.useCallback(() => {
    const emptySelection = {
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
      current: undefined,
    }
    setGridSelection(emptySelection)
    if (isRowSelectionActivated || isColumnSelectionActivated) {
      syncSelectionState(emptySelection)
    }
  }, [isRowSelectionActivated, isColumnSelectionActivated, syncSelectionState])

  // This callback is used to clear only cell selections
  const clearCellSelection = React.useCallback(() => {
    setGridSelection({
      columns: gridSelection.columns,
      rows: gridSelection.rows,
      current: undefined,
    })
  }, [gridSelection])

  return {
    gridSelection,
    isRowSelectionActivated,
    isMultiRowSelectionActivated,
    isColumnSelectionActivated,
    isMultiColumnSelectionActivated,
    isRowSelected,
    isColumnSelected,
    isCellSelected,
    clearSelection,
    clearCellSelection,
    processSelectionChange,
  }
}

export default useSelectionHandler
