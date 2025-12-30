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

/**
 * Serializers for converting widget values to/from URL query parameter strings.
 *
 * These serializers are used when widgets are bound to query parameters.
 * The format parameter on widgets is for display only and does NOT affect serialization.
 * We always use canonical formats that are unambiguous and parseable.
 */

// Type for a function that serializes a widget value to a query param string
export type QueryParamSerializer<T> = (value: T) => string | string[]

// Type for a function that deserializes a query param string to a widget value
export type QueryParamDeserializer<T> = (
  value: string | string[] | null
) => T | undefined

// --- Boolean Serializers (for Checkbox, Toggle) ---

export function serializeBool(value: boolean): string {
  return value ? "true" : "false"
}

export function deserializeBool(value: string | string[] | null): boolean {
  if (value === null) return false
  const str = Array.isArray(value) ? (value[value.length - 1] ?? "") : value
  return ["true", "1", "yes", "on"].includes(str.toLowerCase())
}

// --- String Serializers (for TextInput, TextArea) ---

export function serializeString(value: string | null): string {
  return value ?? ""
}

export function deserializeString(
  value: string | string[] | null
): string | undefined {
  if (value === null) return undefined
  return Array.isArray(value) ? (value[value.length - 1] ?? "") : value
}

// --- Number Serializers (for NumberInput) ---

export function serializeNumber(value: number | null): string {
  if (value === null) return ""

  // For integers, use string directly
  if (Number.isInteger(value)) {
    return String(value)
  }

  // For floats, use toString which gives full precision
  // Then clean up trailing zeros but keep at least one decimal place
  const str = String(value)
  if (str.includes(".") && !str.includes("e")) {
    const parts = str.split(".")
    const decimalPart = parts[1].replace(/0+$/, "") || "0"
    return `${parts[0]}.${decimalPart}`
  }
  return str
}

export function deserializeNumber(
  value: string | string[] | null,
  asInt = false
): number | undefined {
  if (value === null) return undefined

  const str = Array.isArray(value) ? (value[value.length - 1] ?? "") : value
  if (!str) return undefined

  const parsed = asInt ? parseInt(str, 10) : parseFloat(str)
  return Number.isNaN(parsed) ? undefined : parsed
}

// --- Color Serializers (for ColorPicker) ---

export function serializeColor(value: string | null): string {
  if (!value) return ""
  // Remove # prefix for cleaner URLs
  return value.replace(/^#/, "").toLowerCase()
}

export function deserializeColor(
  value: string | string[] | null
): string | undefined {
  if (value === null) return undefined

  const str = Array.isArray(value) ? (value[value.length - 1] ?? "") : value
  if (!str) return undefined

  // Add # prefix if not present
  return str.startsWith("#") ? str.toLowerCase() : `#${str.toLowerCase()}`
}

// --- Date Serializers (for DateInput) ---

/**
 * Serialize a Date to ISO format (YYYY-MM-DD).
 */
export function serializeDate(value: Date | null): string {
  if (!value || !(value instanceof Date) || Number.isNaN(value.getTime())) {
    return ""
  }
  // Use local date components to avoid timezone issues
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Deserialize an ISO date string (YYYY-MM-DD) to a Date.
 */
export function deserializeDate(
  value: string | string[] | null
): Date | undefined {
  if (value === null) return undefined

  const str = Array.isArray(value) ? (value[value.length - 1] ?? "") : value
  if (!str) return undefined

  // Parse ISO format YYYY-MM-DD
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str)
  if (!match) return undefined

  const [, yearStr, monthStr, dayStr] = match
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1 // JS months are 0-indexed
  const day = parseInt(dayStr, 10)

  const date = new Date(year, month, day)
  // Validate the date is valid (e.g., not Feb 30)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return undefined
  }

  return date
}

/**
 * Serialize a date range to comma-separated ISO format.
 */
export function serializeDateRange(
  value: [Date, Date] | [Date] | Date[] | null
): string {
  if (!value || value.length === 0) return ""

  if (value.length === 1) {
    return serializeDate(value[0])
  }

  // value.length >= 2 at this point
  const start = serializeDate(value[0])
  const end = value[1] ? serializeDate(value[1]) : ""
  if (!start || !end) return ""

  return `${start},${end}`
}

/**
 * Deserialize comma-separated ISO dates to a date range.
 * Returns a tuple of [start, end] dates, or a single [date] for single values.
 */
export function deserializeDateRange(
  value: string | string[] | null
): [Date, Date] | [Date] | undefined {
  if (value === null) return undefined

  const str = Array.isArray(value) ? (value[value.length - 1] ?? "") : value
  if (!str) return undefined

  const parts = str.split(",")
  if (parts.length === 1) {
    const date = deserializeDate(parts[0])
    return date ? [date] : undefined
  }

  if (parts.length === 2) {
    const start = deserializeDate(parts[0])
    const end = deserializeDate(parts[1])
    if (start && end) {
      return [start, end]
    }
  }

  return undefined
}

