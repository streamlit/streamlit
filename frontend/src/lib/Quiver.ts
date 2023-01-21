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

// Private members use _.
/* eslint-disable no-underscore-dangle */

import {
  StructRow,
  Table,
  Vector,
  tableFromIPC,
  Null,
  Field,
  Dictionary,
  Struct,
} from "apache-arrow"
import { immerable, produce } from "immer"
import { range, unzip, zip } from "lodash"
import moment from "moment-timezone"
import numbro from "numbro"

import { IArrow, Styler as StylerProto } from "src/autogen/proto"

import { notNullOrUndefined, isNullOrUndefined } from "src/lib/utils"

/** Data types used by ArrowJS. */
export type DataType =
  | null
  | boolean
  | number
  | string
  | Date // datetime
  | Int32Array // int
  | Uint8Array // bytes
  | Uint32Array // Decimal
  | Vector // arrays
  | StructRow // interval
  | Dictionary // categorical
  | Struct // dict

/**
 * A row-major grid of DataFrame index header values.
 */
type IndexValue = Vector | number[]

/**
 * A row-major grid of DataFrame index header values.
 */
type Index = IndexValue[]

/**
 * A row-major grid of DataFrame column header values.
 * NOTE: ArrowJS automatically formats the columns in schema, i.e. we always get strings.
 */
type Columns = string[][]

/**
 * A row-major grid of DataFrame data.
 */
type Data = Table

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
  index: Type[]

  /** Types for each data column. */
  // NOTE: `DataTypeName` should be used here, but as it's hard (maybe impossible)
  // to define such recursive types in TS, `string` will suffice for now.
  data: Type[]
}

/** Type information for single-index columns, and data columns. */
export interface Type {
  /** Type name. */
  // NOTE: `DataTypeName` should be used here, but as it's hard (maybe impossible)
  // to define such recursive types in TS, `string` will suffice for now.
  pandas_type: IndexTypeName | string

  numpy_type: string

  /** Type metadata. */
  meta?: Record<string, any> | null
}

// type IntervalData = "int64" | "uint64" | "float64" | "datetime64[ns]"
type IntervalClosed = "left" | "right" | "both" | "neither"
// type IntervalIndex = `interval[${IntervalData}, ${IntervalClosed}]`

// Our current Typescript version (3.9.5) doesn't support template literal types,
// so we have to use string literals for now.
type IntervalIndex = string

/** Interval data type. */
interface Interval {
  left: number
  right: number
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
   * The DataFrame's index names (either provided by user or generated,
   * guaranteed unique). It is used to fetch the index data. Each DataFrame has
   * at least 1 index. There are many different index types; for most of them
   * the index name is stored as a string, but for the "range" index a `RangeIndex`
   * object is used. A `RangeIndex` is only ever by itself, never as part of a
   * multi-index. The length represents the dimensions of the DataFrame's index grid.
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
export interface DataFrameCell {
  /** The cell's type (blank, index, columns, or data). */
  type: DataFrameCellType

  /** The cell's CSS id, if the DataFrame has Styler. */
  cssId?: string

  /** The cell's CSS class. */
  cssClass: string

  /** The cell's content. */
  content: DataType

  /** The cell's content type. */
  // For "blank" cells "contentType" is undefined.
  contentType?: Type

  /** The cell's field. */
  field?: Field

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
  /**
   * Plain objects (objects without a prototype), arrays, Maps and Sets are always drafted by Immer.
   * Every other object must use the immerable symbol to mark itself as compatible with Immer.
   * When one of these objects is mutated within a producer, its prototype is preserved between copies.
   * Source: https://immerjs.github.io/immer/complex-objects/
   */
  [immerable] = true

  /** DataFrame's index (matrix of row names). */
  private _index: Index

  /** DataFrame's column labels (matrix of column names). */
  private _columns: Columns

  /** DataFrame's index names. */
  private _indexNames: string[]

  /** DataFrame's data. */
  private _data: Data

  /** Definition for DataFrame's fields. */
  private _fields: Field[]

  /** Types for DataFrame's index and data. */
  private _types: Types

  /** [optional] DataFrame's Styler data. This will be defined if the user styled the dataframe. */
  private readonly _styler?: Styler

