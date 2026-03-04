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

import { getLuminance, transparentize } from "color2k"

import lightElevationShadows, {
  ElevationShadows,
} from "./emotionBaseTheme/elevationShadows"
import darkElevationShadows from "./emotionDarkTheme/elevationShadows"
import { sizes } from "./primitives/sizes"
import { EmotionThemeColors } from "./types"

/**
 * Derived shadows - computed from theme colors.
 */
type DerivedShadows = {
  focusRing: string
  focusRingSubtle: string
  focusRingOutline: string
  focusRingMuted: string
}

/**
 * Full shadows type combining elevation shadows (including none) + derived focus ring shadows.
 */
export type ThemeShadows = ElevationShadows & DerivedShadows

/**
 * Create the complete shadows object for a theme.
 *
 * Determines light/dark elevation shadows based on background
 * luminance, then derives focus ring shadows from theme colors.
 *
 * @param colors - Emotion theme colors containing:
 *   - `bgColor`: Background color used to determine light/dark elevation shadows
 *   - `primary`: Primary color for focus ring and outline shadows
 *   - `darkenedBgMix25`: Used for subtle focus ring shadow
 *   - `gray10`: Used for muted focus ring shadow on dark backgrounds
 *   - `gray90`: Used for muted focus ring shadow on light backgrounds
 * @returns Complete theme shadows object including elevation shadows (tooltip, popover,
 *   toolbar, sidebar, none) and focus ring shadows (focusRing, focusRingSubtle,
 *   focusRingOutline, focusRingMuted)
 */
export const createShadows = (
  colors: Pick<
    EmotionThemeColors,
    "bgColor" | "primary" | "darkenedBgMix25" | "gray10" | "gray90"
  >
): ThemeShadows => {
  // Auto-determine elevation shadows based on background luminance
  const isLightBg = getLuminance(colors.bgColor) > 0.5
  const elevationShadows = isLightBg
    ? lightElevationShadows
    : darkElevationShadows

  const width = sizes.focusRingWidth
  const gray = isLightBg ? colors.gray90 : colors.gray10
  return {
    ...elevationShadows,
    // Primary focus ring - buttons, checkboxes, sliders, inputs
    focusRing: `0 0 0 ${width} ${transparentize(colors.primary, 0.5)}`,
    // Subtle focus ring - CodeBlock copy button
    focusRingSubtle: `0 0 0 ${width} ${transparentize(colors.darkenedBgMix25, 0.5)}`,
    // Solid outline focus ring - FileUploader dropzone
    focusRingOutline: `0 0 0 1px ${colors.primary}`,
    // Muted focus ring - header link buttons
    focusRingMuted: `0 0 0 ${width} ${transparentize(gray, 0.8)}`,
  }
}
