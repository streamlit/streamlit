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

import { darken, getLuminance, lighten, mix, transparentize } from "color2k"

import { BACKGROUND_ONLY_COLORS, NAMED_COLOR_CONFIG } from "./namedColors"
import {
  DerivedColors,
  EmotionTheme,
  EmotionThemeColors,
  GenericColors,
} from "./types"

export const computeDerivedColors = (
  genericColors: GenericColors
): DerivedColors => {
  const { bodyText, secondaryBg, bgColor } = genericColors

  const hasLightBg = getLuminance(bgColor) > 0.5

  const fadedText05 = transparentize(bodyText, 0.9) // Mostly used for very faint 1px lines.
  const fadedText10 = transparentize(bodyText, 0.8) // Mostly used for 1px lines.
  const fadedText20 = transparentize(bodyText, 0.7) // Used for 1px lines.
  const fadedText40 = transparentize(bodyText, 0.6) // Backgrounds.
  const fadedText60 = transparentize(bodyText, 0.4) // Secondary text.

  const bgMix = mix(bgColor, secondaryBg, 0.5)
  const darkenedBgMix100 = hasLightBg
    ? darken(bgMix, 0.3)
    : lighten(bgMix, 0.6) // Icons.
  const darkenedBgMix40 = transparentize(darkenedBgMix100, 0.6)
  // TODO(tvst): Rename to darkenedBgMix25 (number = opacity)
  const darkenedBgMix25 = transparentize(darkenedBgMix100, 0.75)
  const darkenedBgMix15 = transparentize(darkenedBgMix100, 0.85) // Hovered menu/nav items.

  const lightenedBg05 = lighten(bgColor, 0.025) // Button, checkbox, radio background.

  return {
    fadedText05,
    fadedText10,
    fadedText20,
    fadedText40,
    fadedText60,

    bgMix,
    darkenedBgMix100,
    darkenedBgMix40,
    darkenedBgMix25,
    darkenedBgMix15,
    lightenedBg05,
  }
}

function _isLightBackground(bgColor: string): boolean {
  return getLuminance(bgColor) > 0.5
}

export function hasLightBackgroundColor(theme: EmotionTheme): boolean {
  return _isLightBackground(theme.colors.bgColor)
}

export const createEmotionColors = (
  genericColors: GenericColors
): EmotionThemeColors => {
  const derivedColors = computeDerivedColors(genericColors)
  const defaultCategoricalColors = defaultCategoricalColorsArray(genericColors)
  const defaultSequentialColors = defaultSequentialColorsArray(genericColors)
  const defaultDivergingColors = defaultDivergingColorsArray(genericColors)

  return {
    ...genericColors,
    ...derivedColors,

    link: genericColors.blueTextColor,

    codeTextColor: genericColors.greenTextColor,
    codeBackgroundColor: derivedColors.bgMix,

    borderColor: derivedColors.fadedText10,
    borderColorLight: derivedColors.fadedText05,

    dataframeBorderColor: derivedColors.fadedText05,
    dataframeHeaderBackgroundColor: derivedColors.bgMix,

    headingColor: genericColors.bodyText,

    chartCategoricalColors: defaultCategoricalColors,
    chartSequentialColors: defaultSequentialColors,
    chartDivergingColors: defaultDivergingColors,
  }
}

type DividerColors = {
  red: string
  orange: string
  yellow: string
  blue: string
  green: string
  violet: string
  gray: string
  grey: string
  rainbow: string
}

export function getDividerColors(theme: EmotionTheme): DividerColors {
  // Handling of defaults based on light/dark theme in emotionBaseTheme/emotionDarkTheme
  const {
    redColor,
    orangeColor,
    yellowColor,
    blueColor,
    greenColor,
    violetColor,
    grayColor,
  } = theme.colors

  return {
    red: redColor,
    orange: orangeColor,
    yellow: yellowColor,
    blue: blueColor,
    green: greenColor,
    violet: violetColor,
    gray: grayColor,
    grey: grayColor,
    rainbow: `linear-gradient(to right, ${redColor}, ${orangeColor}, ${yellowColor}, ${greenColor}, ${blueColor}, ${violetColor})`,
  }
}

