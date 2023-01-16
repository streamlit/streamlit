/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import {
  EditableGridCell,
  GridCell,
  DataEditorProps,
  GridSelection,
  Item,
} from "@glideapps/glide-data-grid"

import {
  BaseColumn,
  isErrorCell,
} from "src/components/widgets/DataFrame/columns"
import EditingState from "src/components/widgets/DataFrame/EditingState"

/**
 * Create return type for useDataLoader hook based on the DataEditorProps.
 */
type DataEditorReturn = Pick<
  DataEditorProps,
  "onCellEdited" | "onPaste" | "onRowAppended" | "onDelete"
>

/**
 * Custom hook to handle all aspects related to data editing. This includes editing cells,
 * pasting from clipboard, and appending & deleting rows.
 *
 * @param numRows - The number of rows in the table (including additions & deletions)
 * @param columns - The columns of the table
 * @param fixedNumRows - Whether the number of rows is fixed. This means that rows cannot be added or deleted
 * @param getCellContent - Function to get a specific cell.
 * @param getOriginalIndex - Function to map a row ID of the current state to the original row ID.
 *                           This mainly changed by sorting of columns.
 * @param refreshCells - Callback that allows to trigger a UI refresh of a selection of cells.
 * @param commitWidgetState - Callback that allows to send the widget state to the backend (triggering a rerun).
 * @param editingState - The editing state of the data editor.
 *
 * @returns Glide-data-grid compatible functions for editing capabilities.
 */
function useDataEditor(
  numRows: number,
  columns: BaseColumn[],
  fixedNumRows: boolean,
  getCellContent: ([col, row]: readonly [number, number]) => GridCell,
  getOriginalIndex: (index: number) => number,
  refreshCells: (
    cells: {
      cell: [number, number]
    }[]
  ) => void,
  commitWidgetState: (clearSelection?: boolean) => void,
  editingState: React.MutableRefObject<EditingState>
): DataEditorReturn {
  const onCellEdited = React.useCallback(
    (
      [col, row]: readonly [number, number],
      updatedCell: EditableGridCell
    ): void => {
      const column = columns[col]

      const originalCol = column.indexNumber

      // We need to apply two different mappings here. One for the case that
      // the user has sorted a column, and another one from the editing state
      // to get the correct row ID when the user has deleted rows.
      const originalRow = editingState.current.getOriginalRowIndex(
        getOriginalIndex(row)
      )
      const currentCell = getCellContent([col, row])
      const currentValue = column.getCellValue(currentCell)
      const newValue = column.getCellValue(updatedCell)
      if (!isErrorCell(currentCell) && newValue === currentValue) {
        // No editing is required since the values did not change
        return
      }

      const newCell = column.getCell(newValue)

      editingState.current.setCell(originalCol, originalRow, {
        ...newCell,
        lastUpdated: performance.now(),
      })

      commitWidgetState()
    },
    [
      columns,
      editingState,
      getOriginalIndex,
      getCellContent,
      commitWidgetState,
    ]
  )

  const onRowAppended = React.useCallback(() => {
    const newRow: Map<number, GridCell> = new Map()
    columns.forEach(column => {
      newRow.set(column.indexNumber, column.getCell(undefined))
    })
    editingState.current.addRow(newRow)
    // TODO(lukasmasuch): should we really trigger a rerun here?
    commitWidgetState()
  }, [columns, editingState])

  const onDelete = React.useCallback(
    (selection: GridSelection): GridSelection | boolean => {
      if (selection.rows.length > 0) {
        // User has selected one or more rows
        if (fixedNumRows) {
          // Deleting rows is not supported
          return true
        }

        const rowsToDelete = selection.rows.toArray().map(row => {
          return editingState.current.getOriginalRowIndex(
            getOriginalIndex(row)
          )
        })
        // We need to delete all rows at once, so that the indexes work correct
        editingState.current.deleteRows(rowsToDelete)
        commitWidgetState(true)
        return false
      }
      if (selection.current?.range) {
        // User has selected one or more cells
        const updatedCells: { cell: [number, number] }[] = []
        const selectedArea = selection.current.range
        for (
          let row = selectedArea.y;
          row < selectedArea.y + selectedArea.height;
          row++
        ) {
          for (
            let col = selectedArea.x;
            col < selectedArea.x + selectedArea.width;
            col++
          ) {
            const column = columns[col]
            if (column.isEditable) {
              updatedCells.push({
                cell: [col, row],
              })
              onCellEdited(
                [col, row],
                column.getCell(null) as EditableGridCell
              )
            }
          }
        }

        if (updatedCells.length > 0) {
          commitWidgetState()
          refreshCells(updatedCells)
        }
        return false
      }
      return true
    },
    [columns, editingState, refreshCells, getOriginalIndex, commitWidgetState]
  )

  const onPaste = React.useCallback(
    (target: Item, values: readonly (readonly string[])[]): boolean => {
      const [targetCol, targetRow] = target

      const updatedCells: { cell: [number, number] }[] = []

      for (let row = 0; row < values.length; row++) {
        const rowData = values[row]
        if (row + targetRow >= numRows) {
          if (fixedNumRows) {
            // Only add new rows if editing mode is dynamic, otherwise break here
            break
          }
          // Adding rows during paste would not work currently. However, we already disallow
          // sorting in dynamic mode, so we don't have to do anything here.
          onRowAppended()
        }
        for (let col = 0; col < rowData.length; col++) {
          const pasteDataValue = rowData[col]

          const rowIndex = row + targetRow
          const colIndex = col + targetCol

          if (colIndex >= columns.length) {
            // We could potentially add new columns here in the future.
            break
          }

          const column = columns[colIndex]

          if (!column.isEditable) {
            // Column is not editable -> just ignore
            continue
          }

          const newCell = column.getCell(pasteDataValue)
          if (isErrorCell(newCell)) {
            // If new cell value leads to error -> just ignore
            continue
          }

          const originalCol = column.indexNumber
          const originalRow = editingState.current.getOriginalRowIndex(
            getOriginalIndex(rowIndex)
          )

          const currentValue = column.getCellValue(
            getCellContent([colIndex, rowIndex])
          )

          const newValue = column.getCellValue(newCell)
          if (newValue === currentValue) {
            // No editing is required since the values did not change
            continue
          }

          editingState.current.setCell(originalCol, originalRow, {
            ...newCell,
            lastUpdated: performance.now(),
          })

          updatedCells.push({
            cell: [colIndex, rowIndex],
          })
        }

        if (updatedCells.length > 0) {
          commitWidgetState()
          refreshCells(updatedCells)
        }
      }

      return false
    },
    [
      columns,
      numRows,
      editingState,
      getOriginalIndex,
      getCellContent,
      onRowAppended,
      commitWidgetState,
      refreshCells,
    ]
  )

  return {
    onCellEdited,
    onPaste,
    onRowAppended,
    onDelete,
  }
}

export default useDataEditor