// --- Time Serializers (for TimeInput) ---

/**
 * Serialize a time (as Date or {hour, minute, second}) to ISO format (HH:MM:SS or HH:MM).
 */
export function serializeTime(
  value: Date | { hour: number; minute: number; second?: number } | null
): string {
  if (!value) return ""

  let hour: number
  let minute: number
  let second: number

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ""
    hour = value.getHours()
    minute = value.getMinutes()
    second = value.getSeconds()
  } else {
    hour = value.hour
    minute = value.minute
    second = value.second ?? 0
  }

  const hh = String(hour).padStart(2, "0")
  const mm = String(minute).padStart(2, "0")

  // Only include seconds if non-zero
  if (second > 0) {
    const ss = String(second).padStart(2, "0")
    return `${hh}:${mm}:${ss}`
  }

  return `${hh}:${mm}`
}

/**
 * Deserialize an ISO time string (HH:MM or HH:MM:SS) to a time object.
 * Returns {hour, minute, second} for use with time widgets.
 */
export function deserializeTime(
  value: string | string[] | null
): { hour: number; minute: number; second: number } | undefined {
  if (value === null) return undefined

  const str = Array.isArray(value) ? (value[value.length - 1] ?? "") : value
  if (!str) return undefined

  // Parse HH:MM or HH:MM:SS format
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(str)
  if (!match) return undefined

  const hour = parseInt(match[1], 10)
  const minute = parseInt(match[2], 10)
  const second = match[3] ? parseInt(match[3], 10) : 0

  // Validate ranges
  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return undefined
  }

  return { hour, minute, second }
}

// --- Number Range Serializers (for Slider range mode) ---

/**
 * Serialize a number range to comma-separated format.
 */
export function serializeNumberRange(
  value: [number, number] | number | null
): string {
  if (value === null) return ""

  if (typeof value === "number") {
    return serializeNumber(value)
  }

  if (Array.isArray(value) && value.length === 2) {
    return `${serializeNumber(value[0])},${serializeNumber(value[1])}`
  }

  return ""
}

/**
 * Deserialize comma-separated numbers to a number range or single value.
 */
export function deserializeNumberRange(
  value: string | string[] | null,
  asInt = false
): [number, number] | number | undefined {
  if (value === null) return undefined

  const str = Array.isArray(value) ? (value[value.length - 1] ?? "") : value
  if (!str) return undefined

  const parts = str.split(",")

  if (parts.length === 1) {
    // Single value
    return deserializeNumber(parts[0], asInt)
  }

  if (parts.length === 2) {
    // Range value
    const min = deserializeNumber(parts[0], asInt)
    const max = deserializeNumber(parts[1], asInt)
    if (min !== undefined && max !== undefined) {
      return [min, max]
    }
  }

  return undefined
}

// --- Utility: Get last value from array or string ---

export function getLastValue(value: string | string[] | null): string | null {
  if (value === null) return null
  return Array.isArray(value) ? (value[value.length - 1] ?? null) : value
}

// --- Date String Serializers (for DateInput which uses YYYY/MM/DD strings) ---

/**
 * Serialize date strings from DateInput format (YYYY/MM/DD) to ISO format (YYYY-MM-DD).
 * DateInput stores dates as strings internally, so we just convert the separator.
 */
