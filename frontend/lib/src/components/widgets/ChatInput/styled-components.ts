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
import styled from "@emotion/styled"
import { ChatInput as ChatInputProto } from "@streamlit/lib/src/proto"
import { hasLightBackgroundColor } from "@streamlit/lib/src/theme"

export interface StyledChatInputContainerProps {
  width: number
  position: ChatInputProto.Position
}

export const StyledChatInputContainer =
  styled.div<StyledChatInputContainerProps>(({ theme, width, position }) => {
    const lightTheme = hasLightBackgroundColor(theme)
    return {
      borderRadius: theme.radii.lg,
      display: "flex",
      ...(position === ChatInputProto.Position.BOTTOM && {
        backgroundColor: lightTheme
          ? theme.colors.gray20
          : theme.colors.gray90,
      }),
      width: `${width}px`,
    }
  })

export const StyledChatInput = styled.div(({ theme }) => {
  return {
    backgroundColor: theme.colors.transparent,
    position: "relative",
    flexGrow: 1,
    borderRadius: theme.radii.lg,
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
      borderTopRightRadius: extended ? theme.radii.none : theme.radii.lg,
      borderTopLeftRadius: extended ? theme.radii.lg : theme.radii.none,
      borderBottomRightRadius: theme.radii.lg,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: 1,
      margin: 0,
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

export const StyledFloatingChatInputContainer = styled.div(({ theme }) => ({
  position: "fixed",
  bottom: "0px",
  paddingBottom: "70px",
  paddingTop: theme.spacing.lg,
  backgroundColor: theme.colors.bgColor,
  zIndex: theme.zIndices.chatInput,
  [`@media (max-width: ${theme.breakpoints.md})`]: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    left: 0,
    width: "100vw",
  },
}))

export const StyledSendIconButtonContainer = styled.div(() => ({
  display: "flex",
  alignItems: "flex-end",
  height: "100%",
  position: "absolute",
  right: "0px",
  pointerEvents: "none",
}))

export const StyledInputInstructionsContainer = styled.div({
  position: "absolute",
  bottom: "0px",
  right: "3rem",
})
