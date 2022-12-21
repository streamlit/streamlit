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

import { notNullOrUndefined } from "src/lib/utils"

import { BaseColumn } from "./columns"

class EditingState {
  // row -> column -> GridCell
  // Using [number, number] as a key for a Map would not work.
  private editedCells: Map<number, Map<number, GridCell>> = new Map()

  // List of rows represented by of column -> GridCell mappings
  private addedRows: Array<Map<number, GridCell>> = []

  private deletedRows: number[] = []

  private numRows = 0

  constructor(numRows: number) {
    this.numRows = numRows
  }

  toJson(columns: BaseColumn[]): string {
    const columnsByIndex = new Map<number, BaseColumn>()
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
              column.getCellValue(cell)
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

export default EditingState
