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

// (HK) TODO: Everything here must be heavily refactored.
// Do NOT use this in production.

import { Column, Table } from "apache-arrow"
import { isEqual, range, unzip } from "lodash"

export interface DataTable {
  index: any
  columns: any[][]
  data: any[][]
  styler?: Styler
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

enum IndexTypes {
  UnicodeIndex = "unicode",
  RangeIndex = "range",
  CategoricalIndex = "categorical",
  MultiIndex = "multiIndex",
  IntervalIndex = "interval[int64]",
  DatetimeIndex = "datetime",
  TimedeltaIndex = "time",
  PeriodIndex = "period[Q-DEC]",
  Int64Index = "int64",
  UInt64Index = "uint64",
  Float64Index = "float64",
}

export interface Styler {
  uuid?: string
  caption?: string
  styles?: string
  displayValues?: any
}

export function toHumanFormat(table: any): DataTable {
  const schema = getSchema(table)
  const columns = getColumns(schema)
  const data = getData(table, columns)
  const index = {
    data: getIndex(table, schema),
    type: getIndexType(schema),
  }

  return {
    index,
    columns,
    data,
  }
}

function getSchema(table: Table<any>): Schema {
  const schema = table.schema.metadata.get("pandas")
  if (schema == null) {
    throw new Error("Table schema is missing.")
  }
  return JSON.parse(schema)
}

function getIndex(table: Table<any>, schema: Schema): string[][] {
  return schema.index_columns.map(field => {
    const isRangeIndex = typeof field === "object" && field.kind === "range"
    if (isRangeIndex) {
      const { start, stop, step } = field as RangeIndex
      return range(start, stop, step).map(String)
    }
    const column = table.getColumn(field as string)
    return getColumnData(column).map(String)
  })
}

function getIndexType(schema: Schema): any {
  return schema.index_columns.map(indexName => {
    if (isRangeIndex(indexName)) {
      return {
        name: IndexTypes.RangeIndex,
        meta: indexName,
      }
    }

    // Get index column from columns schema.
    const indexColumn = schema.columns.find(
      column => column.field_name === indexName
    )

    // PeriodIndex and IntervalIndex values are kept in `numpy_type` property,
    // the rest in `pandas_type`.
    return {
      name:
        indexColumn?.pandas_type === "object"
          ? indexColumn?.numpy_type
          : indexColumn?.pandas_type,
      meta: indexColumn?.metadata,
    }
  })
}

function getColumns(schema: Schema): string[][] {
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

function getData(table: Table<any>, columns: string[][]): any[][] {
  const rows = table.length
  const cols = columns.length > 0 ? columns[0].length : 0

  return range(0, rows).map(rowIndex =>
    range(0, cols).map(columnIndex =>
      table
        .getColumnAt(columnIndex)
        ?.get(rowIndex)
        ?.toString()
    )
  )
}

function getColumnData(column: Column): any[] {
  return range(0, column.length).map(rowIndex => column.get(rowIndex))
}

function isRangeIndex(field: string | RangeIndex): boolean {
  return typeof field === "object" && field.kind === "range"
}

export function concatTables(df1: any, df2: any): any {
  // Special case if df1 is empty.
  if (df1.data.length === 0) {
    return df2
  }

  // Otherwise, make sure the types match.
  // (HK) TODO: Fix this check for RangeIndex with different steps.
  if (!isEqual(df1.index.type, df2.index.type)) {
    throw new Error(
      `Cannot concatenate ${df1.index.type.join()} with ${df2.index.type.join()}.`
    )
  }

  const index = concatIndices(df1.index, df2.index)
  const data = concatData(df1.data, df2.data)
  return { index, data }
}

function concatIndices(index1: any, index2: any): any {
  // NOTE: The current implementation works only for single indices.
  // (HK) TODO: Add multi-index support.
  const indexType = index1.type[0].name

  switch (indexType) {
    case IndexTypes.RangeIndex:
      return concatRangeIndex(index1, index2)
    default:
      // Patch for now.
      // (HK) TODO: Add support for different types of indices.
      return concatAnyIndex(index1, index2)
  }
}

function concatRangeIndex(index1: any, index2: any): any {
  // @ts-ignore
  // eslint-disable-next-line
  let { step, stop } = index1.type[0].meta
  index2.data[0].forEach(() => {
    index1.data[0].push(stop)
    stop += step
  })

  index1.type[0].meta.stop = stop

  return index1
}

function concatAnyIndex(index1: any, index2: any): any {
  index2.data[0].forEach((value: any) => {
    index1.data[0].push(value)
  })
  return index1
}

function concatData(data1: any, data2: any): any {
  return data1.concat(data2)
}
