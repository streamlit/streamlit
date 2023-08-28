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

import { ReactNode, MouseEvent } from "react"
import styled, { CSSObject } from "@emotion/styled"
import { darken, transparentize } from "color2k"
import { EmotionTheme } from "@streamlit/lib/src/theme"

import {
  BaseButtonKind,
  BaseButtonSize,
} from "@streamlit/lib/src/components/shared/BaseButton/styled-components"

export { BaseButtonKind, BaseButtonSize }

export interface BaseLinkButtonProps {
  kind: BaseButtonKind.PRIMARY | BaseButtonKind.SECONDARY
  size?: BaseButtonSize
  disabled?: boolean
  // If true or number, the button should take up container's full width
  fluidWidth?: boolean | number
  children: ReactNode
  autoFocus?: boolean
  href: string
  target: string
  rel: string
  onClick: (event: MouseEvent<HTMLAnchorElement>) => any
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

export const StyledBaseLinkButton = styled.a<RequiredBaseLinkButtonProps>(
  ({ fluidWidth, size, theme }) => {
    const buttonWidth =
      typeof fluidWidth == "number" ? `${fluidWidth}px` : "100%"

    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: theme.fontWeights.normal,
      padding: `${theme.spacing.xs} ${theme.spacing.md}`,
      borderRadius: theme.radii.lg,
      minHeight: "38.4px",
      margin: 0,
      lineHeight: theme.lineHeights.base,
      color: theme.colors.primary,
      textDecoration: "none",
      width: fluidWidth ? buttonWidth : "auto",
      userSelect: "none",
      "&:visited": {
        color: theme.colors.primary,
      },
      "&:focus": {
        outline: "none",
      },
      "&:focus-visible": {
        boxShadow: `0 0 0 0.2rem ${transparentize(theme.colors.primary, 0.5)}`,
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
  backgroundColor: theme.colors.primary,
  color: theme.colors.white,
  border: `1px solid ${theme.colors.primary}`,
  "&:hover": {
    backgroundColor: darken(theme.colors.primary, 0.05),
    color: theme.colors.white,
  },
  "&:active": {
    backgroundColor: "transparent",
    color: theme.colors.primary,
  },
  "&:visited:not(:active)": {
    color: theme.colors.white,
  },
  "&[disabled], &[disabled]:hover, &[disabled]:active, &[disabled]:visited": {
    borderColor: theme.colors.fadedText10,
    backgroundColor: theme.colors.transparent,
    color: theme.colors.fadedText40,
    cursor: "not-allowed",
  },
}))

export const StyledSecondaryLinkButton = styled(
  StyledBaseLinkButton
)<RequiredBaseLinkButtonProps>(({ theme }) => ({
  backgroundColor: theme.colors.lightenedBg05,
  color: theme.colors.bodyText,
  border: `1px solid ${theme.colors.fadedText10}`,
  "&:visited": {
    color: theme.colors.bodyText,
  },
  "&:hover": {
    borderColor: theme.colors.primary,
    color: theme.colors.primary,
  },
  "&:active": {
    color: theme.colors.white,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  "&:focus:not(:active)": {
    borderColor: theme.colors.primary,
    color: theme.colors.primary,
  },
  "&[disabled], &[disabled]:hover, &[disabled]:active": {
    borderColor: theme.colors.fadedText10,
    backgroundColor: theme.colors.transparent,
    color: theme.colors.fadedText40,
    cursor: "not-allowed",
  },
}))
