/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import styled, { CSSObject } from "@emotion/styled"

import { EmotionTheme } from "@streamlit/lib"

export const StyledAppViewContainer = styled.div({
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
    // print multiple pages if app is scrollable in Safari
    overflow: "visible",
  },
})

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
    height: `100dvh`,

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
        height: `100dvh`,
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

/**
 * Adds the CSS query for wide mode.
 */
const applyWideModePadding = (theme: EmotionTheme): CSSObject => {
  return {
    // Increase side padding, if layout = wide and the screen is wide enough
    // The calculation is used to make sure that wide mode always has the same or larger
    // content compared to centered mode.
    [`@media (min-width: calc(${theme.sizes.contentMaxWidth} + 2 * (${theme.sizes.wideSidePadding} - ${theme.spacing.lg})))`]:
      {
        paddingLeft: theme.sizes.wideSidePadding,
        paddingRight: theme.sizes.wideSidePadding,
      },
    minWidth: "auto",
    maxWidth: "initial",
  }
}

export interface StyledAppViewBlockContainerProps {
  isWideMode: boolean
  hasBottom: boolean
  showPadding: boolean
  hasHeader: boolean
  showToolbar: boolean
  hasTopNav: boolean
  hasSidebar: boolean
  embedded: boolean
}

export const StyledAppViewBlockContainer =
  styled.div<StyledAppViewBlockContainerProps>(
    ({
      hasBottom,
      isWideMode,
      showPadding,
      hasHeader,
      showToolbar,
      hasTopNav,
      hasSidebar,
      embedded,
      theme,
    }) => {
      const littlePadding = "2.25rem"

      // Top padding logic per specification:
      let topPadding = littlePadding // Default: 2.25rem

      if (!embedded) {
        // Non-embedded apps always get 6rem or 8rem
        topPadding = hasTopNav ? "8rem" : "6rem"
      } else if (showPadding || showToolbar) {
        // 6rem if embedded with show_padding or show_toolbar
        topPadding = "6rem"
      } else if (hasHeader || hasSidebar) {
        // 4.5rem if embedded with header but no padding/toolbar
        topPadding = "4.5rem"
      }
      // Otherwise use default: 2.25rem if embedded with no header and no padding/toolbar

      const bottomEmbedPadding =
        showPadding && !hasBottom ? "10rem" : theme.spacing.lg

      return {
        width: theme.sizes.full,
        paddingLeft: theme.spacing.lg,
        paddingRight: theme.spacing.lg,
        paddingTop: topPadding,
        paddingBottom: bottomEmbedPadding,
        maxWidth: theme.sizes.contentMaxWidth,
        ...(isWideMode && applyWideModePadding(theme)),
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

export const StyledEventBlockContainer = styled.div({
  display: "none",
})

export interface StyledBottomBlockContainerProps {
  isWideMode: boolean
  showPadding: boolean
}

export const StyledBottomBlockContainer =
  styled.div<StyledBottomBlockContainerProps>(
    ({ isWideMode, showPadding, theme }) => {
      return {
        width: theme.sizes.full,
        paddingLeft: theme.spacing.lg,
        paddingRight: theme.spacing.lg,
        paddingTop: theme.spacing.lg,
        paddingBottom: showPadding
          ? theme.sizes.appDefaultBottomPadding
          : theme.spacing.threeXL,
        maxWidth: theme.sizes.contentMaxWidth,
        ...(isWideMode && applyWideModePadding(theme)),
        [`@media print`]: {
          paddingTop: theme.spacing.none,
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

export const StyledIFrameResizerAnchor = styled.div(({ theme }) => ({
  position: "relative",
  bottom: theme.spacing.none,
}))

export const StyledMainContent = styled.div(({ theme }) => ({
  width: theme.sizes.full,
  minWidth: 0,
  height: `100dvh`,

  // Apply relative positioning only on desktop to fix header positioning when sidebar opens.
  // On mobile, relative positioning is omitted to allow the sidebar to properly overlay
  // the app content for st.navigation(position='top') functionality (#11349).
  // Without this conditional positioning, the sidebar would overlap the top navigation
  // when opened on desktop devices.
  [`@media (min-width: ${theme.breakpoints.md})`]: {
    position: "relative",
  },
}))
