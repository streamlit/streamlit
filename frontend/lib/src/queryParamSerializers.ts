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

// --- Utility: Get last value from array or string ---

export function getLastValue(value: string | string[] | null): string | null {
  if (value === null) return null
  return Array.isArray(value) ? (value[value.length - 1] ?? null) : value
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
