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

import { LightTheme, DarkTheme } from "baseui"
import { lightBaseUITheme, darkBaseUITheme } from "./baseui"
import base from "./baseTheme"
import light from "./lightTheme"
import dark from "./darkTheme"
import sidebar from "./sidebarTheme"
import { Theme } from "./types"

export * from "./baseui"
export * from "./types"
export * from "./utils"
export const lightTheme: Theme = light
export const darkTheme: Theme = dark
export const sidebarTheme: Theme = sidebar

export const AvailableTheme = {
  lightTheme: {
    name: "Light",
    emotion: light,
    base: LightTheme,
    baseui: lightBaseUITheme,
  },
  darkTheme: {
    name: "Dark",
    emotion: dark,
    base: DarkTheme,
    baseui: darkBaseUITheme,
  },
  customTheme: {
    // TODO: base, main or nothing?
    name: "Custom",
    emotion: base,
    base: LightTheme,
    baseui: lightBaseUITheme,
  },
}
