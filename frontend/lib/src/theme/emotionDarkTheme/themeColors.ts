/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { colors } from "@streamlit/lib/src/theme/primitives/colors"

export default {
  ...colors,
  bgColor: colors.gray100,
  secondaryBg: colors.gray90,
  bodyText: colors.gray10,
  navTextColor: colors.gray50,
  navActiveTextColor: colors.gray10,
  navIconColor: colors.gray70,
  sidebarControlColor: colors.gray10,
  warning: colors.yellow20,
  warningBg: transparentize(colors.yellow70, 0.8),
  success: colors.green10,
  successBg: transparentize(colors.green60, 0.8),
  info: colors.blue20,
  infoBg: transparentize(colors.blue60, 0.8),
  danger: colors.red20,
  dangerBg: transparentize(colors.red60, 0.8),
  primary: colors.red70,
  disabled: colors.gray70,
}
