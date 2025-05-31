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
import { transparentize } from "color2k"

import { EmotionTheme, hasLightBackgroundColor } from "@streamlit/lib"

/**
 * Returns the color of the text in the sidebar nav.
 *
 * @param theme The theme to use.
 * @param isActive Whether the nav text should show as active.
 * @returns The color of the text in the sidebar nav.
 */
const getNavTextColor = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  theme: any,
  isActive: boolean,
  disabled: boolean = false
): string => {
  const isLightTheme = hasLightBackgroundColor(theme)
  if (disabled) {
    return theme.colors.fadedText40
  }
  if (isActive) {
    return theme.colors.bodyText
  }
  return isLightTheme
    ? transparentize(theme.colors.bodyText, 0.2)
    : transparentize(theme.colors.bodyText, 0.25)
}

/**
 * Returns the horizontal spacing for the sidebar, taking into consideration
 * the scrollbar gutters (one on each side) which are present when the OS
 * doesn't support overlay scrollbars.
 *
 * @param theme The theme to use.
 * @returns The horizontal spacing for the sidebar.
 */
const getSidebarHorizontalSpacing = (theme: EmotionTheme): string => {
  // This should be max(0px, ...), but there's a Chrome bug that
  // causes content to clip when scrollbar-gutter is set to "stable both-edges".
  // So we change the min from 0px to --scrollbar-width to account for that.
  // Chrome bug: https://issues.chromium.org/issues/40064879
  return `max(
    calc(var(--scrollbar-width)),
    calc(${theme.spacing.lg} - var(--scrollbar-width))
  )`
}

export interface StyledSidebarProps {
  isCollapsed: boolean
  adjustTop: boolean
  sidebarWidth: string
}

