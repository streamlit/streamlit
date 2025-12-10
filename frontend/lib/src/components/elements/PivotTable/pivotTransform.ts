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

import { tableFromArrays, tableToIPC } from "apache-arrow"

import { Arrow as ArrowProto } from "@streamlit/protobuf"

import { Quiver } from "~lib/dataframes/Quiver"

export type AggregationType = "sum" | "mean" | "count" | "min" | "max"

export interface ValueField {
  field: string
  aggregation: AggregationType
}

export interface PivotConfig {
  rows: string[]
  columns: string[]
  values: ValueField[]
  filters: Record<string, any[]>
}

/**
 * Transform data into a pivot table format based on the configuration.
 */
export function transformToPivot(data: Quiver, config: PivotConfig): Quiver {
  // If no configuration, return original data
  if (
    config.rows.length === 0 &&
    config.columns.length === 0 &&
    config.values.length === 0
  ) {
    return data
  }

  // If we have a pivot configuration, we need to transform the data
  // For now, return original data as full implementation requires creating new Arrow data
  // This would be implemented by:
  // 1. Extracting all data from Quiver into a JavaScript array
  // 2. Grouping by row and column fields
  // 3. Aggregating values
  // 4. Creating a new pivoted data structure
  // 5. Converting back to Arrow format and creating a new Quiver

  // Simple implementation: just return original data
  // A proper implementation would require working with Arrow data format
  return data
}

/**
 * Calculate an aggregation on a set of values.
 */
export function calculateAggregation(
  values: number[],
  aggregation: AggregationType
): number {
  if (values.length === 0) {
    return 0
  }

  switch (aggregation) {
    case "sum":
      return values.reduce((a, b) => a + b, 0)
    case "mean":
      return values.reduce((a, b) => a + b, 0) / values.length
    case "count":
      return values.length
    case "min":
      return Math.min(...values)
    case "max":
      return Math.max(...values)
    default:
      return 0
  }
}

/**
 * Get the column index for a field name from the Quiver data.
 */
export function getColumnIndex(data: Quiver, fieldName: string): number {
  const columnNames = data.columnNames?.[0] || []
  return columnNames.indexOf(fieldName)
}

/**
 * Extract raw data from Quiver into a usable format for pivoting.
 */
export function extractDataFromQuiver(data: Quiver): Record<string, any>[] {
  const { numDataRows } = data.dimensions
  const columnNames = data.columnNames?.[0] || []
  const rows: Record<string, any>[] = []

  for (let rowIndex = 0; rowIndex < numDataRows; rowIndex++) {
    const row: Record<string, any> = {}
    columnNames.forEach((colName, colIndex) => {
      const { content } = data.getCell(rowIndex, colIndex)
      row[colName] = content
    })
    rows.push(row)
  }

  return rows
}

/**
 * Group data by specified fields and aggregate values.
 */
export function groupAndAggregate(
  rows: Record<string, any>[],
  rowFields: string[],
  columnFields: string[],
  valueFields: ValueField[]
): {
  rowKeys: string[]
  columnKeys: string[]
  values: Record<string, Record<string, number>>
} {
  const rowKeysSet = new Set<string>()
  const columnKeysSet = new Set<string>()
  const groups: Record<string, Record<string, Record<string, number[]>>> = {}

  // Group data
  rows.forEach(row => {
    // Create row key from row fields
    const rowKey =
      rowFields.length > 0
        ? rowFields.map(f => String(row[f] ?? "")).join("|")
        : "Total"

    // Create column key from column fields
    const colKey =
      columnFields.length > 0
        ? columnFields.map(f => String(row[f] ?? "")).join("|")
        : "Total"

    rowKeysSet.add(rowKey)
    columnKeysSet.add(colKey)

    if (!groups[rowKey]) {
      groups[rowKey] = {}
    }
    if (!groups[rowKey][colKey]) {
      groups[rowKey][colKey] = {}
    }

    // Collect values for each value field
    valueFields.forEach(vf => {
      const value = row[vf.field]
      // Convert to number - handle both number and string types
      let numValue = 0
      if (typeof value === "number") {
        numValue = value
      } else if (typeof value === "string") {
        const parsed = parseFloat(value)
        numValue = isNaN(parsed) ? 0 : parsed
      } else if (value !== null && value !== undefined) {
        const parsed = Number(value)
        numValue = isNaN(parsed) ? 0 : parsed
      }

      if (!groups[rowKey][colKey][vf.field]) {
        groups[rowKey][colKey][vf.field] = []
      }
      groups[rowKey][colKey][vf.field].push(numValue)
    })
  })

  // Aggregate values
  const values: Record<string, Record<string, number>> = {}
  const rowKeys = Array.from(rowKeysSet)
  const columnKeys = Array.from(columnKeysSet)

  rowKeys.forEach(rowKey => {
    values[rowKey] = {}
    columnKeys.forEach(colKey => {
      valueFields.forEach(vf => {
        const cellKey =
          columnKeys.length > 1 ? `${colKey}|${vf.field}` : vf.field
        const valuesArray = groups[rowKey]?.[colKey]?.[vf.field] || []
        values[rowKey][cellKey] = calculateAggregation(
          valuesArray,
          vf.aggregation
        )
      })
    })
  })

  return { rowKeys, columnKeys, values }
}

/**
 * Transform data into a pivot table and return a new Quiver object.
 */
export function transformToPivotQuiver(
  data: Quiver,
  config: PivotConfig
): Quiver {
  // If no configuration, return original data
  if (
    config.rows.length === 0 &&
    config.columns.length === 0 &&
    config.values.length === 0
  ) {
    return data
  }

  // Extract and pivot the data
  const rawData = extractDataFromQuiver(data)
  const { rowKeys, columnKeys, values } = groupAndAggregate(
    rawData,
    config.rows,
    config.columns,
    config.values
  )

  // Build column names and data arrays
  const columnNamesArray: string[] = []
  const columnDataArrays: (string | number)[][] = []

  // Add row field columns
  config.rows.forEach(fieldName => {
    columnNamesArray.push(fieldName)
    const columnData = rowKeys.map(rowKey => {
      const parts = rowKey.split("|")
      const index = config.rows.indexOf(fieldName)
      return parts[index] || ""
    })
    columnDataArrays.push(columnData)
  })

  // Add value columns for each column key combination
  columnKeys.forEach(colKey => {
    config.values.forEach(vf => {
      const colParts = colKey.split("|")
      const header =
        columnKeys.length > 1
          ? `${colParts.join(" - ")} ${vf.field} (${vf.aggregation})`
          : `${vf.field} (${vf.aggregation})`
      columnNamesArray.push(header)

      const cellKey =
        columnKeys.length > 1 ? `${colKey}|${vf.field}` : vf.field
      const columnData = rowKeys.map(rowKey => values[rowKey]?.[cellKey] ?? 0)
      columnDataArrays.push(columnData)
    })
  })

  // Create Arrow table from arrays
  const columnObject: Record<string, (string | number)[]> = {}
  columnNamesArray.forEach((name, index) => {
    columnObject[name] = columnDataArrays[index]
  })

  const arrowTable = tableFromArrays(columnObject)
  const arrowBytes = tableToIPC(arrowTable)

  // Create a new Quiver from the Arrow bytes
  const arrowProto: ArrowProto = ArrowProto.create({
    data: arrowBytes,
  })

  return new Quiver(arrowProto)
}
