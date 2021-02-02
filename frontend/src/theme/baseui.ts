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

import {
  createTheme,
  lightThemePrimitives as lightBaseThemePrimitives,
  darkThemePrimitives as darkBaseThemePrimitives,
} from "baseui"
import lightTheme from "./lightTheme"
import darkTheme from "./darkTheme"
import {
  createBaseUiTheme,
  createThemeOverrides,
  createBaseThemePrimitives,
} from "./utils"

export const lightBaseUITheme = createBaseUiTheme(
  lightTheme,
  lightBaseThemePrimitives
)

export const darkBaseUITheme = createBaseUiTheme(
  darkTheme,
  darkBaseThemePrimitives
)

// TODO: rethink through sidebar
const lightThemeOverrides = createThemeOverrides(lightTheme)
export const sidebarBaseUITheme = createTheme(
  createBaseThemePrimitives(lightBaseThemePrimitives, lightTheme),
  {
    ...lightThemeOverrides,
    colors: {
      ...lightThemeOverrides.colors,
      // mono100 overrides
      datepickerBackground: lightTheme.colors.white,
      calendarBackground: lightTheme.colors.white,
      tickFill: lightTheme.colors.white,
      tickMarkFillDisabled: lightTheme.colors.white,
      menuFill: lightTheme.colors.white,

      // mono200 overrides
      buttonDisabledFill: lightTheme.colors.white,
      fileUploaderBackgroundColor: lightTheme.colors.white,
      tickFillHover: lightTheme.colors.white,
      inputFillDisabled: lightTheme.colors.white,
      inputFillActive: lightTheme.colors.white,

      // mono300 overrides
      toggleTrackFillDisabled: lightTheme.colors.white,
      tickFillActive: lightTheme.colors.white,
      sliderTrackFillDisabled: lightTheme.colors.white,
      inputBorder: lightTheme.colors.white,
      inputFill: lightTheme.colors.white,
      inputEnhanceFill: lightTheme.colors.white,
      inputEnhancerFillDisabled: lightTheme.colors.white,

      // mono400 overrides
      buttonDisabledSpinnerBackground: lightTheme.colors.gray40,
      toggleTrackFill: lightTheme.colors.gray40,
      sliderTrackFill: lightTheme.colors.gray40,
      sliderHandleInnerFill: lightTheme.colors.gray40,
      sliderHandleInnerFillDisabled: lightTheme.colors.gray40,

      progressbarTrackFill: lightTheme.colors.gray40,
    },
  }
)

export type LightBaseUITheme = typeof lightBaseUITheme
export type SidebarBaseUITheme = typeof sidebarBaseUITheme
