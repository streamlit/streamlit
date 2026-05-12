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
 * Color utility functions using chroma-js.
 *
 * These functions replace color2k and provide proper handling of colors with
 * alpha transparency. The key difference is that setAlpha() sets an absolute
 * alpha value rather than subtracting from it (which was the bug in color2k's
 * transparentize function).
 */

import chroma from "chroma-js"

/**
 * Convert a chroma color to a CSS string in legacy format.
 * Uses hex for opaque colors and rgba() for transparent colors.
 */
function toCSS(c: chroma.Color): string {
  // Use >= 1 to handle floating point precision issues from Lab-space transforms
  if (c.alpha() >= 1) {
    return c.hex("rgb")
  }
  // Round RGB values to integers since chroma can return floats after
  // Lab-space transformations (darken, brighten, mix in non-RGB mode)
  const [r, g, b] = c.rgb()
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${c.alpha()})`
}

/**
 * Try to parse a color with chroma-js, returning null if parsing fails.
 *
 * Chroma-js v3 natively supports most CSS color formats including:
 * oklch(), oklab(), lab(), lch(), and modern space-separated rgb()/hsl().
 * Only hwb() and exotic color(<colorspace> ...) syntaxes fall through to
 * the catch block. This function returns null instead of throwing for
 * unsupported formats.
 */
function tryParse(color: string): chroma.Color | null {
  try {
    return chroma(color)
  } catch {
    return null
  }
}

/**
 * Set absolute alpha value on a color.
 * Unlike color2k's transparentize which subtracts, this sets the exact alpha.
 * Returns the original color string if parsing fails (e.g., unsupported format).
 *
 * @param color - Any valid CSS color string
 * @param alpha - Target alpha value (0-1), will be clamped to valid range
 * @returns CSS color string with the specified alpha
 */
export function setAlpha(color: string, alpha: number): string {
  const c = tryParse(color)
  if (!c) return color
  // Clamp alpha to valid range [0, 1] to ensure valid CSS output
  const clampedAlpha = Math.max(0, Math.min(1, alpha))
  return toCSS(c.alpha(clampedAlpha))
}

/**
 * Darken a color by the specified amount.
 * Returns the original color string if parsing fails.
 *
 * @param color - Any valid CSS color string
 * @param amount - Amount to darken (0-1, where 0.1 = slight, 0.3 = moderate)
 * @returns Darkened CSS color string
 */
export function darken(color: string, amount = 0.1): string {
  const c = tryParse(color)
  if (!c) return color
  // Multiply by 5 to roughly match color2k's visual intensity.
  // color2k used HSL-based darkening with 0-1 range, while chroma-js uses
  // Lab-space with a different scale. The factor of 5 was empirically
  // calibrated to produce visually similar results.
  return toCSS(c.darken(amount * 5))
}

/**
 * Lighten a color by the specified amount.
 * Returns the original color string if parsing fails.
 *
 * @param color - Any valid CSS color string
 * @param amount - Amount to lighten (0-1, where 0.1 = slight, 0.3 = moderate)
 * @returns Lightened CSS color string
 */
export function lighten(color: string, amount = 0.1): string {
  const c = tryParse(color)
  if (!c) return color
  // Multiply by 5 to roughly match color2k's visual intensity.
  // See darken() for the rationale behind this calibration factor.
  return toCSS(c.brighten(amount * 5))
}

/**
 * Mix two colors together.
 * Uses RGB color space for consistency with previous color2k behavior.
 * Returns color1 if either color cannot be parsed.
 *
 * @param color1 - First color
 * @param color2 - Second color
 * @param ratio - Mix ratio (0 = all color1, 1 = all color2, 0.5 = equal mix)
 * @returns Mixed CSS color string
 */
export function mix(color1: string, color2: string, ratio = 0.5): string {
  const c1 = tryParse(color1)
  const c2 = tryParse(color2)
  if (!c1 || !c2) return color1
  return toCSS(chroma.mix(c1, c2, ratio, "rgb"))
}

/**
 * Get the relative luminance of a color (0-1).
 * Used for determining if a background is light or dark.
 * Returns 0.5 if the color cannot be parsed (e.g., hwb() format not supported).
 */
export function getLuminance(color: string): number {
  try {
    return chroma(color).luminance()
  } catch {
    // hwb() and exotic color(<colorspace> ...) syntaxes are not supported.
    // Return a mid-gray luminance as a fallback.
    return 0.5
  }
}

/**
 * Parse a color string to RGBA values.
 * Returns [r, g, b, a] where r,g,b are 0-255 and a is 0-1.
 * Returns null if the color cannot be parsed (e.g., unsupported CSS format).
 */
export function parseToRgba(
  color: string
): [number, number, number, number] | null {
  const c = tryParse(color)
  if (!c) return null
  const [r, g, b] = c.rgb()
  return [Math.round(r), Math.round(g), Math.round(b), c.alpha()]
}

/**
 * Convert a color to hex format.
 * If the color has alpha < 1, returns 8-digit hex (#RRGGBBAA).
 * Returns the original color string if parsing fails (e.g., unsupported format).
 */
export function toHex(color: string): string {
  const c = tryParse(color)
  if (!c) return color
  return c.alpha() < 1 ? c.hex("rgba") : c.hex("rgb")
}
