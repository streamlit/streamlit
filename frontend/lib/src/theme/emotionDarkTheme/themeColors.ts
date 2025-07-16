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

import { lighten, transparentize } from "color2k"

import { colors } from "~lib/theme/primitives/colors"

export default {
  ...colors,
  bgColor: colors.gray100,
  bodyText: colors.gray10,
  warning: colors.yellow20,
  warningBg: transparentize(colors.yellow70, 0.8),
  success: colors.green10,
  successBg: transparentize(colors.green60, 0.8),
  info: colors.blue20,
  infoBg: transparentize(colors.blue60, 0.8),
  danger: colors.red20,
  dangerBg: transparentize(colors.red60, 0.8),
  // Brighten link color a bit so they're easier to read:
  link: lighten(colors.blue80, 0.2),

  primary: colors.red70,
  secondaryBg: colors.gray90,
  disabled: colors.gray70,
  red: colors.red70,
  blue: colors.blue50,
  green: colors.green60,
  yellow: colors.yellow40,
}
