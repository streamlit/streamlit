/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { MouseEvent, ReactNode } from "react"

import styled, { CSSObject } from "@emotion/styled"

import {
  BaseButtonKind,
  BaseButtonSize,
} from "~lib/components/shared/BaseButton/styled-components"
import type { EmotionTheme } from "~lib/theme/types"

export { BaseButtonKind, BaseButtonSize }

function getThemeVars(theme: EmotionTheme): EmotionTheme["vars"] {
  return theme.vars
}

export interface BaseLinkButtonProps {
  kind:
    | BaseButtonKind.PRIMARY
    | BaseButtonKind.SECONDARY
    | BaseButtonKind.TERTIARY
  size?: BaseButtonSize
  disabled?: boolean
  // If true, the button should take up container's full width
  containerWidth?: boolean
  children: ReactNode
  autoFocus?: boolean
  href: string
  target: string
  rel: string
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void
}

type RequiredBaseLinkButtonProps = Required<BaseLinkButtonProps>

function getSizeStyle(size: BaseButtonSize, theme: EmotionTheme): CSSObject {
  switch (size) {
    case BaseButtonSize.XSMALL:
      return {
        padding: `${theme.spacing.twoXS} ${theme.spacing.sm}`,
        fontSize: theme.fontSizes.sm,
      }
    case BaseButtonSize.SMALL:
      return {
        padding: `${theme.spacing.twoXS} ${theme.spacing.md}`,
      }
    case BaseButtonSize.LARGE:
      return {
        padding: `${theme.spacing.md} ${theme.spacing.md}`,
      }
    default:
      return {
        padding: `${theme.spacing.xs} ${theme.spacing.md}`,
      }
  }
}

const StyledBaseLinkButton = styled.a<RequiredBaseLinkButtonProps>(
  ({ containerWidth, size, theme }) => {
    const vars = getThemeVars(theme)

    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: theme.fontWeights.normal,
      padding: `${theme.spacing.xs} ${theme.spacing.md}`,
      borderRadius: theme.radii.button,
      minHeight: theme.sizes.minElementHeight,
      margin: 0,
      lineHeight: theme.lineHeights.base,
      color: vars.colors.primary,
      textDecoration: "none",
      width: containerWidth ? "100%" : "auto",
      userSelect: "none",
      "&:visited": {
        color: vars.colors.primary,
      },
      "&:focus": {
        outline: "none",
      },
      "&:focus-visible": {
        // When focus-visible (e.g. if the button was focused via keyboard navigation)
        // we use the hover style of the respective button type (see below) and
        // additionally show a colored focus ring
        boxShadow: vars.shadows.focusRing,
      },
      "&:hover": {
        textDecoration: "none",
      },
      "&:active": {
        textDecoration: "none",
      },
      ...getSizeStyle(size, theme),
    }
  }
)

export const StyledPrimaryLinkButton = styled(
  StyledBaseLinkButton
)<RequiredBaseLinkButtonProps>(({ theme }) => ({
  backgroundColor: getThemeVars(theme).colors.primary,
  color: getThemeVars(theme).colors.white,
  border: `${theme.sizes.borderWidth} solid ${getThemeVars(theme).colors.primary}`,
  "&:hover, &:focus-visible": {
    backgroundColor: getThemeVars(theme).colors.primaryHover,
    borderColor: getThemeVars(theme).colors.primaryHover,
  },
  "&:active": {
    backgroundColor: getThemeVars(theme).colors.primary,
    // Keep the border darker when clicked so that the button looks "pressed"
    borderColor: getThemeVars(theme).colors.primaryHover,
  },
  "&:visited:not(:active)": {
    color: getThemeVars(theme).colors.white,
  },
  "&[disabled], &[disabled]:hover, &[disabled]:active, &[disabled]:visited": {
    borderColor: getThemeVars(theme).colors.borderColor,
    backgroundColor: getThemeVars(theme).colors.transparent,
    color: getThemeVars(theme).colors.fadedText40,
    cursor: "not-allowed",
  },
}))

export const StyledSecondaryLinkButton = styled(
  StyledBaseLinkButton
)<RequiredBaseLinkButtonProps>(({ theme }) => ({
  backgroundColor: getThemeVars(theme).colors.lightenedBg05,
  color: getThemeVars(theme).colors.bodyText,
  border: `${theme.sizes.borderWidth} solid ${getThemeVars(theme).colors.borderColor}`,
  "&:visited": {
    color: getThemeVars(theme).colors.bodyText,
  },
  "&:hover, &:focus-visible": {
    backgroundColor: getThemeVars(theme).colors.darkenedBgMix15,
  },
  "&:active": {
    backgroundColor: getThemeVars(theme).colors.darkenedBgMix25,
  },
  "&[disabled], &[disabled]:hover, &[disabled]:active": {
    borderColor: getThemeVars(theme).colors.borderColor,
    backgroundColor: getThemeVars(theme).colors.transparent,
    color: getThemeVars(theme).colors.fadedText40,
    cursor: "not-allowed",
  },
}))

export const StyledTertiaryLinkButton = styled(
  StyledBaseLinkButton
)<RequiredBaseLinkButtonProps>(({ theme }) => ({
  padding: theme.spacing.none,
  backgroundColor: getThemeVars(theme).colors.transparent,
  color: getThemeVars(theme).colors.bodyText,
  border: "none",
  "&:visited": {
    color: getThemeVars(theme).colors.bodyText,
  },
  "&:hover, &:focus-visible": {
    color: getThemeVars(theme).colors.primary,
  },
  "&:hover:not([disabled]), &:focus-visible:not([disabled])": {
    // Also make colored text have the primary color on hover. Since text color is
    // applied as an inline style we need to use !important to override it.
    // Note that we're not doing this when disabled. We should probably do that as
    // well but we don't do it anywhere else.
    "span.stMarkdownColoredText": {
      color: "inherit !important",
    },
  },
  "&:active": {
    color: getThemeVars(theme).colors.primaryEmphasis,
  },
  "&[disabled], &[disabled]:hover, &[disabled]:active": {
    backgroundColor: getThemeVars(theme).colors.transparent,
    color: getThemeVars(theme).colors.fadedText40,
    cursor: "not-allowed",
  },
}))
