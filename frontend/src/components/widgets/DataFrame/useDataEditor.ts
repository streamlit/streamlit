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

import React, { useState } from "react"
import {
  EditableGridCell,
  GridCell,
  DataEditorProps,
  GridSelection,
  Item,
} from "@glideapps/glide-data-grid"

import { debounce } from "src/lib/utils"
import { notNullOrUndefined } from "src/lib/utils"

import {
  CustomColumn,
  getErrorCell,
  getCell,
  isErrorCell,
  getCellValue,
} from "./DataFrameCells"

// Debounce time for triggering a widget state update
// This prevents to rapid updates to the widget state.
const DEBOUNCE_TIME_MS = 100

/**
 * Create return type for useDataLoader hook based on the DataEditorProps.
 */
type DataEditorReturn = {
  numRows: number
  resetEditingState: () => void
} & Pick<
  DataEditorProps,
  "getCellContent" | "onCellEdited" | "onPaste" | "onRowAppended" | "onDelete"
>

/**
 * The editing state of the DataFrame.
 */
class EditingState {
  // row -> column -> GridCell
  // Using [number, number] as a key for a Map would not work.
  private editedCells: Map<number, Map<number, GridCell>> = new Map()
  // List of rows represented by of column -> GridCell mappings
  private addedRows: Array<Map<number, GridCell>> = new Array()
  private deletedRows: number[] = new Array()
  private numRows: number = 0

  constructor(numRows: number) {
    this.numRows = numRows
  }

  toJson(columns: CustomColumn[]): string {
    const columnsByIndex = new Map<number, CustomColumn>()
    columns.forEach(column => {
      columnsByIndex.set(column.indexNumber, column)
    })

    const currentState = {
      edited_cells: {} as Record<string, any>,
      added_rows: [] as Map<number, any>[],
      deleted_rows: [] as number[],
    }

    this.editedCells.forEach(
      (row: Map<number, GridCell>, rowIndex: number, _map) => {
        row.forEach((cell: GridCell, colIndex: number, _map) => {
          const column = columnsByIndex.get(colIndex)
          if (column) {
            currentState.edited_cells[`${colIndex}:${rowIndex}`] =
              getCellValue(column, cell)
          }
        })
      }
    )

    // TODO(lukasmasuch): Support adding rows
    // this.addedRows.forEach((row: Map<number, GridCell>) => {
    //   currentState.edited_cells.push(row[0])
    // })

    currentState.deleted_rows = this.deletedRows
    // Convert undefined values to null, otherwise this is removed here since
    // undefined does not exist in JSON.
    return JSON.stringify(currentState, (k, v) => (v === undefined ? null : v))
  }

  isAddedRow(row: number): boolean {
    return row >= this.numRows
  }

  getCell(col: number, row: number): GridCell | undefined {
    if (this.isAddedRow(row)) {
      // Added rows have their own editing state
      return this.addedRows[row - this.numRows].get(col)
    }

    const rowCache = this.editedCells.get(row)
    if (rowCache === undefined) {
      return undefined
    }

    return rowCache.get(col)
  }

  setCell(col: number, row: number, cell: GridCell): void {
    console.log(
      "setCell",
      col,
      row,
      cell,
      this.editedCells,
      this.addedRows,
      this.isAddedRow(row)
    )
    if (this.isAddedRow(row)) {
      if (row - this.numRows >= this.addedRows.length) {
        // Added row does not exist. This is only expected to happen
        // in relation to a trailing row issue in glide-data-grid.
        return
      }
      // Added rows have their own editing state
      this.addedRows[row - this.numRows].set(col, cell)
    } else {
      if (this.editedCells.get(row) === undefined) {
        this.editedCells.set(row, new Map())
      }

      const rowCache = this.editedCells.get(row) as Map<number, GridCell>
      rowCache.set(col, cell)
    }
  }

  addRow(rowCells: Map<number, GridCell>): void {
    this.addedRows.push(rowCells)
  }

  deleteRows(rows: number[]): void {
    // Delete row one by one starting from the row with the highest index
    rows
      .sort((a, b) => b - a)
      .forEach(row => {
        this.deleteRow(row)
      })
  }

  deleteRow(row: number): void {
    if (!notNullOrUndefined(row) || row < 0) {
      // This should never happen
      return
    }

    if (this.isAddedRow(row)) {
      // Remove from added rows:
      this.addedRows.splice(row - this.numRows, 1)
      // there is nothing more we have to do
      return
    }

    if (!this.deletedRows.includes(row)) {
      // Add to the set
      this.deletedRows.push(row)
      // Sort the deleted rows (important for calculation of the original row index)
      this.deletedRows = this.deletedRows.sort((a, b) => a - b)
    }

    // Remove all cells from cell state associated with this row:
    this.editedCells.delete(row)
  }

  getOriginalRowIndex(row: number): number {
    // Just count all deleted rows before this row to determine the original row index:
    let originalIndex = row
    for (let i = 0; i < this.deletedRows.length; i++) {
      if (this.deletedRows[i] > originalIndex) {
        break
      }
      originalIndex += 1
    }
    return originalIndex
  }

  getNumRows(): number {
    return this.numRows + this.addedRows.length - this.deletedRows.length
  }
}