export const StyledSidebar = styled.section<StyledSidebarProps>(
  ({ theme, isCollapsed, adjustTop, sidebarWidth }) => {
    const minWidth = isCollapsed ? 0 : Math.min(200, window.innerWidth)
    const maxWidth = isCollapsed ? 0 : Math.min(600, window.innerWidth * 0.9)

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

export const StyledSidebarNavContainer = styled.div({
  position: "relative",
})

export const StyledSidebarNavItems = styled.ul(({ theme }) => {
  return {
    listStyle: "none",
    margin: theme.spacing.none,
    paddingBottom: theme.spacing.threeXS,
    paddingTop: theme.spacing.none,
    paddingRight: theme.spacing.none,
    paddingLeft: theme.spacing.none,
  }
})
export interface StyledSidebarNavLinkContainerProps {
  disabled: boolean
}

export const StyledSidebarNavLinkContainer =
  styled.div<StyledSidebarNavLinkContainerProps>(({ disabled }) => ({
    display: "flex",
    flexDirection: "column",
    cursor: disabled ? "not-allowed" : "pointer",
  }))

export interface StyledSidebarNavIconProps {
  isActive: boolean
}

export const StyledSidebarNavIcon = styled.span<StyledSidebarNavIconProps>(
  ({ theme, isActive }) => {
    return {
      display: "inline-flex",
      // Apply a different font weight to the icon if it is active
      // The icon is in a span element.
      span: {
        fontWeight: isActive
          ? theme.fontWeights.bold
          : theme.fontWeights.normal,
      },
    }
  }
)

export interface StyledSidebarNavLinkProps {
  isActive: boolean
  disabled: boolean
}

export const StyledSidebarNavLink = styled.a<StyledSidebarNavLinkProps>(
  ({ theme, isActive, disabled }) => {
    const defaultPageLinkStyles = {
      textDecoration: "none",
      fontWeight: isActive ? theme.fontWeights.bold : theme.fontWeights.normal,
    }

    return {
      ...defaultPageLinkStyles,
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      borderRadius: theme.radii.default,
      paddingLeft: theme.spacing.sm,
      paddingRight: theme.spacing.sm,
      marginLeft: getSidebarHorizontalSpacing(theme),
      marginRight: getSidebarHorizontalSpacing(theme),
      marginTop: theme.spacing.threeXS,
      marginBottom: theme.spacing.threeXS,
      lineHeight: theme.lineHeights.menuItem,

      color: getNavTextColor(theme, isActive),
      backgroundColor: isActive ? theme.colors.darkenedBgMix25 : "transparent",

      ...(disabled && {
        pointerEvents: "none",
      }),

      "&:hover": {
        backgroundColor: transparentize(theme.colors.darkenedBgMix25, 0.1),
      },

      "&:active,&:visited,&:hover": {
        ...defaultPageLinkStyles,
      },

      "&:focus": {
        outline: "none",
      },

      "&:focus-visible": {
        backgroundColor: theme.colors.darkenedBgMix15,
      },

      [`@media print`]: {
        paddingLeft: theme.spacing.none,
      },
    }
  }
)

export const StyledSidebarLinkText = styled.span<StyledSidebarNavLinkProps>(
  ({ isActive, theme, disabled }) => {
    return {
      color: getNavTextColor(theme, isActive, disabled),
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      display: "table-cell",
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
    paddingLeft: getSidebarHorizontalSpacing(theme),
    paddingRight: getSidebarHorizontalSpacing(theme),
  }))

export const StyledSidebarContent = styled.div({
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
})

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
  alignItems: "start",
  paddingBottom: theme.spacing.twoXL,
  paddingLeft: getSidebarHorizontalSpacing(theme),
  paddingRight: getSidebarHorizontalSpacing(theme),
  // Adjust top padding based on the header decoration height
  paddingTop: `calc(${theme.spacing.twoXL} - ${theme.sizes.headerDecorationHeight})`,
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

export const StyledLogo = styled.img<StyledLogoProps>(
  ({ theme, size, sidebarWidth }) => ({
    height: translateLogoHeight(theme, size),
    // Extra margin to align small logo with sidebar collapse arrow
    marginTop: size == "small" ? theme.spacing.xs : theme.spacing.twoXS,
    marginBottom: size == "small" ? theme.spacing.xs : theme.spacing.twoXS,
    marginRight: theme.spacing.sm,
    marginLeft: theme.spacing.none,
    zIndex: theme.zIndices.header,
    objectFit: "contain",
    verticalAlign: "middle",
    ...(sidebarWidth && {
      // Control max width of logo so sidebar collapse button always shows (issue #8707)
      // L & R padding (lg) + scrollbarGutter on both sides (2 * 8px) + R margin (sm) + collapse button (2.25rem)
      maxWidth: `calc(${sidebarWidth}px - 2 * ${getSidebarHorizontalSpacing(
        theme
      )} - (2 * var(--scrollbar-width)) - ${theme.spacing.sm} - 2.25rem)`,
    }),
  })
)

export const StyledNoLogoSpacer = styled.div(({ theme }) => ({
  height: theme.sizes.largeLogoHeight,
}))

export interface StyledSidebarOpenContainerProps {
  chevronDownshift: number
}

export const StyledSidebarOpenContainer =
  styled.div<StyledSidebarOpenContainerProps>(
    ({ theme, chevronDownshift }) => ({
      position: "fixed",
      top: chevronDownshift ? `${chevronDownshift}px` : theme.spacing.xl,
      left: theme.spacing.twoXL,
      zIndex: theme.zIndices.header,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",

      [`@media print`]: {
        position: "absolute",
        left: 0,
        top: 0,
        marginTop: 0,

        [`& > ${StyledLogo}`]: {
          // Add more space to the actual app content by moving the logo a little bit more to the top.
          // margin-bottom wouldn't work here to push the content down because the logo is absolutely positioned.
          marginTop: 0,
        },
      },
    })
  )

export const StyledOpenSidebarButton = styled.div(({ theme }) => {
  return {
    zIndex: theme.zIndices.header,
    color: hasLightBackgroundColor(theme)
      ? theme.colors.fadedText60
      : theme.colors.bodyText,
    marginTop: theme.spacing.twoXS,

    button: {
      "&:hover": {
        backgroundColor: theme.colors.darkenedBgMix25,
      },
    },

    [`@media print`]: {
      display: "none",
    },
  }
})

export interface StyledCollapseSidebarButtonProps {
  showSidebarCollapse: boolean
}

export const StyledCollapseSidebarButton =
  styled.div<StyledCollapseSidebarButtonProps>(
    ({ showSidebarCollapse, theme }) => {
      return {
        display: showSidebarCollapse ? "inline" : "none",
        transition: "left 300ms",
        transitionDelay: "left 300ms",
        color: hasLightBackgroundColor(theme)
          ? theme.colors.fadedText60
          : theme.colors.bodyText,
        lineHeight: "0",

        [`@media print`]: {
          display: "none",
        },

        [`@media (max-width: ${theme.breakpoints.sm})`]: {
          display: "inline",
        },
      }
    }
  )

export const StyledSidebarNavSectionHeader = styled.header(({ theme }) => {
  return {
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.bold,
    color: getNavTextColor(theme, false),
    lineHeight: theme.lineHeights.small,
    paddingRight: theme.spacing.sm,
    marginLeft: getSidebarHorizontalSpacing(theme),
    marginRight: getSidebarHorizontalSpacing(theme),
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.twoXS,
  }
})

export const StyledViewButton = styled.button(({ theme }) => {
  return {
    fontSize: theme.fontSizes.sm,
    fontFamily: "inherit",
    lineHeight: theme.lineHeights.base,
    color: getNavTextColor(theme, true),
    backgroundColor: theme.colors.transparent,
    border: "none",
    borderRadius: theme.radii.default,
    marginTop: theme.spacing.twoXS,
    marginLeft: theme.spacing.lg,
    marginBottom: theme.spacing.none,
    marginRight: theme.spacing.none,
    padding: `${theme.spacing.threeXS} ${theme.spacing.sm}`,
    "&:hover, &:active, &:focus": {
      border: "none",
      outline: "none",
      boxShadow: "none",
    },
    "&:hover": {
      backgroundColor: theme.colors.darkenedBgMix25,
    },
  }
})

export const StyledSidebarNavSeparator = styled.div(({ theme }) => ({
  paddingTop: theme.spacing.lg,
  borderBottom: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
  marginRight: getSidebarHorizontalSpacing(theme),
  marginLeft: getSidebarHorizontalSpacing(theme),
}))
