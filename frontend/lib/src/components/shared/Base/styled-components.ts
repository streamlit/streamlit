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

import { hasLightBackgroundColor } from "~lib/theme"
import { EmotionTheme, EmotionThemeColors } from "~lib/theme/types"

export const Box = styled.div<{
  width?: CSSProperties["width"]
  height?: CSSProperties["height"]
}>(({ width = "100%", height }) => ({
  width,
  height,
}))

/**
 * Returns the shared popover container style: border-radius, border
 * (invisible in light mode to avoid pixel shifts), and box-shadow
 * (light mode only).
 *
 * @see Selectbox DropdownContainer
 * @see Multiselect DropdownContainer
 */
export const getPopoverContainerStyle = (
  theme: EmotionTheme
): Record<string, string> => {
  const lightBackground = hasLightBackgroundColor(theme)
  return {
    boxSizing: "border-box",

    borderTopLeftRadius: theme.radii.default,
    borderTopRightRadius: theme.radii.default,
    borderBottomRightRadius: theme.radii.default,
    borderBottomLeftRadius: theme.radii.default,

    // Always use same border width - in light mode, match background
    // so we don't need to adjust for pixel shifts
    borderWidth: theme.sizes.borderWidth,
    borderStyle: "solid",
    borderColor: lightBackground
      ? theme.colors.bgColor
      : theme.colors.borderColor,

    // Only show shadow in light mode
    boxShadow: lightBackground ? theme.shadows.popover : theme.shadows.none,
  }
}

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
