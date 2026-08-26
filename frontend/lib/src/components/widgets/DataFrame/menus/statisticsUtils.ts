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

import { getLogger } from "loglevel"

import {
  toSafeBoolean,
  toSafeDate,
  toSafeNumber,
} from "~lib/components/widgets/DataFrame/columns/utils"
import { Quiver } from "~lib/dataframes/Quiver"
import { isNullOrUndefined, notNullOrUndefined } from "~lib/util/utils"

const LOG = getLogger("DataFrameStatistics")

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

/**
 * Pick a compact histogram bin count based on the available value count.
 * This avoids sparse tick-like charts for small columns while preserving detail
 * for larger columns.
 */
function getHistogramBinCount(valueCount: number): number {
  if (valueCount <= 1) return 1

  return Math.min(HISTOGRAM_BINS, Math.ceil(Math.sqrt(valueCount)))
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
 * Check if a column kind supports statistics.
 */
export function supportsStatistics(columnKind: string): boolean {
  return getStatisticsType(columnKind) !== null
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
  } catch (error) {
    // If cell extraction fails (malformed Arrow buffer, unexpected type, etc.),
    // log the error and return null to signal graceful degradation to the "No data" state.
    LOG.warn("Failed to extract column values for statistics", error)
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
    // Use toSafeNumber so cell values are interpreted the same way NumberColumn
    // displays them: empty/whitespace strings become null (not 0), and formatted
    // numeric strings are parsed. Plain Number() would coerce "" and "  " to 0.
    const num = toSafeNumber(v)
    if (isNullOrUndefined(num)) {
      // null/undefined inputs and blank strings count as empty values.
      nullCount++
    } else if (Number.isFinite(num)) {
      // Number.isFinite already excludes NaN and ±Infinity (unparseable values).
      values.push(num)
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

  const binCount = getHistogramBinCount(sortedValues.length)
  const binWidth = (max - min) / binCount
  const bins: HistogramBin[] = []

  for (let i = 0; i < binCount; i++) {
    const binStart = min + i * binWidth
    const binEnd = i === binCount - 1 ? max : min + (i + 1) * binWidth
    bins.push({ binStart, binEnd, count: 0 })
  }

  // Count values in each bin
  for (const value of sortedValues) {
    const binIndex = Math.min(
      Math.floor((value - min) / binWidth),
      binCount - 1
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
  // Running total of counted (non-empty, primitive) values. Maintained here to
  // avoid allocating an intermediate array from valueCounts afterwards. This
  // correctly excludes non-primitive values that were skipped.
  let count = 0

  for (const v of rawValues) {
    if (isNullOrUndefined(v)) {
      empty++
    } else if (typeof v === "string") {
      if (v === "") {
        empty++
      } else {
        valueCounts.set(v, (valueCounts.get(v) || 0) + 1)
        lengths.push(v.length)
        count++
      }
    } else if (
      typeof v === "number" ||
      typeof v === "bigint" ||
      typeof v === "boolean"
    ) {
      const str = v.toString()
      valueCounts.set(str, (valueCounts.get(str) || 0) + 1)
      lengths.push(str.length)
      count++
    }
    // Skip objects and other non-primitive types
  }

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
    // toSafeDate handles Date objects, bigints, numbers, and strings. It returns
    // null/undefined for empty or unparseable values.
    const date = isNullOrUndefined(v) ? null : toSafeDate(v)
    const timestamp = notNullOrUndefined(date) ? date.getTime() : NaN
    if (Number.isFinite(timestamp)) {
      timestamps.push(timestamp)
    } else {
      // null/undefined inputs, empty strings, and unparseable values all count as
      // empty so that count + nullCount reflects the total number of rows.
      nullCount++
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
  // Compute the mean incrementally to avoid summing into values above
  // Number.MAX_SAFE_INTEGER. Millisecond timestamps (~1.7e12) summed over the
  // sample cap (10k) reach ~1.7e16, which would lose integer precision.
  let mean = 0
  timestamps.forEach((v, i) => {
    mean += (v - mean) / (i + 1)
  })
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

/**
 * Format a number for display in statistics.
 * Uses toLocaleString consistently for all numbers to respect locale decimal separators.
 */
export function formatNumber(value: number, precision = 2): string {
  if (!Number.isFinite(value)) return "-"

  return value.toLocaleString(undefined, {
    maximumFractionDigits: precision,
    minimumFractionDigits: 0,
  })
}

/**
 * Format a datetime timestamp for display in statistics.
 * Uses the column's timezone if available, otherwise defaults to UTC
 * to avoid local timezone shifts that can change dates.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @param isDateOnly - If true, format as date only without time
 * @param timezone - Optional timezone identifier (e.g., "America/New_York", "UTC")
 */
export function formatDatetime(
  timestamp: number,
  isDateOnly = false,
  timezone?: string
): string {
  const date = new Date(timestamp)
  // Use provided timezone, or default to UTC for consistency
  const tz = timezone || "UTC"
  if (isDateOnly) {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: tz,
    })
  }
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  })
}

/**
 * Format a percentage for display.
 */
function formatPercent(value: number): string {
  return `${formatNumber(value, 1)}%`
}

/**
 * Compute empty percentage from count and empty/null count.
 */
export function computeEmptyPercentage(
  count: number,
  emptyCount: number
): number {
  const total = count + emptyCount
  return total > 0 ? (emptyCount / total) * 100 : 0
}

/**
 * Format a count with optional percentage.
 */
export function formatCountWithPercent(
  count: number,
  percentage: number
): string {
  return `${formatNumber(count, 0)} (${formatPercent(percentage)})`
}

/**
 * Get the null/empty count from statistics.
 */
export function getNullOrEmptyCount(statistics: ColumnStatistics): number {
  switch (statistics.type) {
    case "numeric":
    case "datetime":
    case "boolean":
      return statistics.nullCount
    case "text":
      return statistics.empty
  }
}

/**
 * Formats a number for display in chart tooltips. Integers are shown without
 * decimals; non-integers keep up to two fraction digits.
 */
export function formatTooltipNumber(value: number): string {
  if (Number.isInteger(value)) {
    return value.toLocaleString()
  }
  // For decimals, show up to 2 significant decimal places
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

/**
 * Formats a compact count for visible chart labels.
 */
export function formatChartCount(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

/**
 * Formats a compact percentage for visible chart labels.
 */
export function formatChartPercent(value: number): string {
  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })}%`
}

/**
 * Formats a timestamp as a date/datetime string for chart tooltips.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @param includeTime - If true, include time in the formatted string
 * @param timezone - Optional timezone identifier (e.g., "America/New_York", "UTC").
 *                   Defaults to UTC for consistency with formatDatetime.
 */
export function formatTooltipDate(
  timestamp: number,
  includeTime = false,
  timezone?: string
): string {
  const date = new Date(timestamp)
  const tz = timezone || "UTC"
  if (includeTime) {
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    })
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: tz,
  })
}

/** A single bar entry for the categorical statistics bar chart. */
export interface LabeledBarDatum {
  label: string
  /**
   * Share of the column's total values (0–100). Drives the bar width so the
   * bar length directly represents the proportion the value takes on, with the
   * track behind it standing for 100%.
   */
  percent: number
  valueLabel: string
  title: string
}

/**
 * Builds a labeled bar datum for categorical statistics. The visible value
 * label shows the percentage, while the row title (hover) carries both the raw
 * count and the percentage.
 */
export function createLabeledBarDatum(
  label: string,
  count: number,
  percentage: number
): LabeledBarDatum {
  const countLabel = formatChartCount(count)
  const percentLabel = formatChartPercent(percentage)
  return {
    label,
    percent: percentage,
    valueLabel: percentLabel,
    title: `${label}: ${countLabel} (${percentLabel})`,
  }
}
