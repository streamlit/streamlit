/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
  Schema as ArrowSchema,
  Dictionary,
  Field,
  Null,
  Struct,
  StructRow,
  Table,
  tableFromIPC,
  util,
  Vector,
} from "apache-arrow"
import { immerable, produce } from "immer"
import range from "lodash/range"
import trimEnd from "lodash/trimEnd"
import unzip from "lodash/unzip"
import zip from "lodash/zip"
import moment from "moment-timezone"
import numbro from "numbro"

import { IArrow, Styler as StylerProto } from "@streamlit/lib/src/proto"
import { logWarning } from "@streamlit/lib/src/util/log"
import {
  isNullOrUndefined,
  notNullOrUndefined,
} from "@streamlit/lib/src/util/utils"

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
  | bigint // period

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
  /** The type label returned by pandas.api.types.infer_dtype */
  // NOTE: `DataTypeName` should be used here, but as it's hard (maybe impossible)
  // to define such recursive types in TS, `string` will suffice for now.
  pandas_type: IndexTypeName | string

  /** The numpy dtype that corresponds to the types returned in df.dtypes */
  numpy_type: string

  /** Type metadata. */
  meta?: Record<string, any> | null
}

type IntervalData = "int64" | "uint64" | "float64" | "datetime64[ns]"
type IntervalClosed = "left" | "right" | "both" | "neither"
type IntervalType = `interval[${IntervalData}, ${IntervalClosed}]`

// The frequency strings defined in pandas.
// See: https://pandas.pydata.org/docs/user_guide/timeseries.html#period-aliases
// Not supported: "N" (nanoseconds), "U" & "us" (microseconds), and "B" (business days).
// Reason is that these types are not supported by moment.js, but also they are not
// very commonly used in practice.
type SupportedPandasOffsetType =
  // yearly frequency:
  | "A" // deprecated alias
  | "Y"
  // quarterly frequency:
  | "Q"
  // monthly frequency:
  | "M"
  // weekly frequency:
  | "W"
  // calendar day frequency:
  | "D"
  // hourly frequency:
  | "H" // deprecated alias
  | "h"
  // minutely frequency
  | "T" // deprecated alias
  | "min"
  // secondly frequency:
  | "S" // deprecated alias
  | "s"
  // milliseconds frequency:
  | "L" // deprecated alias
  | "ms"

type PeriodFrequency =
  | SupportedPandasOffsetType
  | `${SupportedPandasOffsetType}-${string}`
type PeriodType = `period[${PeriodFrequency}]`

const WEEKDAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
const formatMs = (duration: number): string =>
  moment("19700101", "YYYYMMDD")
    .add(duration, "ms")
    .format("YYYY-MM-DD HH:mm:ss.SSS")

const formatSec = (duration: number): string =>
  moment("19700101", "YYYYMMDD")
    .add(duration, "s")
    .format("YYYY-MM-DD HH:mm:ss")

const formatMin = (duration: number): string =>
  moment("19700101", "YYYYMMDD").add(duration, "m").format("YYYY-MM-DD HH:mm")

const formatHours = (duration: number): string =>
  moment("19700101", "YYYYMMDD").add(duration, "h").format("YYYY-MM-DD HH:mm")

const formatDay = (duration: number): string =>
  moment("19700101", "YYYYMMDD").add(duration, "d").format("YYYY-MM-DD")

const formatMonth = (duration: number): string =>
  moment("19700101", "YYYYMMDD").add(duration, "M").format("YYYY-MM")

const formatYear = (duration: number): string =>
  moment("19700101", "YYYYMMDD").add(duration, "y").format("YYYY")

const formatWeeks = (duration: number, freqParam?: string): string => {
  if (!freqParam) {
    throw new Error('Frequency "W" requires parameter')
  }
  const dayIndex = WEEKDAY_SHORT.indexOf(freqParam)
  if (dayIndex < 0) {
    throw new Error(
      `Invalid value: ${freqParam}. Supported values: ${JSON.stringify(
        WEEKDAY_SHORT
      )}`
    )
  }
  const startDate = moment("19700101", "YYYYMMDD")
    .add(duration, "w")
    .day(dayIndex - 6)
    .format("YYYY-MM-DD")
  const endDate = moment("19700101", "YYYYMMDD")
    .add(duration, "w")
    .day(dayIndex)
    .format("YYYY-MM-DD")

  return `${startDate}/${endDate}`
}

