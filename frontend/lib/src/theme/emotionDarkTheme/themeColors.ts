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

export default {
  ...colors,
  bgColor: colors.gray100,
  bodyText: colors.gray10,

  primary: colors.red70,
  secondaryBg: colors.gray90,
  disabled: colors.gray70,

  // TODO (mgbarnes): Reduce/remove these colors to avoid
  // confusion with the default main/text/bg theme colors
  red: colors.red70,
  blue: colors.blue50,
  green: colors.green60,

  // Default main theme colors (dark theme)
  redColor: colors.red80,
  orangeColor: colors.orange80,
  yellowColor: colors.yellow70,
  blueColor: colors.blue80,
  greenColor: colors.green80,
  violetColor: colors.purple70,
  grayColor: colors.gray80,

  // Default background theme colors (dark theme)
  redBackgroundColor: transparentize(colors.red60, 0.8),
  orangeBackgroundColor: transparentize(colors.orange80, 0.8),
  yellowBackgroundColor: transparentize(colors.yellow65, 0.8),
  blueBackgroundColor: transparentize(colors.blue60, 0.8),
  greenBackgroundColor: transparentize(colors.green60, 0.8),
  violetBackgroundColor: transparentize(colors.purple60, 0.8),
  grayBackgroundColor: transparentize(colors.gray70, 0.8),

  // Default text theme colors (dark theme)
  redTextColor: colors.red60,
  orangeTextColor: colors.orange60,
  yellowTextColor: colors.yellow20,
  blueTextColor: colors.blue60,
  greenTextColor: colors.green50,
  violetTextColor: colors.purple50,
  grayTextColor: transparentize(colors.gray10, 0.4),
}
