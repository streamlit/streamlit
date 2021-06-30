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

// Private members use _.
/* eslint-disable no-underscore-dangle */

import { Table, Vector } from "apache-arrow"
import { cloneDeep, range, unzip } from "lodash"
import moment from "moment"
import numbro from "numbro"

import { IArrow, Styler as StylerProto } from "src/autogen/proto"

/** Data types used by ArrowJS. */
export type DataType =
  | null
  | boolean
  | number
  | string
  | Date // datetime
  | Int32Array // int
  | Uint8Array // bytes
  | Vector // arrays

/**
 * A row-major grid of DataFrame index header values.
 */
type Index = DataType[][]

/**
 * A row-major grid of DataFrame column header values.
 * NOTE: ArrowJS automatically formats the columns in schema, i.e. we always get strings.
 */
type Columns = string[][]

/**
 * A row-major grid of DataFrame data.
 */
type Data = DataType[][]

// This type should be recursive as there can be nested structures.
// Example: list[int64], list[list[unicode]], etc.
// NOTE: Commented out until we can find a way to properly define recursive types.
//
// enum DataTypeName {
//   Empty = "empty",
//   Boolean = "bool",
//   Number = "int64",
//   Float = "float64",
//   String = "unicode",
//   Date = "date", // "datetime", "datetimetz"
//   Bytes = "bytes",
//   Object = "object",
//   List = "list[int64]",
// }

/** DataFrame index and data types. */
interface Types {
  /** Types for each index column. */
  index: IndexType[]

  /** Types for each data column. */
  // NOTE: `DataTypeName` should be used here, but as it's hard (maybe impossible)
  // to define such recursive types in TS, `string` will suffice for now.
  data: string[]
}

/** Type information for a single index column. */
interface IndexType {
  /** Type name. */
  name: IndexTypeName

  /** Type metadata. */
  meta: Record<string, any> | null
}

export enum IndexTypeName {
  CategoricalIndex = "categorical",
  DatetimeIndex = "datetime",
  Float64Index = "float64",
  Int64Index = "int64",
  RangeIndex = "range",
  UInt64Index = "uint64",
  UnicodeIndex = "unicode",

  // Not fully supported.
  IntervalIndex = "interval[int64]",
  PeriodIndex = "period[Q-DEC]",

  // Throws an error.
  TimedeltaIndex = "time",
}

/**
 * The Arrow table schema. It's a blueprint that tells us where data
 * is stored in the associated table. (Arrow stores the schema as a JSON string,
 * and we parse it into this typed object - so these member names come from
 * Arrow.)
 */
interface Schema {
  /**
   * The DataFrame's index names (either provided by user or generated). It is used to fetch
   * the index data. Each DataFrame has at least 1 index. There are many different
   * index types; for most of them the index name is stored as a string, but for the "range"
   * index a `RangeIndex` object is used. The length represents the dimensions of the
   * DataFrame's index grid.
   *
   * Example:
   * Range index: [{ kind: "range", name: null, start: 1, step: 1, stop: 5 }]
   * Other index types: ["__index_level_0__", "foo", "bar"]
   */
  index_columns: (string | RangeIndex)[]

  /**
   * Schemas for each column (index *and* data columns) in the DataFrame.
   */
  columns: ColumnSchema[]

  /**
   * DataFrame column headers.
   * The length represents the dimensions of the DataFrame's columns grid.
   */
  column_indexes: ColumnSchema[]
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
 * (This can describe an index *or* a data column.)
 */
interface ColumnSchema {
  /**
   * The fieldName of the column.
   * For a single-index column, this is just the name of the column (e.g. "foo").
   * For a multi-index column, this is a stringified tuple (e.g. "('1','foo')")
   */
  field_name: string

  /**
   * Column-specific metadata. Only used by certain column types
   * (e.g. CategoricalIndex has `num_categories`.)
   */
  metadata: Record<string, any> | null

  /** The name of the column. */
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
  numpy_type: string
}

/** DataFrame's Styler information. */
interface Styler {
  /** Styler's UUID. */
  uuid: string

  /** Optional user-specified caption. */
  caption: string | null

  /** DataFrame's CSS styles. */
  styles: string | null

