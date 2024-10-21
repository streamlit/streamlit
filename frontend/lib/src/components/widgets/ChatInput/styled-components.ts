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

import { hasLightBackgroundColor } from "@streamlit/lib/src/theme"

export interface StyledChatInputContainerProps {
  width: number
}

export const StyledChatInputContainer =
  styled.div<StyledChatInputContainerProps>(({ theme, width }) => {
    return {
      borderRadius: theme.radii.default,
      display: "flex",
      backgroundColor:
        theme.colors.widgetBackgroundColor ?? theme.colors.secondaryBg,
      width: `${width}px`,
    }
  })

export const StyledChatInput = styled.div(({ theme }) => {
  return {
    backgroundColor: theme.colors.transparent,
    position: "relative",
    flexGrow: 1,
    borderRadius: theme.radii.default,
    display: "flex",
    alignItems: "center",
  }
})

interface StyledSendIconButtonProps {
  disabled: boolean
  extended: boolean
}

export const StyledSendIconButton = styled.button<StyledSendIconButtonProps>(
  ({ theme, disabled, extended }) => {
    const lightTheme = hasLightBackgroundColor(theme)
    const [cleanIconColor, dirtyIconColor] = lightTheme
      ? [theme.colors.gray60, theme.colors.gray80]
      : [theme.colors.gray80, theme.colors.gray40]
    return {
      border: "none",
      backgroundColor: theme.colors.transparent,
      borderTopRightRadius: extended ? "0" : theme.radii.default,
      borderTopLeftRadius: extended ? theme.radii.default : "0",
      borderBottomRightRadius: theme.radii.default,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: theme.lineHeights.none,
      margin: theme.spacing.none,
      padding: theme.spacing.sm,
      color: disabled ? cleanIconColor : dirtyIconColor,
      pointerEvents: "auto",
      "&:focus": {
        outline: "none",
      },
      ":focus": {
        outline: "none",
      },
      "&:focus-visible": {
        backgroundColor: lightTheme
          ? theme.colors.gray10
          : theme.colors.gray90,
      },
      "&:hover": {
        backgroundColor: theme.colors.primary,
        color: theme.colors.white,
      },
      "&:disabled, &:disabled:hover, &:disabled:active": {
        backgroundColor: theme.colors.transparent,
        borderColor: theme.colors.transparent,
        color: theme.colors.gray,
      },
    }
  }
)

export const StyledSendIconButtonContainer = styled.div({
  display: "flex",
  alignItems: "flex-end",
  height: "100%",
  position: "absolute",
  right: 0,
  pointerEvents: "none",
})

export const StyledInputInstructionsContainer = styled.div(({ theme }) => ({
  position: "absolute",
  bottom: "0px",
  // Calculate the right padding to account for the send icon (iconSizes.xl + 2 * spacing.sm)
  // and some additional margin between the icon and the text (spacing.sm).
  right: `calc(${theme.iconSizes.xl} + 2 * ${theme.spacing.sm} + ${theme.spacing.sm})`,
}))
