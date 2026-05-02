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

import { lightThemePrimitives } from "baseui"

import { CustomThemeConfig } from "@streamlit/protobuf"

import { baseuiLightTheme } from "./baseui"
import emotionBaseTheme from "./emotionBaseTheme"
import {
  OptionalThemeColors,
  RequiredThemeColors,
} from "./emotionBaseTheme/themeColors"
import { ThemeShadows } from "./getShadows"
import type { NamedColor } from "./namedColors"
import { type PrimitiveColors } from "./primitives/colors"

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
type SpecialEmotionColors = {
  link: string

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
  chartDivergingColors: string[]
}

/**
 * Complete emotion theme type with explicitly typed colors and shadows
 */
export interface EmotionTheme extends Omit<
  typeof emotionBaseTheme,
  "colors" | "shadows"
> {
  colors: EmotionThemeColors
  shadows: ThemeShadows
}

export type ThemeConfig = {
  name: string
  // Display name is used in custom themes for the main menu theme selector
  // Allows custom themes to still show as "Light", "Dark", or "Use System Setting"
  displayName?: string
  emotion: EmotionTheme
  // For use with Baseweb's ThemeProvider. This is required in order for us to
  // create separate themes for in the children. Currently required to accommodate
  // sidebar theming.
  basewebTheme: typeof baseuiLightTheme
  primitives: typeof lightThemePrimitives
  themeInput?: Partial<CustomThemeConfig>
}

export type ThemeSelection = "System" | "Light" | "Dark"

export type CachedTheme = ThemeSelection

type IconSizes = typeof emotionBaseTheme.iconSizes
type ThemeSpacings = typeof emotionBaseTheme.spacing

export type IconSize = keyof IconSizes
export type ThemeSpacing = keyof ThemeSpacings
export type PresetThemeName = "Light" | "Dark"

/**
 * Auto color modes for charts and progress bars.
 * - "auto": Green when positive/increasing, red when negative/decreasing
 * - "auto-inverse": Red when positive/increasing, green when negative/decreasing
 */
type ChartAutoColor = "auto" | "auto-inverse"

/**
 * Branded type for CSS color strings (hex, rgb, etc.)
 * Allows any string while providing type safety for color values.
 */
declare const __cssColorBrand: unique symbol
type CSSColorString = string & { readonly [__cssColorBrand]?: never }

/**
 * Union of all valid color parameter values for charts and progress bars.
 */
export type ChartColor = ChartAutoColor | NamedColor | CSSColorString
