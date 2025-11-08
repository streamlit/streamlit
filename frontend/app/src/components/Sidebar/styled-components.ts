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

import styled from "@emotion/styled"

import { EmotionTheme, hasLightBackgroundColor } from "@streamlit/lib"

/**
 * Returns the horizontal spacing for the sidebar, taking into consideration
 * the scrollbar gutters (one on each side) which are present when the OS
 * doesn't support overlay scrollbars.
 *
 * @param theme The theme to use.
 * @returns The horizontal spacing for the sidebar.
 */
export const getSidebarHorizontalSpacing = (
  theme: EmotionTheme,
  scrollbarGutterSize: number
): string => {
  // This should be max(0px, ...), but there's a Chrome bug that
  // causes content to clip when scrollbar-gutter is set to "stable both-edges".
  // So we change the min from 0px to scrollbarGutterSize to account for that.
  // Chrome bug: https://issues.chromium.org/issues/40064879
  return `max(
    ${scrollbarGutterSize}px,
    calc(${theme.spacing.xl} - ${scrollbarGutterSize}px)
  )`
}

export interface StyledSidebarProps {
  isCollapsed: boolean
  adjustTop: boolean
  sidebarWidth: string
  windowInnerWidth: number
}

export const StyledSidebar = styled.section<StyledSidebarProps>(
  ({ theme, isCollapsed, adjustTop, sidebarWidth, windowInnerWidth }) => {
    const minWidth = isCollapsed ? 0 : Math.min(200, windowInnerWidth)
    const maxWidth = isCollapsed ? 0 : Math.min(600, windowInnerWidth * 0.9)

    return {
      position: "relative",
      // Nudge the sidebar by 2px so the header decoration doesn't go below it
      top: adjustTop ? theme.sizes.headerDecorationHeight : theme.spacing.none,
      backgroundColor: theme.colors.bgColor,
      // Since the sidebar can have a different theme (+ background)
      // we need to explicitly set the font color and color scheme
      // here again so that it is inherited correctly by all sidebar elements:
      color: theme.colors.bodyText,
      colorScheme: hasLightBackgroundColor(theme) ? "light" : "dark",
      zIndex: theme.zIndices.header + 1,

      minWidth,
      maxWidth,
      transform: isCollapsed ? `translateX(-${sidebarWidth}px)` : "none",
      transition: "transform 300ms, min-width 300ms, max-width 300ms",

      "&:focus": {
        outline: "none",
      },

      [`@media (max-width: ${theme.breakpoints.md})`]: {
        boxShadow: `-2rem 0 2rem 2rem ${
          isCollapsed ? "transparent" : "#00000029"
        }`,
      },

      [`@media print`]: {
        display: isCollapsed ? "none" : "initial",
        // set to auto, otherwise the sidebar does not take up the whole page
        height: "auto !important",
        // set maxHeight to little bit less than 100%, otherwise the sidebar might start a mostly blank page
        maxHeight: "99%",
        // on Chrome, sth. adds a box-shadow in printing mode which looks weird
        boxShadow: "none",
      },
    }
  }
)

export interface StyledSidebarUserContentProps {
  hasPageNavAbove: boolean
}

export const StyledSidebarUserContent =
  styled.div<StyledSidebarUserContentProps>(({ hasPageNavAbove, theme }) => ({
    paddingTop: hasPageNavAbove ? theme.spacing.twoXL : 0,
    paddingBottom: theme.sizes.sidebarTopSpace,
  }))

export interface StyledSidebarContentProps {
  scrollbarGutterSize: number
}

export const StyledSidebarContent = styled.div<StyledSidebarContentProps>(
  ({ theme, scrollbarGutterSize }) => ({
    position: "relative",
    height: "100%",
    width: "100%",
    overflow: "auto",
    /**
     * Ensure that space is reserved for scrollbars, even when they are not
     * visible. This is necessary to prevent layout shifts when the scrollbars
     * appear and disappear.
     *
     * We utilize both-edges so that things look visually centered and aligned.
     *
     * @see https://github.com/streamlit/streamlit/issues/10310
     */
    scrollbarGutter: "stable both-edges",
    paddingLeft: getSidebarHorizontalSpacing(theme, scrollbarGutterSize),
    paddingRight: getSidebarHorizontalSpacing(theme, scrollbarGutterSize),
  })
)

export const RESIZE_HANDLE_WIDTH = "8px"

export const StyledResizeHandle = styled.div(({ theme }) => ({
  position: "absolute",
  width: RESIZE_HANDLE_WIDTH,
  height: "100%",
  cursor: "col-resize",
  zIndex: theme.zIndices.sidebarMobile,
  backgroundImage: theme.showSidebarBorder
    ? `linear-gradient(to right, transparent 20%, ${theme.colors.borderColor} 28%, transparent 36%)`
    : "none",

  "&:hover": {
    backgroundImage: `linear-gradient(to right, transparent 20%, ${theme.colors.borderColor} 28%, transparent 44%)`,
  },
}))

export const StyledSidebarHeaderContainer = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: theme.spacing.lg,
  height: theme.sizes.headerHeight,
}))

export const StyledLogoLink = styled.a({
  "&:hover": {
    opacity: "0.7",
  },
})

export interface StyledLogoProps {
  size: string
  sidebarWidth?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
function translateLogoHeight(theme: any, size: string): string {
  if (size === "small") {
    return theme.sizes.smallLogoHeight
  } else if (size === "large") {
    return theme.sizes.largeLogoHeight
  }
  // Default logo size
  return theme.sizes.defaultLogoHeight
}

export const StyledLogo = styled.img<StyledLogoProps>(({ theme, size }) => ({
  height: translateLogoHeight(theme, size),
  // Extra margin to align small logo with sidebar collapse arrow
  marginTop: size == "small" ? theme.spacing.xs : theme.spacing.twoXS,
  marginBottom: size == "small" ? theme.spacing.xs : theme.spacing.twoXS,
  marginLeft: theme.spacing.none,
  zIndex: theme.zIndices.header,
  objectFit: "contain",
  objectPosition: "left",
  verticalAlign: "middle",
  maxWidth: `100%`,
}))

export const StyledNoLogoSpacer = styled.div(({ theme }) => ({
  height: theme.sizes.largeLogoHeight,
}))

export interface StyledCollapseSidebarButtonProps {
  showSidebarCollapse: boolean
}

export const StyledCollapseSidebarButton =
  styled.div<StyledCollapseSidebarButtonProps>(
    ({ showSidebarCollapse, theme }) => {
      return {
        display: "inline",
        visibility: showSidebarCollapse ? "visible" : "hidden",
        marginLeft: theme.spacing.sm,
        transition: "left 300ms",
        transitionDelay: "left 300ms",
        color: hasLightBackgroundColor(theme)
          ? theme.colors.fadedText60
          : theme.colors.bodyText,
        lineHeight: "0",

        [`@media print`]: {
          // Always hide the collapse button on print:
          visibility: "hidden",
        },

        [`@media (max-width: ${theme.breakpoints.sm})`]: {
          // Always show the collapse button on small screens:
          visibility: "visible",
        },
      }
    }
  )
