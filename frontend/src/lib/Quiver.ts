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

import { Table } from "apache-arrow"
import { range, unzip } from "lodash"

import { IArrow, IStyler } from "src/autogen/proto"

type Index = any[][]
type Columns = string[][]
type Data = any[][]

interface Types {
  index: IndexType[]
  data: string[]
}

interface IndexType {
  name: string
  meta: any
}

enum IndexTypes {
  UnicodeIndex = "unicode",
  RangeIndex = "range",
  CategoricalIndex = "categorical",
  IntervalIndex = "interval[int64]",
  DatetimeIndex = "datetime",
  TimedeltaIndex = "time",
  PeriodIndex = "period[Q-DEC]",
  Int64Index = "int64",
  UInt64Index = "uint64",
  Float64Index = "float64",
}

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

interface Styler {
  uuid: string
  caption: string | null
  styles: string | null
  displayValues: Quiver
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

export class Quiver {
  public index: Index

  public columns: Columns

  public data: Data

  public types: Types

  public styler?: Styler

  constructor(element: IArrow) {
    const table = Table.from(element.data)
    const schema = this.parseSchema(table)

    const index = this.parseIndex(table, schema)
    const columns = this.parseColumns(schema)
    const data = this.parseData(table, schema, columns)
    const types = this.parseTypes(table, schema)
    const styler = element.styler
      ? this.parseStyler(element.styler)
      : undefined

    this.index = index
    this.columns = columns
    this.data = data
    this.types = types
    this.styler = styler
  }

  private parseSchema(table: Table): Schema {
    const schema = table.schema.metadata.get("pandas")
    if (schema == null) {
      // This should never happen!
      throw new Error("Table schema is missing.")
    }
    return JSON.parse(schema)
  }

  private parseIndex(table: Table, schema: Schema): Index {
    const data = schema.index_columns.map(field => {
      if (Quiver.isRangeIndex(field)) {
        const { start, stop, step } = field as RangeIndex
        return range(start, stop, step)
      }
      const column = table.getColumn(field as string)
      return range(0, column.length).map(rowIndex => column.get(rowIndex))
    })

    return data
  }

