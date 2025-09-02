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

import { Metric as MetricProto } from "@streamlit/protobuf"

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

export const createEmotionColors = (
  genericColors: GenericColors
): EmotionThemeColors => {
  const derivedColors = computeDerivedColors(genericColors)
  const defaultCategoricalColors = defaultCategoricalColorsArray(genericColors)
  const defaultSequentialColors = defaultSequentialColorsArray(genericColors)

  return {
    ...genericColors,
    ...derivedColors,

    codeTextColor: genericColors.green,
    codeBackgroundColor: derivedColors.bgMix,

    // TODO (mgbarnes): These currently control both the metric delta text and chart
    // line/bar/area top line color. Dislocate these with text color updates.
    metricPositiveDeltaColor: genericColors.greenColor,
    metricNegativeDeltaColor: genericColors.redColor,
    metricNeutralDeltaColor: genericColors.grayColor,

    // Status element colors
    infoBg: genericColors.blueBackgroundColor,
    dangerBg: genericColors.redBackgroundColor,
    successBg: genericColors.greenBackgroundColor,
    warningBg: genericColors.yellowBackgroundColor,

    borderColor: derivedColors.fadedText10,
    borderColorLight: derivedColors.fadedText05,

    dataframeBorderColor: derivedColors.fadedText05,
    dataframeHeaderBackgroundColor: derivedColors.bgMix,

    headingColor: genericColors.bodyText,

    chartCategoricalColors: defaultCategoricalColors,
    chartSequentialColors: defaultSequentialColors,
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

type MarkdownBgColors = {
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

export function getMarkdownBgColors(theme: EmotionTheme): MarkdownBgColors {
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

// Metric delta uses the same background colors as Markdown bg colors.
export function getMetricBackgroundColor(
  theme: EmotionTheme,
  color: MetricProto.MetricColor
): string {
  switch (color) {
    case MetricProto.MetricColor.RED:
      return theme.colors.redBackgroundColor
    case MetricProto.MetricColor.GREEN:
      return theme.colors.greenBackgroundColor
    // this must be grey
    default:
      return theme.colors.grayBackgroundColor
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
