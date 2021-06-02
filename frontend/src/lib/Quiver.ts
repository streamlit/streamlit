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

import { IArrow, Styler as StylerProto } from "src/autogen/proto"

// TODO: rename this maybe? It's actually *all* indexes for the table.
// TODO: make a type union of all IndexTypes

/**
 * A column-major grid of index header values.
 */
type Index = any[][]

/**
 * A grid of column header values.
 */
type Columns = string[][]

/**
 * A row-major grid of a table's data.
 * TODO: type this.
 */
type Data = any[][]

/** Types for a table's index and data. */
interface Types {
  /** Types for each index column. */
  index: IndexTypeData[]

  /** Types for each data column. */
  // TODO: type union (or enum)
  data: string[]
}

/** Type data for a single index column. */
interface IndexTypeData {
  name: string

  // TODO: type this
  meta: any
}

// TODO: incorporate this into types (IndexTypeData, etc)
enum IndexTypeName {
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

/**
 * The Arrow table schema. It's a blueprint that tells us where data
 * is stored in the associated table. (Arrow stores the schema as a JSON string,
 * and we parse it into this typed object - so these member names come from
 * Arrow.)
 */
interface Schema {
  /**
   * The table's index types. (Each table has at least 1 index.)
   * There are many different index types; most of them are stored as strings,
   * but the "range" index type is a `RangeIndex` object.
   */
  index_columns: (string | RangeIndex)[]

  /**
   * Schemas for each column (index columns *and* data columns) in the table.
   */
  columns: ColumnSchema[]

  /** Column header index types. TODO: type this */
  column_indexes: any[]
}

/** Metadata for the "range" index type. */
interface RangeIndex {
  kind: "range"
  name: string | null
  start: number
  step: number
  stop: number
}

/**
 * Metadata for a single column in an Arrow table.
 * (This can describe an index column *or* a data column.)
 */
interface ColumnSchema {
  /**
   * The fieldName of the column. (Only set for non-index columns. TODO double check.)
   * For a single-index column, this is just be the name of the column (e.g. "foo").
   * For a multi-index column, this is a stringified tuple (e.g. "('1','foo')")
   */
  field_name: string

  /**
   * Column-specific metadata. Only used by certain column types
   * (e.g. categoricalIndex has num_categories.)
   */
  metadata: Record<string, any> | null

  /** The name of the column. (Only set for index columns. TODO: double check this) */
  name: string | null

  /**
   * The type of the column. When `pandas_type == "object"`, `numpy_type`
   * will have a more specific type.
   */
  pandas_type: string

  /**
   * When `pandas_type === "object"`, this field contains the object type.
   * If pandas_type has another value, numpy_type is ignored.
   */
  // TODO: turn this and pandas_type into string unions?
  numpy_type: string
}

/** Styling data for the entire table. */
interface Styler {
  /** The styler's unique ID. */
  uuid: string

  /** Optional user-specified caption. */
  caption: string | null

  /** CSS styles for the entire table. */
  styles: string | null

  /**
   * Stringified versions of each cell in the source table, in the
   * user-specified format.
   */
  displayValues: Quiver
}

/** Dimensions of the table. */
interface TableDimensions {
  headerRows: number
  headerColumns: number
  dataRows: number
  dataColumns: number
  rows: number
  columns: number
}

type TableCellType = "blank" | "index" | "columns" | "data"

/** Data for a single cell in a table. */
interface TableCell {
  type: TableCellType

  /** The cell's CSS id, if the table is styled. */
  cssId?: string

  /** The cell's CSS class. */
  cssClass: string

  // TODO: expose the actual data (not the pre-formatted data).
  /** The cell's formatted string value. */
  content: string
}

/**
 * Parses cell and style data from an Arrow table, and stores it in
 * row-major format (which is more useful for our frontend display code than
 * Arrow's columnar format).
 */
export class Quiver {
  private index: Index

  private columns: Columns

  private data: Data

  private types: Types

  private styler?: Styler

  constructor(element: IArrow) {
    const table = Table.from(element.data)
    const schema = Quiver.parseSchema(table)

    const index = Quiver.parseIndex(table, schema)
    const columns = Quiver.parseColumns(schema)
    const data = Quiver.parseData(table, columns)
    const types = Quiver.parseTypes(table, schema)
    const styler = element.styler
      ? Quiver.parseStyler(element.styler as StylerProto)
      : undefined

    this.index = index
    this.columns = columns
    this.data = data
    this.types = types
    this.styler = styler
  }

  /** Parse the table's schema from a JSON string to an object. */
  private static parseSchema(table: Table): Schema {
    const schema = table.schema.metadata.get("pandas")
    if (schema == null) {
      // This should never happen!
      throw new Error("Table schema is missing.")
    }
    return JSON.parse(schema)
  }

