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

import { transparentize } from "color2k"
import { colors } from "../primitives/colors"

const genericColors = {
  ...colors,
  bodyText: colors.gray90,
  danger: "#9d292d",
  info: "#1e6777",
  success: "#176c36",
  warning: "#947c2d",
  primary: "#f63366",
  disabled: colors.gray30,
  secondary: colors.gray60,
  lightestGray: colors.gray20,
  lightGray: colors.gray30,
  gray: colors.gray60,
  darkGray: colors.gray70,
  red: colors.red80,
  blue: colors.blue80,
  green: colors.green80,
  yellow: colors.yellow80,
}

export default {
  ...genericColors,
  // Alerts
  alertErrorBorderColor: transparentize(genericColors.red, 0.8),
  alertErrorBackgroundColor: transparentize(genericColors.red, 0.8),
  alertErrorTextColor: genericColors.danger,
  alertInfoBorderColor: transparentize(genericColors.blue, 0.9),
  alertInfoBackgroundColor: transparentize(genericColors.blue, 0.9),
  alertInfoTextColor: genericColors.info,
  alertSuccessBorderColor: transparentize(genericColors.green, 0.8),
  alertSuccessBackgroundColor: transparentize(genericColors.green, 0.8),
  alertSuccessTextColor: genericColors.success,
  alertWarningBorderColor: transparentize(genericColors.yellow, 0.2),
  alertWarningBackgroundColor: transparentize(genericColors.yellow, 0.8),
  alertWarningTextColor: genericColors.warning,

  docStringHeaderBorder: "#e6e9ef",
  docStringModuleText: "#444444",
  docStringContainerBackground: "#f0f3f9",

  tableGray: colors.gray40,
}
