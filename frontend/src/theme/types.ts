/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { LightTheme, lightThemePrimitives } from "baseui"

import { CustomThemeConfig } from "src/autogen/proto"

import base from "./baseTheme"
import { lightBaseUITheme } from "./baseui"

export type Theme = typeof base

export type ThemeConfig = {
  name: string
  emotion: Theme
  // For use with the BaseProvider that adds a LayersManager and ThemeProvider.
  // Unfortunately Theme is required.
  baseweb: typeof LightTheme
  // For use with Baseweb's ThemeProvider. This is required in order for us to
  // create separate themes for in the children. Currently required to accomodate
  // sidebar theming.
  basewebTheme: typeof lightBaseUITheme
  primitives: typeof lightThemePrimitives
}

export type CachedTheme = {
  name: string

  themeInput?: Partial<CustomThemeConfig>
}

type IconSizes = typeof base.iconSizes
type ThemeSpacings = typeof base.spacing
type ThemeColors = typeof base.colors

export type IconSize = keyof IconSizes
export type ThemeColor = Extract<keyof ThemeColors, string>
export type ThemeSpacing = keyof ThemeSpacings
