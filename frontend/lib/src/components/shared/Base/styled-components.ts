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

import { CSSProperties } from "react"

import styled from "@emotion/styled"

import { EmotionTheme, hasLightBackgroundColor } from "~lib/theme"
import { EmotionThemeColors } from "~lib/theme/types"

export const Box = styled.div<{
  width?: CSSProperties["width"]
  height?: CSSProperties["height"]
}>(({ width = "100%", height }) => ({
  width,
  height,
}))

/**
 * Helper function to handle the border color for baseweb input widgets
 * @see Selectbox
 * @see Multiselect
 * @see DateInput
 * @see TimeInput
 * @see TextInput
 * @see TextArea
 * Note: NumberInput exhibits same styling but doesn't directly use this function -
 * border color is handled in StyledInputContainer instead of the baseweb overrides.
 */
/**
 * Returns styles for a dropdown popover body that show a border in dark mode
 * (where shadows don't provide enough contrast) and rely on box-shadow in
 * light mode.
 */
export const getDropdownPopoverBodyStyles = (
  theme: EmotionTheme
): CSSProperties => {
  const lightBackground = hasLightBackgroundColor(theme)
  const borderWidth = lightBackground ? "0" : theme.sizes.borderWidth
  const borderStyle = lightBackground ? "none" : "solid"
  const borderColor = lightBackground ? "transparent" : theme.colors.borderColor
  return {
    borderLeftWidth: borderWidth,
    borderRightWidth: borderWidth,
    borderTopWidth: borderWidth,
    borderBottomWidth: borderWidth,

    borderLeftStyle: borderStyle,
    borderRightStyle: borderStyle,
    borderTopStyle: borderStyle,
    borderBottomStyle: borderStyle,

    borderLeftColor: borderColor,
    borderRightColor: borderColor,
    borderTopColor: borderColor,
    borderBottomColor: borderColor,

    boxShadow: lightBackground
      ? "0px 4px 16px rgba(0, 0, 0, 0.16)"
      : "0px 4px 16px rgba(0, 0, 0, 0.7)",
  }
}

export const getBorderColor = (
  colors: EmotionThemeColors,
  $isFocused: boolean
): string => {
  let borderColor = colors.widgetBorderColor ?? colors.secondaryBg
  if ($isFocused) {
    borderColor = colors.primary
  }
  return borderColor
}
