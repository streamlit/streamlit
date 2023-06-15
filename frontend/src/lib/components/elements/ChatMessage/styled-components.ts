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

export const StyledAvatarEmoji = styled.div(({ theme }) => {
  const lightTheme = hasLightBackgroundColor(theme)
  return {
    display: "flex",
    backgroundColor: lightTheme ? theme.colors.white : theme.colors.gray100,
    lineHeight: "1",
    fontSize: theme.fontSizes.md,
    width: "2rem",
    height: "2rem",
    borderRadius: theme.radii.md,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: lightTheme
      ? "0px 1px 3px rgba(25, 30, 36, 0.15), 0px 4px 8px rgba(25, 30, 36, 0.05)"
      : "0px 1px 3px rgba(90, 90, 90, 0.75), 0px 4px 8px rgba(47, 47, 47, 0.01)",
  }
})

export interface StyledAvatarIconProps {
  background: string
}

export const StyledAvatarIcon = styled(
  StyledAvatarEmoji
)<StyledAvatarIconProps>(({ theme, background }) => ({
  backgroundColor: background,
  color: theme.colors.white,
  boxShadow: "none",
}))

export const StyledAvatarImage = styled.img(({ theme }) => {
  const lightTheme = hasLightBackgroundColor(theme)
  return {
    backgroundColor: lightTheme ? theme.colors.white : theme.colors.gray100,
    width: "2rem",
    height: "2rem",
    borderRadius: theme.radii.md,
    objectFit: "cover",
    display: "flex",
    // TODO(lukasmasuch): Should images also have a drop shadow?
    // boxShadow: lightTheme
    //   ? "0px 1px 3px rgba(25, 30, 36, 0.15), 0px 4px 8px rgba(25, 30, 36, 0.05)"
    //   : "0px 1px 3px rgba(90, 90, 90, 0.75), 0px 4px 8px rgba(47, 47, 47, 0.01)",
  }
})
