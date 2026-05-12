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

import { createEmotionColors } from "~lib/theme/getColors"
import { createShadows } from "~lib/theme/getShadows"
import { breakpoints } from "~lib/theme/primitives/breakpoints"
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

import genericColors from "./themeColors"

// Create colors (includes derived colors)
const colors = createEmotionColors(genericColors)

// Create shadows (dependent on colors/derived colors)
const shadows = createShadows(colors)

export default {
  inSidebar: false,
  showSidebarBorder: false,
  linkUnderline: true,
  breakpoints,
  colors,
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