export function serializeDateString(value: string | null): string {
  if (!value) return ""
  // Convert YYYY/MM/DD to YYYY-MM-DD
  return value.replace(/\//g, "-")
}

/**
 * Serialize an array of date strings to comma-separated ISO format.
 * Handles both single dates and date ranges from DateInput.
 */
export function serializeDateStringArray(value: string[] | null): string {
  if (!value || value.length === 0) return ""

  // Convert each date from YYYY/MM/DD to YYYY-MM-DD
  const isoDates = value.map(d => d.replace(/\//g, "-"))
  return isoDates.join(",")
}

/**
 * Deserialize ISO date strings (YYYY-MM-DD) back to DateInput format (YYYY/MM/DD).
 */
export function deserializeDateString(
  value: string | string[] | null
): string | undefined {
  if (value === null) return undefined

  const str = Array.isArray(value) ? (value[value.length - 1] ?? "") : value
  if (!str) return undefined

  // Convert YYYY-MM-DD to YYYY/MM/DD
  return str.replace(/-/g, "/")
}

/**
 * Deserialize comma-separated ISO dates to DateInput string array format.
 */
export function deserializeDateStringArray(
  value: string | string[] | null
): string[] | undefined {
  if (value === null) return undefined

  const str = Array.isArray(value) ? (value[value.length - 1] ?? "") : value
  if (!str) return undefined

  // Split by comma and convert each YYYY-MM-DD to YYYY/MM/DD
  const parts = str.split(",")
  return parts.map(d => d.replace(/-/g, "/"))
}

// --- Selection Widget Serializers (Radio, Selectbox, Multiselect, SelectSlider) ---

/**
 * Serialize a Radio/Selectbox selection by converting the selected index to its option value.
 * @param index - The selected index (0-based)
 * @param options - The options array from the widget proto
 * @returns The string representation of the selected option, or "" if invalid
 */
export function serializeSelectionIndex(
  index: number | null | undefined,
  options: readonly string[]
): string {
  if (
    index === null ||
    index === undefined ||
    index < 0 ||
    index >= options.length
  ) {
    return ""
  }
  return options[index]
}

/**
 * Deserialize a query param value to a Radio/Selectbox selection index.
 * @param value - The query param value
 * @param options - The options array from the widget proto
 * @returns The index of the matching option, or undefined if not found
 */
export function deserializeSelectionIndex(
  value: string | string[] | null,
  options: readonly string[]
): number | undefined {
  if (value === null) return undefined

  const str = Array.isArray(value) ? (value[value.length - 1] ?? "") : value
  if (!str) return undefined

  const index = options.indexOf(str)
  return index >= 0 ? index : undefined
}

/**
 * Serialize a Multiselect selection (array of option values).
 * @param values - Array of selected values (strings)
 * @returns Array of selected option strings
 */
export function serializeMultiselect(values: string[] | null): string[] {
  if (!values || values.length === 0) return []
  return values
}

/**
 * Deserialize query param values to Multiselect selections.
 * @param value - Single string or array of strings from query params
 * @param options - The options array from the widget proto
 * @returns Array of matching option values
 */
export function deserializeMultiselect(
  value: string | string[] | null,
  options: readonly string[]
): string[] | undefined {
  if (value === null) return undefined

  // Handle both single value and array
  const values = Array.isArray(value) ? value : [value]
  if (values.length === 0 || (values.length === 1 && !values[0])) {
    return undefined
  }

  // Only include values that are valid options
  const result = values.filter(v => options.includes(v))
  return result.length > 0 ? result : undefined
}

/**
 * Serialize a SelectSlider selection (single value or range).
 * @param indices - The selected index/indices as numbers
 * @param options - The options array from the widget proto
 * @returns Comma-separated string of option values for ranges, or single value
 */
export function serializeSelectSlider(
  indices: number[] | null,
  options: readonly string[]
): string {
  if (!indices || indices.length === 0) return ""

  const values = indices.map(idx => {
    if (idx < 0 || idx >= options.length) return ""
    return options[idx]
  })

  // Filter out invalid values
  const validValues = values.filter(v => v !== "")
  if (validValues.length === 0) return ""

  if (validValues.length === 1) {
    return validValues[0]
  }

  // Range: comma-separated
  return validValues.join(",")
}

/**
 * Deserialize query param value to SelectSlider indices.
 * @param value - Single string (possibly comma-separated for range) from query params
 * @param options - The options array from the widget proto
 * @returns Array of indices, or undefined if not found
 */
export function deserializeSelectSlider(
  value: string | string[] | null,
  options: readonly string[]
): number[] | undefined {
  if (value === null) return undefined

  const str = Array.isArray(value) ? (value[value.length - 1] ?? "") : value
  if (!str) return undefined

  // Check for comma-separated range
  if (str.includes(",")) {
    const parts = str.split(",")
    const indices = parts.map(p => options.indexOf(p.trim()))
    // All parts must be valid
    if (indices.some(idx => idx < 0)) return undefined
    return indices
  }

  // Single value
  const index = options.indexOf(str)
  return index >= 0 ? [index] : undefined
}

// --- Query Param Key Detection ---

/** Prefix for user keys that should be bound to URL query parameters. */
export const QUERY_PARAM_KEY_PREFIX = "?"

/**
 * Returns true if the user key indicates query param binding.
 * A user key starting with "?" indicates that the widget should be
 * bound to a URL query parameter of the same name (without the prefix).
 */
export function isQueryParamKey(userKey: string | undefined | null): boolean {
  if (!userKey) return false
  return userKey.startsWith(QUERY_PARAM_KEY_PREFIX)
}

/**
 * Extracts the query param name from a user key with the "?" prefix.
 * Assumes the key starts with "?" - use isQueryParamKey() to check first.
 *
 * @param userKey - The user key with "?" prefix (e.g., "?enabled")
 * @returns The query param name (e.g., "enabled")
 */
export function extractQueryParamName(userKey: string): string {
  return userKey.slice(QUERY_PARAM_KEY_PREFIX.length)
}
