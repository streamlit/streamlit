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

import { EmotionTheme } from "~lib/theme"

/**
 * Built-in color names that map to Streamlit theme colors.
 * These are passed from the backend as strings and resolved here
 * to actual theme color values.
 *
 * TODO: Consolidate with similar getColorMapping functions in
 * ProgressColumn.ts, ChartColumn.ts, and MultiselectColumn.ts
 * into a shared theme utility.
 */
const BUILTIN_COLOR_NAMES = new Set([
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "violet",
  "gray",
  "grey", // alias for gray
  "primary",
])

/**
 * Maps built-in color names to their corresponding theme color keys.
 */
const COLOR_NAME_TO_THEME_KEY: Record<string, keyof EmotionTheme["colors"]> = {
  red: "redColor",
  orange: "orangeColor",
  yellow: "yellowColor",
  green: "greenColor",
  blue: "blueColor",
  violet: "violetColor",
  gray: "grayColor",
  grey: "grayColor", // alias
  primary: "primary",
}

/**
 * Check if a value is a built-in color name.
 */
export function isBuiltinColorName(value: unknown): value is string {
  return (
    typeof value === "string" && BUILTIN_COLOR_NAMES.has(value.toLowerCase())
  )
}

/**
 * Resolve a built-in color name to its theme color value.
 * If the color is not a built-in name, returns it unchanged.
 */
export function resolveBuiltinColor(
  color: string,
  theme: EmotionTheme
): string {
  const lowerColor = color.toLowerCase()
  const themeKey = COLOR_NAME_TO_THEME_KEY[lowerColor]
  if (themeKey) {
    return theme.colors[themeKey] as string
  }
  return color
}

/**
 * Resolve built-in color names in a Vega-Lite spec to their theme color values.
 * This mutates the spec in place.
 *
 * Handles all Vega-Lite composition types via recursive traversal:
 * - Unit specs with top-level encoding
 * - Layer specs (including nested layers)
 * - Concatenation specs (vconcat, hconcat, concat)
 * - Facet specs (both operator form and encoding channels)
 * - Repeat specs (row/column/layer forms, both object and array)
 *
 * Colors are resolved in `encoding.color` only (both value and scale.range).
 * Mark-level colors (mark.color, mark.fill, mark.stroke) are NOT resolved
 * as these are static styling properties, not data-driven encodings.
 *
 * @see https://vega.github.io/vega-lite/docs/composition.html
 * @param spec The Vega-Lite specification object
 * @param theme The Streamlit EmotionTheme containing color values
 */
export function resolveBuiltinColorsInSpec(
  spec: Record<string, unknown>,
  theme: EmotionTheme
): void {
  // Handle top-level encoding first (unit specs like bar_chart, area_chart)
  resolveEncodingColors(spec, theme)

  // Handle layer specs - recursively process each layer
  // Layers can contain unit specs or nested layers (but not concat/facet/repeat)
  // See: https://vega.github.io/vega-lite/docs/layer.html
  if (Array.isArray(spec.layer)) {
    for (const layerSpec of spec.layer) {
      if (layerSpec && typeof layerSpec === "object") {
        resolveBuiltinColorsInSpec(layerSpec as Record<string, unknown>, theme)
      }
    }
  }

  // Handle concatenation specs (vconcat, hconcat, concat)
  for (const key of ["vconcat", "hconcat", "concat"]) {
    if (Array.isArray(spec[key])) {
      for (const subSpec of spec[key] as unknown[]) {
        if (subSpec && typeof subSpec === "object") {
          resolveBuiltinColorsInSpec(subSpec as Record<string, unknown>, theme)
        }
      }
    }
  }

  // Handle facet and repeat specs - both use nested "spec" property
  if (
    ("facet" in spec || "repeat" in spec) &&
    spec.spec &&
    typeof spec.spec === "object"
  ) {
    resolveBuiltinColorsInSpec(spec.spec as Record<string, unknown>, theme)
  }
}

/**
 * Resolve color values within an encoding object.
 * Handles both ColorValue (single color) and Color with scale (array).
 */
function resolveEncodingColors(
  spec: Record<string, unknown>,
  theme: EmotionTheme
): void {
  const encoding = spec.encoding as Record<string, unknown> | undefined
  if (!encoding) return

  const colorEncoding = encoding.color as Record<string, unknown> | undefined
  if (!colorEncoding) return

  // Case 1: ColorValue - { value: "red" }
  // Used when: st.line_chart(df, color="red")
  if ("value" in colorEncoding && isBuiltinColorName(colorEncoding.value)) {
    colorEncoding.value = resolveBuiltinColor(colorEncoding.value, theme)
  }

  // Case 2: Color with scale - { scale: { range: ["red", "blue"] } }
  // Used when: st.line_chart(df, y=["a", "b"], color=["red", "blue"])
  const scale = colorEncoding.scale as Record<string, unknown> | undefined
  if (scale && Array.isArray(scale.range)) {
    scale.range = (scale.range as unknown[]).map(color =>
      isBuiltinColorName(color) ? resolveBuiltinColor(color, theme) : color
    )
  }
}
