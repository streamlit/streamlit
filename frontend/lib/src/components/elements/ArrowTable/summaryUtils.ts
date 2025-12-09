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

export type SummaryType =
  | "count"
  | "sum"
  | "average"
  | "min"
  | "max"
  | "median"

// All available summary types for dropdown
export const ALL_SUMMARY_TYPES: SummaryType[] = [
  "count",
  "sum",
  "average",
  "median",
  "min",
  "max",
]

// Parsed summary value from backend
// Either {"type": "sum"} for static or {"type": "all", "default": "count"} for dropdown
export interface SummaryConfigValue {
  type: SummaryType | "all"
  default?: SummaryType // Only present when type is "all"
}

export interface SummaryConfig {
  [columnName: string]: SummaryConfigValue
}

/**
 * Check if a summary config value is the "all" dropdown type.
 */
export function isAllType(value: SummaryConfigValue): boolean {
  return value.type === "all"
}

/**
 * Get the default summary type for an "all" config.
 */
export function getDefaultType(value: SummaryConfigValue): SummaryType {
  if (value.type === "all") {
    return value.default ?? "count"
  }
  return value.type
}

/**
 * Get the display label for a summary type.
 */
export function getSummaryLabel(summaryType: SummaryType): string {
  const labels: Record<SummaryType, string> = {
    count: "Count",
    sum: "Sum",
    average: "Avg",
    median: "Med",
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
 * Parse a value as a number, handling comma-formatted strings.
 */
function parseNumericValue(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null
  }

  // If it's already a number, return it
  if (typeof value === "number") {
    return isNaN(value) ? null : value
  }

  // Handle bigint
  if (typeof value === "bigint") {
    return Number(value)
  }

  // For strings, try to parse (removing commas for thousands separators)
  if (typeof value === "string") {
    const strValue = value.replace(/,/g, "")
    const numValue = Number(strValue)
    return isNaN(numValue) ? null : numValue
  }

  // For other types, try direct number conversion
  const numValue = Number(value)
  return isNaN(numValue) ? null : numValue
}

/**
 * Get all column values for a specific column index.
 * Returns an array of numeric values (nulls are filtered out).
 * Handles comma-formatted numbers (e.g., "1,234").
 */
function getColumnNumericValues(table: Quiver, columnIndex: number): number[] {
  const { numDataRows } = table.dimensions
  const values: number[] = []

  for (let rowIndex = 0; rowIndex < numDataRows; rowIndex++) {
    const cell = table.getCell(rowIndex, columnIndex)
    const numValue = parseNumericValue(cell.content)

    if (numValue !== null) {
      values.push(numValue)
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
 * Compute the median value in a column.
 */
function computeMedian(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

/**
 * Detect the maximum number of decimal places used in column values.
 */
function detectColumnDecimalPlaces(
  table: Quiver,
  columnIndex: number
): number {
  const { numDataRows } = table.dimensions
  let maxDecimals = 0

  for (let rowIndex = 0; rowIndex < numDataRows; rowIndex++) {
    const cell = table.getCell(rowIndex, columnIndex)
    const value = cell.content

    if (value !== null && value !== undefined) {
      // Remove commas before checking decimals (for comma-formatted strings)
      const strValue = String(value).replace(/,/g, "")
      const decimalIndex = strValue.indexOf(".")
      if (decimalIndex !== -1) {
        const decimals = strValue.length - decimalIndex - 1
        maxDecimals = Math.max(maxDecimals, decimals)
      }
    }
  }

  return maxDecimals
}

/**
 * Format a summary value for display with locale formatting.
 * Always uses commas for thousands for better readability.
 */
function formatSummaryValue(
  value: number | null,
  summaryType: SummaryType,
  decimalPlaces: number
): string {
  if (value === null) {
    return "-"
  }

  // Count is always an integer
  if (summaryType === "count") {
    return value.toLocaleString()
  }

  // Format with locale (commas) and matching decimal places
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
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
  // Detect the decimal places used in the column
  const decimalPlaces = detectColumnDecimalPlaces(table, columnIndex)

  // For count, we can work with any column type
  if (summaryType === "count") {
    const count = computeCount(table, columnIndex)
    return formatSummaryValue(count, summaryType, 0)
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
    case "median":
      result = computeMedian(values)
      break
    case "min":
      result = computeMin(values)
      break
    case "max":
      result = computeMax(values)
      break
  }

  return formatSummaryValue(result, summaryType, decimalPlaces)
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
