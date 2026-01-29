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

/**
 * Named Colors - Single Source of Truth
 *
 * This file defines all named colors (e.g., "red", "blue", "primary") and
 * their mappings to theme color properties. Named colors can be used across
 * charts, DataFrame columns, and other Streamlit components.
 *
 * To add a new color: add it to NAMED_COLOR_CONFIG below.
 * The type and set are automatically derived from the config.
 *
 * NOTE: "purple" and "violet" are handled differently:
 * - For main colors, "purple" is not supported (passes through unchanged).
 * - For background colors, "purple" is computed as purplebg (DISTINCT from violet)
 *   in order to support the rainbow gradient.
 */

/**
 * Configuration for mapping named colors to theme color keys.
 * Each entry maps a user-facing color name to the corresponding theme property.
 *
 * colorKey: The theme.colors property for the main color (e.g., "redColor")
 * bgColorKey: The theme.colors property for background color, or null if computed
 */
export const NAMED_COLOR_CONFIG = {
  red: { colorKey: "redColor", bgColorKey: "redBackgroundColor" },
  orange: { colorKey: "orangeColor", bgColorKey: "orangeBackgroundColor" },
  yellow: { colorKey: "yellowColor", bgColorKey: "yellowBackgroundColor" },
  green: { colorKey: "greenColor", bgColorKey: "greenBackgroundColor" },
  blue: { colorKey: "blueColor", bgColorKey: "blueBackgroundColor" },
  violet: { colorKey: "violetColor", bgColorKey: "violetBackgroundColor" },
  gray: { colorKey: "grayColor", bgColorKey: "grayBackgroundColor" },
  grey: { colorKey: "grayColor", bgColorKey: "grayBackgroundColor" }, // alias
  primary: { colorKey: "primary", bgColorKey: null }, // primary bg is computed
} as const

/**
 * Additional background colors that don't have a corresponding main color.
 * These are only available via resolveNamedBackgroundColor().
 */
export const BACKGROUND_ONLY_COLORS = {
  purple: { bgColorKey: "purplebg" }, // distinct from violet
} as const

/**
 * Named colors that map to Streamlit theme colors.
 * Derived from NAMED_COLOR_CONFIG - this is the single source of truth.
 */
export type NamedColor = keyof typeof NAMED_COLOR_CONFIG

/**
 * Set of named colors for quick runtime lookup.
 * Derived from NAMED_COLOR_CONFIG to ensure consistency.
 */
export const NAMED_COLORS: ReadonlySet<string> = new Set(
  Object.keys(NAMED_COLOR_CONFIG)
)

/**
 * Type guard to check if a value is a named color.
 */
export function isNamedColor(value: unknown): value is NamedColor {
  return typeof value === "string" && NAMED_COLORS.has(value.toLowerCase())
}
