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
  Field,
  Float64,
  tableFromArrays,
  tableToIPC,
  Utf8,
} from "apache-arrow"

import { Arrow as ArrowProto } from "@streamlit/protobuf"

import { isNumericType } from "~lib/dataframes/arrowTypeUtils"
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
  filters: Record<string, unknown[]>
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
  const rowKeys = Array.from(rowKeysSet).sort()
  const columnKeys = Array.from(columnKeysSet).sort()

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
 * Detect the number of decimal places in the original data for a field.
 * Samples up to 100 rows to find the maximum decimal precision.
 */
function detectDecimalPlaces(data: Quiver, fieldName: string): number {
  const columnNames = data.columnNames?.[0] || []
  const colIndex = columnNames.indexOf(fieldName)

  if (colIndex === -1) {
    return 0 // Default to 0 decimal places if field not found
  }

  let maxDecimals = 0
  const { numDataRows } = data.dimensions
  const samplesToCheck = Math.min(numDataRows, 100)

  for (let rowIndex = 0; rowIndex < samplesToCheck; rowIndex++) {
    const { content } = data.getCell(rowIndex, colIndex)

    if (content === null || content === undefined) {
      continue
    }

    let numValue: number
    if (typeof content === "number") {
      numValue = content
    } else if (typeof content === "string") {
      numValue = parseFloat(content)
      if (isNaN(numValue)) {
        continue
      }
    } else {
      continue
    }

    // Skip if not a finite number
    if (!isFinite(numValue)) {
      continue
    }

    // Convert to string to count decimal places
    const stringValue = numValue.toString()

    // Skip scientific notation
    if (stringValue.includes("e") || stringValue.includes("E")) {
      continue
    }

    const decimalIndex = stringValue.indexOf(".")
    if (decimalIndex !== -1) {
      // Count significant decimal places (excluding trailing zeros)
      let decimals = 0
      let hasNonZero = false

      for (let i = stringValue.length - 1; i > decimalIndex; i--) {
        const char = stringValue[i]
        if (char === "0" && !hasNonZero) {
          continue // Skip trailing zeros
        }
        hasNonZero = true
        decimals++
      }

      maxDecimals = Math.max(maxDecimals, decimals)
    }
  }

  return Math.min(maxDecimals, 6) // Cap at 6 decimal places for reasonable display
}

/**
 * Format a number with the appropriate decimal places for display.
 * Returns a number for Arrow, which we'll control via Decimal type with scale.
 */
function formatNumber(value: number, decimalPlaces: number): number {
  if (!isFinite(value)) {
    return value
  }

  if (decimalPlaces === 0) {
    return Math.round(value)
  }

  // Round to the specified decimal places
  const factor = Math.pow(10, decimalPlaces)
  return Math.round(value * factor) / factor
}

/**
 * Format a number as string for display (used for totals and custom formatting).
 * NOTE: Currently unused but kept for potential future use.
 */
function _formatNumberAsString(value: number, decimalPlaces: number): string {
  if (!isFinite(value)) {
    return String(value)
  }

  if (decimalPlaces === 0) {
    return Math.round(value).toString()
  }

  // Round to the specified decimal places
  const rounded = formatNumber(value, decimalPlaces)

  // Format with fixed decimals, then remove trailing zeros
  let formatted = rounded.toFixed(decimalPlaces)

  // Remove trailing zeros after decimal point
  if (formatted.includes(".")) {
    formatted = formatted.replace(/\.?0+$/, "")
  }

  return formatted
}

/**
 * Get abbreviated label for aggregation type (matching ArrowTable summary style).
 */
function getAggregationLabel(aggregation: AggregationType): string {
  switch (aggregation) {
    case "sum":
      return "Sum"
    case "mean":
      return "Avg"
    case "count":
      return "Count"
    case "min":
      return "Min"
    case "max":
      return "Max"
    default:
      return aggregation
  }
}

