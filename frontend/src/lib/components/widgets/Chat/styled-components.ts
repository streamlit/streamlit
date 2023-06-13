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
import { hasLightBackgroundColor } from "src/lib/theme"

export const StyledChatContainer = styled.div(() => {
  return {}
})

export const StyledChatAnchor = styled.div(() => {
  return {
    height: "0.5px",
  }
})

export interface StyledChatMessageContainerProps {
  background: string
}

export const StyledChatMessageContainer =
  styled.div<StyledChatMessageContainerProps>(({ theme, background }) => {
    const lightTheme = hasLightBackgroundColor(theme)
    const messageBackground =
      background === "grey"
        ? {
            backgroundColor: lightTheme
              ? theme.colors.gray10
              : theme.colors.gray90,
          }
        : {}

    return {
      display: "flex",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      paddingTop: theme.spacing.md,
      paddingRight: background ? theme.spacing.md : 0,
      borderRadius: theme.radii.md,
      ...messageBackground,
    }
  })

export const StyledMessageContent = styled.div(({ theme }) => ({
  color: theme.colors.bodyText,
  margin: "auto",
  flexGrow: 1,
  // paddingRight: "1rem",
}))

export const StyledAvatarEmoji = styled.div(({ theme }) => ({
  display: "flex",
  backgroundColor: theme.colors.secondaryBg,
  lineHeight: "1",
  fontSize: "1.25rem",
  padding: "0.75rem",
  borderRadius: theme.radii.md,
  alignItems: "center",
  justifyContent: "center",
}))

export const StyledAvatarImage = styled.img(({ theme }) => ({
  width: "2rem",
  height: "2rem",
  // marginTop: "-4px",
  borderRadius: theme.radii.md,
  objectFit: "cover",
  display: "flex",
}))

export interface StyledChatInputContainerProps {
  width: number
  fullscreenLayout: boolean
}

export const StyledChatInputContainer =
  styled.div<StyledChatInputContainerProps>(
    ({ theme, width, fullscreenLayout }) => {
      const lightTheme = hasLightBackgroundColor(theme)
      return {
        backgroundColor: lightTheme
          ? theme.colors.gray10
          : theme.colors.gray90,
        borderRadius: theme.radii.md,
        display: "flex",
        alignItems: "center",
        border: `1px solid ${
          lightTheme ? theme.colors.gray20 : theme.colors.gray80
        }`,
        ...(fullscreenLayout
          ? {
              filter: lightTheme
                ? "drop-shadow(0px 4px 6px rgba(25, 30, 36, 0.15))"
                : "drop-shadow(0px 4px 6px rgba(191, 197, 211, 0.3))",
              position: "fixed",
              bottom: "40px",
              zIndex: theme.zIndices.chatInput,
            }
          : {}),
        width: `${width}px`,
      }
    }
  )

export const StyledChatInput = styled.div(({ theme }) => {
  const lightTheme = hasLightBackgroundColor(theme)
  return {
    backgroundColor: lightTheme ? theme.colors.gray10 : theme.colors.gray90,
    position: "relative",
    flexGrow: 1,
    borderRadius: theme.radii.md,
  }
})
export interface StyledSendIconContainerProps {
  height: string
}

export const StyledSendIconContainer =
  styled.button<StyledSendIconContainerProps>(({ theme, height }) => {
    const lightTheme = hasLightBackgroundColor(theme)

    return {
      height: height,
      border: "none",
      backgroundColor: lightTheme ? theme.colors.gray10 : theme.colors.gray90,
      borderRadius: theme.radii.md,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      paddingRight: theme.spacing.sm,
      paddingLeft: theme.spacing.sm,
      ":hover": {
        backgroundColor: lightTheme
          ? theme.colors.gray40
          : theme.colors.gray10,
      },
      ":focus": {
        backgroundColor: lightTheme
          ? theme.colors.gray40
          : theme.colors.gray10,
        outline: "none",
      },
      "&:focus:not(:active)": {
        backgroundColor: lightTheme
          ? theme.colors.gray10
          : theme.colors.gray90,
      },
    }
  })

export const StyledSendIcon = styled.img({
  width: "1.5rem",
  height: "1.5rem",
})
