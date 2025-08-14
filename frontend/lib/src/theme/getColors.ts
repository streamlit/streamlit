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

import { darken, getLuminance, lighten, mix, transparentize } from "color2k"

import { EmotionTheme } from "./types"

export type DerivedColors = {
  fadedText05: string
  fadedText10: string
  fadedText20: string
  fadedText40: string
  fadedText60: string

  bgMix: string
  darkenedBgMix100: string
  darkenedBgMix25: string
  darkenedBgMix15: string
  lightenedBg05: string
}

export const computeDerivedColors = (
  genericColors: Record<string, string>
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

export const createEmotionColors = (genericColors: {
  [key: string]: string
}): { [key: string]: string } => {
  const derivedColors = computeDerivedColors(genericColors)
  const defaultCategoricalColors = defaultCategoricalColorsArray(genericColors)
  const defaultSequentialColors = defaultSequentialColorsArray(genericColors)

  return {
    ...genericColors,
    ...derivedColors,

    codeTextColor: genericColors.green,
    codeBackgroundColor: derivedColors.bgMix,

    metricPositiveDeltaColor: genericColors.green,
    metricNegativeDeltaColor: genericColors.red,
    metricNeutralDeltaColor: derivedColors.fadedText60,

    borderColor: derivedColors.fadedText10,
    borderColorLight: derivedColors.fadedText05,
    // Used for borders around dataframes and tables
    dataframeBorderColor: derivedColors.fadedText05,
    // Used for dataframe header background
    dataframeHeaderBackgroundColor: derivedColors.bgMix,

    headingColor: genericColors.bodyText,

    // @ts-expect-error -- chart colors are a string[] vs. string
    chartCategoricalColors: defaultCategoricalColors,
    // @ts-expect-error
    chartSequentialColors: defaultSequentialColors,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
export function getDividerColors(theme: EmotionTheme): any {
  const lightTheme = hasLightBackgroundColor(theme)
  const red = lightTheme ? theme.colors.red60 : theme.colors.red90
  const orange = lightTheme ? theme.colors.orange60 : theme.colors.orange90
  const yellow = lightTheme ? theme.colors.yellow80 : theme.colors.yellow70
  const blue = lightTheme ? theme.colors.blue60 : theme.colors.blue90
  const green = lightTheme ? theme.colors.green60 : theme.colors.green90
  const violet = lightTheme ? theme.colors.purple60 : theme.colors.purple80
  const gray = lightTheme ? theme.colors.gray40 : theme.colors.gray70

  return {
    red: red,
    orange: orange,
    yellow: yellow,
    blue: blue,
    green: green,
    violet: violet,
    gray: gray,
    grey: gray,
    rainbow: `linear-gradient(to right, ${red}, ${orange}, ${yellow}, ${green}, ${blue}, ${violet})`,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
export function getMarkdownTextColors(theme: EmotionTheme): any {
  const lightTheme = hasLightBackgroundColor(theme)
  const primary = theme.colors.primary
  const red = theme.colors.red
  const orange = lightTheme ? theme.colors.orange100 : theme.colors.orange60
  const yellow = lightTheme ? theme.colors.yellow80 : theme.colors.yellow70
  const blue = theme.colors.blue
  const green = theme.colors.green
  const violet = lightTheme ? theme.colors.purple80 : theme.colors.purple50
  const purple = lightTheme ? theme.colors.purple100 : theme.colors.purple80
  const gray = lightTheme ? theme.colors.gray80 : theme.colors.gray70

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
export function getMarkdownBgColors(theme: EmotionTheme): any {
  const lightTheme = hasLightBackgroundColor(theme)

  return {
    redbg: transparentize(
      theme.colors[lightTheme ? "red80" : "red60"],
      lightTheme ? 0.9 : 0.7
    ),
    orangebg: transparentize(theme.colors.yellow70, lightTheme ? 0.9 : 0.7),
    yellowbg: transparentize(
      theme.colors[lightTheme ? "yellow80" : "yellow70"],
      0.9
    ),
    bluebg: transparentize(
      theme.colors[lightTheme ? "blue70" : "blue60"],
      lightTheme ? 0.9 : 0.7
    ),
    greenbg: transparentize(
      theme.colors[lightTheme ? "green70" : "green60"],
      lightTheme ? 0.9 : 0.7
    ),
    violetbg: transparentize(
      theme.colors[lightTheme ? "purple70" : "purple60"],
      lightTheme ? 0.9 : 0.7
    ),
    purplebg: transparentize(
      theme.colors[lightTheme ? "purple90" : "purple80"],
      lightTheme ? 0.9 : 0.7
    ),
    graybg: transparentize(
      theme.colors[lightTheme ? "gray70" : "gray50"],
      lightTheme ? 0.9 : 0.7
    ),
    primarybg: transparentize(theme.colors.primary, lightTheme ? 0.9 : 0.7),
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
function getBlueArrayAsc(colors: { [key: string]: string }): string[] {
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
function getBlueArrayDesc(colors: { [key: string]: string }): string[] {
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

export function getDivergingColorsArray(theme: EmotionTheme): string[] {
  const { colors } = theme
  return [
    colors.red100,
    colors.red90,
    colors.red70,
    colors.red50,
    colors.red30,
    colors.blue30,
    colors.blue50,
    colors.blue70,
    colors.blue90,
    colors.blue100,
  ]
}

function defaultSequentialColorsArray(genericColors: {
  [key: string]: string
}): string[] {
  return _isLightBackground(genericColors.bgColor)
    ? getBlueArrayAsc(genericColors)
    : getBlueArrayDesc(genericColors)
}

function defaultCategoricalColorsArray(genericColors: {
  [key: string]: string
}): string[] {
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