/**
 * Add totals row/column to original unpivoted data.
 * NOTE: Currently disabled to preserve decimal formatting from original data.
 */
function _addTotalsToOriginalData(
  data: Quiver,
  showRowTotals: boolean,
  showColumnTotals: boolean
): Quiver {
  const { numDataRows, numColumns } = data.dimensions
  const columnNames = data.columnNames?.[0] || []

  // Build new data arrays
  const columnNamesArray: string[] = []
  const columnDataArrays: (string | number)[][] = []
  const schemaFields: Field[] = []

  // Add all original columns
  for (let colIndex = 0; colIndex < numColumns; colIndex++) {
    const colName = columnNames[colIndex]
    const isIndexColumn = !colName || colName === "" // Unnamed columns are treated as index columns

    // For unnamed columns, use the index number as the display name to avoid "null"
    const displayName = colName || String(colIndex)
    columnNamesArray.push(displayName)

    const columnData: (string | number)[] = []
    // Index columns should always be treated as strings, not numeric
    let isNumeric = !isIndexColumn

    // Get the original field from the first cell to preserve type metadata
    const { field: originalField } = data.getCell(0, colIndex)

    // Get all values for this column
    for (let rowIndex = 0; rowIndex < numDataRows; rowIndex++) {
      const { content, contentType } = data.getCell(rowIndex, colIndex)
      columnData.push(content)
      if (!isIndexColumn && !isNumericType(contentType)) {
        isNumeric = false
      }
    }

    // Add row total if needed
    if (showRowTotals) {
      if (isNumeric && !isIndexColumn) {
        // Sum for numeric named columns only
        const sum = columnData.reduce((acc, val) => {
          const num = typeof val === "number" ? val : parseFloat(String(val))
          return acc + (isNaN(num) ? 0 : num)
        }, 0)
        // Detect decimal places for this column and format accordingly
        const dp = detectDecimalPlaces(data, colName)
        columnData.push(formatNumber(sum, dp))
      } else if (colIndex === 0) {
        // First column gets "Total" label
        columnData.push("Total")
      } else {
        columnData.push("")
      }
    }

    columnDataArrays.push(columnData)

    // Preserve original field type with metadata, or use string for index columns
    if (isIndexColumn) {
      schemaFields.push(new Field(displayName, new Utf8(), true))
    } else {
      // Preserve the original field type including decimal precision metadata
      schemaFields.push(
        new Field(displayName, originalField.type, originalField.nullable)
      )
    }
  }

  // Add column totals if needed
  if (showColumnTotals) {
    columnNamesArray.push("Total")
    const totalColumn: (string | number)[] = []

    // Detect max decimal places across all numeric columns for proper formatting
    let maxDecimals = 0
    for (let colIndex = 0; colIndex < numColumns; colIndex++) {
      const colName = columnNames[colIndex]
      const { contentType } = data.getCell(0, colIndex)
      if (isNumericType(contentType) && colName) {
        const dp = detectDecimalPlaces(data, colName)
        maxDecimals = Math.max(maxDecimals, dp)
      }
    }
    // Default to 2 if no numeric columns found with names
    if (maxDecimals === 0) {
      maxDecimals = 2
    }

    for (let rowIndex = 0; rowIndex < numDataRows; rowIndex++) {
      let rowSum = 0
      for (let colIndex = 0; colIndex < numColumns; colIndex++) {
        const { content, contentType } = data.getCell(rowIndex, colIndex)
        if (isNumericType(contentType)) {
          const num =
            typeof content === "number" ? content : parseFloat(String(content))
          rowSum += isNaN(num) ? 0 : num
        }
      }
      totalColumn.push(formatNumber(rowSum, maxDecimals))
    }

    // Grand total if both row and column totals
    if (showRowTotals) {
      const grandTotal = totalColumn.reduce((acc, val) => {
        const num = typeof val === "number" ? val : parseFloat(String(val))
        return acc + (isNaN(num) ? 0 : num)
      }, 0)
      totalColumn.push(formatNumber(grandTotal, maxDecimals))
    }

    columnDataArrays.push(totalColumn)
    schemaFields.push(new Field("Total", new Float64(), true))
  }

  // Create Arrow table - ensure all data has consistent types
  const columnObject: Record<string, any[]> = {}

  // Process each column to ensure type consistency
  for (let i = 0; i < columnNamesArray.length; i++) {
    const name = columnNamesArray[i]
    const field = schemaFields[i]
    const isNumeric = field.type.toString().includes("Float")

    if (isNumeric) {
      // Numeric columns - preserve original values, only convert strings if needed
      columnObject[name] = columnDataArrays[i].map(v => {
        if (typeof v === "number") {
          return v
        }
        // For string values, convert carefully
        const parsed = parseFloat(String(v))
        return isNaN(parsed) ? 0 : parsed
      })
    } else {
      // String columns - ensure all values are strings
      columnObject[name] = columnDataArrays[i].map(v => String(v))
    }
  }

  const arrowTable = tableFromArrays(columnObject)
  const arrowBytes = tableToIPC(arrowTable)

  const arrowProto: ArrowProto = ArrowProto.create({
    data: arrowBytes,
  })

  return new Quiver(arrowProto)
}

