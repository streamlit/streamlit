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

import { transparentize } from "color2k"

import { colors } from "~lib/theme/primitives/colors"

// NOTE: Updates to the color below MUST be reflected in the mockTheme.ts file
// to ensure the mock theme used for tests is consistent with expected theme colors.
const requiredThemeColors = {
  bgColor: colors.white,
  secondaryBg: colors.gray20,
  bodyText: colors.gray85,

  primary: colors.red70,
  secondary: colors.blue70, // Used in progress bar and spinners
  disabled: colors.gray40,
  lightestGray: colors.gray20,
  lightGray: colors.gray30,
  gray: colors.gray60,
  darkGray: colors.gray70,

  // TODO (mgbarnes): Reduce/remove these colors to avoid
  // confusion with the default main/text/bg theme colors
  red: colors.red80,
  blue: colors.blue80,
  green: colors.green90,

  // Default main theme colors (light theme)
  redColor: colors.red70,
  orangeColor: colors.orange70,
  yellowColor: colors.yellow80,
  blueColor: colors.blue70,
  greenColor: colors.green70,
  violetColor: colors.purple70,
  grayColor: colors.gray60,

  // Default background theme colors (light theme)
  redBackgroundColor: transparentize(colors.red80, 0.9),
  orangeBackgroundColor: transparentize(colors.orange70, 0.9),
  yellowBackgroundColor: transparentize(colors.yellow65, 0.9),
  blueBackgroundColor: transparentize(colors.blue65, 0.9),
  greenBackgroundColor: transparentize(colors.green70, 0.9),
  violetBackgroundColor: transparentize(colors.purple60, 0.9),
  grayBackgroundColor: transparentize(colors.gray85, 0.9),

  // Default text theme colors (light theme)
  redTextColor: colors.red90,
  orangeTextColor: colors.orange95,
  yellowTextColor: colors.yellow115,
  blueTextColor: colors.blue90,
  greenTextColor: colors.green90,
  violetTextColor: colors.purple90,
  grayTextColor: transparentize(colors.gray85, 0.4),
}

export type RequiredThemeColors = Record<
  keyof typeof requiredThemeColors,
  string
>
export interface OptionalThemeColors {
  widgetBorderColor?: string
}

const optionalThemeColors: OptionalThemeColors = {}

export default {
  ...colors,
  ...requiredThemeColors,
  ...optionalThemeColors,
}
