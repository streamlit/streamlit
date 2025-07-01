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

/** A mock theme definition for use in unit tests. */

import { lightThemePrimitives } from "baseui"
import { transparentize } from "color2k"

import { ThemeConfig } from "~lib/theme"
import { createBaseUiTheme } from "~lib/theme/createBaseUiTheme"
import { createEmotionColors } from "~lib/theme/getColors"
import {
  breakpoints,
  colors,
  fonts,
  fontSizes,
  fontWeights,
  genericFonts,
  iconSizes,
  lineHeights,
  radii,
  sizes,
  spacing,
  zIndices,
} from "~lib/theme/primitives"

const requiredThemeColors = {
  bgColor: colors.white,
  secondaryBg: colors.gray20,
  bodyText: colors.gray85,
  warning: colors.yellow110,
  warningBg: transparentize(colors.yellow80, 0.8),
  success: colors.green100,
  successBg: transparentize(colors.green80, 0.8),
  infoBg: transparentize(colors.blue70, 0.9),
  info: colors.blue100,
  danger: colors.red100,
  dangerBg: transparentize(colors.red70, 0.8),
  link: colors.blue80,

  primary: colors.red70,
  secondary: colors.blue70,
  disabled: colors.gray40,
  lightestGray: colors.gray20,
  lightGray: colors.gray30,
  gray: colors.gray60,
  darkGray: colors.gray70,
  red: colors.red80,
  blue: colors.blue80,
  green: colors.green90,
  yellow: colors.yellow100,
}

interface OptionalThemeColors {
  widgetBorderColor?: string
}

const optionalThemeColors: OptionalThemeColors = {}

const genericColors = {
  ...colors,
  ...requiredThemeColors,
  ...optionalThemeColors,
}

const emotionMockTheme = {
  inSidebar: false,
  showSidebarBorder: false,
  linkUnderline: true,
  breakpoints,
  colors: createEmotionColors(genericColors),
  fonts,
  fontSizes,
  fontWeights,
  genericFonts,
  iconSizes,
  lineHeights,
  radii,
  sizes,
  spacing,
  zIndices,
}

const baseuiMockTheme = createBaseUiTheme(
  emotionMockTheme,
  lightThemePrimitives
)

export const mockTheme: ThemeConfig = {
  name: "MockTheme",
  emotion: emotionMockTheme,
  basewebTheme: baseuiMockTheme,
  primitives: lightThemePrimitives,
}
