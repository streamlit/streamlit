/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import { CSSProperties } from "@emotion/serialize"
import styled from "@emotion/styled"
import { darken, lighten } from "color2k"

import { hasLightBackgroundColor, Theme } from "src/theme"

export function toastColoration(
  toastType: string,
  theme: Theme
): CSSProperties {
  const lightTheme = hasLightBackgroundColor(theme)
  const inSidebar = theme.inSidebar

  const defaultStyle = {
    backgroundColor: inSidebar
      ? theme.colors.bgColor
      : theme.colors.secondaryBg,
    color: theme.colors.bodyText,
  }
  const successStyle = {
    backgroundColor: lightTheme
      ? lighten(theme.colors.green10, 0.03)
      : darken(theme.colors.green100, 0.15),
    color: lightTheme ? theme.colors.green100 : theme.colors.green10,
  }
  const warningStyle = {
    backgroundColor: lightTheme
      ? theme.colors.yellow10
      : darken(theme.colors.yellow110, 0.16),
    color: lightTheme ? theme.colors.yellow110 : theme.colors.yellow20,
  }
  const errorStyle = {
    backgroundColor: lightTheme
      ? theme.colors.red10
      : darken(theme.colors.red100, 0.2),
    color: lightTheme ? theme.colors.red100 : theme.colors.red20,
  }

  switch (toastType) {
    case "success":
      return successStyle
    case "warning":
      return warningStyle
    case "error":
      return errorStyle
    default:
      return defaultStyle
  }
}

export const StyledViewButton = styled.button(({ theme }) => ({
  fontSize: theme.fontSizes.sm,
  lineHeight: "1.4rem",
  color: theme.colors.gray60,
  backgroundColor: theme.colors.transparent,
  border: "none",
  boxShadow: "none",
  padding: "0px",
  "&:hover, &:active, &:focus": {
    border: "none",
    outline: "none",
    boxShadow: "none",
  },
  "&:hover": {
    color: theme.colors.primary,
  },
}))

interface StyledToastMessageProps {
  expanded: boolean
}

export const StyledToastMessage = styled.div<StyledToastMessageProps>(
  ({ expanded }) => ({
    maxHeight: expanded ? "none" : "68px",
    overflow: "hidden",
    display: "flex",
  })
)
