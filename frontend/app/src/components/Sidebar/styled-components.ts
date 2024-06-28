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

import { transparentize } from "color2k"
import styled from "@emotion/styled"
import {
  getWrappedHeadersStyle,
  hasLightBackgroundColor,
} from "@streamlit/lib/src/theme/utils"
import { StyledMaterialIcon } from "@streamlit/lib/src/components/shared/Icon/Material/styled-components"

// Check for custom text color & handle colors in Sidebar/SidebarNav accordingly
const hasCustomTextColor = (theme: any): boolean => {
  const isLightTheme = hasLightBackgroundColor(theme)

  if (isLightTheme) {
    return theme.colors.bodyText !== theme.colors.gray85
  }
  return theme.colors.bodyText !== theme.colors.gray10
}

export interface StyledSidebarProps {
  isCollapsed: boolean
  adjustTop: boolean
  sidebarWidth: string
}

export const StyledSidebar = styled.section<StyledSidebarProps>(
  ({ theme, isCollapsed, adjustTop, sidebarWidth }) => {
    const minWidth = isCollapsed ? 0 : Math.min(244, window.innerWidth)
    const maxWidth = isCollapsed ? 0 : Math.min(550, window.innerWidth * 0.9)

    return {
      // Nudge the sidebar by 2px so the header decoration doesn't go below it
      position: "relative",
      top: adjustTop ? "2px" : "0px",
      backgroundColor: theme.colors.bgColor,
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

export const StyledSidebarNavContainer = styled.div(() => ({
  position: "relative",
}))

export interface StyledSidebarNavItemsProps {
  isExpanded: boolean
  hasSidebarElements: boolean
}

export const StyledSidebarNavItems = styled.ul<StyledSidebarNavItemsProps>(
  ({ isExpanded, hasSidebarElements }) => {
    return {
      maxHeight: isExpanded ? "none" : "30vh",
      listStyle: "none",
      overflow:
        isExpanded && hasSidebarElements ? ["auto", "overlay"] : "hidden",
      margin: 0,
      paddingBottom: "0.125rem",
    }
  }
)

export const StyledSidebarNavLinkContainer = styled.div(() => ({
  display: "flex",
  flexDirection: "column",
}))

const generateNavLinkColors = (
  theme: any,
  isCustomTextColor: boolean
): string[] => {
  const isLightTheme = hasLightBackgroundColor(theme)

  // Theme defaults
  let color = isLightTheme ? theme.colors.gray80 : theme.colors.gray40
  let activeSvgColor = isLightTheme ? theme.colors.gray90 : theme.colors.gray10
  let svgColor = isLightTheme ? theme.colors.gray60 : theme.colors.gray70
  let activeBgColor = theme.colors.darkenedBgMix25

  if (isCustomTextColor) {
    color = theme.colors.bodyText
    activeSvgColor = theme.colors.bodyText
    svgColor = theme.colors.fadedText60
  }

  return [color, svgColor, activeSvgColor, activeBgColor]
}
export interface StyledSidebarNavLinkProps {
  isActive: boolean
}

export const StyledSidebarNavLink = styled.a<StyledSidebarNavLinkProps>(
  ({ isActive, theme }) => {
    const [color, svgColor, activeSvgColor, activeBgColor] =
      generateNavLinkColors(theme, hasCustomTextColor(theme))

    const defaultPageLinkStyles = {
      textDecoration: "none",
      fontWeight: isActive ? 600 : 400,
    }

    return {
      ...defaultPageLinkStyles,
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      borderRadius: theme.radii.lg,

      paddingLeft: theme.spacing.sm,
      paddingRight: theme.spacing.sm,
      marginLeft: theme.spacing.twoXL,
      marginRight: theme.spacing.twoXL,
      marginTop: theme.spacing.threeXS,
      marginBottom: theme.spacing.threeXS,
      lineHeight: theme.lineHeights.menuItem,

      color: color,
      backgroundColor: isActive ? activeBgColor : "transparent",

      [StyledMaterialIcon as any]: {
        color: isActive ? activeSvgColor : svgColor,
        fontWeight: isActive ? 600 : 400,
      },

      "&:hover": {
        backgroundColor: transparentize(activeBgColor, 0.1),
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

const generateNavLinkTextColors = (
  theme: any,
  isCustomTextColor: boolean
): string[] => {
  const isLightTheme = hasLightBackgroundColor(theme)

  // Streamlit Theme Defaults
  let defaultColor = isLightTheme ? theme.colors.gray80 : theme.colors.gray50
  let activeColor = isLightTheme ? theme.colors.gray90 : theme.colors.gray10
  if (isCustomTextColor) {
    defaultColor = transparentize(theme.colors.bodyText, 0.2)
    activeColor = theme.colors.bodyText
  }

  return [defaultColor, activeColor]
}

export const StyledSidebarLinkText = styled.span<StyledSidebarNavLinkProps>(
  ({ isActive, theme }) => {
    const [defaultColor, activeColor] = generateNavLinkTextColors(
      theme,
      hasCustomTextColor(theme)
    )

    return {
      color: isActive ? activeColor : defaultColor,
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
    paddingLeft: theme.spacing.twoXL,
    paddingRight: theme.spacing.twoXL,

    ...getWrappedHeadersStyle(theme),
  }))

export const StyledSidebarContent = styled.div(({}) => ({
  position: "relative",
  height: "100%",
  width: "100%",
  overflow: ["auto", "overlay"],
}))

export const StyledResizeHandle = styled.div(({ theme }) => ({
  position: "absolute",
  width: "8px",
  height: "100%",
  cursor: "col-resize",
  zIndex: theme.zIndices.sidebarMobile,

  "&:hover": {
    backgroundImage: `linear-gradient(to right, transparent 20%, ${theme.colors.fadedText20} 28%, transparent 36%)`,
  },
}))

export const StyledSidebarHeaderContainer = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "start",
  padding: `${theme.spacing.xl} ${theme.spacing.twoXL} ${theme.spacing.twoXL} ${theme.spacing.twoXL}`,
}))

export const StyledLogoLink = styled.a(({}) => ({
  "&:hover": {
    opacity: "0.7",
  },
}))

export const StyledLogo = styled.img(({ theme }) => ({
  height: "1.5rem",
  maxWidth: "15rem",
  margin: "0.25rem 0.5rem 0.25rem 0",
  zIndex: theme.zIndices.header,
}))

export const StyledNoLogoSpacer = styled.div(({}) => ({
  height: "2.0rem",
}))

export interface StyledSidebarOpenContainerProps {
  chevronDownshift: number
  isCollapsed: boolean
}

export const StyledSidebarOpenContainer =
  styled.div<StyledSidebarOpenContainerProps>(
    ({ theme, chevronDownshift, isCollapsed }) => ({
      position: "fixed",
      top: chevronDownshift ? `${chevronDownshift}px` : theme.spacing.xl,
      left: isCollapsed ? theme.spacing.twoXL : `-${theme.spacing.twoXL}`,
      zIndex: theme.zIndices.header,
      display: "flex",
      justifyContent: "center",
      alignItems: "start",

      transition: "left 300ms",
      transitionDelay: "left 300ms",

      [`@media print`]: {
        position: "static",
      },
    })
  )

export const StyledOpenSidebarButton = styled.div(({ theme }) => {
  const isLightTheme = hasLightBackgroundColor(theme)
  const isCustomTextColor = hasCustomTextColor(theme)

  return {
    zIndex: theme.zIndices.header,
    color:
      isLightTheme && !isCustomTextColor
        ? theme.colors.gray70
        : theme.colors.bodyText,

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
      const isLightTheme = hasLightBackgroundColor(theme)
      const isCustomTextColor = hasCustomTextColor(theme)

      return {
        display: showSidebarCollapse ? "inline" : "none",
        transition: "left 300ms",
        transitionDelay: "left 300ms",
        color:
          isLightTheme && !isCustomTextColor
            ? theme.colors.gray70
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

const generateNavSectionHeaderColor = (
  theme: any,
  isCustomTextColor: boolean
): string => {
  const isLightTheme = hasLightBackgroundColor(theme)

  // Streamlit theme defaults
  let navHeaderColor = isLightTheme ? theme.colors.gray80 : theme.colors.gray60
  if (isCustomTextColor) {
    navHeaderColor = transparentize(theme.colors.bodyText, 0.15)
  }

  return navHeaderColor
}

export const StyledSidebarNavSectionHeader = styled.header(({ theme }) => {
  const navHeaderColor = generateNavSectionHeaderColor(
    theme,
    hasCustomTextColor(theme)
  )

  return {
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.bold,
    color: navHeaderColor,
    lineHeight: theme.lineHeights.table,
    paddingRight: theme.spacing.sm,
    marginLeft: theme.spacing.twoXL,
    marginRight: theme.spacing.twoXL,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.twoXS,
  }
})

export const StyledViewButton = styled.button(({ theme }) => {
  const isLightTheme = hasLightBackgroundColor(theme)
  const isCustomTextColor = hasCustomTextColor(theme)

  let viewButtonColor = isLightTheme
    ? theme.colors.gray90
    : theme.colors.gray10
  if (isCustomTextColor) {
    viewButtonColor = theme.colors.bodyText
  }

  return {
    fontSize: theme.fontSizes.sm,
    lineHeight: "1.4rem",
    color: viewButtonColor,
    backgroundColor: theme.colors.transparent,
    border: "none",
    borderRadius: theme.radii.lg,
    marginTop: theme.spacing.twoXS,
    marginLeft: theme.spacing.xl,
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
  borderBottom: `1px solid ${theme.colors.fadedText10}`,
}))
