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
import { transparentize } from "color2k"

import { hasLightBackgroundColor } from "@streamlit/lib/src/theme"

export interface StyledChatMessageContainerProps {
  background: boolean
}

export const StyledChatMessageContainer =
  styled.div<StyledChatMessageContainerProps>(({ theme, background }) => {
    const lightTheme = hasLightBackgroundColor(theme)
    return {
      display: "flex",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
      paddingRight: background ? theme.spacing.lg : 0,
      borderRadius: theme.radii.default,
      ...(background
        ? {
            backgroundColor: lightTheme
              ? transparentize(theme.colors.gray20, 0.5)
              : transparentize(theme.colors.gray90, 0.5),
          }
        : {}),
    }
  })

export const StyledMessageContent = styled.div(({ theme }) => ({
  color: theme.colors.bodyText,
  margin: "auto",
  flexGrow: 1,
  // Ensure the size of the message has an interpreted width as
  // the amount defined by flex layout and disregard its contents
  // they will handle their overflow.
  //
  // Unintuitively, setting the min width to 0 tells the browser
  // that it can shrink past the content's width to the desired size.
  // https://makandracards.com/makandra/66994-css-flex-and-min-width
  minWidth: 0,
}))

export const StyledAvatarBackground = styled.div(({ theme }) => {
  const lightTheme = hasLightBackgroundColor(theme)
  return {
    display: "flex",
    border: `${theme.sizes.borderWidth} solid ${
      lightTheme ? theme.colors.gray40 : theme.colors.gray85
    }`,
    backgroundColor: lightTheme ? theme.colors.white : theme.colors.gray100,
    color: lightTheme ? theme.colors.gray90 : theme.colors.white,
    lineHeight: theme.lineHeights.none,
    fontSize: theme.fontSizes.md,
    // Ensure the avatar always respects the width/height
    flexShrink: 0,
    width: theme.sizes.chatAvatarSize,
    height: theme.sizes.chatAvatarSize,
    borderRadius: theme.radii.default,
    alignItems: "center",
    justifyContent: "center",
  }
})

export interface StyledAvatarIconProps {
  background: string
}

export const StyledAvatarIcon = styled.div<StyledAvatarIconProps>(
  ({ theme, background }) => {
    const lightTheme = hasLightBackgroundColor(theme)
    return {
      display: "flex",
      width: theme.sizes.chatAvatarSize,
      height: theme.sizes.chatAvatarSize,
      // Ensure the avatar always respects the width/height
      flexShrink: 0,
      borderRadius: theme.radii.default,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: background,
      color: lightTheme ? theme.colors.white : theme.colors.gray100,
    }
  }
)

export const StyledAvatarImage = styled.img(({ theme }) => {
  return {
    width: theme.sizes.chatAvatarSize,
    height: theme.sizes.chatAvatarSize,
    // Ensure the avatar always respects the width/height
    flexShrink: 0,
    borderRadius: theme.radii.default,
    objectFit: "cover",
    display: "flex",
  }
})
