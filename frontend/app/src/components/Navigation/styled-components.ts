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
export const getNavTextColor = (
  theme: EmotionTheme,
  isActive: boolean,
  disabled: boolean = false,
  isTopNav?: boolean
): string => {
  if (disabled) {
    return theme.colors.fadedText40
  }

  if (isTopNav) {
    return theme.colors.bodyText
  }

  const isLightTheme = hasLightBackgroundColor(theme)

  if (isActive) {
    return theme.colors.bodyText
  }
  return isLightTheme
    ? transparentize(theme.colors.bodyText, 0.2)
    : transparentize(theme.colors.bodyText, 0.25)
}

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

export const StyledSidebarNavLinkListItem = styled.li(({ theme }) => ({
  marginTop: theme.spacing.threeXS,
  marginBottom: theme.spacing.threeXS,
}))

export interface StyledSidebarNavLinkProps {
  isActive: boolean
  disabled: boolean
  isTopNav?: boolean
  label?: string
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

      marginTop: theme.spacing.threeXS,
      marginBottom: theme.spacing.threeXS,
      lineHeight: theme.lineHeights.menuItem,

      color: getNavTextColor(theme, isActive),
      backgroundColor: isActive ? theme.colors.darkenedBgMix25 : "transparent",

      ...(disabled && {
        pointerEvents: "none",
      }),

      "&:hover": {
        backgroundColor: theme.colors.darkenedBgMix15,
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
  ({ isActive, theme, disabled, isTopNav, label }) => {
    return {
      color: getNavTextColor(theme, isActive, disabled, isTopNav),
      fontSize: theme.fontSizes.sm,
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      display: "table-cell",
      /* Pseudo-element to reserve bold width */
      "&::after": {
        content: `"${label}"` /* duplicate text */,
        fontWeight: theme.fontWeights.bold /* bold version */,
        visibility: "hidden" /* occupies space, not visible */,
        display: "block",
        width: "fit-content",
        height: 0,
      },
    }
  }
)

export const StyledChevronContainer = styled.div<{ isExpanded: boolean }>(
  ({ isExpanded }) => ({
    visibility: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
    transition: "transform 200ms ease",
    flexShrink: 0,
  })
)

export const StyledNavSectionHeaderText = styled.span(() => ({
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  minWidth: 0,
}))

export const StyledSidebarNavSectionHeader = styled.header<{
  isExpanded: boolean
}>(({ theme }) => {
  return {
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.semiBold,
    color: getNavTextColor(theme, false),
    lineHeight: theme.lineHeights.small,
    paddingRight: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.twoXS,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    cursor: "pointer",
    userSelect: "none",
    "&:hover": {
      [`& > ${StyledChevronContainer}`]: {
        visibility: "visible",
      },
    },
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
    marginLeft: theme.spacing.none,
    marginBottom: theme.spacing.none,
    marginRight: theme.spacing.none,
    padding: `${theme.spacing.threeXS} ${theme.spacing.sm}`,
    "&:hover, &:active, &:focus": {
      border: "none",
      outline: "none",
      boxShadow: "none",
    },
    "&:hover": {
      backgroundColor: theme.colors.darkenedBgMix15,
    },
  }
})

export const StyledSidebarNavSeparator = styled.div(({ theme }) => ({
  paddingTop: theme.spacing.lg,
  borderBottom: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
}))

export const StyledNavSectionContainer = styled.div(({ theme }) => ({
  "&:not(:first-child)": {
    marginTop: theme.spacing.lg,
  },
}))

// TopNav styled components
export const StyledOverflowContainer = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  width: "100%",
  flexShrink: 1,
  overflow: "hidden",
  padding: `0 ${theme.spacing.lg}`,
}))

interface StyledNavSectionProps {
  isOpen: boolean
}

export const StyledNavSection = styled.div<StyledNavSectionProps>(
  ({ theme, isOpen }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "relative",
    lineHeight: theme.lineHeights.menuItem,
    fontSize: theme.fontSizes.sm,
    padding: `0 ${theme.spacing.sm}`,
    color: getNavTextColor(theme, false, false, true),
    borderRadius: theme.radii.default,
    marginRight: theme.spacing.twoXS,
    "&:not(:first-of-type)": {
      marginLeft: theme.spacing.twoXS,
    },
    ...(isOpen ? { backgroundColor: theme.colors.darkenedBgMix25 } : {}),
    "&:hover": {
      backgroundColor: theme.colors.darkenedBgMix15,
    },
  })
)

export const StyledTopNavLinkContainer = styled.div(({ theme }) => ({
  marginRight: theme.spacing.twoXS,
  "&:not(:first-of-type)": {
    marginLeft: theme.spacing.twoXS,
  },
}))

// This is specifically for use in TopNavSection's popover menu
export const StyledTopNavSidebarNavLinkContainer = styled.div(({ theme }) => ({
  margin: `${theme.spacing.twoXS} ${theme.spacing.sm}`,
}))

export const StyledNavSectionText = styled.span(() => ({
  whiteSpace: "nowrap",
}))

export const StyledSectionName = styled.div(({ theme }) => ({
  marginLeft: theme.spacing.sm,
  marginTop: theme.spacing.sm,
  marginBottom: theme.spacing.sm,
}))

export const StyledPopoverContent = styled.div(({ theme }) => ({
  padding: `${theme.spacing.twoXS} 0`,
  fontSize: theme.fontSizes.sm,
}))

export const StyledIconContainer = styled.div(({ theme }) => ({
  marginLeft: theme.spacing.twoXS,
}))
