/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Table } from "@apache-arrow/esnext-esm"

type CellType = "blank" | "columnHeading" | "rowHeading" | "data"

interface Cell {
  type: CellType
  content: string
  id?: string
  classNames: string
}

class TheArrowTable {
  public readonly uuid: string
  private readonly headerColumnsTable: Table
  private readonly headerRowsTable: Table
  private readonly dataTable: Table

  constructor(
    uuid: string,
    headerColumnsBuffer: Uint8Array,
    headerRowsBuffer: Uint8Array,
    dataBuffer: Uint8Array
  ) {
    this.uuid = uuid
    this.headerColumnsTable = Table.from(headerColumnsBuffer)
    this.headerRowsTable = Table.from(headerRowsBuffer)
    this.dataTable = Table.from(dataBuffer)
  }

  get rows(): number {
    return this.headerColumnsTable.numCols + this.dataTable.length
  }

  get columns(): number {
    return this.headerRowsTable.numCols + this.dataTable.numCols
  }

  get headerRows(): number {
    return this.headerColumnsTable.numCols
  }

  get headerColumns(): number {
    return this.headerRowsTable.numCols
  }

  public getCell = (rowIndex: number, columnIndex: number): Cell => {
    const isBlankCell =
      rowIndex < this.headerRows && columnIndex < this.headerColumns
    const isColumnHeadingCell =
      rowIndex < this.headerRows && columnIndex >= this.headerColumns
    const isRowHeadingCell =
      rowIndex >= this.headerRows && columnIndex < this.headerColumns

    if (isBlankCell) {
      const classNames = ["blank"]
      if (columnIndex > 0) {
        classNames.push("level" + rowIndex)
      }

      return {
        type: "blank",
        content: "",
        classNames: classNames.join(" "),
      }
    } else if (isColumnHeadingCell) {
      const pandasColumnIndex = columnIndex - this.headerColumns
      const classNames = [
        "col_heading",
        "level" + rowIndex,
        "col" + pandasColumnIndex,
      ]

      return {
        type: "columnHeading",
        content: this.getContent(
          this.headerColumnsTable,
          pandasColumnIndex,
          rowIndex
        ),
        classNames: classNames.join(" "),
      }
    } else if (isRowHeadingCell) {
      const pandasRowIndex = rowIndex - this.headerRows
      const classNames = [
        "row_heading",
        "level" + columnIndex,
        "row" + pandasRowIndex,
      ]

      return {
        type: "rowHeading",
        content: this.getContent(
          this.headerRowsTable,
          pandasRowIndex,
          columnIndex
        ),
        id: `T_${this.uuid}level${columnIndex}_row${pandasRowIndex}`,
        classNames: classNames.join(" "),
      }
    } else {
      const pandasRowIndex = rowIndex - this.headerRows
      const pandasColumnIndex = columnIndex - this.headerColumns
      const classNames = [
        "data",
        "row" + pandasRowIndex,
        "col" + pandasColumnIndex,
      ]

      return {
        type: "data",
        content: this.getContent(
          this.dataTable,
          pandasRowIndex,
          pandasColumnIndex
        ),
        id: `T_${this.uuid}row${pandasRowIndex}_col${pandasColumnIndex}`,
        classNames: classNames.join(" "),
      }
    }
  }

  private getContent = (
    table: Table,
    rowIndex: number,
    columnIndex: number
  ) => {
    const column = table.getColumnAt(columnIndex)
    if (column === null) {
      return null
    }
    let content = column.get(rowIndex)
    content = this.handleIntValues(content)
    return content
  }

  private handleIntValues = (item: any): any => {
    if (item instanceof Int32Array || item instanceof Uint32Array) {
      // Recreate the 64bit integer from TypedArray.
      const first32Bits = this.toBinaryString(item[1], 32)
      const last32Bits = this.toBinaryString(item[0], 32)
      return parseInt(first32Bits + last32Bits, 2)
    }
    return item
  }

  private toBinaryString = (num: number, bits: number): string => {
    return (num >>> 0).toString(2).padStart(bits, "0")
  }
}

export default TheArrowTable
