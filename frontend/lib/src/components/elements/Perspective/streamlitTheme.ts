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

import { CSSObject } from "@emotion/react"
import { transparentize } from "color2k"

import { hasLightBackgroundColor } from "~lib/theme/getColors"
import type { EmotionTheme } from "~lib/theme/types"

export const STREAMLIT_PERSPECTIVE_THEME_NAME = "Streamlit"

const VIEWER_SELECTOR = `perspective-viewer[theme="${STREAMLIT_PERSPECTIVE_THEME_NAME}"]`

const MENU_SELECTORS = [
  "perspective-copy-menu",
  "perspective-export-menu",
  "perspective-dropdown",
  "perspective-date-column-style",
  "perspective-datetime-column-style",
  "perspective-number-column-style",
  "perspective-string-column-style",
]
  .map(element => `${element}[theme="${STREAMLIT_PERSPECTIVE_THEME_NAME}"]`)
  .join(", ")

export const STREAMLIT_PERSPECTIVE_VIEWER_SELECTOR = VIEWER_SELECTOR
export const STREAMLIT_PERSPECTIVE_MENU_SELECTOR = MENU_SELECTORS

function getCategoricalColor(theme: EmotionTheme, index: number): string {
  const { chartCategoricalColors, blueColor } = theme.colors
  const fallbackColor =
    chartCategoricalColors[chartCategoricalColors.length - 1] ?? blueColor

  return chartCategoricalColors[index] ?? fallbackColor
}

function createFullGradient(theme: EmotionTheme): string {
  return `linear-gradient(${theme.colors.redColor} 0%, ${theme.colors.bgColor} 50%, ${theme.colors.greenColor} 100%)`
}

function createPositiveGradient(theme: EmotionTheme): string {
  return `linear-gradient(${theme.colors.bgColor} 0%, ${theme.colors.greenColor} 100%)`
}

function createNegativeGradient(theme: EmotionTheme): string {
  return `linear-gradient(${theme.colors.redColor} 0%, ${theme.colors.bgColor} 100%)`
}

export function resolvePerspectiveThemeName(theme: string): string {
  return theme === "streamlit" ? STREAMLIT_PERSPECTIVE_THEME_NAME : theme
}