  constructor(element: IArrow) {
    const table = tableFromIPC(element.data)
    const schema = Quiver.parseSchema(table)
    const rawColumns = Quiver.getRawColumns(schema)
    const fields = table.schema.fields || []

    const index = Quiver.parseIndex(table, schema)
    const columns = Quiver.parseColumns(schema)
    const indexNames = Quiver.parseIndexNames(schema)
    const data = Quiver.parseData(table, columns, rawColumns)
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
    this._fields = fields
    this._styler = styler
    this._indexNames = indexNames
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

  /** Get unprocessed column names for data columns. Needed for selecting
   * data columns when there are multi-columns. */
  private static getRawColumns(schema: Schema): string[] {
    return (
      schema.columns
        .map(columnSchema => columnSchema.field_name)
        // Filter out all index columns
        .filter(columnName => !schema.index_columns.includes(columnName))
    )
  }

  /** Parse DataFrame's index header values. */
  private static parseIndex(table: Table, schema: Schema): Index {
    return schema.index_columns
      .map(indexName => {
        // Generate a range using the "range" index metadata.
        if (Quiver.isRangeIndex(indexName)) {
          const { start, stop, step } = indexName
          return range(start, stop, step)
        }

        // Otherwise, use the index name to get the index column data.
        const column = table.getChild(indexName as string)
        if (column instanceof Vector && column.type instanceof Null) {
          return null
        }
        return column
      })
      .filter(
        (column: IndexValue | null): column is IndexValue => column !== null
      )
  }

  /** Parse DataFrame's index header names. */
  private static parseIndexNames(schema: Schema): string[] {
    return schema.index_columns.map(indexName => {
      // Range indices are treated differently:
      if (Quiver.isRangeIndex(indexName)) {
        const { name } = indexName
        return name || ""
      }
      if (indexName.startsWith("__index_level_")) {
        // Unnamed indices can have a name like "__index_level_0__".
        return ""
      }
      return indexName
    })
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
  private static parseData(
    table: Table,
    columns: Columns,
    rawColumns: string[]
  ): Data {
    const numDataRows = table.numRows
    const numDataColumns = columns.length > 0 ? columns[0].length : 0
    if (numDataRows === 0 || numDataColumns === 0) {
      return table.select([])
    }

    return table.select(rawColumns)
  }

  /** Parse DataFrame's index and data types. */
  private static parseTypes(table: Table, schema: Schema): Types {
    const index = Quiver.parseIndexType(schema)
    const data = Quiver.parseDataType(table, schema)
    return { index, data }
  }

  /** Parse types for each index column. */
  private static parseIndexType(schema: Schema): Type[] {
    return schema.index_columns.map(indexName => {
      if (Quiver.isRangeIndex(indexName)) {
        return {
          pandas_type: IndexTypeName.RangeIndex,
          numpy_type: IndexTypeName.RangeIndex,
          meta: indexName as RangeIndex,
        }
      }

      // Find the index column we're looking for in the schema.
      const indexColumn = schema.columns.find(
        column => column.field_name === indexName
      )

      // This should never happen!
      if (!indexColumn) {
        throw new Error(`${indexName} index not found.`)
      }

      return {
        pandas_type: indexColumn.pandas_type,
        numpy_type: indexColumn.numpy_type,
        meta: indexColumn.metadata,
      }
    })
  }

  /**
   * Returns the categorical options defined for a given column.
   * Returns undefined if the column is not categorical.
   */
  public getCategoricalOptions(columnIndex: number): string[] | undefined {
    // TODO(lukasmasuch): Should we also support headcolumns here?
    const { columns: numColumns } = this.dimensions

    if (columnIndex < 0 || columnIndex >= numColumns) {
      throw new Error(`Column index is out of range: ${columnIndex}`)
    }

    if (!(this._fields[columnIndex].type instanceof Dictionary)) {
      // This is not a categorical column
      return undefined
    }

    const categoricalDict =
      this._data.getChildAt(columnIndex)?.data[0]?.dictionary
    if (categoricalDict) {
      // get all values into a list
      const values = []

      for (let i = 0; i < categoricalDict.length; i++) {
        values.push(categoricalDict.get(i))
      }
      return values
    }
    return undefined
  }

  /** Parse types for each non-index column. */
  private static parseDataType(table: Table, schema: Schema): Type[] {
    return (
      schema.columns
        // Filter out all index columns
        .filter(
          columnSchema =>
            !schema.index_columns.includes(columnSchema.field_name)
        )
        .map(columnSchema => ({
          pandas_type: columnSchema.pandas_type,
          numpy_type: columnSchema.numpy_type,
          meta: columnSchema.metadata,
        }))
    )
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
  private concatIndexes(otherIndex: Index, otherIndexTypes: Type[]): Index {
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
      const receivedIndexTypes = otherIndexTypes.map(index =>
        Quiver.getTypeName(index)
      )
      const expectedIndexTypes = this._types.index.map(index =>
        Quiver.getTypeName(index)
      )

      throw new Error(`
Unsupported operation. The data passed into \`add_rows()\` must have the same
index signature as the original data.

In this case, \`add_rows()\` received \`${JSON.stringify(receivedIndexTypes)}\`
but was expecting \`${JSON.stringify(expectedIndexTypes)}\`.
`)
    }

    if (this._types.index.length === 0) {
      // This should never happen!
      throw new Error("There was an error while parsing index types.")
    }

    // NOTE: "range" index cannot be a part of a multi-index, i.e.
    // if the index type is "range", there will only be one element in the index array.
    if (this._types.index[0].pandas_type === IndexTypeName.RangeIndex) {
      // Continue the sequence for a "range" index.
      // NOTE: The metadata of the original index will be used, i.e.
      // if both indexes are of type "range" and they have different
      // metadata (start, step, stop) values, the metadata of the given
      // index will be ignored.
      const { step, stop } = this._types.index[0].meta as RangeIndex
      otherIndex = [
        range(
          stop,
          // End is not inclusive
          stop + otherIndex[0].length * step,
          step
        ),
      ]
    }

    // Concatenate each index with its counterpart in the other table
    const zipped = zip(this._index, otherIndex)
    // @ts-ignore We know the two indexes are of the same size
    return zipped.map(a => a[0].concat(a[1]))
  }

  /** True if both arrays contain the same index types in the same order. */
  private static sameIndexTypes(t1: Type[], t2: Type[]): boolean {
    // Make sure both indexes have same dimensions.
    if (t1.length !== t2.length) {
      return false
    }

    return t1.every(
      (type: Type, index: number) =>
        index < t2.length &&
        Quiver.getTypeName(type) === Quiver.getTypeName(t2[index])
    )
  }

  /** Concatenate the original DataFrame data with the given one. */
  private concatData(otherData: Data, otherDataType: Type[]): Data {
    // If one of the `data` arrays is empty, return the other one.
    // Otherwise, they will have different types and an error will be thrown.
    if (otherData.numCols === 0) {
      return this._data
    }
    if (this._data.numCols === 0) {
      return otherData
    }

    // Make sure `data` arrays have the same types.
    if (!Quiver.sameDataTypes(this._types.data, otherDataType)) {
      const receivedDataTypes = otherDataType.map(t => t.pandas_type)
      const expectedDataTypes = this._types.data.map(t => t.pandas_type)

      throw new Error(`
Unsupported operation. The data passed into \`add_rows()\` must have the same
data signature as the original data.

In this case, \`add_rows()\` received \`${JSON.stringify(receivedDataTypes)}\`
but was expecting \`${JSON.stringify(expectedDataTypes)}\`.
`)
    }

    // Remove extra columns from the "other" DataFrame.
    // Columns from otherData are used by index without checking column names.
    const slicedOtherData = otherData.selectAt(range(0, this._data.numCols))
    return this._data.concat(slicedOtherData)
  }

  /** True if both arrays contain the same data types in the same order. */
  private static sameDataTypes(t1: Type[], t2: Type[]): boolean {
    // NOTE: We remove extra columns from the DataFrame that we add rows from.
    // Thus, as long as the length of `t2` is >= than `t1`, this will work properly.
    // For columns, `pandas_type` will point us to the correct type.
    return t1.every(
      (type: Type, index: number) =>
        type.pandas_type === t2[index]?.pandas_type
    )
  }

  /** Concatenate index and data types. */
  private concatTypes(otherTypes: Types): Types {
    const index = this.concatIndexTypes(otherTypes.index)
    const data = this.concatDataTypes(otherTypes.data)
    return { index, data }
  }

  /** Concatenate index types. */
  private concatIndexTypes(otherIndexTypes: Type[]): Type[] {
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
      const receivedIndexTypes = otherIndexTypes.map(index =>
        Quiver.getTypeName(index)
      )
      const expectedIndexTypes = this._types.index.map(index =>
        Quiver.getTypeName(index)
      )

      throw new Error(`
Unsupported operation. The data passed into \`add_rows()\` must have the same
index signature as the original data.

In this case, \`add_rows()\` received \`${JSON.stringify(receivedIndexTypes)}\`
but was expecting \`${JSON.stringify(expectedIndexTypes)}\`.
`)
    }

    // TL;DR This sets the new stop value.
    return this._types.index.map(indexType => {
      // NOTE: "range" index cannot be a part of a multi-index, i.e.
      // if the index type is "range", there will only be one element in the index array.
      if (indexType.pandas_type === IndexTypeName.RangeIndex) {
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
  private concatDataTypes(otherDataTypes: Type[]): Type[] {
    if (this._types.data.length === 0) {
      return otherDataTypes
    }

    return this._types.data
  }

  /** True if the index name represents a "range" index. */
  private static isRangeIndex(
    indexName: string | RangeIndex
  ): indexName is RangeIndex {
    return typeof indexName === "object" && indexName.kind === "range"
  }

  /** Formats an interval index. */
  private static formatIntervalType(
    data: StructRow,
    typeName: IntervalIndex
  ): string {
    const match = typeName.match(/interval\[(.+), (both|left|right|neither)\]/)
    if (match === null) {
      throw new Error(`Invalid interval type: ${typeName}`)
    }
    const [, subtype, closed] = match
    return this.formatInterval(data, subtype, closed as IntervalClosed)
  }

  private static formatInterval(
    data: StructRow,
    subtype: string,
    closed: IntervalClosed
  ): string {
    const interval = data.toJSON() as Interval

    const leftBracket = closed === "both" || closed === "left" ? "[" : "("
    const rightBracket = closed === "both" || closed === "right" ? "]" : ")"
    const leftInterval = Quiver.format(interval.left, {
      pandas_type: subtype,
      numpy_type: subtype,
    })
    const rightInterval = Quiver.format(interval.right, {
      pandas_type: subtype,
      numpy_type: subtype,
    })

    return `${leftBracket + leftInterval}, ${rightInterval + rightBracket}`
  }

  /** Returns type for a single-index column or data column. */
  public static getTypeName(type: Type): IndexTypeName | string {
    // For `PeriodIndex` and `IntervalIndex` types are kept in `numpy_type`,
    // for the rest of the indexes in `pandas_type`.
    return type.pandas_type === "object" ? type.numpy_type : type.pandas_type
  }

  /** Takes the data and it's type and nicely formats it. */
  public static format(x: DataType, type?: Type, field?: Field): string {
    const typeName = type && Quiver.getTypeName(type)
    if (x == null) {
      return "<NA>"
    }

    // date
    const isDate = x instanceof Date || Number.isFinite(x)
    if (isDate && typeName === "date") {
      return moment.utc(x as Date | number).format("YYYY-MM-DD")
    }
    // datetimetz
    if (isDate && typeName === "datetimetz") {
      const meta = type?.meta
      let datetime = moment(x as Date | number)

      if (meta?.timezone) {
        if (moment.tz.zone(meta?.timezone)) {
          // uses timezone notation
          datetime = datetime.tz(meta?.timezone)
        } else {
          // uses UTC offset notation
          datetime = datetime.utcOffset(meta?.timezone)
        }
      }

      return datetime.format("YYYY-MM-DDTHH:mm:ssZ")
    }
    // datetime, datetime64, datetime64[ns], etc.
    if (isDate && typeName?.startsWith("datetime")) {
      return moment.utc(x as Date | number).format("YYYY-MM-DDTHH:mm:ss")
    }

    if (typeName?.startsWith("interval")) {
      return Quiver.formatIntervalType(
        x as StructRow,
        typeName as IntervalIndex
      )
    }

    if (typeName === "categorical") {
      if (field?.metadata.get("ARROW:extension:name") === "pandas.interval") {
        const { subtype, closed } = JSON.parse(
          field?.metadata.get("ARROW:extension:metadata") as string
        )
        return Quiver.formatInterval(x as StructRow, subtype, closed)
        // TODO: We should add support for pandas.Period here.
        //  See: https://github.com/streamlit/streamlit/issues/5392
      }
      return String(x)
    }

    if (typeName === "decimal") {
      // Support decimal type
      // Unfortunately, this still can fail in certain situations:
      // https://github.com/apache/arrow/issues/22932
      // https://github.com/streamlit/streamlit/issues/5864
      const decimalStr = x.toString()
      if (
        isNullOrUndefined(field?.type?.scale) ||
        Number.isNaN(field?.type?.scale) ||
        field?.type?.scale > decimalStr.length
      ) {
        return decimalStr
      }
      const scaleIndex = decimalStr.length - field?.type?.scale
      return `${decimalStr.slice(0, scaleIndex)}.${decimalStr.slice(
        scaleIndex
      )}`
    }

    // Nested arrays and objects.
    if (typeName === "object" || typeName?.startsWith("list")) {
      if (field?.type instanceof Struct) {
        // This type is used by python dictionary values

        // Workaround: Arrow JS adds all properties from all cells
        // as fields. When you convert to string, it will contain lots of fields with
        // null values. To mitigate this, we filter out null values.

        return JSON.stringify(x, (_key, value) => {
          if (!notNullOrUndefined(value)) {
            // Ignore null and undefined values ->
            return undefined
          }
          if (typeof value === "bigint") {
            return Number(value)
          }
          return value
        })
      }
      return JSON.stringify(x, (_key, value) =>
        typeof value === "bigint" ? Number(value) : value
      )
    }

    if (typeName === "float64" && Number.isFinite(x)) {
      return numbro(x).format("0,0.0000")
    }

    return String(x)
  }

  /** DataFrame's index (matrix of row names). */
  public get index(): Index {
    return this._index
  }

  /** DataFrame's index names. */
  public get indexNames(): string[] {
    return this._indexNames
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
    // TODO(lukasmasuch): this._index[0].length can be 0 if there are rows
    // but only an empty index. Probably not the best way to cross check the number
    // of rows.
    const [headerColumns, dataRowsCheck] = this._index.length
      ? [this._index.length, this._index[0].length]
      : [1, 0]

    const [headerRows, dataColumnsCheck] = this._columns.length
      ? [this._columns.length, this._columns[0].length]
      : [1, 0]

    const [dataRows, dataColumns] = this._data.numRows
      ? [this._data.numRows, this._data.numCols]
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
      this._data.numRows === 0 &&
      this._data.numCols === 0
    )
  }

  /** Return a single cell in the table. */
  public getCell(rowIndex: number, columnIndex: number): DataFrameCell {
    const { headerRows, headerColumns, rows, columns } = this.dimensions

    if (rowIndex < 0 || rowIndex >= rows) {
      throw new Error(`Row index is out of range: ${rowIndex}`)
    }
    if (columnIndex < 0 || columnIndex >= columns) {
      throw new Error(`Column index is out of range: ${columnIndex}`)
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

      const contentType = this._types.index[columnIndex]
      const content = this.getIndexValue(dataRowIndex, columnIndex)

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
        // Keep ArrowJS structure for consistency.
        contentType: {
          pandas_type: IndexTypeName.UnicodeIndex,
          numpy_type: "object",
        },
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
    const field = this._fields[dataColumnIndex]
    const content = this.getDataValue(dataRowIndex, dataColumnIndex)
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
      field,
    }
  }

  public getIndexValue(rowIndex: number, columnIndex: number): any {
    const index = this._index[columnIndex]
    const value =
      index instanceof Vector ? index.get(rowIndex) : index[rowIndex]
    return value
  }

  public getDataValue(rowIndex: number, columnIndex: number): any {
    console.log(this._data)
    return this._data.getChildAt(columnIndex)?.get(rowIndex)
  }

  /**
   * Add the contents of another table (data + indexes) to this table.
   * Extra columns will not be created.
   */
  public addRows(other: Quiver): Quiver {
    if (this._styler || other._styler) {
      throw new Error(`
Unsupported operation. \`add_rows()\` does not support Pandas Styler objects.

If you do not need the Styler's styles, try passing the \`.data\` attribute of
the Styler object instead to concatenate just the underlying dataframe.

For example:
\`\`\`
st.add_rows(my_styler.data)
\`\`\`
`)
    }

    // Don't do anything if the incoming DataFrame is empty.
    if (other.isEmpty()) {
      return produce(this, (draft: Quiver) => draft)
    }

    // We need to handle this separately, as columns need to be reassigned.
    // We don't concatenate columns in the general case.
    if (this.isEmpty()) {
      return produce(other, (draft: Quiver) => draft)
    }

    // Concatenate all data into temporary variables. If any of
    // these operations fail, an error will be thrown and we'll prematurely
    // exit the function.
    const index = this.concatIndexes(other._index, other._types.index)
    const data = this.concatData(other._data, other._types.data)
    const types = this.concatTypes(other._types)

    // If we get here, then we had no concatenation errors.
    return produce(this, (draft: Quiver) => {
      draft._index = index
      draft._data = data
      draft._types = types
    })
  }
}
