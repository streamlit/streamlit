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
  ValidatedGridCell,
} from "@glideapps/glide-data-grid"

import { logWarning } from "src/lib/log"
import { notNullOrUndefined } from "src/lib/utils"
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
  "onCellEdited" | "onPaste" | "onRowAppended" | "onDelete" | "validateCell"
>

/**
 * Custom hook to handle all aspects related to data editing. This includes editing cells,
 * pasting from clipboard, and appending & deleting rows.
 *
 * @param columns - The columns of the table.
 * @param fixedNumRows - Whether the number of rows is fixed. This means that rows cannot be added or deleted.
 * @param editingState - The editing state of the data editor.
 * @param getCellContent - Function to get a specific cell.
 * @param getOriginalIndex - Function to map a row ID of the current state to the original row ID.
 *                           This mainly changed by sorting of columns.
 * @param refreshCells - Callback that allows to trigger a UI refresh of a selection of cells.
 * @param applyEdits - Callback that needs to be called on all edits. This will also trigger a rerun
 *                     and send widget state to the backend.
 *
 * @returns Glide-data-grid compatible functions for editing capabilities.
 */
function useDataEditor(
  columns: BaseColumn[],
  fixedNumRows: boolean,
  editingState: React.MutableRefObject<EditingState>,
  getCellContent: ([col, row]: readonly [number, number]) => GridCell,
  getOriginalIndex: (index: number) => number,
  refreshCells: (
    cells: {
      cell: [number, number]
    }[]
  ) => void,
  applyEdits: (clearSelection?: boolean, triggerRerun?: boolean) => void
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

      const newCell = column.getCell(newValue, true)
      // Only update the cell if the new cell is not causing any errors:
      if (!isErrorCell(newCell)) {
        editingState.current.setCell(originalCol, originalRow, {
          ...newCell,
          lastUpdated: performance.now(),
        })

        applyEdits()
      } else {
        logWarning(
          `Not applying the cell edit since it causes this error:\n ${newCell.data}`
        )
      }
    },
    [columns, editingState, getOriginalIndex, getCellContent, applyEdits]
  )

  const onRowAppended = React.useCallback(() => {
    if (fixedNumRows) {
      // Appending rows is not supported
      return
    }

    const newRow: Map<number, GridCell> = new Map()
    columns.forEach(column => {
      // For the default value, we trust the developer to make a valid choice,
      // so we do not validate the value here.
      newRow.set(column.indexNumber, column.getCell(column.defaultValue))
    })
    editingState.current.addRow(newRow)
    applyEdits(false, false)
  }, [columns, editingState, fixedNumRows, applyEdits])

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
        applyEdits(true)
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
            // Only allow deletion if the column is editable and not configured as required
            if (column.isEditable && !column.isRequired) {
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
          applyEdits()
          refreshCells(updatedCells)
        }
        return false
      }
      return true
    },
    [
      columns,
      editingState,
      fixedNumRows,
      refreshCells,
      getOriginalIndex,
      applyEdits,
      onCellEdited,
    ]
  )

  const onPaste = React.useCallback(
    (target: Item, values: readonly (readonly string[])[]): boolean => {
      const [targetCol, targetRow] = target

      const updatedCells: { cell: [number, number] }[] = []

      for (let row = 0; row < values.length; row++) {
        const rowData = values[row]
        if (row + targetRow >= editingState.current.getNumRows()) {
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
          // Only add to columns that are editable:
          if (column.isEditable) {
            const newCell = column.getCell(pasteDataValue, true)
            // We are not editing cells if the pasted value leads to an error:
            if (notNullOrUndefined(newCell) && !isErrorCell(newCell)) {
              const originalCol = column.indexNumber
              const originalRow = editingState.current.getOriginalRowIndex(
                getOriginalIndex(rowIndex)
              )
              const currentValue = column.getCellValue(
                getCellContent([colIndex, rowIndex])
              )
              const newValue = column.getCellValue(newCell)
              // Edit the cell only if the value actually changed:
              if (newValue !== currentValue) {
                editingState.current.setCell(originalCol, originalRow, {
                  ...newCell,
                  lastUpdated: performance.now(),
                })

                updatedCells.push({
                  cell: [colIndex, rowIndex],
                })
              }
            }
          }
        }

        if (updatedCells.length > 0) {
          applyEdits()
          refreshCells(updatedCells)
        }
      }

      return false
    },
    [
      columns,
      editingState,
      fixedNumRows,
      getOriginalIndex,
      getCellContent,
      onRowAppended,
      applyEdits,
      refreshCells,
    ]
  )

  const validateCell = React.useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      const col = cell[0]
      if (col >= columns.length) {
        // This should never happen.
        // But we return true (default) to avoid any unknown issues.
        return true
      }

      const column = columns[col]
      if (column.validateInput) {
        // We get the actual raw value of the new cell and
        // validate it based on the column validateInput implementation:
        const validationResult = column.validateInput(
          column.getCellValue(newValue)
        )
        if (validationResult === true || validationResult === false) {
          // Only return if the validation result is a valid boolean value (true or false)
          // validationResult can also be other values, so we need to check this specifically.
          return validationResult
        }
        // If it is any other value, we return it as a corrected cell:
        return column.getCell(validationResult) as ValidatedGridCell
      }
      // If no validation is implemented, we accept the value:
      return true
    },
    [columns]
  )

  return {
    onCellEdited,
    onPaste,
    onRowAppended,
    onDelete,
    validateCell,
  }
}

export default useDataEditor