  /**
   * Stringified versions of each cell in the DataFrame, in the
   * user-specified format.
   */
  displayValues: Quiver
}

/** Dimensions of the DataFrame. */
interface DataFrameDimensions {
  headerRows: number
  headerColumns: number
  dataRows: number
  dataColumns: number
  rows: number
  columns: number
}

/**
 * There are 4 cell types:
 *  - blank, cells that are not part of index headers, column headers, or data
 *  - index, index header cells
 *  - columns, column header cells
 *  - data, data cells
 */
export enum DataFrameCellType {
  BLANK = "blank",
  INDEX = "index",
  COLUMNS = "columns",
  DATA = "data",
}

/** Data for a single cell in a DataFrame. */
interface DataFrameCell {
  /** The cell's type (blank, index, columns, or data). */
  type: DataFrameCellType

  /** The cell's CSS id, if the DataFrame has Styler. */
  cssId?: string

  /** The cell's CSS class. */
  cssClass: string

  /** The cell's content. */
  content: DataType

  /** The cell's content type. */
  // NOTE: `DataTypeName` should be used here, but as it's hard (maybe impossible)
  // to define such recursive types in TS, `string` will suffice for now.
  // For "blank" cells "contentType" is undefined.
  // For "columns" cells "contentType" is always set to "unicode"
  // (ArrowJS automatically converts them to strings).
  contentType?: string

  /**
   * The cell's formatted content string, if the DataFrame was created with a Styler.
   * If the DataFrame is unstyled, displayContent will be undefined, and display
   * code should apply a default formatting to the `content` value instead.
   */
  displayContent?: string
}

/**
 * Parses data from an Arrow table, and stores it in a row-major format
 * (which is more useful for our frontend display code than Arrow's columnar format).
 */
export class Quiver {
  /** DataFrame's index (matrix of row names). */
  private _index: Index

  /** DataFrame's column labels (matrix of column names). */
  private _columns: Columns

  /** DataFrame's data. */
  private _data: Data

  /** Types for DataFrame's index and data. */
  private _types: Types

  /** [optional] DataFrame's Styler data. This will be defined if the user styled the dataframe. */
  private readonly _styler?: Styler

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

    // The assignment is done below to avoid partially populating the instance
    // if an error is thrown.
    this._index = index
    this._columns = columns
    this._data = data
    this._types = types
    this._styler = styler
  }

  /** Parse Arrow table's schema from a JSON string to an object. */
  private static parseSchema(table: Table): Schema {
    const schema = table.schema.metadata.get("pandas")
    if (schema == null) {
      // This should never happen!
      throw new Error("Table schema is missing.")
    }
    return JSON.parse(schema)
  }

  /** Parse DataFrame's index header values. */
  private static parseIndex(table: Table, schema: Schema): Index {
    // Perform the following transformation:
    // ["foo", "bar", "baz"] -> [[1, 2, 3], [4, 5, 6]] -> [[1, 4], [2, 5], [3, 6]]
    // where "foo", "bar", and "baz" are names of a "non-range" type index.
    return unzip(
      schema.index_columns.map(indexName => {
        // Generate a range using the "range" index metadata.
        if (Quiver.isRangeIndex(indexName)) {
          const { start, stop, step } = indexName as RangeIndex
          return range(start, stop, step)
        }

        // Otherwise, use the index name to get the index column data.
        const column = table.getColumn(indexName as string)
        return range(0, column.length).map(rowIndex => column.get(rowIndex))
      })
    )
  }

