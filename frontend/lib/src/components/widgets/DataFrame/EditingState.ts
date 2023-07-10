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

import { GridCell } from "@glideapps/glide-data-grid"

import {
  notNullOrUndefined,
  isNullOrUndefined,
} from "@streamlit/lib/src/util/utils"

import { BaseColumn, isMissingValueCell } from "./columns"
import { INDEX_IDENTIFIER } from "./hooks/useColumnLoader"

/**
 * Get the column name for a given column to use in the widget state.
 * This is either the column name or the index identifier for index columns.
 */
function getColumnName(column: BaseColumn): string {
  // TODO(lukasmasuch): We need to adapt this once we want to support multi-index columns.
  return column.isIndex
    ? INDEX_IDENTIFIER
    : isNullOrUndefined(column.name)
    ? ""
    : column.name
}

/**
 * The editing state keeps track of all table edits applied by the user.
 */
class EditingState {
  // row -> column -> GridCell
  // Using [number, number] as a key for a Map would not work.
  private editedCells: Map<number, Map<number, GridCell>> = new Map()

  // List of rows represented by of column -> GridCell mappings
  private addedRows: Array<Map<number, GridCell>> = []

  // List of deleted row IDs
  private deletedRows: number[] = []

  // The original number of rows in the table (without potential additions & deletions)
  private numRows = 0

  constructor(numRows: number) {
    this.numRows = numRows
  }

  /**
   * Convert the current editing state to a JSON string.
   *
   * @param columns - The columns of the table
   * @returns JSON string
   */
  toJson(columns: BaseColumn[]): string {
    const columnsByIndex = new Map<number, BaseColumn>()
    columns.forEach(column => {
      columnsByIndex.set(column.indexNumber, column)
    })

    const currentState = {
      // We use snake case here since this is the widget state
      // that is sent and used in the backend. Therefore, it should
      // conform with the Python naming conventions.
      edited_rows: {} as Record<number, Record<string, any>>,
      added_rows: [] as Record<string, any>[],
      deleted_rows: [] as number[],
    }

    // Loop through all edited cells and transform into the structure
    // we use for the JSON-compatible widget state:
    // row position -> column name -> edited value
    this.editedCells.forEach(
      (row: Map<number, GridCell>, rowIndex: number, _map) => {
        const editedRow: Record<string, any> = {}
        row.forEach((cell: GridCell, colIndex: number, _map) => {
          const column = columnsByIndex.get(colIndex)
          if (column) {
            editedRow[getColumnName(column)] = column.getCellValue(cell)
          }
        })
        currentState.edited_rows[rowIndex] = editedRow
      }
    )

    // Loop through all added rows and transform into the format that
    // we use for the JSON-compatible widget state:
    // List of column name -> edited value
    this.addedRows.forEach((row: Map<number, GridCell>) => {
      const addedRow: Record<string, any> = {}
      // This flags is used to check if the row is incomplete
      // (i.e. missing required values) and should therefore not be included in
      // the current state version.
      let isIncomplete = false
      row.forEach((cell: GridCell, colIndex: number, _map) => {
        const column = columnsByIndex.get(colIndex)
        if (column) {
          const cellValue = column.getCellValue(cell)

          if (
            column.isRequired &&
            column.isEditable &&
            isMissingValueCell(cell)
          ) {
            // If the cell is missing a required value, the row is incomplete
            isIncomplete = true
          }

          if (notNullOrUndefined(cellValue)) {
            addedRow[getColumnName(column)] = cellValue
          }
        }
      })
      if (!isIncomplete) {
        currentState.added_rows.push(addedRow)
      }
    })

    // The deleted rows don't need to be transformed
    currentState.deleted_rows = this.deletedRows

    // Convert undefined values to null, otherwise this is removed here since
    // undefined does not exist in JSON.
    const json = JSON.stringify(currentState, (_k, v) =>
      v === undefined ? null : v
    )
    return json
  }