export function createStreamlitPerspectiveTheme(
  theme: EmotionTheme
): CSSObject {
  const isLightTheme = hasLightBackgroundColor(theme)

  const sharedThemeVars = {
    color: theme.colors.bodyText,
    fontFamily: theme.genericFonts.bodyFont,
    backgroundColor: theme.colors.secondaryBg,
    "--psp-theme-name": `"${STREAMLIT_PERSPECTIVE_THEME_NAME}"`,
    "--psp--color": theme.colors.bodyText,
    "--psp-active--color": theme.colors.primary,
    "--psp-error--color": theme.colors.redTextColor,
    "--psp-inactive--color": theme.colors.grayTextColor,
    "--psp-inactive--border-color": theme.colors.borderColor,
    "--psp--background-color": theme.colors.bgColor,
    "--psp-sidebar--background": theme.colors.secondaryBg,
    "--psp-main-column--background": theme.colors.bgColor,
    "--psp-active--background": transparentize(
      theme.colors.primary,
      isLightTheme ? 0.88 : 0.72
    ),
    "--psp-placeholder--background": theme.colors.fadedText10,
    "--psp-icon-overflow-hint--color": theme.colors.fadedText40,
    "--psp-select--background-color": theme.colors.bgColor,
    "--psp-warning--background": theme.colors.yellowBackgroundColor,
    "--psp-warning--color": theme.colors.bodyText,
    "--psp-interface-monospace--font-family": theme.genericFonts.codeFont,
    "--psp-button--font-size": theme.fontSizes.md,
    "--psp-column-selector--font-size": theme.fontSizes.md,
    "--psp-button--min-width": theme.sizes.minElementHeight,
    "--psp-column-type--float--color": theme.colors.blueColor,
    "--psp-column-type--string--color": theme.colors.orangeColor,
    "--psp-column-type--date--color": theme.colors.greenColor,
    "--psp-column-type--boolean--color": theme.colors.yellowColor,
    "--psp-expression--operator--color": theme.colors.bodyText,
    "--psp-expression--function--color": theme.colors.blueTextColor,
    "--psp-expression--error--color": theme.colors.redTextColor,
    "--psp-code-editor--symbol--color": theme.colors.bodyText,
    "--psp-code-editor--literal--color": theme.colors.blueTextColor,
    "--psp-code-editor--operator--color": theme.colors.greenTextColor,
    "--psp-code-editor--comment--color": theme.colors.grayTextColor,
    "--psp-code-editor--column--color": theme.colors.violetTextColor,
    "--psp-datagrid--pos-cell--color": theme.colors.greenTextColor,
    "--psp-datagrid--neg-cell--color": theme.colors.redTextColor,
    "--psp-datagrid--border-color": theme.colors.borderColor,
    "--psp-datagrid--hover--border-color": theme.colors.primary,
    "--psp-d3fc--legend--color": theme.colors.bodyText,
    "--psp-d3fc--legend--background": theme.colors.bgColor,
    "--psp-d3fc--treemap--labels": theme.colors.bodyText,
    "--psp-d3fc--treemap--hover-highlight": theme.colors.bgColor,
    "--psp-d3fc--tooltip--background-color": transparentize(
      theme.colors.bgColor,
      isLightTheme ? 0.03 : 0.12
    ),
    "--psp-d3fc--tooltip--background": transparentize(
      theme.colors.bgColor,
      isLightTheme ? 0.03 : 0.12
    ),
    "--psp-d3fc--tooltip--color": theme.colors.bodyText,
    "--psp-d3fc--tooltip--border-color": theme.colors.borderColor,
    "--psp-d3fc--tooltip--box-shadow": theme.shadows.tooltip,
    "--psp-d3fc--axis-ticks--color": theme.colors.bodyText,
    "--psp-d3fc--axis-lines--color": theme.colors.borderColor,
    "--psp-d3fc--gridline--color": theme.colors.fadedText10,
    "--psp-d3fc--series--color": getCategoricalColor(theme, 0),
    "--psp-d3fc--series-1--color": getCategoricalColor(theme, 0),
    "--psp-d3fc--series-2--color": getCategoricalColor(theme, 1),
    "--psp-d3fc--series-3--color": getCategoricalColor(theme, 2),
    "--psp-d3fc--series-4--color": getCategoricalColor(theme, 3),
    "--psp-d3fc--series-5--color": getCategoricalColor(theme, 4),
    "--psp-d3fc--series-6--color": getCategoricalColor(theme, 5),
    "--psp-d3fc--series-7--color": getCategoricalColor(theme, 6),
    "--psp-d3fc--series-8--color": getCategoricalColor(theme, 7),
    "--psp-d3fc--series-9--color": getCategoricalColor(theme, 8),
    "--psp-d3fc--series-10--color": getCategoricalColor(theme, 9),
    "--psp-d3fc--full-gradient--background": createFullGradient(theme),
    "--psp-d3fc--pos-gradient--background": createPositiveGradient(theme),
    "--psp-d3fc--neg-gradient--background": createNegativeGradient(theme),
    "--psp-openlayers--tile-url": isLightTheme
      ? '"http://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"'
      : '"http://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"',
    "--psp-openlayers--attribution--filter": isLightTheme
      ? "none"
      : "invert(1) hue-rotate(180deg)",
    "--psp-openlayers--element--background": theme.colors.bgColor,
    "--psp-openlayers--category-1--color": getCategoricalColor(theme, 0),
    "--psp-openlayers--category-2--color": getCategoricalColor(theme, 1),
    "--psp-openlayers--category-3--color": getCategoricalColor(theme, 2),
    "--psp-openlayers--category-4--color": getCategoricalColor(theme, 3),
    "--psp-openlayers--category-5--color": getCategoricalColor(theme, 4),
    "--psp-openlayers--category-6--color": getCategoricalColor(theme, 5),
    "--psp-openlayers--category-7--color": getCategoricalColor(theme, 6),
    "--psp-openlayers--category-8--color": getCategoricalColor(theme, 7),
    "--psp-openlayers--category-9--color": getCategoricalColor(theme, 8),
    "--psp-openlayers--category-10--color": getCategoricalColor(theme, 9),
    "--psp-openlayers--gradient--background": createFullGradient(theme),
    "--psp-calendar--filter": isLightTheme ? "none" : "invert(1)",
    "--psp-icon--select-arrow--mask-image": isLightTheme
      ? "var(--psp-icon--select-arrow-dark--mask-image)"
      : "var(--psp-icon--select-arrow-light--mask-image)",
    "--psp-icon--select-arrow-hover--mask-image": isLightTheme
      ? "var(--psp-icon--select-arrow-light--mask-image)"
      : "var(--psp-icon--select-arrow-dark--mask-image)",
  }

  return {
    [VIEWER_SELECTOR]: {
      ...sharedThemeVars,
      borderRadius: theme.radii.default,
    },
    [MENU_SELECTORS]: {
      ...sharedThemeVars,
      backgroundColor: theme.colors.bgColor,
      border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
      borderRadius: theme.radii.default,
      boxShadow: theme.shadows.popover,
    },
  }
}
