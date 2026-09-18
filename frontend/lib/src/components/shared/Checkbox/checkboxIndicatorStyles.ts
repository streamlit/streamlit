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

import type { CSSObject } from "@emotion/react"

import { hasLightBackgroundColor } from "~lib/theme/getColors"
import type { EmotionTheme } from "~lib/theme/types"

/**
 * Visual state for the shared checkbox indicator (the square + checkmark).
 * Used by `st.checkbox` (prop-driven) and DataFrame column-visibility menus
 * (CSS `data-*`) so rest and selected colours cannot drift apart. The menu
 * mark does not use the hover state: the row already paints that token.
 */
type CheckboxIndicatorVisualState = {
  /** Checked or indeterminate — both use the primary fill. */
  isSelected: boolean
  isHovered: boolean
  isDisabled: boolean
}

/**
 * Return border and fill so the indicator matches secondary-button hover.
 * `st.checkbox` uses every state below. DataFrame menus use rest and selected
 * only — the row already paints `darkenedBgMix15`, so the mark must not.
 *
 * - Unchecked rest: `lightenedBg05` fill, `borderColor` stroke
 * - Unchecked hover: `darkenedBgMix15` fill, `borderColor` stroke
 * - Selected: `primary` fill and stroke (hover does not change this)
 * - Disabled: dimmed fill; hover does not apply
 */
export function getCheckboxIndicatorColors(
  theme: EmotionTheme,
  { isSelected, isHovered, isDisabled }: CheckboxIndicatorVisualState
): { borderColor: string; backgroundColor: string } {
  if (isDisabled) {
    return {
      borderColor: theme.colors.borderColor,
      backgroundColor: isSelected
        ? theme.colors.fadedText40
        : theme.colors.lightenedBg05,
    }
  }
  if (isSelected) {
    return {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    }
  }
  if (isHovered) {
    return {
      borderColor: theme.colors.borderColor,
      backgroundColor: theme.colors.darkenedBgMix15,
    }
  }
  return {
    borderColor: theme.colors.borderColor,
    backgroundColor: theme.colors.lightenedBg05,
  }
}

/** Shared indicator box so size, alignment, and hover transition stay identical at every call site. */
export function getCheckboxIndicatorLayoutStyles(
  theme: EmotionTheme
): CSSObject {
  return {
    flexShrink: 0,
    width: theme.sizes.checkbox,
    height: theme.sizes.checkbox,
    // Vertically center the indicator with the first text line.
    // = (lineHeight × fontSize − indicatorSize) / 2 = (1.5 × 0.875rem − 1rem) / 2 = 2.5px
    marginTop: `calc((${theme.lineHeights.small} * ${theme.fontSizes.sm} - ${theme.sizes.checkbox}) / 2)`,
    borderRadius: theme.radii.sm,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background-color 100ms ease, border-color 100ms ease",
  }
}

/** Shared checkmark/dash geometry and stroke so the two checkbox call sites cannot drift. */
export function getCheckboxIndicatorSvgStyles(
  theme: EmotionTheme,
  { isDisabled }: { isDisabled: boolean }
): CSSObject {
  return {
    width: "65%",
    height: "65%",
    fill: "none",
    stroke: isDisabled
      ? hasLightBackgroundColor(theme)
        ? theme.colors.bgColor
        : theme.colors.bodyText
      : theme.colors.white,
    strokeWidth: "2.5px",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  }
}
