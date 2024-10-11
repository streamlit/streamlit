/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { CustomThemeConfig } from "@streamlit/lib/src/proto"

import emotionBaseTheme from "./emotionBaseTheme"
import { baseuiLightTheme } from "./baseui"

export type EmotionTheme = typeof emotionBaseTheme

export type ThemeConfig = {
  name: string
  emotion: EmotionTheme
  // For use with Baseweb's ThemeProvider. This is required in order for us to
  // create separate themes for in the children. Currently required to accommodate
  // sidebar theming.
  basewebTheme: typeof baseuiLightTheme
  primitives: typeof lightThemePrimitives
}

export type CachedTheme = {
  name: string

  themeInput?: Partial<CustomThemeConfig>
}

type IconSizes = typeof emotionBaseTheme.iconSizes
type ThemeColors = typeof emotionBaseTheme.colors
export type ThemeSizings = typeof emotionBaseTheme.sizes
export type ThemeSpacings = typeof emotionBaseTheme.spacing

export type IconSize = keyof IconSizes
export type ThemeColor = Extract<keyof ThemeColors, string>
export type ThemeSizing = keyof ThemeSizings
export type ThemeSpacing = keyof ThemeSpacings
export type PresetThemeName = "Light" | "Dark"
