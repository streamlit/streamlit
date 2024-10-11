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

import styled from "@emotion/styled"

import { computeSpacingStyle, IconSize } from "@streamlit/lib/src/theme"

export interface StyledMaterialIconProps {
  size: IconSize
  margin: string
  padding: string
  color: string
}

export const StyledMaterialIcon = styled.span<StyledMaterialIconProps>(
  ({ size, margin, padding, theme, color }) => {
    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContents: "center",
      color: color,
      fontSize: theme.iconSizes[size],
      width: theme.iconSizes[size],
      height: theme.iconSizes[size],
      margin: computeSpacingStyle(margin, theme),
      padding: computeSpacingStyle(padding, theme),
      userSelect: "none",
      fontFamily: theme.genericFonts.iconFont,
      fontWeight: theme.fontWeights.normal,
      fontStyle: "normal",
      lineHeight: theme.lineHeights.none,
      letterSpacing: "normal",
      textTransform: "none",
      whiteSpace: "nowrap",
      wordWrap: "normal",
      direction: "ltr",
      fontFeatureSettings: "liga",
      MozFontFeatureSettings: "liga",
      WebkitFontFeatureSettings: "liga",
      WebkitFontSmoothing: "antialiased",
    }
  }
)
