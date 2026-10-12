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

export default {
  ...colors,
  bgColor: colors.gray100,
  bodyText: colors.gray10,

  primary: colors.red70,
  secondaryBg: colors.gray90,

  // Solid design defaults. Dark text matches the main color for every hue
  // except gray.
  redColor: "#F2919A",
  orangeColor: "#F2A56D",
  yellowColor: "#FBD54F",
  blueColor: "#85B8F8",
  greenColor: "#7ED5B0",
  violetColor: "#BF8EF7",
  grayColor: "#A9A5A0",

  redBackgroundColor: "#412023",
  orangeBackgroundColor: "#342414",
  yellowBackgroundColor: "#302917",
  blueBackgroundColor: "#1E2A3D",
  greenBackgroundColor: "#0E2F24",
  violetBackgroundColor: "#332244",
  grayBackgroundColor: "#2C2925",

  redTextColor: "#F2919A",
  orangeTextColor: "#F2A56D",
  yellowTextColor: "#FBD54F",
  blueTextColor: "#85B8F8",
  greenTextColor: "#7ED5B0",
  violetTextColor: "#BF8EF7",
  grayTextColor: "#B8B3A8",
}
