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

import { lightThemePrimitives } from "baseui"

import { CustomThemeConfig } from "@streamlit/protobuf"

import { baseuiLightTheme } from "./baseui"
import emotionBaseTheme from "./emotionBaseTheme"
import {
  OptionalThemeColors,
  RequiredThemeColors,
} from "./emotionBaseTheme/themeColors"
import { PrimitiveColors } from "./primitives"

/**
 * Comprehensive type for emotion theme colors.
 * Combines:
 * - PrimitiveColors: Base color palette from primitives/colors.ts
 * - RequiredThemeColors: Required theme colors declared in base/dark themeColors.ts
 * - OptionalThemeColors: Optional theme colors declared in base/dark themeColors.ts
 * - DerivedColors: Computed colors based on the 3 color segments above
 * - SpecialEmotionColors: Extra colors added by createEmotionColors (related to custom theming)
 */
export type EmotionThemeColors = PrimitiveColors &
  RequiredThemeColors &
  OptionalThemeColors &
  DerivedColors &
  SpecialEmotionColors

/**
 * Subsegment of EmotionThemeColors that is passed to createEmotionColors to create the full emotion theme colors.
 * - PrimitiveColors: Base color palette from primitives/colors.ts
 * - RequiredThemeColors: Required theme colors declared in base/dark themeColors.ts
 * - OptionalThemeColors: Optional theme colors declared in base/dark themeColors.ts
 */
export type GenericColors = PrimitiveColors &
  RequiredThemeColors &
  OptionalThemeColors

/**
 * Computed colors based on GenericColors
 */
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

/**
 * Extra colors added by createEmotionColors (related to custom theming)
 */
export type SpecialEmotionColors = {
  codeTextColor: string
  codeBackgroundColor: string

  borderColor: string
  borderColorLight: string

  // Used for borders around dataframes and tables
  dataframeBorderColor: string
  // Used for dataframe header background
  dataframeHeaderBackgroundColor: string

  headingColor: string

  // Chart colors (these are arrays of colors)
  chartCategoricalColors: string[]
  chartSequentialColors: string[]
}

/**
 * Complete emotion theme type with explicitly typed colors
 */
export interface EmotionTheme extends Omit<typeof emotionBaseTheme, "colors"> {
  colors: EmotionThemeColors
}

export type ThemeConfig = {
  name: string
  emotion: EmotionTheme
  // For use with Baseweb's ThemeProvider. This is required in order for us to
  // create separate themes for in the children. Currently required to accommodate
  // sidebar theming.
  basewebTheme: typeof baseuiLightTheme
  primitives: typeof lightThemePrimitives
  themeInput?: Partial<CustomThemeConfig>
}

export type CachedTheme = {
  name: string

  themeInput?: Partial<CustomThemeConfig>
}

type IconSizes = typeof emotionBaseTheme.iconSizes
export type ThemeSizings = typeof emotionBaseTheme.sizes
export type ThemeSpacings = typeof emotionBaseTheme.spacing

export type IconSize = keyof IconSizes
export type ThemeSizing = keyof ThemeSizings
export type ThemeSpacing = keyof ThemeSpacings
export type PresetThemeName = "Light" | "Dark"