type ThemeBackgroundColors = {
  redbg: string
  orangebg: string
  yellowbg: string
  bluebg: string
  greenbg: string
  violetbg: string
  purplebg: string
  graybg: string
  primarybg: string
}

export function getThemeBackgroundColors(
  theme: EmotionTheme
): ThemeBackgroundColors {
  const lightTheme = hasLightBackgroundColor(theme)
  const colors = theme.colors

  return {
    redbg: colors.redBackgroundColor,
    orangebg: colors.orangeBackgroundColor,
    yellowbg: colors.yellowBackgroundColor,
    bluebg: colors.blueBackgroundColor,
    greenbg: colors.greenBackgroundColor,
    violetbg: colors.violetBackgroundColor,
    purplebg: transparentize(
      colors[lightTheme ? "purple90" : "purple80"],
      lightTheme ? 0.9 : 0.7
    ),
    graybg: colors.grayBackgroundColor,
    primarybg: transparentize(colors.primary, lightTheme ? 0.9 : 0.7),
  }
}

type MarkdownTextColors = {
  red: string
  orange: string
  yellow: string
  blue: string
  green: string
  violet: string
  purple: string
  gray: string
  primary: string
}

export function getMarkdownTextColors(
  theme: EmotionTheme
): MarkdownTextColors {
  const lightTheme = hasLightBackgroundColor(theme)
  const colors = theme.colors

  const primary = colors.primary
  const red = colors.redTextColor
  const orange = colors.orangeTextColor
  const yellow = colors.yellowTextColor
  const blue = colors.blueTextColor
  const green = colors.greenTextColor
  const violet = colors.violetTextColor
  const purple = lightTheme ? colors.purple100 : colors.purple80
  const gray = colors.grayTextColor

  return {
    red: red,
    orange: orange,
    yellow: yellow,
    green: green,
    blue: blue,
    violet: violet,
    purple: purple,
    gray: gray,
    primary: primary,
  }
}

export function getGray70(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.gray70
    : theme.colors.gray30
}

export function getGray30(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.gray30
    : theme.colors.gray85
}

export function getGray90(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.gray90
    : theme.colors.gray10
}

export function getBlue80(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.blue80
    : theme.colors.blue40
}
function getBlueArrayAsc(colors: GenericColors): string[] {
  return [
    colors.blue10,
    colors.blue20,
    colors.blue30,
    colors.blue40,
    colors.blue50,
    colors.blue60,
    colors.blue70,
    colors.blue80,
    colors.blue90,
    colors.blue100,
  ]
}
function getBlueArrayDesc(colors: GenericColors): string[] {
  return [
    colors.blue100,
    colors.blue90,
    colors.blue80,
    colors.blue70,
    colors.blue60,
    colors.blue50,
    colors.blue40,
    colors.blue30,
    colors.blue20,
    colors.blue10,
  ]
}

function defaultDivergingColorsArray(genericColors: GenericColors): string[] {
  return [
    genericColors.red100,
    genericColors.red90,
    genericColors.red70,
    genericColors.red50,
    genericColors.red30,
    genericColors.blue30,
    genericColors.blue50,
    genericColors.blue70,
    genericColors.blue90,
    genericColors.blue100,
  ]
}

function defaultSequentialColorsArray(genericColors: GenericColors): string[] {
  return _isLightBackground(genericColors.bgColor)
    ? getBlueArrayAsc(genericColors)
    : getBlueArrayDesc(genericColors)
}

