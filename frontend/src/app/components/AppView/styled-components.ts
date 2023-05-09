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

export const StyledAppViewContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "flex-start",
  alignItems: "stretch",
  alignContent: "flex-start",
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflow: "hidden",
  "@media print": {
    display: "block",
    float: "none",
    height: theme.sizes.full,
    position: "static",
    overflow: "visible",
  },
}))

export interface StyledAppViewMainProps {
  isEmbedded: boolean
  disableScrolling: boolean
}

export const StyledAppViewMain = styled.section<StyledAppViewMainProps>(
  ({ disableScrolling, theme }) => ({
    display: "flex",
    flexDirection: "column",
    width: theme.sizes.full,
    overflow: disableScrolling ? "hidden" : "auto",
    alignItems: "center",

    "&:focus": {
      outline: "none",
    },

    // Added so sidebar overlays main app content on
    // smaller screen sizes
    [`@media (max-width: ${theme.breakpoints.md})`]: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },

    "@media print": {
      position: "relative",
      display: "block",
    },
  })
)

export interface StyledAppViewBlockContainerProps {
  isWideMode: boolean
  showPadding: boolean
  addPaddingForHeader: boolean
}

export const StyledAppViewBlockContainer =
  styled.div<StyledAppViewBlockContainerProps>(
    ({ isWideMode, showPadding, addPaddingForHeader, theme }) => {
      let topEmbedPadding: string = showPadding ? "6rem" : "1rem"
      if (addPaddingForHeader && !showPadding) {
        topEmbedPadding = "3rem"
      }
      const bottomEmbedPadding = showPadding ? "10rem" : "1rem"
      const wideSidePadding = isWideMode ? "5rem" : theme.spacing.lg
      return {
        width: theme.sizes.full,
        paddingLeft: theme.inSidebar ? theme.spacing.none : theme.spacing.lg,
        paddingRight: theme.inSidebar ? theme.spacing.none : theme.spacing.lg,
        // Increase side padding, if layout = wide and we're not on mobile
        "@media (min-width: 576px)": {
          paddingLeft: theme.inSidebar ? theme.spacing.none : wideSidePadding,
          paddingRight: theme.inSidebar ? theme.spacing.none : wideSidePadding,
        },
        paddingTop: theme.inSidebar ? theme.spacing.none : topEmbedPadding,
        paddingBottom: theme.inSidebar
          ? theme.spacing.none
          : bottomEmbedPadding,
        minWidth: isWideMode ? "auto" : undefined,
        maxWidth: isWideMode ? "initial" : theme.sizes.contentMaxWidth,

        [`@media print`]: {
          minWidth: "100%",
          paddingTop: 0,
        },
      }
    }
  )

export const StyledAppViewBlockSpacer = styled.div(({ theme }) => {
  return {
    width: theme.sizes.full,
    flexGrow: 1,
  }
})

export const StyledAppViewFooterLink = styled.a(({ theme }) => ({
  color: theme.colors.fadedText60,
  // We do not want to change the font for this based on theme.
  fontFamily: theme.fonts.sansSerif,
  textDecoration: "none",
  transition: "color 300ms",
  "&:hover": {
    color: theme.colors.bodyText,
    textDecoration: "underline",
  },
}))

export interface StyledAppViewFooterProps {
  isWideMode: boolean
}

export const StyledAppViewFooter = styled.footer<StyledAppViewFooterProps>(
  ({ isWideMode, theme }) => {
    const wideSidePadding = isWideMode ? "5rem" : theme.spacing.lg
    return {
      color: theme.colors.fadedText40,
      fontSize: theme.fontSizes.sm,
      height: theme.sizes.footerHeight,
      minWidth: isWideMode ? "auto" : undefined,
      maxWidth: isWideMode ? "initial" : theme.sizes.contentMaxWidth,
      padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
      // Increase side padding, if layout = wide and we're not on mobile
      "@media (min-width: 576px)": {
        paddingLeft: wideSidePadding,
        paddingRight: wideSidePadding,
      },
      width: theme.sizes.full,
      a: {
        color: theme.colors.fadedText60,
      },
    }
  }
)

export interface StyledIFrameResizerAnchorProps {
  hasFooter: boolean
}

// The anchor appears above the footer, so we need to offset it by the footer
// if the app is not embedded.
export const StyledIFrameResizerAnchor =
  styled.div<StyledIFrameResizerAnchorProps>(({ theme, hasFooter }) => ({
    position: "relative",
    bottom: hasFooter ? `-${theme.sizes.footerHeight}` : "0",
  }))
