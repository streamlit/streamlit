/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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
  toSafeBoolean,
  toSafeDate,
} from "~lib/components/widgets/DataFrame/columns/utils"
import { Quiver } from "~lib/dataframes/Quiver"
import { isNullOrUndefined, notNullOrUndefined } from "~lib/util/utils"

/** Threshold for sampling large datasets. */
const SAMPLE_THRESHOLD = 100_000

/** Number of samples to take from large datasets. */
const SAMPLE_SIZE = 10_000

/** Number of bins for histograms. */
const HISTOGRAM_BINS = 15

/** Number of top values to show for text columns. */
const TOP_VALUES_COUNT = 5

/**
 * Compute a percentile value from a sorted array using linear interpolation.
 */
function getPercentile(sortedValues: number[], p: number): number {
  const count = sortedValues.length
  if (count === 0) return 0
  const index = (p / 100) * (count - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sortedValues[lower]
  return (
    sortedValues[lower] +
    (sortedValues[upper] - sortedValues[lower]) * (index - lower)
  )
}

/** Histogram bin data. */
export interface HistogramBin {
  binStart: number
  binEnd: number
  count: number
}

/** Numeric column statistics. */
export interface NumericStatistics {
  type: "numeric"
  count: number
  nullCount: number
  unique: number
  sum: number
  mean: number
  q25: number
  median: number
  q75: number
  stdDev: number
  variance: number
  min: number
  max: number
  histogram: HistogramBin[]
  isSampled: boolean
}

/** Top value for text columns. */
interface TopValue {
  value: string
  count: number
  percentage: number
}

/** Text column statistics. */
export interface TextStatistics {
  type: "text"
  count: number
  empty: number
  unique: number
  minLength: number
  maxLength: number
  avgLength: number
  topValues: TopValue[]
  isSampled: boolean
}

/** DateTime column statistics. */
export interface DateTimeStatistics {
  type: "datetime"
  /** Whether the underlying column is date-only (no time component). */
  isDateOnly: boolean
  /** The timezone identifier from the column's Arrow type metadata (e.g., "UTC", "America/New_York"). */
  timezone?: string
  count: number
  nullCount: number
  mean: number
  q25: number
  median: number
  q75: number
  min: number
  max: number
  range: string
  histogram: HistogramBin[]
  isSampled: boolean
}

/** Boolean column statistics. */
export interface BooleanStatistics {
  type: "boolean"
  count: number
  nullCount: number
  trueCount: number
  falseCount: number
  truePercentage: number
  falsePercentage: number
  isSampled: boolean
}

/** Union type for all statistics types. */
export type ColumnStatistics =
  | NumericStatistics
  | TextStatistics
  | DateTimeStatistics
  | BooleanStatistics

/** Column kinds that support numeric statistics. */
const NUMERIC_KINDS = new Set(["number", "progress"])

/**
 * Column kinds that support text statistics.
 * Note: "selectbox" and "link" are excluded because they can render user-facing
 * display labels that differ from the raw cell content (e.g., hrefs, option codes).
 * Until the stats pipeline uses column.getCell() for display values, enabling these
 * would make statistics disagree with what's shown in the table.
 */
const TEXT_KINDS = new Set(["text"])

/** Column kinds that support datetime statistics. */
// Note: "time" excluded - toSafeDate() lacks field metadata to handle time-only values correctly
const DATETIME_KINDS = new Set(["datetime", "date"])

/** Column kinds that support boolean statistics. */
const BOOLEAN_KINDS = new Set(["checkbox"])

/**
 * Check if a column kind supports statistics.
 */
export function supportsStatistics(columnKind: string): boolean {
  return (
    NUMERIC_KINDS.has(columnKind) ||
    TEXT_KINDS.has(columnKind) ||
    DATETIME_KINDS.has(columnKind) ||
    BOOLEAN_KINDS.has(columnKind)
  )
}

/**
 * Get the statistics type for a column kind.
 */
export function getStatisticsType(
  columnKind: string
): "numeric" | "text" | "datetime" | "boolean" | null {
  if (NUMERIC_KINDS.has(columnKind)) return "numeric"
  if (TEXT_KINDS.has(columnKind)) return "text"
  if (DATETIME_KINDS.has(columnKind)) return "datetime"
  if (BOOLEAN_KINDS.has(columnKind)) return "boolean"
  return null
}

/**
 * Extract column values from Quiver data.
 * Applies sampling for large datasets.
 * Returns null if extraction fails (e.g., malformed Arrow buffer).
 *
 * @param data - The Quiver data
 * @param columnIndex - The absolute column index in Quiver (including index columns)
 */
function extractColumnValues(
  data: Quiver,
  columnIndex: number
): { values: unknown[]; isSampled: boolean } | null {
  try {
    const { numDataRows } = data.dimensions
    const shouldSample = numDataRows > SAMPLE_THRESHOLD

    const values: unknown[] = []

    if (shouldSample) {
      // Systematic sampling: take evenly spaced samples.
      // Note: Systematic sampling is fast and deterministic but can be biased on
      // datasets with periodic structure. For UI summary purposes this is acceptable.
      // Reservoir/random sampling would be unbiased but adds complexity.
      // Guard against zero step if constants are changed in the future
      const step = Math.max(1, Math.floor(numDataRows / SAMPLE_SIZE))
      for (
        let i = 0;
        i < numDataRows && values.length < SAMPLE_SIZE;
        i += step
      ) {
        const cell = data.getCell(i, columnIndex)
        values.push(cell.content)
      }
    } else {
      for (let i = 0; i < numDataRows; i++) {
        const cell = data.getCell(i, columnIndex)
        values.push(cell.content)
      }
    }

    return { values, isSampled: shouldSample }
  } catch {
    // If cell extraction fails (malformed Arrow buffer, unexpected type, etc.),
    // return null to signal graceful degradation to the "No data" state.
    return null
  }
}

/**
 * Compute statistics for a numeric column.
 */
export function computeNumericStatistics(
  rawValues: unknown[],
  isSampled: boolean
): NumericStatistics {
  // Filter to valid numbers
  const values: number[] = []
  let nullCount = 0

  for (const v of rawValues) {
    if (isNullOrUndefined(v)) {
      nullCount++
    } else {
      const num = Number(v)
      // Number.isFinite already excludes NaN and ±Infinity
      if (Number.isFinite(num)) {
        values.push(num)
      }
    }
  }

  const count = values.length
  const unique = new Set(values).size

  if (count === 0) {
    return {
      type: "numeric",
      count: 0,
      nullCount,
      unique: 0,
      sum: 0,
      mean: 0,
      q25: 0,
      median: 0,
      q75: 0,
      stdDev: 0,
      variance: 0,
      min: 0,
      max: 0,
      histogram: [],
      isSampled,
    }
  }

  // Sort for median and percentiles
  const sorted = [...values].sort((a, b) => a - b)

  const sum = values.reduce((acc, v) => acc + v, 0)
  const mean = sum / count
  const min = sorted[0]
  const max = sorted[count - 1]

  const q25 = getPercentile(sorted, 25)
  const median = getPercentile(sorted, 50)
  const q75 = getPercentile(sorted, 75)

  // Standard deviation (population, not sample)
  // Uses N as divisor rather than N-1, which differs from pandas' default df.std().
  // Population std dev is appropriate here as we're describing the data shown,
  // not inferring about a larger population.
  const squaredDiffs = values.map(v => (v - mean) ** 2)
  const variance = squaredDiffs.reduce((acc, v) => acc + v, 0) / count
  const stdDev = Math.sqrt(variance)

  // Histogram
  const histogram = computeHistogram(sorted, min, max)

  return {
    type: "numeric",
    count,
    nullCount,
    unique,
    sum,
    mean,
    q25,
    median,
    q75,
    stdDev,
    variance,
    min,
    max,
    histogram,
    isSampled,
  }
}

/**
 * Compute histogram bins for numeric data.
 */
function computeHistogram(
  sortedValues: number[],
  min: number,
  max: number
): HistogramBin[] {
  if (sortedValues.length === 0 || min === max) {
    // Single value or empty - return one bin
    return sortedValues.length > 0
      ? [{ binStart: min, binEnd: max, count: sortedValues.length }]
      : []
  }

  const binWidth = (max - min) / HISTOGRAM_BINS
  const bins: HistogramBin[] = []

  for (let i = 0; i < HISTOGRAM_BINS; i++) {
    const binStart = min + i * binWidth
    const binEnd = i === HISTOGRAM_BINS - 1 ? max : min + (i + 1) * binWidth
    bins.push({ binStart, binEnd, count: 0 })
  }

  // Count values in each bin
  for (const value of sortedValues) {
    const binIndex = Math.min(
      Math.floor((value - min) / binWidth),
      HISTOGRAM_BINS - 1
    )
    bins[binIndex].count++
  }

  return bins
}

/**
 * Compute statistics for a text column.
 */
export function computeTextStatistics(
  rawValues: unknown[],
  isSampled: boolean
): TextStatistics {
  // Count occurrences of each value and track lengths
  const valueCounts = new Map<string, number>()
  const lengths: number[] = []
  let empty = 0

  for (const v of rawValues) {
    if (isNullOrUndefined(v)) {
      empty++
    } else if (typeof v === "string") {
      if (v === "") {
        empty++
      } else {
        valueCounts.set(v, (valueCounts.get(v) || 0) + 1)
        lengths.push(v.length)
      }
    } else if (
      typeof v === "number" ||
      typeof v === "bigint" ||
      typeof v === "boolean"
    ) {
      const str = v.toString()
      valueCounts.set(str, (valueCounts.get(str) || 0) + 1)
      lengths.push(str.length)
    }
    // Skip objects and other non-primitive types
  }

  // Count is the sum of all value counts (not rawValues.length - empty)
  // This correctly excludes non-primitive values that were skipped
  const count = [...valueCounts.values()].reduce((acc, c) => acc + c, 0)
  const unique = valueCounts.size

  // Sort by count to get top values
  const sortedEntries = [...valueCounts.entries()].sort((a, b) => b[1] - a[1])

  const topValues: TopValue[] = sortedEntries
    .slice(0, TOP_VALUES_COUNT)
    .map(([value, valueCount]) => ({
      value,
      count: valueCount,
      percentage: count > 0 ? (valueCount / count) * 100 : 0,
    }))

  // Length statistics - use reduce instead of spread to avoid stack overflow on large arrays
  let minLength = Infinity
  let maxLength = 0
  let totalLength = 0
  for (const len of lengths) {
    if (len < minLength) minLength = len
    if (len > maxLength) maxLength = len
    totalLength += len
  }
  if (lengths.length === 0) {
    minLength = 0
  }
  const avgLength = lengths.length > 0 ? totalLength / lengths.length : 0

  return {
    type: "text",
    count,
    empty,
    unique,
    minLength,
    maxLength,
    avgLength,
    topValues,
    isSampled,
  }
}

/**
 * Compute statistics for a datetime column.
 *
 * Note: This uses toSafeDate() which applies a heuristic to detect the time unit
 * (seconds vs. milliseconds vs. microseconds vs. nanoseconds) based on magnitude
 * thresholds. Streamlit normalizes datetime columns to nanoseconds in the Quiver
 * layer, so this works correctly for standard Streamlit data. However, data from
 * other Arrow sources with different time units (e.g., raw millisecond timestamps
 * before Sep 2001 / 10^12 ms) could be misinterpreted.
 *
 * @param isDateOnly - True if the column is date-only (no time component)
 * @param timezone - Optional timezone identifier from the column's Arrow type metadata
 */
export function computeDateTimeStatistics(
  rawValues: unknown[],
  isSampled: boolean,
  isDateOnly = false,
  timezone?: string
): DateTimeStatistics {
  // Convert values to timestamps using toSafeDate which handles various units.
  // toSafeDate uses magnitude thresholds to detect the unit: >= 10^18 = ns,
  // >= 10^15 = µs, >= 10^12 = ms, otherwise seconds.
  const timestamps: number[] = []
  let nullCount = 0

  for (const v of rawValues) {
    if (isNullOrUndefined(v)) {
      nullCount++
    } else {
      // toSafeDate handles Date objects, bigints, numbers, and strings
      const date = toSafeDate(v)
      if (notNullOrUndefined(date)) {
        const timestamp = date.getTime()
        if (Number.isFinite(timestamp)) {
          timestamps.push(timestamp)
        }
      }
    }
  }

  const count = timestamps.length

  if (count === 0) {
    return {
      type: "datetime",
      isDateOnly,
      timezone,
      count: 0,
      nullCount,
      mean: 0,
      q25: 0,
      median: 0,
      q75: 0,
      min: 0,
      max: 0,
      range: "",
      histogram: [],
      isSampled,
    }
  }

  const sorted = [...timestamps].sort((a, b) => a - b)
  const sum = timestamps.reduce((acc, v) => acc + v, 0)
  const mean = sum / count
  const min = sorted[0]
  const max = sorted[count - 1]

  const q25 = getPercentile(sorted, 25)
  const median = getPercentile(sorted, 50)
  const q75 = getPercentile(sorted, 75)

  // Compute human-readable range
  const range = computeDateRange(min, max)

  // Histogram for datetime
  const histogram = computeHistogram(sorted, min, max)

  return {
    type: "datetime",
    isDateOnly,
    timezone,
    count,
    nullCount,
    mean,
    q25,
    median,
    q75,
    min,
    max,
    range,
    histogram,
    isSampled,
  }
}

/** Format a time unit with singular/plural handling. */
function formatTimeUnit(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10
  return rounded === 1 ? `1 ${unit}` : `${rounded} ${unit}s`
}

/**
 * Compute a human-readable date range string.
 */
function computeDateRange(minTimestamp: number, maxTimestamp: number): string {
  const diffMs = maxTimestamp - minTimestamp
  const diffSeconds = diffMs / 1000
  const diffMinutes = diffSeconds / 60
  const diffHours = diffMinutes / 60
  const diffDays = diffHours / 24
  const diffWeeks = diffDays / 7
  const diffMonths = diffDays / 30.44 // Average days per month
  const diffYears = diffDays / 365.25

  if (diffYears >= 1) return formatTimeUnit(Math.round(diffYears), "year")
  if (diffMonths >= 1) return formatTimeUnit(Math.round(diffMonths), "month")
  if (diffWeeks >= 1) return formatTimeUnit(Math.round(diffWeeks), "week")
  if (diffDays >= 1) return formatTimeUnit(Math.round(diffDays), "day")
  if (diffHours >= 1) return formatTimeUnit(Math.round(diffHours), "hour")
  if (diffMinutes >= 1)
    return formatTimeUnit(Math.round(diffMinutes), "minute")
  return formatTimeUnit(Math.round(diffSeconds), "second")
}

/**
 * Compute statistics for a boolean column.
 * Uses toSafeBoolean() to match the broader vocabulary recognized by checkbox columns
 * (true/t/yes/y/on/1 and false/f/no/n/off/0, case-insensitively).
 */
export function computeBooleanStatistics(
  rawValues: unknown[],
  isSampled: boolean
): BooleanStatistics {
  let trueCount = 0
  let falseCount = 0
  let nullCount = 0

  for (const v of rawValues) {
    const boolValue = toSafeBoolean(v)
    if (boolValue === true) {
      trueCount++
    } else if (boolValue === false) {
      falseCount++
    } else {
      // null (empty), undefined (cannot be interpreted as boolean)
      nullCount++
    }
  }

  const count = trueCount + falseCount
  const truePercentage = count > 0 ? (trueCount / count) * 100 : 0
  const falsePercentage = count > 0 ? (falseCount / count) * 100 : 0

  return {
    type: "boolean",
    count,
    nullCount,
    trueCount,
    falseCount,
    truePercentage,
    falsePercentage,
    isSampled,
  }
}

/**
 * Compute statistics for a column based on its kind.
 *
 * @param columnKind - The column kind (e.g., "numeric", "datetime", "text", "checkbox")
 * @param data - The Quiver data
 * @param columnIndex - The absolute column index in Quiver
 * @param timezone - Optional timezone identifier for datetime columns (from column.arrowType)
 */
export function computeStatistics(
  columnKind: string,
  data: Quiver,
  columnIndex: number,
  timezone?: string
): ColumnStatistics | null {
  const statsType = getStatisticsType(columnKind)
  if (!statsType) return null

  const result = extractColumnValues(data, columnIndex)
  // If extraction failed (malformed data), return null to show "No data" state
  if (!result) return null

  const { values, isSampled } = result

  switch (statsType) {
    case "numeric":
      return computeNumericStatistics(values, isSampled)
    case "text":
      return computeTextStatistics(values, isSampled)
    case "datetime":
      // Pass isDateOnly flag based on column kind and timezone from Arrow type
      return computeDateTimeStatistics(
        values,
        isSampled,
        columnKind === "date",
        timezone
      )
    case "boolean":
      return computeBooleanStatistics(values, isSampled)
  }
}
