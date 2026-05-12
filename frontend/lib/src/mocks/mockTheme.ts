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

/** A mock theme definition for use in unit tests. */

import { lightThemePrimitives } from "baseui"

import { setAlpha } from "~lib/theme/colorUtils"
import { createBaseUiTheme } from "~lib/theme/createBaseUiTheme"
import { createEmotionColors } from "~lib/theme/getColors"
import { createShadows } from "~lib/theme/getShadows"
import { breakpoints } from "~lib/theme/primitives/breakpoints"
import { colors } from "~lib/theme/primitives/colors"
import { iconSizes } from "~lib/theme/primitives/iconSizes"
import { radii } from "~lib/theme/primitives/radii"
import { sizes } from "~lib/theme/primitives/sizes"
import { spacing } from "~lib/theme/primitives/spacing"
import {
  fonts,
  fontSizes,
  fontWeights,
  genericFonts,
  lineHeights,
} from "~lib/theme/primitives/typography"
import { zIndices } from "~lib/theme/primitives/zIndices"
import type { ThemeConfig } from "~lib/theme/types"

const requiredThemeColors = {
  bgColor: colors.white,
  secondaryBg: colors.gray20,
  bodyText: colors.gray85,

  primary: colors.red70,
  secondary: colors.blue70,

  // Default main theme colors (light theme)
  redColor: colors.red70,
  orangeColor: colors.orange70,
  yellowColor: colors.yellow80,
  blueColor: colors.blue70,
  greenColor: colors.green70,
  violetColor: colors.purple70,
  grayColor: colors.gray60,

  // Default background theme colors (light theme)
  redBackgroundColor: setAlpha(colors.red80, 0.1),
  orangeBackgroundColor: setAlpha(colors.orange70, 0.1),
  yellowBackgroundColor: setAlpha(colors.yellow65, 0.1),
  blueBackgroundColor: setAlpha(colors.blue65, 0.1),
  greenBackgroundColor: setAlpha(colors.green70, 0.1),
  violetBackgroundColor: setAlpha(colors.purple60, 0.1),
  grayBackgroundColor: setAlpha(colors.gray85, 0.1),

  // Default text theme colors (light theme)
  redTextColor: colors.red90,
  orangeTextColor: colors.orange95,
  yellowTextColor: colors.yellow115,
  blueTextColor: colors.blue90,
  greenTextColor: colors.green90,
  violetTextColor: colors.purple90,
  grayTextColor: setAlpha(colors.gray85, 0.6),
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

// Create colors and shadows using the same pattern as emotionBaseTheme
const emotionColors = createEmotionColors(genericColors)
const shadows = createShadows(emotionColors)

const emotionMockTheme = {
  inSidebar: false,
  showSidebarBorder: false,
  linkUnderline: true,
  breakpoints,
  colors: emotionColors,
  fonts,
  fontSizes,
  fontWeights,
  genericFonts,
  iconSizes,
  lineHeights,
  radii,
  shadows,
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
