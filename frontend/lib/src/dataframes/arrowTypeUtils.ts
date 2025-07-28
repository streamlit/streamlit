/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import {
  DataType as ArrowDataType,
  Dictionary,
  Field,
  Struct,
  StructRow,
  Vector,
} from "apache-arrow"

import { isNullOrUndefined } from "~lib/util/utils"

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

/** The name we use for range index columns.  We have to set the name ourselves since range
 * indices are not included in the data or the arrow schema.
 */
export const PandasRangeIndexType = "range"

/** Pandas type information for single-index columns, and data columns. */
export interface PandasColumnType {
  /** The type label returned by pandas.api.types.infer_dtype */
  pandas_type: string

  /** The numpy dtype that corresponds to the types returned in df.dtypes */
  numpy_type: string

  /** Type metadata. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  meta?: Record<string, any> | null
}

/** Metadata for the "range" index type. */
export interface PandasRangeIndex {
  kind: "range"
  name: string | null
  start: number
  step: number
  stop: number
}

/**
 * Pandas metadata extracted from an Arrow table.
 * This describes a single column (either index or data column).
 * It needs to exactly match the structure used in the JSON
 * representation of the Pandas schema in the Arrow table.
 */
export interface PandasColumnMetadata {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
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

/**
 * The Pandas schema extracted from an Arrow table.
 * Arrow stores the schema as a JSON string, and we parse it into this typed object.
 * The Pandas schema is only present if the Arrow table was processed through Pandas.
 */
export interface PandasSchema {
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
  index_columns: (string | PandasRangeIndex)[]

  /**
   * Schemas for each column (index *and* data columns) in the DataFrame.
   */
  columns: PandasColumnMetadata[]

  /**
   * DataFrame column headers.
   * The length represents the dimensions of the DataFrame's columns grid.
   */
  column_indexes: PandasColumnMetadata[]
}

/** The type of the cell. */
export enum DataFrameCellType {
  // Index cells
  INDEX = "index",
  // Data cells
  DATA = "data",
}

/** Metadata for a single column in a DataFrame. */
export interface ArrowType {
  /** The cell's type (index or data). */
  type: DataFrameCellType

  /** The Arrow field metadata of the column. */
  arrowField: Field

  /** The pandas type metadata of the column. */
  pandasType: PandasColumnMetadata | undefined