function useDataEditor(
  numRows: number,
  columns: CustomColumn[],
  fixedNumRows: boolean,
  getCellContent: ([col, row]: readonly [number, number]) => GridCell,
  getOriginalIndex: (index: number) => number,
  refreshCells: (
    cells: {
      cell: [number, number]
    }[]
  ) => void,
  commitWidgetValue: (currentEditingState: string) => void,
  clearSelection: () => void
): DataEditorReturn {
  const editingState = React.useRef<EditingState>(new EditingState(numRows))
  const [editedNumRows, setEditedNumRows] = useState(
    editingState.current.getNumRows()
  )

  React.useEffect(() => {
    editingState.current = new EditingState(numRows)
    setEditedNumRows(editingState.current.getNumRows())
  }, [numRows])

  const resetEditingState = React.useCallback(() => {
    editingState.current = new EditingState(numRows)
    setEditedNumRows(editingState.current.getNumRows())
  }, [numRows])

  const getEditedCellContent = React.useCallback(
    ([col, row]: readonly [number, number]): GridCell => {
      if (col > columns.length - 1) {
        return getErrorCell(
          "Column index out of bounds.",
          "This should never happen. Please report this bug."
        )
      }

      if (row > editedNumRows - 1) {
        return getErrorCell(
          "Row index out of bounds.",
          "This should never happen. Please report this bug."
        )
      }
      const column = columns[col]

      const originalCol = column.indexNumber
      const originalRow = editingState.current.getOriginalRowIndex(row)
      // Use editing state if editable or if it is an appended row
      if (column.isEditable || editingState.current.isAddedRow(originalRow)) {
        const editedCell = editingState.current.getCell(
          originalCol,
          originalRow
        )
        if (editedCell !== undefined) {
          return editedCell
        }
      }

      // We need to use the original row index here to support row deletions
      // The column mapping is already happening in the underlying getCellContent.
      return getCellContent([col, originalRow])
    },
    [columns, editedNumRows, editingState] // TODO: is editing state required here as dependency?
  )

  const triggerUpdate = React.useCallback(
    // Use debounce to prevent rapid updates to the widget state.
    debounce(DEBOUNCE_TIME_MS, () => {
      commitWidgetValue(editingState.current.toJson(columns))
    }),
    [editingState, columns, commitWidgetValue]
  )

  const onCellEdited = React.useCallback(
    (
      [col, row]: readonly [number, number],
      updatedCell: EditableGridCell
    ): void => {
      console.log("onCellEdited", col, row, updatedCell)
      const column = columns[col]

      const originalCol = column.indexNumber
      const originalRow = editingState.current.getOriginalRowIndex(
        getOriginalIndex(row)
      )
      const currentValue = getCellValue(
        column,
        getEditedCellContent([col, row])
      )
      const newValue = getCellValue(column, updatedCell)
      if (newValue === currentValue) {
        // No editing is required since the values did not change
        return
      }

      const newCell = getCell(column, newValue)

      editingState.current.setCell(originalCol, originalRow, {
        ...newCell,
        lastUpdated: performance.now(),
      })

      triggerUpdate()
    },
    [
      columns,
      editingState,
      getOriginalIndex,
      getEditedCellContent,
      triggerUpdate,
    ]
  )

  const onRowAppended = React.useCallback(() => {
    const newRow: Map<number, GridCell> = new Map()
    columns.forEach(column => {
      newRow.set(column.indexNumber, getCell(column, undefined))
    })
    editingState.current.addRow(newRow)
    setEditedNumRows(editingState.current.getNumRows())
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
        setEditedNumRows(editingState.current.getNumRows())
        clearSelection()
        triggerUpdate()
        return false
      }
      if (selection.current?.range) {
        // User has selected one or more cells
        const updatedCells: { cell: [number, number] }[] = []
        const selected_area = selection.current.range
        for (
          let row = selected_area.y;
          row < selected_area.y + selected_area.height;
          row++
        ) {
          for (
            let col = selected_area.x;
            col < selected_area.x + selected_area.width;
            col++
          ) {
            const column = columns[col]
            if (column.isEditable) {
              updatedCells.push({
                cell: [col, row],
              })
              onCellEdited(
                [col, row],
                getCell(column, undefined) as EditableGridCell
              )
            }
          }
        }

        if (updatedCells.length > 0) {
          triggerUpdate()
          refreshCells(updatedCells)
        }
        return false
      }
      return true
    },
    [columns, editingState, refreshCells, getOriginalIndex, triggerUpdate]
  )

  const onPaste = React.useCallback(
    (target: Item, values: readonly (readonly string[])[]): boolean => {
      const [targetCol, targetRow] = target

      const updatedCells: { cell: [number, number] }[] = []

      for (let row = 0; row < values.length; row++) {
        const rowData = values[row]
        if (row + targetRow >= editedNumRows) {
          if (fixedNumRows) {
            // Only add new rows if editing mode is dynamic, otherwise break here
            break
          }
          // TODO(lukasmasuch): Remove this since we are already disallowing sorting in dynamic mode
          // if (sort) {
          //   // Sorting and adding appending new rows via paste is currently
          //   // not compatible because the sort index isn't updated.
          //   break
          // }
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

          const newCell = getCell(column, pasteDataValue)
          if (isErrorCell(newCell)) {
            // If new cell value leads to error -> just ignore
            continue
          }

          const originalCol = column.indexNumber
          const originalRow = editingState.current.getOriginalRowIndex(
            getOriginalIndex(rowIndex)
          )

          const currentValue = getCellValue(
            column,
            getEditedCellContent([colIndex, rowIndex])
          )

          const newValue = getCellValue(column, newCell)
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
          triggerUpdate()
          refreshCells(updatedCells)
        }
      }

      return false
    },
    [
      columns,
      editedNumRows,
      editingState,
      getOriginalIndex,
      getEditedCellContent,
      onRowAppended,
      triggerUpdate,
      refreshCells,
    ]
  )

  return {
    numRows: editedNumRows,
    resetEditingState,
    getCellContent: getEditedCellContent,
    onCellEdited,
    onPaste,
    onRowAppended,
    onDelete,
  }
}

export default useDataEditor
