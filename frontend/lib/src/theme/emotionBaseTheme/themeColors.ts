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

import { colors } from "~lib/theme/primitives/colors"

/** Light-theme defaults shared by `emotionBaseTheme` and `mockTheme`. */
export const requiredThemeColors = {
  // Page surface defaults from the design spec (not the primitives scale).
  bgColor: "#FFFFFF",
  secondaryBg: "#F8F8F7",
  bodyText: "#2F2D2B",

  primary: "#C53948",
  secondary: colors.blue70, // Used in progress bar

  // Named palette defaults (main / background / text) come from the design
  // spec, not the primitives scale. Backgrounds are opaque and tuned for the
  // default `bgColor`.
  redColor: "#D94A57",
  orangeColor: "#E0682B",
  yellowColor: "#BB8300",
  blueColor: "#3B82F6",
  greenColor: "#079464",
  violetColor: "#9B5DE5",
  grayColor: "#6B7280",

  redBackgroundColor: "#FFF1F2",
  orangeBackgroundColor: "#FFF6ED",
  yellowBackgroundColor: "#FFFAE5",
  blueBackgroundColor: "#EDF5FF",
  greenBackgroundColor: "#F1FBF6",
  violetBackgroundColor: "#F8F2FF",
  grayBackgroundColor: "#F5F4F2",

  redTextColor: "#9E303B",
  orangeTextColor: "#9B4519",
  yellowTextColor: "#956B0F",
  blueTextColor: "#244FB4",
  greenTextColor: "#0C5A44",
  violetTextColor: "#6F33B8",
  grayTextColor: "#686255",
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
