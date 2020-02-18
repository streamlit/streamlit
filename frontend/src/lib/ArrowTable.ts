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

import { Table } from "apache-arrow"
import { Map as ImmutableMap } from "immutable"

type CellType = "blank" | "index" | "columns" | "data"

interface Cell {
  classNames: string
  content: string
  id?: string
  type: CellType
}

export default class ArrowTable {
  private readonly dataTable: Table
  private readonly indexTable: Table
  private readonly columnsTable: Table
  private readonly styler?: ImmutableMap<string, any>

  constructor(
    dataBuffer: Uint8Array,
    indexBuffer: Uint8Array,
    columnsBuffer: Uint8Array,
    styler?: any
  ) {
    this.dataTable = Table.from(dataBuffer)
    this.indexTable = Table.from(indexBuffer)
    this.columnsTable = Table.from(columnsBuffer)
    this.styler = styler
  }

  get rows(): number {
    console.log(
      "rows",
      this.indexTable.length,
      this.columnsTable.numCols,
      this.columnsTable.length,
      this.columnsTable.schema.fields
    )
    return this.indexTable.length + this.columnsTable.numCols
  }

  get columns(): number {
    return this.indexTable.numCols + this.columnsTable.length
  }

  get headerRows(): number {
    return this.rows - this.dataRows
  }

  get headerColumns(): number {
    return this.columns - this.dataColumns
  }

  get dataRows(): number {
    return this.dataTable.length
  }

  get dataColumns(): number {
    return this.dataTable.numCols
  }

  get uuid(): string | null {
    return this.styler?.get("uuid", null)
  }

  get caption(): string | null {
    return this.styler?.get("caption", null)
  }

  get styles(): string | null {
    return this.styler?.get("styles", null)
  }

  public getCell = (rowIndex: number, columnIndex: number): Cell => {
    const isBlankCell =
      rowIndex < this.headerRows && columnIndex < this.headerColumns
    const isIndexCell =
      rowIndex >= this.headerRows && columnIndex < this.headerColumns
    const isColumnsCell =
      rowIndex < this.headerRows && columnIndex >= this.headerColumns

    if (isBlankCell) {
      const classNames = ["blank"]
      if (columnIndex > 0) {
        classNames.push("level" + rowIndex)
      }

      return {
        type: "blank",
        classNames: classNames.join(" "),
        content: "",
      }
    } else if (isColumnsCell) {
      const dataColumnIndex = columnIndex - this.headerColumns
      const classNames = [
        "col_heading",
        "level" + rowIndex,
        "col" + dataColumnIndex,
      ]

      return {
        type: "columns",
        classNames: classNames.join(" "),
        content: this.getContent(this.columnsTable, dataColumnIndex, rowIndex),
      }
    } else if (isIndexCell) {
      const dataRowIndex = rowIndex - this.headerRows
      const classNames = [
        "row_heading",
        "level" + columnIndex,
        "row" + dataRowIndex,
      ]

      return {
        type: "index",
        id: `T_${this.uuid}level${columnIndex}_row${dataRowIndex}`,
        classNames: classNames.join(" "),
        content: this.getContent(this.indexTable, dataRowIndex, columnIndex),
      }
    } else {
      const dataRowIndex = rowIndex - this.headerRows
      const dataColumnIndex = columnIndex - this.headerColumns
      const classNames = ["data", "row" + dataRowIndex, "col" + dataColumnIndex]

      return {
        type: "data",
        id: `T_${this.uuid}row${dataRowIndex}_col${dataColumnIndex}`,
        classNames: classNames.join(" "),
        content: this.getContent(this.dataTable, dataRowIndex, dataColumnIndex),
      }
    }
  }

  private getContent = (
    table: Table,
    rowIndex: number,
    columnIndex: number
  ): string => {
    const column = table.getColumnAt(columnIndex)
    if (column === null) {
      return ""
    }
    return column.get(rowIndex)
  }
}
