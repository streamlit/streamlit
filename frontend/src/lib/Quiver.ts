/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

import { ArrowNamedDataSet, Element, IArrow } from "autogen/proto"
import { Table } from "apache-arrow"
import { concatTables, Styler, toHumanFormat } from "lib/arrowProto"

interface TableDimensions {
  headerRows: number
  headerColumns: number
  dataRows: number
  dataColumns: number
  rows: number
  columns: number
}

type TableCellType = "blank" | "index" | "columns" | "data"

interface TableCell {
  type: TableCellType
  id?: string
  classNames: string
  content: string
}

export interface Index {
  data: any[][]
  type: IndexType
}

export interface IndexType {
  name: any
  meta: any
}

export class Quiver {
  public index: Index

  public columns: any[][]

  public data: any[][]

  private styler?: Styler

  constructor(element?: IArrow | null) {
    const table = Table.from(element?.data)
    const { index, columns, data } = toHumanFormat(table)

    this.index = index
    this.columns = columns
    this.data = data
  }

  get tableId(): string | undefined {
    return this.styler?.uuid && `T_${this.styler.uuid}`
  }

  get tableStyles(): string | undefined {
    return this.styler?.styles
  }

  get caption(): string | undefined {
    return this.styler?.caption
  }

  get dimensions(): TableDimensions {
    const [headerColumns, dataRowsCheck] = this.index.data.length
      ? [this.index.data.length, this.index.data[0].length]
      : [0, 0]

    const [headerRows, dataColumnsCheck] = this.columns.length
      ? [this.columns.length, this.columns[0].length]
      : [0, 0]

    const [dataRows, dataColumns] = this.data.length
      ? [this.data.length, this.data[0].length]
      : // If there is no data, default to the number of header columns.
        [0, dataColumnsCheck]

    // (HK) TODO: dataRowsCheck isn't properly calculated after addRows.
    if (
      (dataRows !== 0 && dataRows !== dataRowsCheck) ||
      (dataColumns !== 0 && dataColumns !== dataColumnsCheck)
    ) {
      throw new Error(
        "Table dimensions don't align: " +
          `rows(${dataRows} != ${dataRowsCheck}) OR ` +
          `cols(${dataColumns} != ${dataColumnsCheck})`
      )
    }

    const rows = headerRows + dataRows
    const columns = headerColumns + dataColumns

    return {
      headerRows,
      headerColumns,
      dataRows,
      dataColumns,
      rows,
      columns,
    }
  }

  public getCell(rowIndex: number, columnIndex: number): TableCell {
    const { headerRows, headerColumns, rows, columns } = this.dimensions

    if (rowIndex < 0 || rowIndex >= rows) {
      throw new Error("Row index is out of range.")
    }
    if (columnIndex < 0 || columnIndex >= columns) {
      throw new Error("Column index is out of range.")
    }

    const isBlankCell = rowIndex < headerRows && columnIndex < headerColumns
    const isIndexCell = rowIndex >= headerRows && columnIndex < headerColumns
    const isColumnsCell = rowIndex < headerRows && columnIndex >= headerColumns

    if (isBlankCell) {
      const classNames = ["blank"]
      if (columnIndex > 0) {
        classNames.push(`level${rowIndex}`)
      }
      return {
        type: "blank",
        classNames: classNames.join(" "),
        content: "",
      }
    }

    if (isIndexCell) {
      const dataRowIndex = rowIndex - headerRows

      const uuid = this.styler?.uuid
      const classNames = [
        `row_heading`,
        `level${columnIndex}`,
        `row${dataRowIndex}`,
      ]

      return {
        type: "index",
        id: uuid
          ? `T_${uuid}level${columnIndex}_row${dataRowIndex}`
          : undefined,
        classNames: classNames.join(" "),
        // Table index is stored as is (in the column format).
        content: this.index.data[columnIndex][dataRowIndex],
      }
    }

    if (isColumnsCell) {
      const dataColumnIndex = columnIndex - headerColumns

      const classNames = [
        `col_heading`,
        `level${rowIndex}`,
        `col${dataColumnIndex}`,
      ]

      return {
        type: "columns",
        classNames: classNames.join(" "),
        content: this.columns[rowIndex][dataColumnIndex],
      }
    }

    const dataRowIndex = rowIndex - headerRows
    const dataColumnIndex = columnIndex - headerColumns

    const uuid = this.styler?.uuid
    const classNames = ["data", `row${dataRowIndex}`, `col${dataColumnIndex}`]

    const content = this.styler?.displayValues
      ? this.styler.displayValues.getCell(rowIndex, columnIndex).content
      : this.data[dataRowIndex][dataColumnIndex]

    return {
      type: "data",
      id: uuid
        ? `T_${uuid}row${dataRowIndex}_col${dataColumnIndex}`
        : undefined,
      classNames: classNames.join(" "),
      content,
    }
  }

  public addRows(newRows: Quiver): void {
    const { index, data } = concatTables(this, newRows)
    this.index = index
    this.data = data
  }
}

export function betaAddRows(
  element: Element,
  namedDataSet: ArrowNamedDataSet
): Quiver {
  const original = new Quiver(element.betaTable)
  const newRows = new Quiver(namedDataSet.data)
  original.addRows(newRows)
  return original
}
