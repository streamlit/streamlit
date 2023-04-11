/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import {
  LightTheme,
  DarkTheme,
  lightThemePrimitives,
  darkThemePrimitives,
} from "baseui"
import { baseuiLightTheme, baseuiDarkTheme } from "./baseui"
import emotionBaseTheme from "./emotionBaseTheme"
import emotionLightTheme from "./emotionLightTheme"
import emotionDarkTheme from "./emotionDarkTheme"
import { ThemeConfig } from "./types"
import { AUTO_THEME_NAME, getSystemTheme } from "./utils"

export const baseTheme: ThemeConfig = {
  name: "base",
  emotion: emotionBaseTheme,
  baseweb: LightTheme,
  basewebTheme: baseuiLightTheme,
  primitives: lightThemePrimitives,
}

export const darkTheme: ThemeConfig = {
  name: "Dark",
  emotion: emotionDarkTheme,
  baseweb: DarkTheme,
  basewebTheme: baseuiDarkTheme,
  primitives: darkThemePrimitives,
}

export const lightTheme: ThemeConfig = {
  name: "Light",
  emotion: emotionLightTheme,
  baseweb: LightTheme,
  basewebTheme: baseuiLightTheme,
  primitives: lightThemePrimitives,
}

export const createAutoTheme = (): ThemeConfig => ({
  ...getSystemTheme(),
  name: AUTO_THEME_NAME,
})

// Update auto theme in case it has changed
export const createPresetThemes = (): ThemeConfig[] => [
  createAutoTheme(),
  lightTheme,
  darkTheme,
]
