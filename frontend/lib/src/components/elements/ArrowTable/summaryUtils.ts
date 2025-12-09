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

import { Quiver } from "~lib/dataframes/Quiver"

export type SummaryType = "count" | "sum" | "average" | "min" | "max"

export interface SummaryConfig {
  [columnName: string]: SummaryType
}

/**
 * Get the display label for a summary type.
 */
export function getSummaryLabel(summaryType: SummaryType): string {
  const labels: Record<SummaryType, string> = {
    count: "Count",
    sum: "Sum",
    average: "Avg",
    min: "Min",
    max: "Max",
  }
  return labels[summaryType]
}

/**
 * Parse the summary configuration from a JSON string.
 */
export function parseSummaryConfig(configJson: string): SummaryConfig | null {
  if (!configJson) {
    return null
  }
  try {
    return JSON.parse(configJson) as SummaryConfig
  } catch {
    return null
  }
}

/**
 * Get all column values for a specific column index.
 * Returns an array of numeric values (nulls are filtered out).
 */
function getColumnNumericValues(table: Quiver, columnIndex: number): number[] {
  const { numDataRows } = table.dimensions
  const values: number[] = []

  for (let rowIndex = 0; rowIndex < numDataRows; rowIndex++) {
    const cell = table.getCell(rowIndex, columnIndex)
    const value = cell.content

    if (value !== null && value !== undefined) {
      const numValue = Number(value)
      if (!isNaN(numValue)) {
        values.push(numValue)
      }
    }
  }

  return values
}

/**
 * Count non-null values in a column.
 */
function computeCount(table: Quiver, columnIndex: number): number {
  const { numDataRows } = table.dimensions
  let count = 0

  for (let rowIndex = 0; rowIndex < numDataRows; rowIndex++) {
    const cell = table.getCell(rowIndex, columnIndex)
    if (cell.content !== null && cell.content !== undefined) {
      count++
    }
  }

  return count
}

/**
 * Compute the sum of values in a column.
 */
function computeSum(values: number[]): number {
  return values.reduce((acc, val) => acc + val, 0)
}

/**
 * Compute the average of values in a column.
 */
function computeAverage(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }
  return computeSum(values) / values.length
}

/**
 * Compute the minimum value in a column.
 */
function computeMin(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }
  return Math.min(...values)
}

/**
 * Compute the maximum value in a column.
 */
function computeMax(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }
  return Math.max(...values)
}

/**
 * Format a summary value for display.
 */
function formatSummaryValue(
  value: number | null,
  summaryType: SummaryType
): string {
  if (value === null) {
    return "-"
  }

  // Count is always an integer
  if (summaryType === "count") {
    return value.toLocaleString()
  }

  // For numeric summaries, format appropriately
  if (Number.isInteger(value)) {
    return value.toLocaleString()
  }

  // Format floats with 2 decimal places
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Compute a summary statistic for a specific column.
 * Returns the formatted string result.
 */
export function computeSummary(
  table: Quiver,
  columnIndex: number,
  summaryType: SummaryType
): string {
  // For count, we can work with any column type
  if (summaryType === "count") {
    const count = computeCount(table, columnIndex)
    return formatSummaryValue(count, summaryType)
  }

  // For other summary types, get numeric values
  const values = getColumnNumericValues(table, columnIndex)

  let result: number | null = null

  switch (summaryType) {
    case "sum":
      result = values.length > 0 ? computeSum(values) : null
      break
    case "average":
      result = computeAverage(values)
      break
    case "min":
      result = computeMin(values)
      break
    case "max":
      result = computeMax(values)
      break
  }

  return formatSummaryValue(result, summaryType)
}

/**
 * Get the column name from the table for a specific column index.
 */
export function getColumnName(table: Quiver, columnIndex: number): string {
  const { numIndexColumns, numHeaderRows } = table.dimensions

  // Get the column header name
  // For index columns, we use a special identifier
  if (columnIndex < numIndexColumns) {
    return `_index_${columnIndex}`
  }

  // For data columns, get the header name
  const dataColumnIndex = columnIndex - numIndexColumns

  // Access the column name from the table's column structure
  // The headers are stored in the table data
  try {
    // Get the last header row (the one with actual column names)
    const headerRowIndex = numHeaderRows - 1
    if (headerRowIndex >= 0) {
      // Column names are accessible through the Quiver API
      // We'll use a workaround to get the column name
      const columnNames = table.columnNames
      if (
        columnNames &&
        columnNames.length > 0 &&
        columnNames[0].length > columnIndex
      ) {
        return String(columnNames[numHeaderRows - 1][columnIndex] ?? "")
      }
    }
  } catch {
    // Fall back to index-based name if we can't get the header
  }

  return `col_${dataColumnIndex}`
}

/**
 * Find the column index for a given column name.
 * Returns -1 if not found.
 */
export function findColumnIndex(table: Quiver, columnName: string): number {
  const { numColumns, numHeaderRows } = table.dimensions

  for (let colIndex = 0; colIndex < numColumns; colIndex++) {
    const name = getColumnName(table, colIndex)
    if (name === columnName) {
      return colIndex
    }
  }

  // Also try to match against the raw column names from the table
  const columnNames = table.columnNames
  if (columnNames && columnNames.length > 0) {
    const lastHeaderRow = columnNames[numHeaderRows - 1] || columnNames[0]
    for (let i = 0; i < lastHeaderRow.length; i++) {
      if (String(lastHeaderRow[i]) === columnName) {
        return i
      }
    }
  }

  return -1
}
