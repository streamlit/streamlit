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

export const StyledStickyBottomContainer = styled.div(() => ({
  position: "sticky",
  left: 0,
  bottom: 0,
  width: "100%",
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
  zIndex: theme.zIndices.bottom,
}))

export interface StyledAppViewBlockContainerProps {
  hasSidebar: boolean
  isEmbedded: boolean
  isWideMode: boolean
  showPadding: boolean
  addPaddingForHeader: boolean
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
      theme,
    }) => {
      let topEmbedPadding: string = showPadding ? "6rem" : "2.1rem"
      if (
        (addPaddingForHeader && !showPadding) ||
        (isEmbedded && hasSidebar)
      ) {
        topEmbedPadding = "3rem"
      }
      const bottomEmbedPadding =
        showPadding && !hasBottom ? "10rem" : theme.spacing.lg
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
        paddingTop: topEmbedPadding,
        paddingBottom: bottomEmbedPadding,
        minWidth: isWideMode ? "auto" : undefined,
        maxWidth: isWideMode ? "initial" : theme.sizes.contentMaxWidth,

        [`@media print`]: {
          minWidth: "100%",
          paddingTop: 0,
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

export const StyledIFrameResizerAnchor = styled.div(() => ({
  position: "relative",
  bottom: "0",
}))
