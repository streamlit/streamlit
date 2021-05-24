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
import { range, unzip } from "lodash"
import { Data, Index, IndexType, Quiver } from "src/lib/Quiver"

export interface DataFrame {
  index: Index
  columns: string[][]
  data: Data
  styler?: Styler
}

interface Schema {
  index_columns: (string | RangeIndex)[]
  columns: SchemaColumn[]
  column_indexes: any[]
}

interface IndexData {
  data: string[]
  type: IndexType
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

export enum IndexTypes {
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

export function parseTable(table: Table): DataFrame {
  const schema = getSchema(table)
  const index = {
    data: getIndex(table, schema),
    type: getIndexType(schema),
  }
  const columns = getColumns(schema)
  const data = {
    data: getData(table, columns),
    type: getColumnType(schema),
  }
  return {
    index,
    columns,
    data,
  }
}

function getSchema(table: Table): Schema {
  const schema = table.schema.metadata.get("pandas")
  if (schema == null) {
    throw new Error("Table schema is missing.")
  }
  return JSON.parse(schema)
}

function getIndex(table: Table, schema: Schema): string[][] {
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

function getIndexType(schema: Schema): IndexType[] {
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

function getColumnType(schema: Schema): any {
  return schema.columns
    .filter(column => !schema.index_columns.includes(column.field_name))
    .map(column => column.pandas_type)
}

function getData(table: Table, columns: string[][]): string[][] {
  const rows = table.length
  const cols = columns.length > 0 ? columns[0].length : 0

  return range(0, rows).map(rowIndex =>
    range(0, cols).map(columnIndex =>
      table.getColumnAt(columnIndex)?.get(rowIndex)
    )
  )
}

function getColumnData(column: Column): string[] {
  return range(0, column.length).map(rowIndex => column.get(rowIndex))
}

function isRangeIndex(field: string | RangeIndex): boolean {
  return typeof field === "object" && field.kind === "range"
}

export function concatTables(q1: Quiver, q2: Quiver): DataFrame {
  // Special case if df1 is empty.
  if (q1.data.data.length === 0) {
    return {
      index: q2.index,
      data: q2.data,
      columns: q2.columns,
    }
  }

  // Always return df1 columns
  const { columns } = q1
  const index = concatIndices(q1.index, q2.index)
  const data = concatData(q1.data, q2.data)
  return { index, data, columns }
}

function concatIndices(i1: Index, i2: Index): Index {
  // Special case if i1 is empty.
  if (i1.data.length === 0) {
    return i2
  }

  // Otherwise, make sure the types match.
  if (!sameIndexTypes(i1.type, i2.type)) {
    throw new Error(
      `Cannot concatenate ${JSON.stringify(i1.type)} with ${JSON.stringify(
        i2.type
      )}.`
    )
  }

  return i1.data.reduce(
    (newIndex: Index, indexData: string[], index: number) => {
      const concatenatedIndex = concatIndex(
        indexData,
        i2.data[index],
        i1.type[index]
      )
      newIndex.data.push(concatenatedIndex.data)
      newIndex.type.push(concatenatedIndex.type)
      return newIndex
    },
    { data: [], type: [] }
  )
}

function concatIndex(i1: string[], i2: string[], type: IndexType): IndexData {
  // Special case for RangeIndex.
  if (type.name === IndexTypes.RangeIndex) {
    return concatRangeIndex(i1, i2, type)
  }
  return concatAnyIndex(i1, i2, type)
}

function concatRangeIndex(
  i1: string[],
  i2: string[],
  type: IndexType
): IndexData {
  let newStop = type.meta.stop
  return i2.reduce(
    (newIndex: IndexData) => {
      newIndex.data.push(newStop)
      newStop += type.meta.step
      newIndex.type.meta.stop = newStop
      return newIndex
    },
    { data: i1, type }
  )
}

function concatAnyIndex(
  i1: string[],
  i2: string[],
  type: IndexType
): IndexData {
  const concatenatedIndex = i1.concat(i2)

  // Special case for CategoricalIndex:
  // `num_categories` must be increased.
  if (type.name === IndexTypes.CategoricalIndex) {
    type.meta.num_categories += i2.length
  }

  return { data: concatenatedIndex, type }
}

function concatData(d1: Data, d2: Data): Data {
  // Make sure data types match.
  if (!sameColumnTypes(d1.type, d2.type)) {
    throw new Error(
      `Cannot concatenate ${JSON.stringify(d1.type)} with ${JSON.stringify(
        d2.type
      )}.`
    )
  }

  const numberOfColumns = d1.type.length
  return {
    data: d1.data.concat(
      d2.data.map((data: string[]) => data.slice(0, numberOfColumns))
    ),
    type: d1.type,
  }
}

function sameIndexTypes(t1: IndexType[], t2: IndexType[]): boolean {
  // Make sure both indices have same dimensions.
  if (t1.length !== t2.length) {
    return false
  }

  return t1.every(
    (firstTypeValue: IndexType, index: number) =>
      firstTypeValue.name === t2[index].name
  )
}

function sameColumnTypes(firstType: string[], secondType: string[]): boolean {
  return firstType.every(
    (firstTypeValue: string, index: number) =>
      firstTypeValue === secondType[index]
  )
}
