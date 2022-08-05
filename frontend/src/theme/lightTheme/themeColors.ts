/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
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

import { transparentize } from "color2k"
import { colors } from "../primitives/colors"

export default {
  ...colors,
  bgColor: colors.white,
  bodyText: colors.gray85,
  primary: colors.red70,
  disabled: colors.gray40,
  lightestGray: colors.gray20,
  lightGray: colors.gray30,
  gray: colors.gray60,
  darkGray: colors.gray70,
  red: colors.red80,
  blue: colors.blue80,
  green: colors.green80,
  yellow: colors.yellow80,
  // For this one, we use a specific color,
  // outside our standard color palette,
  // to ensure contrast is good enough for accessibility
  warning: "#C05103",
  warningBg: transparentize(colors.orange10, 0.6),
  success: colors.green100,
  successBg: transparentize(colors.green10, 0.6),
  info: colors.blue100,
  infoBg: transparentize(colors.blue10, 0.6),
  danger: colors.red100,
  dangerBg: transparentize(colors.red10, 0.6),
}
