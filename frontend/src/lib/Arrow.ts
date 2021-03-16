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

import { Column, Table } from "apache-arrow"
import { fromArrow } from "arquero"
import { set } from "immutable"
import { range, unzip } from "lodash"

import { IStyler } from "autogen/proto"
import { getDataFrame, setDataFrame } from "./dataFrameProto"

interface Schema {
  index_columns: (string | RangeIndex)[]
  columns: SchemaColumn[]
  column_indexes: any[]
}

interface RangeIndex {
  kind: "range"
  name: string | null
  start: number
  step: number
  stop: number
}

interface SchemaColumn {
  field_name: string
  metadata: Record<string, any> | null
  name: string | null
  numpy_type: string
  pandas_type: string
}

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

export interface Styler {
  uuid?: string
  caption?: string
  styles?: string
  displayValues?: Arrow
}

export class Arrow {
  private table: Table

  private schema: Schema

  private index: string[][]

  private columns: string[][]

  private data: any[][]

  private styler?: Styler

  constructor(dataBuffer: Uint8Array, styler?: IStyler) {
    this.table = Table.from(dataBuffer)
    this.schema = this.getSchema()
    this.index = this.getIndex()
    this.columns = this.getColumns()
    this.data = this.getData()
    this.styler = {
      uuid: styler?.uuid || undefined,
      caption: styler?.caption || undefined,
      styles: styler?.styles || undefined,
      displayValues: styler?.displayValues
        ? new Arrow(styler.displayValues)
        : undefined,
    }
  }

  private getSchema(): Schema {
    const schema = this.table.schema.metadata.get("pandas")
    if (schema == null) {
      throw new Error("Table schema is missing.")
    }
    return JSON.parse(schema)
  }

  private static getColumnData(column: Column): any[] {
    return range(0, column.length).map(rowIndex => column.get(rowIndex))
  }

  private getIndex(): string[][] {
    return this.schema.index_columns.map(field => {
      const isRangeIndex = typeof field === "object" && field.kind === "range"
      if (isRangeIndex) {
        const { start, stop, step } = field as RangeIndex
        return range(start, stop, step).map(String)
      }
      const column = this.table.getColumn(field as string)
      return Arrow.getColumnData(column).map(String)
    })
  }

  private getColumns(): string[][] {
    const isMultiIndex = this.schema.column_indexes.length > 1
    return unzip(
      this.schema.columns
        .map(column => column.field_name)
        .filter(fieldName => !this.schema.index_columns.includes(fieldName))
        .map(fieldName =>
          isMultiIndex
            ? JSON.parse(
                fieldName
                  .replace(/\(/g, "[")
                  .replace(/\)/g, "]")
                  .replace(/'/g, '"')
              )
            : [fieldName]
        )
    )
  }

  private getData(): any[][] {
    const rows = this.table.length
    const columns = this.columns.length > 0 ? this.columns[0].length : 0

    return range(0, rows).map(rowIndex =>
      range(0, columns).map(columnIndex =>
        this.table
          .getColumnAt(columnIndex)
          ?.get(rowIndex)
          ?.toString()
      )
    )
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
    const [headerColumns, dataRowsCheck] = this.index.length
      ? [this.index.length, this.index[0].length]
      : [0, 0]

    const [headerRows, dataColumnsCheck] = this.columns.length
      ? [this.columns.length, this.columns[0].length]
      : [0, 0]

    const [dataRows, dataColumns] = this.data.length
      ? [this.data.length, this.data[0].length]
      : // If there is no data, default to the number of header columns.
        [0, dataColumnsCheck]

    // (HK) TODO: dataRowsCheck isn't properly calculated after addRows.
    // if (
    //   (dataRows !== 0 && dataRows !== dataRowsCheck) ||
    //   (dataColumns !== 0 && dataColumns !== dataColumnsCheck)
    // ) {
    //   throw new Error(
    //     "Table dimensions don't align: " +
    //       `rows(${dataRows} != ${dataRowsCheck}) OR ` +
    //       `cols(${dataColumns} != ${dataColumnsCheck})`
    //   )
    // }

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
        content: this.index[columnIndex][dataRowIndex],
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

  public addRows(newRows: Arrow) {
    this.table = this.table.concat(newRows.table)
    console.log(this.table.length)
    console.log(this.getData())
  }

  public serialize() {
    return this.table.serialize()
  }
}

export function betaAddRows(element: any, namedDataSet: any) {
  // @ts-ignore
  window.languagePluginLoader
    // @ts-ignore
    .then(() => pyodide.loadPackage("pandas"))
    .then(() => {
      // @ts-ignore
      pyodide.runPython(`
        import pandas as pd
        df1 = pd.DataFrame(
            [["foo", 0], ["bar", 1]],
            index=["r1", "r2"],
            columns=["c1", "c2"],
        )
        df2 = pd.DataFrame(
            [["baz", 2]],
            index=["r3"],
            columns=["c1", "c2"],
        )
        df = df1.append(df2)
        print(df)
      `)
    })

  /* Custom wrapper */
  const df = getDataFrame(element)
  const original = new Arrow(df.get("data"))
  const newRows = new Arrow(namedDataSet.data.data)
  original.addRows(newRows)
  const newDf = set(df, "data", original.serialize())
  return setDataFrame(element, newDf)

  /* Arquero */
  // const df = getDataFrame(element)
  // const original = fromArrow(df.get("data"))
  // const newRows = fromArrow(namedDataSet.data.data)
  // const modified = original.concat(newRows)
  // console.log(modified.print())
  // return element
}
