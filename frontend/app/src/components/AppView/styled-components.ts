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

export const StyledAppViewContainer = styled.div(() => ({
  display: "flex",
  flexDirection: "row" as const,
  justifyContent: "flex-start",
  alignItems: "stretch",
  alignContent: "flex-start",
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflow: "hidden",

  "@media print": {
    // print multiple pages if app is scrollable in Safari
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
    // smaller screen sizes, except when printing
    "@media not print": {
      [`@media (max-width: ${theme.breakpoints.md})`]: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      },
    },

    "@media print": {
      // print multiple pages if app is scrollable in Safari
      overflow: "visible",
    },
  })
)

export const StyledStickyBottomContainer = styled.div(({ theme }) => ({
  position: "sticky",
  left: 0,
  bottom: 0,
  width: "100%",
  zIndex: theme.zIndices.bottom,

  // move the bottom container to the end of pages in print-mode so that nothing
  // (e.g. a floating chat-input) overlays the actual app content
  "@media print": {
    position: "static",
  },
}))

export const StyledInnerBottomContainer = styled.div(({ theme }) => ({
  position: "relative",
  bottom: 0,
  width: "100%",
  minWidth: "100%",
  backgroundColor: theme.colors.bgColor,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
}))

export interface StyledAppViewBlockContainerProps {
  hasSidebar: boolean
  isEmbedded: boolean
  isWideMode: boolean
  showPadding: boolean
  addPaddingForHeader: boolean
  disableFullscreenMode: boolean
  hasBottom: boolean
}

export const StyledAppViewBlockContainer =
  styled.div<StyledAppViewBlockContainerProps>(
    ({
      hasSidebar,
      hasBottom,
      isEmbedded,
      isWideMode,
      showPadding,
      addPaddingForHeader,
      disableFullscreenMode,
      theme,
    }) => {
      const littlePadding = "2.1rem"
      let topEmbedPadding: string = showPadding ? "6rem" : littlePadding
      if (
        (addPaddingForHeader && !showPadding) ||
        (isEmbedded && hasSidebar)
      ) {
        topEmbedPadding = "3rem"
      }
      const bottomEmbedPadding =
        showPadding && !hasBottom ? "10rem" : theme.spacing.lg
      const wideSidePadding = isWideMode ? "5rem" : theme.spacing.lg

      // Full screen-enabled elements can overflow the page when the screen
      // size is slightly over the content max width.
      // 50rem = contentMaxWidth + 2 * 2rem (size of button as margin)
      // We use 0.5 to give a little extra space for a scrollbar that takes
      // space like safari and avoid scrollbar jitter.
      //
      // See https://github.com/streamlit/streamlit/issues/6990
      // TODO: Remove this workaround when we migrated to the new fullscreen buttons
      const shouldHandleFullScreenButton =
        !isWideMode && !disableFullscreenMode
      const fullScreenButtonStyles = shouldHandleFullScreenButton
        ? {
            [`@media (max-width: 50.5rem)`]: {
              maxWidth: `calc(100vw - 4.5rem)`,
            },
          }
        : {}
      return {
        width: theme.sizes.full,
        paddingLeft: theme.spacing.lg,
        paddingRight: theme.spacing.lg,
        // Increase side padding, if layout = wide and we're not on mobile
        "@media (min-width: 576px)": {
          paddingLeft: wideSidePadding,
          paddingRight: wideSidePadding,
        },
        paddingTop: topEmbedPadding,
        paddingBottom: bottomEmbedPadding,
        minWidth: isWideMode ? "auto" : undefined,
        maxWidth: isWideMode ? "initial" : theme.sizes.contentMaxWidth,

        ...fullScreenButtonStyles,

        [`@media print`]: {
          paddingTop: littlePadding,
        },
      }
    }
  )

export const StyledSidebarBlockContainer = styled.div(({ theme }) => {
  return {
    width: theme.sizes.full,
  }
})

export const StyledEventBlockContainer = styled.div(() => {
  return {
    display: "none",
  }
})

export interface StyledBottomBlockContainerProps {
  isWideMode: boolean
  showPadding: boolean
}

export const StyledBottomBlockContainer =
  styled.div<StyledBottomBlockContainerProps>(
    ({ isWideMode, showPadding, theme }) => {
      const wideSidePadding = isWideMode ? "5rem" : theme.spacing.lg
      return {
        width: theme.sizes.full,
        paddingLeft: theme.spacing.lg,
        paddingRight: theme.spacing.lg,
        // Increase side padding, if layout = wide and we're not on mobile
        "@media (min-width: 576px)": {
          paddingLeft: wideSidePadding,
          paddingRight: wideSidePadding,
        },
        paddingTop: theme.spacing.lg,
        paddingBottom: showPadding ? "55px" : theme.spacing.threeXL,
        minWidth: isWideMode ? "auto" : undefined,
        maxWidth: isWideMode ? "initial" : theme.sizes.contentMaxWidth,

        [`@media print`]: {
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

export const StyledIFrameResizerAnchor = styled.div(() => ({
  position: "relative" as const,
  bottom: "0",
}))