  private parseColumns(schema: Schema): Columns {
    const isMultiIndex = schema.column_indexes.length > 1
    return unzip(
      schema.columns
        .map(column => column.field_name)
        .filter(fieldName => !schema.index_columns.includes(fieldName))
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

  private parseData(table: Table, schema: Schema, columns: Columns): Data {
    const R = table.length
    const C = columns.length > 0 ? columns[0].length : 0
    if (R !== 0 && C !== 0) {
      return range(0, R).map(rowIndex =>
        range(0, C).map(columnIndex =>
          table.getColumnAt(columnIndex)?.get(rowIndex)
        )
      )
    }
    return []
  }

  private parseTypes(table: Table, schema: Schema): Types {
    const index = this.parseIndexType(schema)
    const data = this.parseDataType(table, schema)
    return { index, data }
  }

  private parseIndexType(schema: Schema): IndexType[] {
    return schema.index_columns.map(field => {
      if (Quiver.isRangeIndex(field)) {
        return {
          name: IndexTypes.RangeIndex,
          meta: field,
        }
      }

      // Get index column from columns schema.
      const indexColumn = schema.columns.find(
        column => column.field_name === field
      )

      // PeriodIndex and IntervalIndex values are kept in `numpy_type` property,
      // the rest in `pandas_type`.
      return {
        name:
          indexColumn?.pandas_type === "object"
            ? (indexColumn?.numpy_type as string)
            : (indexColumn?.pandas_type as string),
        meta: indexColumn?.metadata,
      }
    })
  }

  private parseDataType(table: Table, schema: Schema): string[] {
    const R = table.length
    return R > 0
      ? schema.columns
          .filter(column => !schema.index_columns.includes(column.field_name))
          .map(column => column.pandas_type)
      : []
  }

  private parseStyler(styler: IStyler): Styler {
    return {
      uuid: styler.uuid as string,
      caption: styler.caption as string | null,
      styles: styler.styles as string | null,
      displayValues: new Quiver({ data: styler.displayValues }),
    }
  }

  private concatIndices(
    otherIndex: Index,
    otherIndexTypes: IndexType[]
  ): Index {
    if (this.index[0].length === 0) {
      return otherIndex
    }

    if (!this.sameIndexTypes(this.types.index, otherIndexTypes)) {
      throw new Error(
        `Cannot concatenate index type ${JSON.stringify(
          this.types.index
        )} with ${JSON.stringify(otherIndexTypes)}.`
      )
    }

    return this.index.reduce(
      (newIndex: Index, firstIndexData: string[], i: number) => {
        const concatenatedIndex = this.concatIndex(
          firstIndexData,
          otherIndex[i],
          this.types.index[i]
        )
        newIndex.push(concatenatedIndex)
        return newIndex
      },
      []
    )
  }

  private sameIndexTypes(t1: IndexType[], t2: IndexType[]): boolean {
    // Make sure both indices have same dimensions.
    if (t1.length !== t2.length) {
      return false
    }

    return t1.every(
      (type: IndexType, index: number) => type.name === t2[index].name
    )
  }

  private concatIndex(i1: string[], i2: string[], type: IndexType): Index {
    if (type.name === IndexTypes.RangeIndex) {
      return this.concatRangeIndex(i1, i2, type)
    }
    return this.concatAnyIndex(i1, i2)
  }

  private concatRangeIndex(i1: any[], i2: any[], range: IndexType): Index {
    let newStop = range.meta.stop

    return i2.reduce((newIndex: Index) => {
      newIndex.push(newStop)
      newStop += range.meta.step
      return newIndex
    }, i1)
  }

  private concatAnyIndex(i1: any[], i2: any[]): Index {
    return i1.concat(i2)
  }

  private concatData(otherData: Data, otherDataType: string[]): Data {
    if (this.data.length === 0) {
      return otherData
    }

    if (!this.sameDataTypes(this.types.data, otherDataType)) {
      throw new Error(
        `Cannot concatenate data type ${JSON.stringify(
          this.types.data
        )} with ${JSON.stringify(otherDataType)}.`
      )
    }

    const numberOfColumns = this.data.length

    return this.data.concat(
      otherData.map((data: string[]) => data.slice(0, numberOfColumns))
    )
  }

  private sameDataTypes(t1: string[], t2: string[]): boolean {
    return t1.every((type: string, index: number) => type === t2[index])
  }

  private concatTypes(otherTypes: Types): Types {
    const index = this.concatIndexTypes(otherTypes.index)
    const data = this.concatDataTypes(otherTypes.data)

    return { index, data }
  }

  private concatIndexTypes(otherIndexTypes: IndexType[]): IndexType[] {
    if (this.types.index.length === 0) {
      return otherIndexTypes
    }

    return this.types.index.reduce(
      (newIndex: IndexType[], firstIndexType: IndexType, i: number) => {
        if (firstIndexType.name === IndexTypes.RangeIndex) {
          const firstStop = firstIndexType.meta.stop
          const secondStop = otherIndexTypes[i].meta.stop
          const secondStep = otherIndexTypes[i].meta.step
          const newStop = firstStop + secondStop / secondStep
          firstIndexType.meta.stop = newStop
        }
        newIndex.push(firstIndexType)
        return newIndex
      },
      []
    )
  }

  private concatDataTypes(otherDataTypes: string[]): string[] {
    if (this.types.data.length === 0) {
      return otherDataTypes
    }

    return this.types.data
  }

  private static isRangeIndex(field: string | RangeIndex): boolean {
    return typeof field === "object" && field.kind === "range"
  }

  private static format(x: any, type: string): string {
    return x.toString()
  }

  get tableId(): string | undefined {
    // TODO
    return this.styler?.uuid && `T_${this.styler.uuid}`
  }

  get tableStyles(): string | undefined {
    // TODO
    return this.styler?.styles || undefined
  }

  get caption(): string | undefined {
    // TODO
    return this.styler?.caption || undefined
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

    if (
      (dataRows !== 0 && dataRows !== dataRowsCheck) ||
      (dataColumns !== 0 && dataColumns !== dataColumnsCheck)
    ) {
      throw new Error(
        "Dataframe dimensions don't align: " +
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

  public isEmpty(): boolean {
    return (
      // TODO: Refactor `getIndex` before this.
      this.index[0].length === 0 &&
      this.columns.length === 0 &&
      this.data.length === 0
    )
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

      const id = this.styler?.uuid
        ? `T_${this.styler.uuid}level${columnIndex}_row${dataRowIndex}`
        : undefined
      const classNames = [
        `row_heading`,
        `level${columnIndex}`,
        `row${dataRowIndex}`,
      ].join(" ")

      const contentType = this.types.index[columnIndex].name
      // Table index is stored in a columnar format.
      const content = Quiver.format(
        this.index[columnIndex][dataRowIndex],
        contentType
      )

      return {
        type: "index",
        id,
        classNames,
        content,
      }
    }

    if (isColumnsCell) {
      const dataColumnIndex = columnIndex - headerColumns

      const classNames = [
        `col_heading`,
        `level${rowIndex}`,
        `col${dataColumnIndex}`,
      ].join(" ")

      return {
        type: "columns",
        classNames,
        content: this.columns[rowIndex][dataColumnIndex],
      }
    }

    const dataRowIndex = rowIndex - headerRows
    const dataColumnIndex = columnIndex - headerColumns

    const id = this.styler?.uuid
      ? `T_${this.styler.uuid}row${dataRowIndex}_col${dataColumnIndex}`
      : undefined
    const classNames = [
      "data",
      `row${dataRowIndex}`,
      `col${dataColumnIndex}`,
    ].join(" ")

    const contentType = this.types.data[dataColumnIndex]
    const content = this.styler?.displayValues
      ? this.styler.displayValues.getCell(rowIndex, columnIndex).content
      : Quiver.format(this.data[dataRowIndex][dataColumnIndex], contentType)

    return {
      type: "data",
      id,
      classNames,
      content,
    }
  }

  public addRows(other: Quiver): void {
    if (this.styler || other.styler) {
      // TODO
      throw new Error("Cannot concatenate dataframes with styler.")
    }

    if (other.isEmpty()) {
      return
    }

    if (this.isEmpty()) {
      this.index = other.index
      this.columns = other.columns
      this.data = other.data
      this.types = other.types
      this.styler = other.styler
      return
    }

    try {
      // NOTE: Concat operations should be atomic.
      // Otherwise, indices will be concatenated even if
      // there is an error during data concatenation.
      const index = this.concatIndices(other.index, other.types.index)
      const data = this.concatData(other.data, other.types.data)
      const types = this.concatTypes(other.types)

      // NOTE: Columns are not modified.
      this.index = index
      this.data = data
      this.types = types
    } catch (e) {
      throw new Error(e.message)
    }
  }
}