  /**
   * Load the editing state from a JSON string.
   *
   * @param columns - The columns of the table
   * @returns JSON string
   */
  fromJson(editingStateJson: string, columns: BaseColumn[]): void {
    // Clear existing state:
    this.editedCells = new Map()
    this.addedRows = []
    this.deletedRows = []

    // Parse JSON editing string:
    const editingState = JSON.parse(editingStateJson)
    // Map columns to column index
    const columnsByIndex = new Map<number, BaseColumn>()
    columns.forEach(column => {
      columnsByIndex.set(column.indexNumber, column)
    })

    // Map column name to columns
    const columnsByName = new Map<string, BaseColumn>()
    columns.forEach(column => {
      columnsByName.set(getColumnName(column), column)
    })

    // Loop through all edited cells and transform into the structure
    // we use for the editing state:
    // row -> column -> GridCell
    Object.keys(editingState.edited_rows).forEach(key => {
      const rowIndex = Number(key)
      const editedRow = editingState.edited_rows[key]
      Object.keys(editedRow).forEach((colName: string) => {
        const cellValue = editedRow[colName]
        const column = columnsByName.get(colName)
        if (column) {
          const cell = column.getCell(cellValue)
          if (cell) {
            if (!this.editedCells.has(rowIndex)) {
              this.editedCells.set(rowIndex, new Map())
            }
            this.editedCells.get(rowIndex)?.set(column.indexNumber, cell)
          }
        }
      })
    })

    // Loop through all added rows and transform into the format that
    // we use for the editing state:
    // List of column index -> edited value
    editingState.added_rows.forEach((row: Record<string, any>) => {
      const addedRow: Map<number, GridCell> = new Map()

      // Set the cells that were actually edited in the row
      Object.keys(row).forEach(colName => {
        const cellValue = row[colName]

        const column = columnsByName.get(colName)

        if (column) {
          const cell = column.getCell(cellValue)
          if (cell) {
            addedRow.set(column.indexNumber, cell)
          }
        }
      })
      this.addedRows.push(addedRow)
    })

    // The deleted rows don't need to be transformed
    this.deletedRows = editingState.deleted_rows
  }

  /**
   * Returns true if the given row was added by the user through the UI.
   */
  isAddedRow(row: number): boolean {
    return row >= this.numRows
  }

  /**
   * Returns the cell at the given column and row,
   * in case the cell was edited or added.
   *
   * @param col - The column index
   * @param row - The row index
   *
   * @returns The edited cell at the given column and row
   */
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

  /**
   * Adds a cell to the editing state for the given column and row index.
   *
   * @param col - The column index
   * @param row - The row index
   * @param cell - The cell to add to the editing state
   */
  setCell(col: number, row: number, cell: GridCell): void {
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

  /**
   * Adds a new row to the editing state.
   *
   * @param rowCells - The cells of the row to add
   */
  addRow(rowCells: Map<number, GridCell>): void {
    this.addedRows.push(rowCells)
  }

  /**
   * Deletes the given rows from the editing state.
   *
   * @param rows - The rows to delete
   */
  deleteRows(rows: number[]): void {
    // Delete row one by one starting from the row with the highest index
    rows
      .sort((a, b) => b - a)
      .forEach(row => {
        this.deleteRow(row)
      })
  }

  /**
   * Deletes the given row from the editing state.
   *
   * @param row - The row to delete
   */
  deleteRow(row: number): void {
    if (isNullOrUndefined(row) || row < 0) {
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

  /**
   * Returns the original row index of the given row.
   * Since the user can delete rows, the original row index and the
   * current one can diverge.
   *
   * @param row - The row index from the current state
   *
   * @returns The original row index
   */
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

  /**
   * Returns the total number of rows of the current state.
   */
  getNumRows(): number {
    return this.numRows + this.addedRows.length - this.deletedRows.length
  }
}

export default EditingState