function defaultCategoricalColorsArray(
  genericColors: GenericColors
): string[] {
  return _isLightBackground(genericColors.bgColor)
    ? [
        genericColors.blue80,
        genericColors.blue40,
        genericColors.red80,
        genericColors.red40,
        genericColors.blueGreen80,
        genericColors.green40,
        genericColors.orange80,
        genericColors.orange50,
        genericColors.purple80,
        genericColors.gray40,
      ]
    : [
        genericColors.blue40,
        genericColors.blue80,
        genericColors.red40,
        genericColors.red80,
        genericColors.green40,
        genericColors.blueGreen80,
        genericColors.orange50,
        genericColors.orange80,
        genericColors.purple80,
        genericColors.gray40,
      ]
}

export function getDecreasingRed(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.red80
    : theme.colors.red40
}

export function getIncreasingGreen(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.blueGreen80
    : theme.colors.green40
}

// WeakMap allows garbage collection when themes are no longer referenced.
const namedColorCache = new WeakMap<EmotionTheme, Map<string, string>>()
const namedBgColorCache = new WeakMap<EmotionTheme, Map<string, string>>()

/**
 * Get or create the named color mapping for a theme.
 * Built from NAMED_COLOR_CONFIG to ensure consistency.
 */
function getNamedColorMap(theme: EmotionTheme): Map<string, string> {
  let colorMap = namedColorCache.get(theme)
  if (!colorMap) {
    colorMap = new Map()
    for (const [name, config] of Object.entries(NAMED_COLOR_CONFIG)) {
      const themeColor = theme.colors[config.colorKey]
      if (typeof themeColor === "string") {
        colorMap.set(name, themeColor)
      }
    }
    namedColorCache.set(theme, colorMap)
  }
  return colorMap
}

/**
 * Get or create the named background color mapping for a theme.
 * Built from NAMED_COLOR_CONFIG and BACKGROUND_ONLY_COLORS.
 */
function getNamedBgColorMap(theme: EmotionTheme): Map<string, string> {
  let colorMap = namedBgColorCache.get(theme)
  if (!colorMap) {
    const bgColors = getThemeBackgroundColors(theme)
    colorMap = new Map()

    // Add colors from main config that have background colors
    for (const [name, config] of Object.entries(NAMED_COLOR_CONFIG)) {
      if (config.bgColorKey) {
        const bgColor = theme.colors[config.bgColorKey]
        if (typeof bgColor === "string") {
          colorMap.set(name, bgColor)
        }
      }
    }

    // Add primary background (computed, not from theme.colors directly)
    colorMap.set("primary", bgColors.primarybg)

    // Add background-only colors (like purple)
    for (const [name, config] of Object.entries(BACKGROUND_ONLY_COLORS)) {
      const bgColor = bgColors[config.bgColorKey as keyof typeof bgColors]
      if (typeof bgColor === "string") {
        colorMap.set(name, bgColor)
      }
    }

    namedBgColorCache.set(theme, colorMap)
  }
  return colorMap
}

/**
 * Resolve a named color to its theme color value.
 * If the color is not a named color, returns it unchanged.
 *
 * Note: "purple" is not supported here (no purpleColor exists in the theme).
 * Use "violet" instead. For background colors, both "purple" and "violet"
 * are supported via resolveNamedBackgroundColor().
 *
 * @param color - The color string to resolve
 * @param theme - The EmotionTheme containing color values
 * @returns The resolved theme color or the original color if not a named color
 */
export function resolveNamedColor(color: string, theme: EmotionTheme): string {
  const colorMap = getNamedColorMap(theme)
  return colorMap.get(color.toLowerCase()) ?? color
}

/**
 * Resolve a named color to its theme background color value.
 * If the color is not a named color, returns it unchanged.
 *
 * Note: "purple" and "violet" have distinct background colors.
 *
 * @param color - The color string to resolve
 * @param theme - The EmotionTheme containing color values
 * @returns The resolved theme background color or the original color if not a named color
 */
export function resolveNamedBackgroundColor(
  color: string,
  theme: EmotionTheme
): string {
  const colorMap = getNamedBgColorMap(theme)
  return colorMap.get(color.toLowerCase()) ?? color
}