const formatQuarter = (duration: number): string =>
  moment("19700101", "YYYYMMDD")
    .add(duration, "Q")
    .endOf("quarter")
    .format("YYYY[Q]Q")

const PERIOD_TYPE_FORMATTERS: Record<
  SupportedPandasOffsetType,
  (duration: number, freqParam?: string) => string
> = {
  L: formatMs,
  ms: formatMs,
  S: formatSec,
  s: formatSec,
  T: formatMin,
  min: formatMin,
  H: formatHours,
  h: formatHours,
  D: formatDay,
  M: formatMonth,
  W: formatWeeks,
  Q: formatQuarter,
  Y: formatYear,
  A: formatYear,
}

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

  // Chunks are stored in a map, with the chunk index as the key.
  // This allows us to add chunks at arbitrary indices.
  private _chunks: Record<number, Quiver | undefined> = {}

  /** DataFrame's index (matrix of row names). */
  private _index: Index

  /** DataFrame's column labels (matrix of column names). */
  private _columns: Columns

  /** DataFrame's index names. */
  private _indexNames: string[]

  /** DataFrame's data. */
  private _data: Data

  /** Definition for DataFrame's fields. */
  private _fields: Record<string, Field<any>>

  /** Types for DataFrame's index and data. */
  private _types: Types

  /** [optional] DataFrame's Styler data. This will be defined if the user styled the dataframe. */
  private readonly _styler?: Styler

  private _chunkSize: number | undefined

  constructor(element: IArrow) {
    const table = tableFromIPC(element.data)
    const schema = Quiver.parseSchema(table)
    const rawColumns = Quiver.getRawColumns(schema)
    const fields = Quiver.parseFields(table.schema)

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

    if (notNullOrUndefined(element.chunkingMetadata)) {
      // Set the chunk size to the number of data rows of the
      // chunk in the initial Arrow message.
      this._chunkSize = this.dimensions.dataRows
    }
  }

  /** Parse Arrow table's schema from a JSON string to an object. */
  private static parseSchema(table: Table): Schema {
    const schema = table.schema.metadata.get("pandas")
    if (isNullOrUndefined(schema)) {
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
      // Range indices are treated differently since they
      // contain additional metadata (e.g. start, stop, step).
      // and not just the name.
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
   * Returns the categorical options defined for a given data column.
   * Returns undefined if the column is not categorical.
   *
   * This function only works for non-index columns and expects the index at 0
   * for the first non-index data column.
   */
  public getCategoricalOptions(dataColumnIndex: number): string[] | undefined {
    const { dataColumns: numDataColumns } = this.dimensions

    if (dataColumnIndex < 0 || dataColumnIndex >= numDataColumns) {
      throw new Error(`Column index is out of range: ${dataColumnIndex}`)
    }

    if (!(this._fields[String(dataColumnIndex)].type instanceof Dictionary)) {
      // This is not a categorical column
      return undefined
    }

    const categoricalDict =
      this._data.getChildAt(dataColumnIndex)?.data[0]?.dictionary
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
    // @ts-expect-error We know the two indexes are of the same size
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
    typeName: IntervalType
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

  /**
   * Adjusts a time value to seconds based on the unit information in the field.
   *
   * The unit numbers are specified here:
   * https://github.com/apache/arrow/blob/3ab246f374c17a216d86edcfff7ff416b3cff803/js/src/enum.ts#L95
   */
  public static convertToSeconds(
    value: number | bigint,
    unit: number
  ): number {
    let unitAdjustment

    if (unit === 1) {
      // Milliseconds
      unitAdjustment = 1000
    } else if (unit === 2) {
      // Microseconds
      unitAdjustment = 1000 * 1000
    } else if (unit === 3) {
      // Nanoseconds
      unitAdjustment = 1000 * 1000 * 1000
    } else {
      // Interpret it as seconds as a fallback
      return Number(value)
    }

    // Do the calculation based on bigints, if the value
    // is a bigint and not safe for usage as number.
    // This might lose some precision since it doesn't keep
    // fractional parts.
    if (typeof value === "bigint" && !Number.isSafeInteger(Number(value))) {
      return Number(value / BigInt(unitAdjustment))
    }

    return Number(value) / unitAdjustment
  }

  private static formatTime(data: number, field?: Field): string {
    const timeInSeconds = Quiver.convertToSeconds(data, field?.type?.unit ?? 0)
    return moment
      .unix(timeInSeconds)
      .utc()
      .format(timeInSeconds % 1 === 0 ? "HH:mm:ss" : "HH:mm:ss.SSS")
  }

  private static formatDuration(data: number | bigint, field?: Field): string {
    return moment
      .duration(
        Quiver.convertToSeconds(data, field?.type?.unit ?? 3),
        "seconds"
      )
      .humanize()
  }

  /**
   * Formats a decimal value with a given scale to a string.
   *
   * This code is partly based on: https://github.com/apache/arrow/issues/35745
   *
   * TODO: This is only a temporary workaround until ArrowJS can format decimals correctly.
   * This is tracked here:
   * https://github.com/apache/arrow/issues/37920
   * https://github.com/apache/arrow/issues/28804
   * https://github.com/apache/arrow/issues/35745
   */
  private static formatDecimal(value: Uint32Array, scale: number): string {
    // Format Uint32Array to a numerical string and pad it with zeros
    // So that it is exactly the length of the scale.
    let numString = util
      .bigNumToString(new util.BN(value))
      .padStart(scale, "0")

    // ArrowJS 13 correctly adds a minus sign for negative numbers.
    // but it doesn't handle th fractional part yet. So we can just return
    // the value if scale === 0, but we need to do some additional processing
    // for the fractional part if scale > 0.

    if (scale === 0) {
      return numString
    }

    let sign = ""
    if (numString.startsWith("-")) {
      // Check if number is negative, and if so remember the sign and remove it.
      // We will add it back later.
      sign = "-"
      numString = numString.slice(1)
    }
    // Extract the whole number part. If the number is < 1, it doesn't
    // have a whole number part, so we'll use "0" instead.
    // E.g for 123450 with scale 3, we'll get "123" as the whole part.
    const wholePart = numString.slice(0, -scale) || "0"
    // Extract the fractional part and remove trailing zeros.
    // E.g. for 123450 with scale 3, we'll get "45" as the fractional part.
    const decimalPart = trimEnd(numString.slice(-scale), "0") || ""
    // Combine the parts and add the sign.
    return `${sign}${wholePart}` + (decimalPart ? `.${decimalPart}` : "")
  }

  public static formatPeriodType(
    duration: bigint,
    typeName: PeriodType
  ): string {
    const match = typeName.match(/period\[(.*)]/)
    if (match === null) {
      logWarning(`Invalid period type: ${typeName}`)
      return String(duration)
    }
    const [, freq] = match
    return this.formatPeriod(duration, freq as PeriodFrequency)
  }

  private static formatPeriod(
    duration: bigint,
    freq: PeriodFrequency
  ): string {
    const [freqName, freqParam] = freq.split("-", 2)
    const momentConverter =
      PERIOD_TYPE_FORMATTERS[freqName as SupportedPandasOffsetType]
    if (!momentConverter) {
      logWarning(`Unsupported period frequency: ${freq}`)
      return String(duration)
    }
    const durationNumber = Number(duration)
    if (!Number.isSafeInteger(durationNumber)) {
      logWarning(
        `Unsupported value: ${duration}. Supported values: [${Number.MIN_SAFE_INTEGER}-${Number.MAX_SAFE_INTEGER}]`
      )
      return String(duration)
    }
    return momentConverter(durationNumber, freqParam)
  }

  private static formatCategoricalType(
    x: number | bigint | StructRow,
    field: Field
  ): string {
    // Serialization for pandas.Interval and pandas.Period is provided by Arrow extensions
    // https://github.com/pandas-dev/pandas/blob/235d9009b571c21b353ab215e1e675b1924ae55c/
    // pandas/core/arrays/arrow/extension_types.py#L17
    const extensionName = field.metadata.get("ARROW:extension:name")
    if (extensionName) {
      const extensionMetadata = JSON.parse(
        field.metadata.get("ARROW:extension:metadata") as string
      )
      if (extensionName === "pandas.interval") {
        const { subtype, closed } = extensionMetadata
        return Quiver.formatInterval(x as StructRow, subtype, closed)
      }
      if (extensionName === "pandas.Period") {
        const { freq } = extensionMetadata
        return Quiver.formatPeriod(x as bigint, freq)
      }
    }
    return String(x)
  }

  /** Returns type for a single-index column or data column. */
  public static getTypeName(type: Type): IndexTypeName | string {
    // For `PeriodType` and `IntervalType` types are kept in `numpy_type`,
    // for the rest of the indexes in `pandas_type`.
    return type.pandas_type === "object" ? type.numpy_type : type.pandas_type
  }

  /** Takes the data and it's type and nicely formats it. */
  public static format(x: DataType, type?: Type, field?: Field): string {
    const typeName = type && Quiver.getTypeName(type)

    if (isNullOrUndefined(x)) {
      return "<NA>"
    }

    // date
    const isDate = x instanceof Date || Number.isFinite(x)
    if (isDate && typeName === "date") {
      return moment.utc(x as Date | number).format("YYYY-MM-DD")
    }
    // time
    if (typeof x === "bigint" && typeName === "time") {
      return Quiver.formatTime(Number(x), field)
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

      return datetime.format("YYYY-MM-DD HH:mm:ssZ")
    }
    // datetime, datetime64, datetime64[ns], etc.
    if (isDate && typeName?.startsWith("datetime")) {
      return moment.utc(x as Date | number).format("YYYY-MM-DD HH:mm:ss")
    }

    if (typeName?.startsWith("interval")) {
      return Quiver.formatIntervalType(
        x as StructRow,
        typeName as IntervalType
      )
    }

    if (typeName?.startsWith("period")) {
      return Quiver.formatPeriodType(x as bigint, typeName as PeriodType)
    }

    if (typeName === "categorical") {
      return this.formatCategoricalType(
        x as number | bigint | StructRow,
        field as Field
      )
    }

    if (typeName?.startsWith("timedelta")) {
      return this.formatDuration(x as number | bigint, field)
    }

    if (typeName === "decimal") {
      return this.formatDecimal(x as Uint32Array, field?.type?.scale || 0)
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
    if (
      isNullOrUndefined(this._styler) ||
      isNullOrUndefined(this._styler.uuid)
    ) {
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

  public get chunkSize(): number | undefined {
    return this._chunkSize
  }

  /** The DataFrame's dimensions. */
  public get dimensions(): DataFrameDimensions {
    const headerColumns = this._index.length || this.types.index.length || 1
    const headerRows = this._columns.length || 1
    const dataRows = this._data.numRows || 0
    const dataColumns = this._data.numCols || this._columns?.[0]?.length || 0

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
      let field = this._fields[`__index_level_${String(columnIndex)}__`]
      if (field === undefined) {
        // If the index column has a name, we need to get it differently:
        field = this._fields[String(columns - headerColumns)]
      }
      return {
        type: DataFrameCellType.INDEX,
        cssId,
        cssClass,
        content,
        contentType,
        field,
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
    const field = this._fields[String(dataColumnIndex)]
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
    return this._data.getChildAt(columnIndex)?.get(rowIndex)
  }

  public addChunk(chunk: Quiver | undefined, chunk_index: number): void {
    this._chunks[chunk_index] = chunk
  }

  public hasChunk(chunk_index: number): boolean {
    return chunk_index in this._chunks
  }

  public getChunk(chunk_index: number): Quiver | undefined {
    return this._chunks[chunk_index]
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

  private static parseFields(schema: ArrowSchema): Record<string, Field> {
    // None-index data columns are listed first, and all index columns listed last
    // within the fields array in arrow.
    return Object.fromEntries(
      (schema.fields || []).map((field, index) => [
        field.name.startsWith("__index_level_") ? field.name : String(index),
        field,
      ])
    )
  }
}