/**
 * Transform data into a pivot table and return a new Quiver object.
 */
export function transformToPivotQuiver(
  data: Quiver,
  config: PivotConfig,
  showRowTotals = false,
  showColumnTotals = false
): Quiver {
  // Check if pivot configuration is active
  const hasConfig =
    config.rows.length > 0 ||
    config.columns.length > 0 ||
    config.values.length > 0

  // If no pivot configuration, return original data unchanged
  // (Totals without pivot would require recreating the table and lose decimal formatting)
  if (!hasConfig) {
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

  // Detect decimal places and preserve original field types
  const decimalPlaces: Record<string, number> = {}
  const originalFields: Record<string, Field> = {}

  config.values.forEach(vf => {
    const detectedPlaces = detectDecimalPlaces(data, vf.field)
    // For count, always use 0 decimals
    decimalPlaces[vf.field] = vf.aggregation === "count" ? 0 : detectedPlaces

    // Find and preserve the original field type for this column
    const columnNames = data.columnNames?.[0] || []
    const colIndex = columnNames.indexOf(vf.field)
    if (colIndex >= 0) {
      const { field } = data.getCell(0, colIndex)
      originalFields[vf.field] = field
    }
  })

  // Build column names, data arrays, and schema fields
  const columnNamesArray: string[] = []
  const columnDataArrays: any[][] = []
  const schemaFields: Field[] = []

  // Add row field columns (as strings)
  config.rows.forEach(fieldName => {
    columnNamesArray.push(fieldName)
    schemaFields.push(new Field(fieldName, new Utf8(), true))
    const columnData = rowKeys.map(rowKey => {
      const parts = rowKey.split("|")
      const index = config.rows.indexOf(fieldName)
      return parts[index] || ""
    })
    columnDataArrays.push(columnData)
  })

  // Add value columns for each column key combination (as Float64)
  columnKeys.forEach(colKey => {
    config.values.forEach(vf => {
      const colParts = colKey.split("|")
      const aggLabel = getAggregationLabel(vf.aggregation)

      // Format header with abbreviated aggregation label
      const header =
        columnKeys.length > 1
          ? `${colParts.join(" - ")} ${vf.field} (${aggLabel})`
          : `${vf.field} (${aggLabel})`
      columnNamesArray.push(header)

      // Preserve original field type if available, otherwise use Float64
      const originalField = originalFields[vf.field]
      const fieldType = originalField ? originalField.type : new Float64()
      schemaFields.push(new Field(header, fieldType, true))

      const cellKey =
        columnKeys.length > 1 ? `${colKey}|${vf.field}` : vf.field
      const dp = decimalPlaces[vf.field] || 0
      const columnData = rowKeys.map(rowKey => {
        const value = values[rowKey]?.[cellKey] ?? 0
        return formatNumber(value, dp)
      })
      columnDataArrays.push(columnData)
    })
  })

  // Add column totals if requested
  if (showColumnTotals && columnKeys.length > 0) {
    config.values.forEach(vf => {
      const aggLabel = getAggregationLabel(vf.aggregation)
      const header = `Total ${vf.field} (${aggLabel})`
      columnNamesArray.push(header)

      // Preserve original field type for totals
      const originalField = originalFields[vf.field]
      const fieldType = originalField ? originalField.type : new Float64()
      schemaFields.push(new Field(header, fieldType, true))

      // Calculate totals across all columns for each row
      const dp = decimalPlaces[vf.field] || 0
      const columnData = rowKeys.map(rowKey => {
        let total = 0
        columnKeys.forEach(colKey => {
          const cellKey =
            columnKeys.length > 1 ? `${colKey}|${vf.field}` : vf.field
          total += values[rowKey]?.[cellKey] ?? 0
        })
        return formatNumber(total, dp)
      })
      columnDataArrays.push(columnData)
    })
  }

  // Add row totals if requested
  if (showRowTotals && rowKeys.length > 0) {
    // Add a "Total" row at the end
    // Add row identifier columns
    config.rows.forEach((_fieldName, index) => {
      if (index === 0) {
        columnDataArrays[index].push("Total")
      } else {
        columnDataArrays[index].push("")
      }
    })

    // Calculate totals for each value column
    let valueColIndex = config.rows.length
    columnKeys.forEach(() => {
      config.values.forEach(vf => {
        let total = 0
        rowKeys.forEach(rowKey => {
          const existingValue =
            columnDataArrays[valueColIndex][rowKeys.indexOf(rowKey)]
          total +=
            typeof existingValue === "number"
              ? existingValue
              : parseFloat(String(existingValue)) || 0
        })
        const dp = decimalPlaces[vf.field] || 0
        columnDataArrays[valueColIndex].push(formatNumber(total, dp))
        valueColIndex++
      })
    })

    // Add column totals cell if both totals are shown
    if (showColumnTotals && columnKeys.length > 0) {
      config.values.forEach(() => {
        let grandTotal = 0
        rowKeys.forEach(rowKey => {
          const existingValue =
            columnDataArrays[valueColIndex][rowKeys.indexOf(rowKey)]
          grandTotal +=
            typeof existingValue === "number"
              ? existingValue
              : parseFloat(String(existingValue)) || 0
        })
        const dp = decimalPlaces[config.values[0].field] || 0
        columnDataArrays[valueColIndex].push(formatNumber(grandTotal, dp))
        valueColIndex++
      })
    }
  }

  // Create Arrow table - ensure all data has consistent types
  const columnObject: Record<string, any[]> = {}

  // Row columns (string type) - ensure all values are strings
  for (let i = 0; i < config.rows.length; i++) {
    const name = columnNamesArray[i]
    columnObject[name] = columnDataArrays[i].map(v => String(v))
  }

  // Value columns (numeric type) - ensure all values are numbers
  for (let i = config.rows.length; i < columnNamesArray.length; i++) {
    const name = columnNamesArray[i]
    columnObject[name] = columnDataArrays[i].map(v =>
      typeof v === "number" ? v : parseFloat(String(v)) || 0
    )
  }

  const arrowTable = tableFromArrays(columnObject)
  const arrowBytes = tableToIPC(arrowTable)

  // Create a new Quiver from the Arrow bytes
  const arrowProto: ArrowProto = ArrowProto.create({
    data: arrowBytes,
  })

  return new Quiver(arrowProto)
}