  /** Parse DataFrame's column header values. */
  private static parseColumns(schema: Schema): Columns {
    // If DataFrame `columns` has multi-level indexing, the length of
    // `column_indexes` will show how many levels there are.
    const isMultiIndex = schema.column_indexes.length > 1

    // Perform the following transformation:
    // ["('1','foo')", "('2','bar')", "('3','baz')"] -> ... -> [["1", "2", "3"], ["foo", "bar", "baz"]]
    return unzip(
      schema.columns
        .map(columnSchema => columnSchema.field_name)
        // Filter out all index columns
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

  /** Parse DataFrame's data. */
  private static parseData(table: Table, columns: Columns): Data {
    const numDataRows = table.length
    const numDataColumns = columns.length > 0 ? columns[0].length : 0
    if (numDataRows === 0 || numDataColumns === 0) {
      return []
    }

    return range(0, numDataRows).map(rowIndex =>
      range(0, numDataColumns).map(columnIndex =>
        table.getColumnAt(columnIndex)?.get(rowIndex)
      )
    )
  }

  /** Parse DataFrame's index and data types. */
  private static parseTypes(table: Table, schema: Schema): Types {
    const index = Quiver.parseIndexType(schema)
    const data = Quiver.parseDataType(table, schema)
    return { index, data }
  }

  /** Parse types for each index column. */
  private static parseIndexType(schema: Schema): IndexType[] {
    return schema.index_columns.map(indexName => {
      if (Quiver.isRangeIndex(indexName)) {
        return {
          name: IndexTypeName.RangeIndex,
          meta: indexName as RangeIndex,
        }
      }

      // Find the index column we're looking for in the schema.
      const indexColumn = schema.columns.find(
        column => column.field_name === indexName
      )

      // For `PeriodIndex` and `IntervalIndex` types are kept in `numpy_type`,
      // for the rest of the indexes in `pandas_type`.
      return {
        name:
          indexColumn?.pandas_type === "object"
            ? (indexColumn?.numpy_type as IndexTypeName)
            : (indexColumn?.pandas_type as IndexTypeName),
        meta: indexColumn?.metadata || null,
      }
    })
  }

  /** Parse types for each non-index column. */
  private static parseDataType(table: Table, schema: Schema): string[] {
    const numDataRows = table.length
    return numDataRows > 0
      ? schema.columns
          // Filter out all index columns
          .filter(
            columnSchema =>
              !schema.index_columns.includes(columnSchema.field_name)
          )
          // For columns, `pandas_type` will point us to the correct type.
          .map(columnSchema => columnSchema.pandas_type)
      : []
  }

  /** Parse styler information from proto. */
  private static parseStyler(styler: StylerProto): Styler {
    return {
      uuid: styler.uuid,
      caption: styler.caption,
      styles: styler.styles,

      // Recursively create a new Quiver instance for Styler's display values.
      // This values will be used for rendering the DataFrame, while the original values
      // will be used for sorting, etc.
      displayValues: new Quiver({ data: styler.displayValues }),
    }
  }

  /** Concatenate the original DataFrame index with the given one. */
  private concatIndexes(
    otherIndex: Index,
    otherIndexTypes: IndexType[]
  ): Index {
    // If one of the `index` arrays is empty, return the other one.
    // Otherwise, they will have different types and an error will be thrown.
    if (otherIndex.length === 0) {
      return this._index
    }
    if (this._index.length === 0) {
      return otherIndex
    }

    // Make sure indexes have same types.
    if (!Quiver.sameIndexTypes(this._types.index, otherIndexTypes)) {
      throw new Error(
        `Cannot concatenate index type ${JSON.stringify(
          this._types.index
        )} with ${JSON.stringify(otherIndexTypes)}.`
      )
    }

    if (this._types.index.length === 0) {
      // This should never happen!
      throw new Error("There was an error while parsing index types.")
    }

    // NOTE: "range" index cannot be a part of a multi-index, i.e.
    // if the index type is "range", there will only be one element in the index array.
    if (this._types.index[0].name === IndexTypeName.RangeIndex) {
      // Continue the sequence for a "range" index.
      // NOTE: The metadata of the original index will be used, i.e.
      // if both indexes are of type "range" and they have different
      // metadata (start, step, stop) values, the metadata of the given
      // index will be ignored.
      const { step, stop } = this._types.index[0].meta as RangeIndex
      otherIndex = range(
        stop,
        // End is not inclusive
        stop + otherIndex.length * step,
        step
      ).map(value => [value])
    }

    return this._index.concat(otherIndex)
  }

  /** True if both arrays contain the same index types in the same order. */
  private static sameIndexTypes(t1: IndexType[], t2: IndexType[]): boolean {
    // Make sure both indexes have same dimensions.
    if (t1.length !== t2.length) {
      return false
    }

    return t1.every(
      (type: IndexType, index: number) => type.name === t2[index].name
    )
  }

  /** Concatenate the original DataFrame data with the given one. */
  private concatData(otherData: Data, otherDataType: string[]): Data {
    // If one of the `data` arrays is empty, return the other one.
    // Otherwise, they will have different types and an error will be thrown.
    if (otherData.length === 0) {
      return this._data
    }
    if (this._data.length === 0) {
      return otherData
    }

    // Make sure `data` arrays have the same types.
    if (!Quiver.sameDataTypes(this._types.data, otherDataType)) {
      throw new Error(
        `Cannot concatenate data type ${JSON.stringify(
          this._types.data
        )} with ${JSON.stringify(otherDataType)}.`
      )
    }

    // Remove extra columns from the "other" DataFrame.
    const slicedOtherData = otherData.map(data =>
      data.slice(0, this.dimensions.dataColumns)
    )
    return this._data.concat(slicedOtherData)
  }

  /** True if both arrays contain the same data types in the same order. */
  private static sameDataTypes(t1: string[], t2: string[]): boolean {
    // NOTE: We remove extra columns from the DataFrame that we add rows from.
    // Thus, as long as the length of `t2` is >= than `t1`, this will work properly.
    return t1.every((type: string, index: number) => type === t2[index])
  }

  /** Concatenate index and data types. */
  private concatTypes(otherTypes: Types): Types {
    const index = this.concatIndexTypes(otherTypes.index)
    const data = this.concatDataTypes(otherTypes.data)
    return { index, data }
  }

  /** Concatenate index types. */
  private concatIndexTypes(otherIndexTypes: IndexType[]): IndexType[] {
    // If one of the `types` arrays is empty, return the other one.
    // Otherwise, an empty array will be returned.
    if (otherIndexTypes.length === 0) {
      return this._types.index
    }
    if (this._types.index.length === 0) {
      return otherIndexTypes
    }

    // Make sure indexes have same types.
    if (!Quiver.sameIndexTypes(this._types.index, otherIndexTypes)) {
      throw new Error(
        `Cannot concatenate index type ${JSON.stringify(
          this._types.index
        )} with ${JSON.stringify(otherIndexTypes)}.`
      )
    }

    // TL;DR This sets the new stop value.
    return this._types.index.map(indexType => {
      // NOTE: "range" index cannot be a part of a multi-index, i.e.
      // if the index type is "range", there will only be one element in the index array.
      if (indexType.name === IndexTypeName.RangeIndex) {
        const { stop, step } = indexType.meta as RangeIndex
        const {
          start: otherStart,
          stop: otherStop,
          step: otherStep,
        } = otherIndexTypes[0].meta as RangeIndex
        const otherRangeIndexLength = (otherStop - otherStart) / otherStep
        const newStop = stop + otherRangeIndexLength * step
        return {
          ...indexType,
          meta: {
            ...indexType.meta,
            stop: newStop,
          },
        }
      }
      return indexType
    })
  }

  /** Concatenate types of data columns. */
  private concatDataTypes(otherDataTypes: string[]): string[] {
    if (this._types.data.length === 0) {
      return otherDataTypes
    }

    return this._types.data
  }

  /** True if the index name represents a "range" index. */
  private static isRangeIndex(indexName: string | RangeIndex): boolean {
    return typeof indexName === "object" && indexName.kind === "range"
  }

  /** Takes the data and it's type and nicely formats it. */
  public static format(x: DataType, type?: string): string {
    if (x == null) {
      return "<NA>"
    }

    // date, datetime, datetimetz.
    const isDate = x instanceof Date || Number.isFinite(x)
    if (isDate && type === "date") {
      return moment.utc(x as Date | number).format("YYYY-MM-DD")
    }
    if (isDate && type === "datetime") {
      return moment.utc(x as Date | number).format("YYYY-MM-DDTHH:mm:ss")
    }
    if (isDate && type === "datetimetz") {
      return moment(x as Date | number).format("YYYY-MM-DDTHH:mm:ssZ")
    }

    // Nested arrays and objects.
    if (type === "object" || type?.startsWith("list")) {
      return JSON.stringify(x)
    }

    if (type === "float64" && Number.isFinite(x)) {
      return numbro(x).format("0,0.0000")
    }

    return String(x)
  }

  /** DataFrame's index (matrix of row names). */
  public get index(): Index {
    return this._index
  }

  /** DataFrame's column labels (matrix of column names). */
  public get columns(): Columns {
    return this._columns
  }

  /** DataFrame's data. */
  public get data(): Data {
    return this._data
  }

  /** Types for DataFrame's index and data. */
  public get types(): Types {
    return this._types
  }

  /**
   * The DataFrame's CSS id, if it has one.
   *
   * If the DataFrame has a Styler, the  CSS id is `T_${StylerUUID}`. Otherwise,
   * it's undefined.
   *
   * This id is used by styled tables and styled dataframes to associate
   * the Styler CSS with the styled data.
   */
  public get cssId(): string | undefined {
    if (this._styler?.uuid == null) {
      return undefined
    }

    return `T_${this._styler.uuid}`
  }

  /** The DataFrame's CSS styles, if it has a Styler. */
  public get cssStyles(): string | undefined {
    return this._styler?.styles || undefined
  }

  /** The DataFrame's caption, if it's been set. */
  public get caption(): string | undefined {
    return this._styler?.caption || undefined
  }

  /** The DataFrame's dimensions. */
  public get dimensions(): DataFrameDimensions {
    const [headerColumns, dataRowsCheck] = this._index.length
      ? [this._index[0].length, this._index.length]
      : [1, 0]

    const [headerRows, dataColumnsCheck] = this._columns.length
      ? [this._columns.length, this._columns[0].length]
      : [1, 0]

    const [dataRows, dataColumns] = this._data.length
      ? [this._data.length, this._data[0].length]
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

  /** True if the DataFrame has no index, columns, and data. */
  public isEmpty(): boolean {
    return (
      this._index.length === 0 &&
      this._columns.length === 0 &&
      this._data.length === 0
    )
  }

  /** Return a single cell in the table. */
  public getCell(rowIndex: number, columnIndex: number): DataFrameCell {
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
      // Blank cells include `blank`.
      const cssClass = ["blank"]
      if (columnIndex > 0) {
        cssClass.push(`level${rowIndex}`)
      }

      return {
        type: DataFrameCellType.BLANK,
        cssClass: cssClass.join(" "),
        content: "",
      }
    }

    if (isIndexCell) {
      const dataRowIndex = rowIndex - headerRows

      const cssId = this._styler?.uuid
        ? `${this.cssId}level${columnIndex}_row${dataRowIndex}`
        : undefined

      // Index label cells include:
      // - row_heading
      // - row<n> where n is the numeric position of the row
      // - level<k> where k is the level in a MultiIndex
      const cssClass = [
        `row_heading`,
        `level${columnIndex}`,
        `row${dataRowIndex}`,
      ].join(" ")

      const contentType = this._types.index[columnIndex].name
      const content = this._index[dataRowIndex][columnIndex]

      return {
        type: DataFrameCellType.INDEX,
        cssId,
        cssClass,
        content,
        contentType,
      }
    }

    if (isColumnsCell) {
      const dataColumnIndex = columnIndex - headerColumns

      // Column label cells include:
      // - col_heading
      // - col<n> where n is the numeric position of the column
      // - level<k> where k is the level in a MultiIndex
      const cssClass = [
        `col_heading`,
        `level${rowIndex}`,
        `col${dataColumnIndex}`,
      ].join(" ")

      return {
        type: DataFrameCellType.COLUMNS,
        cssClass,
        content: this._columns[rowIndex][dataColumnIndex],
        // ArrowJS automatically converts "columns" cells to strings.
        contentType: "unicode",
      }
    }

    const dataRowIndex = rowIndex - headerRows
    const dataColumnIndex = columnIndex - headerColumns

    const cssId = this._styler?.uuid
      ? `${this.cssId}row${dataRowIndex}_col${dataColumnIndex}`
      : undefined

    // Data cells include `data`.
    const cssClass = [
      "data",
      `row${dataRowIndex}`,
      `col${dataColumnIndex}`,
    ].join(" ")

    const contentType = this._types.data[dataColumnIndex]
    const content = this._data[dataRowIndex][dataColumnIndex]
    const displayContent = this._styler?.displayValues
      ? (this._styler.displayValues.getCell(rowIndex, columnIndex)
          .content as string)
      : undefined

    return {
      type: DataFrameCellType.DATA,
      cssId,
      cssClass,
      content,
      contentType,
      displayContent,
    }
  }

  /**
   * Add the contents of another table (data + indexes) to this table.
   * Extra columns will not be created. This is a mutating function.
   */
  public addRows(other: Quiver): void {
    if (this._styler || other._styler) {
      throw new Error("Cannot concatenate DataFrames with Styler.")
    }

    // Don't do anything if the incoming DataFrame is empty.
    if (other.isEmpty()) {
      return
    }

    // We need to handle this separately, as columns need to be reassigned.
    // We don't concatenate columns in the general case.
    if (this.isEmpty()) {
      this._index = cloneDeep(other._index)
      this._columns = cloneDeep(other._columns)
      this._data = cloneDeep(other._data)
      this._types = cloneDeep(other._types)
      return
    }

    // Concatenate all data into temporary variables. If any of
    // these operations fail, an error will be thrown and we'll prematurely
    // exit the function.
    const index = this.concatIndexes(other._index, other._types.index)
    const data = this.concatData(other._data, other._types.data)
    const types = this.concatTypes(other._types)

    // If we get here, then we had no concatenation errors.
    this._index = index
    this._data = data
    this._types = types
  }
}
