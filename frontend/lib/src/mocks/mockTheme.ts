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

import { createEmotionColors } from "~lib/theme/getColors"
import { createShadows } from "~lib/theme/getShadows"
import { breakpoints } from "~lib/theme/primitives/breakpoints"
import { colors } from "~lib/theme/primitives/colors"
import { iconSizes } from "~lib/theme/primitives/iconSizes"
import { opacities } from "~lib/theme/primitives/opacities"
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
  // Keep in sync with emotionBaseTheme/themeColors.ts
  redColor: "#D94A57",
  orangeColor: "#E0682B",
  yellowColor: "#E0A61F",
  blueColor: "#3B82F6",
  greenColor: "#079464",
  violetColor: "#9B5DE5",
  grayColor: "#716A63",

  // Default background theme colors (light theme)
  redBackgroundColor: "#FFF1F2",
  orangeBackgroundColor: "#FFF6ED",
  yellowBackgroundColor: "#FFFAE5",
  blueBackgroundColor: "#EDF5FF",
  greenBackgroundColor: "#F1FBF6",
  violetBackgroundColor: "#F8F2FF",
  grayBackgroundColor: "#F5F4F2",

  // Default text theme colors (light theme)
  redTextColor: "#9E303B",
  orangeTextColor: "#9B4519",
  yellowTextColor: "#9D7110",
  blueTextColor: "#244FB4",
  greenTextColor: "#0C5A44",
  violetTextColor: "#6F33B8",
  grayTextColor: "#3F3A34",
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
  opacities,
  radii,
  shadows,
  sizes,
  spacing,
  zIndices,
}

export const mockTheme: ThemeConfig = {
  name: "MockTheme",
  emotion: emotionMockTheme,
}
