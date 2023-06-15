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
import { ChatInput as ChatInputProto } from "src/lib/proto"
import { hasLightBackgroundColor } from "src/lib/theme"

export interface StyledChatInputContainerProps {
  width: number
  position: ChatInputProto.Position
}

export const StyledChatInputContainer =
  styled.div<StyledChatInputContainerProps>(({ theme, width, position }) => {
    const lightTheme = hasLightBackgroundColor(theme)
    return {
      borderRadius: theme.radii.md,
      display: "flex",
      alignItems: "center",
      // border: `1px solid ${
      //   lightTheme ? theme.colors.gray20 : theme.colors.gray80
      // }`,
      ...(position === ChatInputProto.Position.BOTTOM && {
        backgroundColor: lightTheme
          ? theme.colors.white
          : theme.colors.gray100,
        filter: lightTheme
          ? "drop-shadow(0px 1px 3px rgba(25, 30, 36, 0.15)) drop-shadow(0px 4px 16px rgba(25, 30, 36, 0.1))"
          : "drop-shadow(0px 1px 3px rgba(255, 255, 255, 0.15)) drop-shadow(0px 4px 16px rgba(255, 255, 255, 0.1))",
        position: "fixed",
        bottom: "40px",
        zIndex: theme.zIndices.chatInput,
      }),
      // ...(position === "inline" && {
      //   backgroundColor: lightTheme
      //     ? theme.colors.gray20
      //     : theme.colors.gray90,
      //   // This is a bit of a workaround to fix the margin in
      //   // a non-sticky usage. Since for sticky usage, we need to remove the margin
      //   // for the element container.
      //   marginBottom: theme.spacing.lg,
      // }),
      width: `${width}px`,
    }
  })

export const StyledChatInput = styled.div(({ theme }) => {
  return {
    backgroundColor: theme.colors.transparent,
    position: "relative",
    flexGrow: 1,
    borderRadius: theme.radii.md,
  }
})
export interface StyledSendIconButtonProps {
  height: number
}

export const StyledSendIconButton = styled.button<StyledSendIconButtonProps>(
  ({ theme, height }) => {
    const lightTheme = hasLightBackgroundColor(theme)
    return {
      height: `${height}px`,
      border: "none",
      backgroundColor: theme.colors.transparent,
      borderTopRightRadius: theme.radii.md,
      borderBottomRightRadius: theme.radii.md,
      padding: theme.spacing.sm,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: 1,
      margin: 0,
      color: theme.colors.gray70,
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
        backgroundColor: theme.colors.darkenedBgMix25,
      },
      "&:disabled, &:disabled:hover, &:disabled:active": {
        backgroundColor: theme.colors.lightGray,
        borderColor: theme.colors.transparent,
        color: theme.colors.gray,
      },
    }
  }
)