  /** Return all indexes for the table. */
  // TODO: check whether index is row-major or column-major
  private static parseIndex(table: Table, schema: Schema): Index {
    // index_columns contains the types of all indices
    return schema.index_columns.map(indexType => {
      if (Quiver.isRangeIndex(indexType)) {
        const { start, stop, step } = indexType as RangeIndex
        return range(start, stop, step)
      }

      // This is not a range index. The `indexType` is the name of the column.
      const column = table.getColumn(indexType as string)
      return range(0, column.length).map(rowIndex => column.get(rowIndex))
    })
  }

  /** Parse the column header data from the table's schema. */
  private static parseColumns(schema: Schema): Columns {
    const isMultiIndex = schema.column_indexes.length > 1

    // Perform this transformation:
    // ["('1','foo')", "('2','bar')"] -> [["1", "2"], ["foo", "bar"]]
    return unzip(
      schema.columns
        .map(columnSchema => columnSchema.field_name)
        // Remove all fields that are part of the index
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

  /** Parse the table's data into a 2D row-major array. */
  private static parseData(table: Table, columns: Columns): Data {
    const numDataRows = table.length
    const numDataColumns = columns.length > 0 ? columns[0].length : 0
    if (numDataRows === 0 && numDataColumns === 0) {
      // Empty table
      return []
    }

    return range(0, numDataRows).map(rowIndex =>
      range(0, numDataColumns).map(columnIndex =>
        table.getColumnAt(columnIndex)?.get(rowIndex)
      )
    )
  }

  /**
   * Return an object that contains the index and data types for the entire
   * table.
   */
  private static parseTypes(table: Table, schema: Schema): Types {
    const index = Quiver.parseIndexType(schema)
    const data = Quiver.parseDataType(table, schema)
    return { index, data }
  }

  /** Return an array of types for each index column. */
  private static parseIndexType(schema: Schema): IndexTypeData[] {
    return schema.index_columns.map(indexType => {
      if (Quiver.isRangeIndex(indexType)) {
        return {
          name: IndexTypeName.RangeIndex,
          meta: indexType,
        }
      }

      // Get index column from columns schema.
      const indexColumn = schema.columns.find(
        column => column.field_name === indexType
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

  /** Return an array of the types for each non-index column. */
  private static parseDataType(table: Table, schema: Schema): string[] {
    const numDataRows = table.length
    return numDataRows > 0
      ? schema.columns
          // Filter out all index columns
          .filter(column => !schema.index_columns.includes(column.field_name))
          .map(column => column.pandas_type)
      : []
  }

  private static parseStyler(styler: StylerProto): Styler {
    return {
      uuid: styler.uuid,
      caption: styler.caption,
      styles: styler.styles,
      displayValues: new Quiver({ data: styler.displayValues }),
    }
  }

  private concatIndices(
    otherIndex: Index,
    otherIndexTypes: IndexTypeData[]
  ): Index {
    if (this.index[0].length === 0) {
      // TODO: if an array contains only empty arrays, flatten the whole
      // thing to a single empty array.
      return otherIndex
    }

    if (!Quiver.sameIndexTypes(this.types.index, otherIndexTypes)) {
      throw new Error(
        `Cannot concatenate index type ${JSON.stringify(
          this.types.index
        )} with ${JSON.stringify(otherIndexTypes)}.`
      )
    }

    return this.index.reduce(
      (newIndex: Index, firstIndexData: string[], i: number) => {
        const concatenatedIndex = Quiver.concatIndex(
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

  /** True if both arrays contain the same types in the same order. */
  private static sameIndexTypes(
    t1: IndexTypeData[],
    t2: IndexTypeData[]
  ): boolean {
    // Make sure both indices have same dimensions.
    if (t1.length !== t2.length) {
      return false
    }

    return t1.every(
      (type: IndexTypeData, index: number) => type.name === t2[index].name
    )
  }

  private static concatIndex(
    i1: string[],
    i2: string[],
    type: IndexTypeData
  ): Index {
    if (type.name === IndexTypeName.RangeIndex) {
      return Quiver.concatRangeIndex(i1, i2, type)
    }
    return Quiver.concatAnyIndex(i1, i2)
  }

  // TODO: type i1 and i2
  private static concatRangeIndex(
    i1: any[],
    i2: any[],
    range: IndexTypeData
  ): Index {
    let newStop = range.meta.stop

    return i2.reduce((newIndex: Index) => {
      newIndex.push(newStop)
      newStop += range.meta.step
      return newIndex
    }, i1)
  }

  // TODO: type these params
  private static concatAnyIndex(i1: any[], i2: any[]): Index {
    return i1.concat(i2)
  }

  private concatData(otherData: Data, otherDataType: string[]): Data {
    if (this.data.length === 0) {
      return otherData
    }

    if (!Quiver.sameDataTypes(this.types.data, otherDataType)) {
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

  private static sameDataTypes(t1: string[], t2: string[]): boolean {
    return t1.every((type: string, index: number) => type === t2[index])
  }

  private concatTypes(otherTypes: Types): Types {
    const index = this.concatIndexTypes(otherTypes.index)
    const data = this.concatDataTypes(otherTypes.data)

    return { index, data }
  }

  private concatIndexTypes(otherIndexTypes: IndexTypeData[]): IndexTypeData[] {
    if (this.types.index.length === 0) {
      return otherIndexTypes
    }

    return this.types.index.reduce(
      (
        newIndex: IndexTypeData[],
        firstIndexType: IndexTypeData,
        i: number
      ) => {
        if (firstIndexType.name === IndexTypeName.RangeIndex) {
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

  private static isRangeIndex(indexType: string | RangeIndex): boolean {
    return typeof indexType === "object" && indexType.kind === "range"
  }

  private static format(x: any, type: string): string {
    return x.toString()
  }

  /**
   * The table's unique ID, if it has one.
   *
   * If the table has a Styler, the table's ID is `T_${StylerUUID}`. Otherwise,
   * it's undefined.
   *
   * This ID is used by styled tables and styled dataframes to associate
   * the table's styler CSS with the table's data.
   */
  public get tableCSSId(): string | undefined {
    if (this.styler?.uuid == null) {
      return undefined
    }

    return `T_${this.styler.uuid}`
  }

  /** The table's CSS style string, if it has a Styler. */
  public get tableCSSStyles(): string | undefined {
    return this.styler?.styles || undefined
  }

  /** The table's caption, if it's been set. */
  public get caption(): string | undefined {
    return this.styler?.caption || undefined
  }

  /** The table's dimensions. */
  public get dimensions(): TableDimensions {
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

    // Sanity check: ensure the schema is not messed up. If this happens,
    // something screwy probably happened in addRows.
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

  /** True if the table has no data at all. */
  public isEmpty(): boolean {
    return (
      // TODO: Refactor `getIndex` before this.
      this.index[0].length === 0 &&
      this.columns.length === 0 &&
      this.data.length === 0
    )
  }

  /** Return a single cell in the table. */
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
        cssClass: classNames.join(" "),
        content: "",
      }
    }

    if (isIndexCell) {
      const dataRowIndex = rowIndex - headerRows

      const cssId = this.styler?.uuid
        ? `T_${this.styler.uuid}level${columnIndex}_row${dataRowIndex}`
        : undefined
      const cssClass = [
        `row_heading`,
        `level${columnIndex}`,
        `row${dataRowIndex}`,
      ].join(" ")

      const indexTypeName = this.types.index[columnIndex].name
      // Table index is stored in a columnar format.
      const content = Quiver.format(
        this.index[columnIndex][dataRowIndex],
        indexTypeName
      )

      return {
        type: "index",
        cssId,
        cssClass,
        content,
      }
    }

    if (isColumnsCell) {
      const dataColumnIndex = columnIndex - headerColumns

      const cssClass = [
        `col_heading`,
        `level${rowIndex}`,
        `col${dataColumnIndex}`,
      ].join(" ")

      return {
        type: "columns",
        cssClass,
        content: this.columns[rowIndex][dataColumnIndex],
      }
    }

    const dataRowIndex = rowIndex - headerRows
    const dataColumnIndex = columnIndex - headerColumns

    const cssId = this.styler?.uuid
      ? `T_${this.styler.uuid}row${dataRowIndex}_col${dataColumnIndex}`
      : undefined
    const cssClass = [
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
      cssId,
      cssClass,
      content,
    }
  }

  /**
   * Add the contents of another table (data + indices) to this table.
   * This is a mutating function.
   */
  public addRows(other: Quiver): void {
    if (this.styler || other.styler) {
      // TODO
      throw new Error("Cannot concatenate dataframes with styler.")
    }

    if (other.isEmpty()) {
      return
    }

    // TODO: copy this data, don't just reassign. Also: why is this necessary -
    // why doesn't normal concatenation work if this is empty?
    if (this.isEmpty()) {
      this.index = other.index
      this.columns = other.columns
      this.data = other.data
      this.types = other.types
      this.styler = other.styler
      return
    }

    // Concatenate all data into temporary variables. If any of
    // these operations fail, an error will be thrown and we'll prematurely
    // exit the function.
    const index = this.concatIndices(other.index, other.types.index)
    const data = this.concatData(other.data, other.types.data)
    const types = this.concatTypes(other.types)

    // If we get here, then we had no concatenation errors.
    this.index = index
    this.data = data
    this.types = types
  }
}
