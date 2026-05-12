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
  if (c.alpha() === 1) {
    return c.hex("rgb")
  }
  const [r, g, b] = c.rgb()
  return `rgba(${r}, ${g}, ${b}, ${c.alpha()})`
}

/**
 * Try to parse a color with chroma-js, returning null if parsing fails.
 * This handles modern CSS color formats (HWB, oklch, etc.) that chroma-js
 * doesn't support by returning null instead of throwing.
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
 * @param alpha - Target alpha value (0-1)
 * @returns CSS color string with the specified alpha
 */
export function setAlpha(color: string, alpha: number): string {
  const c = tryParse(color)
  if (!c) return color
  return toCSS(c.alpha(alpha))
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
 * Returns 0.5 if the color cannot be parsed (e.g., HWB format not supported).
 */
export function getLuminance(color: string): number {
  try {
    return chroma(color).luminance()
  } catch {
    // Some modern CSS color formats (like HWB) may not be supported by chroma-js.
    // Return a mid-gray luminance as a fallback.
    return 0.5
  }
}

/**
 * Parse a color string to RGBA values.
 * Returns [r, g, b, a] where r,g,b are 0-255 and a is 0-1.
 */
export function parseToRgba(color: string): [number, number, number, number] {
  const c = chroma(color)
  const [r, g, b] = c.rgb()
  return [r, g, b, c.alpha()]
}

/**
 * Convert a color to hex format.
 * If the color has alpha < 1, returns 8-digit hex (#RRGGBBAA).
 */
export function toHex(color: string): string {
  const c = chroma(color)
  return c.alpha() < 1 ? c.hex("rgba") : c.hex("rgb")
}