  /** If the column is categorical, this contains a list of categorical
   * options. Otherwise, it is undefined.
   */
  categoricalOptions?: string[]
}

/**
 * Converts an Arrow vector to a list of strings.
 *
 * @param vector The Arrow vector to convert.
 * @returns The list of strings.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
export function convertVectorToList(vector: Vector<any>): string[] {
  const values = []

  for (let i = 0; i < vector.length; i++) {
    values.push(vector.get(i))
  }
  return values
}

/** Returns type for a single-index column or data column. */
export function getPandasTypeName(type: ArrowType): string | undefined {
  if (isNullOrUndefined(type.pandasType)) {
    return undefined
  }
  // For `PeriodType` and `IntervalType` types are kept in `numpy_type`,
  // for the rest of the indexes in `pandas_type`.
  return type.pandasType.pandas_type === "object"
    ? type.pandasType.numpy_type
    : type.pandasType.pandas_type
}

/** Returns the timezone of the arrow type metadata. */
export function getTimezone(type: ArrowType): string | undefined {
  return type.arrowField?.type?.timezone ?? type.pandasType?.metadata?.timezone
}

/** True if the arrow type is an integer type.
 * For example: int8, int16, int32, int64, uint8, uint16, uint32, uint64, range
 */
export function isIntegerType(type?: ArrowType): boolean {
  if (isNullOrUndefined(type)) {
    return false
  }
  const typeName = getPandasTypeName(type) ?? ""
  return (
    // Period types are integers with an extra extension name
    (ArrowDataType.isInt(type.arrowField.type) && !isPeriodType(type)) ||
    (typeName.startsWith("int") && !isIntervalType(type)) ||
    isRangeIndexType(type) ||
    isUnsignedIntegerType(type)
  )
}

/** True if the arrow type is an unsigned integer type. */
export function isUnsignedIntegerType(type?: ArrowType): boolean {
  if (isNullOrUndefined(type)) {
    return false
  }
  return (
    (ArrowDataType.isInt(type.arrowField.type) &&
      type.arrowField.type.isSigned === false) ||
    (getPandasTypeName(type)?.startsWith("uint") ?? false)
  )
}

/** True if the arrow type is a float type.
 * For example: float16, float32, float64, float96, float128
 */
export function isFloatType(type?: ArrowType): boolean {
  if (isNullOrUndefined(type)) {
    return false
  }
  return (
    (ArrowDataType.isFloat(type.arrowField.type) ||
      getPandasTypeName(type)?.startsWith("float")) ??
    false
  )
}

/** True if the arrow type is a decimal type. */
export function isDecimalType(type?: ArrowType): boolean {
  if (isNullOrUndefined(type)) {
    return false
  }
  return (
    ArrowDataType.isDecimal(type.arrowField.type) ||
    getPandasTypeName(type) === "decimal"
  )
}

/** True if the arrow type is a numeric type. */
export function isNumericType(type?: ArrowType): boolean {
  if (isNullOrUndefined(type)) {
    return false
  }
  return isIntegerType(type) || isFloatType(type) || isDecimalType(type)
}

/** True if the arrow type is a boolean type. */
export function isBooleanType(type?: ArrowType): boolean {
  if (isNullOrUndefined(type)) {
    return false
  }
  return (
    ArrowDataType.isBool(type.arrowField.type) ||
    getPandasTypeName(type) === "bool"
  )
}

/** True if the arrow type is a duration type. */
export function isDurationType(type?: ArrowType): boolean {
  if (isNullOrUndefined(type)) {
    return false
  }
  return (
    ArrowDataType.isDuration(type.arrowField.type) ||
    (getPandasTypeName(type)?.startsWith("timedelta") ?? false)
  )
}

/** True if the arrow type is a period type. */
export function isPeriodType(type?: ArrowType): boolean {
  if (isNullOrUndefined(type)) {
    return false
  }
  return (
    (ArrowDataType.isInt(type.arrowField.type) &&
      type.arrowField.metadata.get("ARROW:extension:name") === "period") ||
    (getPandasTypeName(type)?.startsWith("period") ?? false)
  )
}

/** True if the arrow type is a datetime type. */
export function isDatetimeType(type?: ArrowType): boolean {
  if (isNullOrUndefined(type)) {
    return false
  }
  return (
    ArrowDataType.isTimestamp(type.arrowField.type) ||
    (getPandasTypeName(type)?.startsWith("datetime") ?? false)
  )
}

/** True if the arrow type is a date type. */
export function isDateType(type?: ArrowType): boolean {
  if (isNullOrUndefined(type)) {
    return false
  }
  return (
    ArrowDataType.isDate(type.arrowField.type) ||
    getPandasTypeName(type) === "date"
  )
}

/** True if the arrow type is a time type. */
export function isTimeType(type?: ArrowType): boolean {
  if (isNullOrUndefined(type)) {
    return false
  }
  return (
    ArrowDataType.isTime(type.arrowField.type) ||
    getPandasTypeName(type) === "time"
  )
}

/** True if the arrow type is a categorical type. */
export function isCategoricalType(type?: ArrowType): boolean {
  if (isNullOrUndefined(type)) {
    return false
  }
  return (
    ArrowDataType.isDictionary(type.arrowField.type) ||
    getPandasTypeName(type) === "categorical"
  )
}

/** True if the arrow type is a list type. */
export function isListType(type?: ArrowType): boolean {
  if (isNullOrUndefined(type)) {
    return false
  }
  return (
    ArrowDataType.isList(type.arrowField.type) ||
    ArrowDataType.isFixedSizeList(type.arrowField.type) ||
    (getPandasTypeName(type)?.startsWith("list") ?? false)
  )
}

/** True if the arrow type is an object type. */
export function isObjectType(type?: ArrowType): boolean {
  if (isNullOrUndefined(type)) {
    return false
  }
  return (
    ArrowDataType.isStruct(type.arrowField.type) ||
    ArrowDataType.isMap(type.arrowField.type) ||
    getPandasTypeName(type) === "object"
  )
}

/** True if the arrow type is a bytes type. */
export function isBytesType(type?: ArrowType): boolean {
  if (isNullOrUndefined(type)) {
    return false
  }
  return (
    ArrowDataType.isBinary(type.arrowField.type) ||
    ArrowDataType.isLargeBinary(type.arrowField.type) ||
    getPandasTypeName(type) === "bytes"
  )
}

/** True if the arrow type is a string type. */
export function isStringType(type?: ArrowType): boolean {
  if (isNullOrUndefined(type)) {
    return false
  }
  return (
    ArrowDataType.isUtf8(type.arrowField.type) ||
    ArrowDataType.isLargeUtf8(type.arrowField.type) ||
    ["unicode", "large_string[pyarrow]"].includes(
      getPandasTypeName(type) ?? ""
    )
  )
}

/** True if the arrow type is an empty type. */
export function isEmptyType(type?: ArrowType): boolean {
  if (isNullOrUndefined(type)) {
    return false
  }
  return (
    ArrowDataType.isNull(type.arrowField.type) ||
    getPandasTypeName(type) === "empty"
  )
}

/** True if the arrow type is a interval type. */
export function isIntervalType(type?: ArrowType): boolean {
  if (isNullOrUndefined(type)) {
    return false
  }
  // ArrowDataType.isInterval checks for a different (unsupported) type and not related
  // to the pandas interval extension type.
  return (
    (ArrowDataType.isStruct(type.arrowField.type) &&
      type.arrowField.metadata.get("ARROW:extension:name") === "interval") ||
    (getPandasTypeName(type)?.startsWith("interval") ?? false)
  )
}

/** True if the arrow type is a range index type. */
export function isRangeIndexType(type?: ArrowType): boolean {
  if (isNullOrUndefined(type)) {
    return false
  }
  // Range index can only exist if the table was processed through Pandas.
  // So, we don't need to check the arrow type here.
  return getPandasTypeName(type) === PandasRangeIndexType
}
