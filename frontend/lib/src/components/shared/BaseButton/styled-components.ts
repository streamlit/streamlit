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

import { MouseEvent, ReactNode } from "react"

import styled, { CSSObject } from "@emotion/styled"
import { darken, transparentize } from "color2k"

import { EmotionTheme } from "@streamlit/lib/src/theme"

export enum BaseButtonKind {
  PRIMARY = "primary",
  SECONDARY = "secondary",
  TERTIARY = "tertiary",
  LINK = "link",
  ICON = "icon",
  ICON_ACTIVE = "iconActive",
  BORDERLESS_ICON = "borderlessIcon",
  BORDERLESS_ICON_ACTIVE = "borderlessIconActive",
  MINIMAL = "minimal",
  PRIMARY_FORM_SUBMIT = "primaryFormSubmit",
  SECONDARY_FORM_SUBMIT = "secondaryFormSubmit",
  HEADER_BUTTON = "header",
  HEADER_NO_PADDING = "headerNoPadding",
  ELEMENT_TOOLBAR = "elementToolbar",
}

export enum BaseButtonSize {
  XSMALL = "xsmall",
  SMALL = "small",
  MEDIUM = "medium",
  LARGE = "large",
}

export interface BaseButtonProps {
  kind: BaseButtonKind
  size?: BaseButtonSize
  onClick?: (event: MouseEvent<HTMLButtonElement>) => any
  disabled?: boolean
  // If true or number, the button should take up container's full width
  fluidWidth?: boolean | number
  children: ReactNode
  autoFocus?: boolean
}

type RequiredBaseButtonProps = Required<BaseButtonProps>

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

export const StyledBaseButton = styled.button<RequiredBaseButtonProps>(
  ({ fluidWidth, size, theme }) => {
    const buttonWidth =
      typeof fluidWidth == "number" ? `${fluidWidth}px` : "100%"

    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: theme.fontWeights.normal,
      padding: `${theme.spacing.xs} ${theme.spacing.md}`,
      borderRadius: theme.radii.default,
      minHeight: theme.sizes.minElementHeight,
      margin: 0,
      lineHeight: theme.lineHeights.base,
      color: "inherit",
      width: fluidWidth ? buttonWidth : "auto",
      userSelect: "none",
      "&:focus": {
        outline: "none",
      },
      "&:focus-visible": {
        boxShadow: `0 0 0 0.2rem ${transparentize(theme.colors.primary, 0.5)}`,
      },
      ...getSizeStyle(size, theme),
    }
  }
)

export const StyledPrimaryButton = styled(
  StyledBaseButton
)<RequiredBaseButtonProps>(({ theme }) => ({
  backgroundColor: theme.colors.primary,
  color: theme.colors.white,
  border: `${theme.sizes.borderWidth} solid ${theme.colors.primary}`,
  "&:hover": {
    backgroundColor: darken(theme.colors.primary, 0.05),
  },
  "&:active": {
    backgroundColor: "transparent",
    color: theme.colors.primary,
  },
  "&:disabled, &:disabled:hover, &:disabled:active": {
    borderColor: theme.colors.borderColor,
    backgroundColor: theme.colors.transparent,
    color: theme.colors.fadedText40,
    cursor: "not-allowed",
  },
}))

export const StyledSecondaryButton = styled(
  StyledBaseButton
)<RequiredBaseButtonProps>(({ theme }) => ({
  backgroundColor: theme.colors.lightenedBg05,
  border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
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
  "&:disabled, &:disabled:hover, &:disabled:active": {
    borderColor: theme.colors.borderColor,
    backgroundColor: theme.colors.transparent,
    color: theme.colors.fadedText40,
    cursor: "not-allowed",
  },
}))

export const StyledTertiaryButton = styled(
  StyledBaseButton
)<RequiredBaseButtonProps>(({ theme }) => ({
  backgroundColor: theme.colors.transparent,
  border: `${theme.sizes.borderWidth} solid ${theme.colors.transparent}`,
  "&:hover": {
    borderColor: theme.colors.transparent,
    color: theme.colors.primary,
  },
  "&:active": {
    color: theme.colors.primary,
    borderColor: theme.colors.transparent,
    backgroundColor: theme.colors.transparent,
  },
  "&:focus:not(:active)": {
    borderColor: theme.colors.transparent,
    color: theme.colors.primary,
  },
  "&:disabled, &:disabled:hover, &:disabled:active": {
    backgroundColor: theme.colors.lightGray,
    borderColor: theme.colors.transparent,
    color: theme.colors.gray,
  },
}))

export const StyledLinkButton = styled(
  StyledBaseButton
)<RequiredBaseButtonProps>(({ theme }) => ({
  backgroundColor: theme.colors.transparent,
  padding: 0,
  border: "none",
  color: theme.colors.primary,
  "&:hover": {
    textDecoration: "underline",
  },
  "&:active": {
    backgroundColor: theme.colors.transparent,
    color: theme.colors.primary,
    textDecoration: "underline",
  },
  "&:disabled, &:disabled:hover, &:disabled:active": {
    backgroundColor: theme.colors.lightGray,
    borderColor: theme.colors.transparent,
    color: theme.colors.gray,
  },
}))

export const StyledMinimalButton = styled(
  StyledBaseButton
)<RequiredBaseButtonProps>(({ theme }) => ({
  backgroundColor: theme.colors.transparent,
  border: "none",
  boxShadow: "none",
  padding: 0,
  "&:hover, &:active, &:focus-visible": {
    color: theme.colors.primary,
  },
}))

export const StyledPrimaryFormSubmitButton =
  styled(StyledPrimaryButton)<RequiredBaseButtonProps>()

export const StyledSecondaryFormSubmitButton = styled(
  StyledSecondaryButton
)<RequiredBaseButtonProps>()

export const StyledIconButton = styled(
  StyledBaseButton
)<RequiredBaseButtonProps>(({ size, theme }) => {
  const iconPadding: Record<BaseButtonSize, string> = {
    [BaseButtonSize.XSMALL]: theme.spacing.threeXS,
    [BaseButtonSize.SMALL]: theme.spacing.twoXS,
    [BaseButtonSize.MEDIUM]: theme.spacing.md,
    [BaseButtonSize.LARGE]: theme.spacing.lg,
  }
  return {
    backgroundColor: theme.colors.transparent,
    border: `${theme.sizes.borderWidth} solid ${theme.colors.transparent}`,
    padding: iconPadding[size],

    "&:hover": {
      borderColor: theme.colors.primary,
      color: theme.colors.primary,
    },
    "&:active": {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
      color: theme.colors.white,
    },
    "&:not(:active)": {
      boxShadow: "none",
    },
    "&:disabled, &:disabled:hover, &:disabled:active": {
      backgroundColor: theme.colors.lightGray,
      borderColor: theme.colors.transparent,
      color: theme.colors.gray,
    },
  }
})

export const StyledIconButtonActive = styled(
  StyledIconButton
)<RequiredBaseButtonProps>(({ theme }) => {
  return {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    color: theme.colors.white,
    "&:hover": {
      backgroundColor: theme.colors.transparent,
      borderColor: theme.colors.primary,
      color: theme.colors.primary,
    },
  }
})

export const StyledHeaderButton = styled(
  StyledBaseButton
)<RequiredBaseButtonProps>(({ theme }) => {
  return {
    backgroundColor: theme.colors.transparent,
    border: "none",
    padding: theme.spacing.sm,
    fontSize: theme.fontSizes.sm,
    marginLeft: theme.spacing.threeXS,
    marginRight: theme.spacing.threeXS,

    lineHeight: theme.lineHeights.none,

    // Override buttons min width and height, to ensure the hover state for icon buttons on the header is square
    minWidth: theme.spacing.threeXL,
    minHeight: theme.spacing.threeXL,

    "&:focus": {
      outline: "none",
    },
    "&:focus-visible": {
      boxShadow: `0 0 0 0.2rem ${transparentize(theme.colors.gray90, 0.8)}`,
    },
    "&:hover": {
      backgroundColor: theme.colors.darkenedBgMix25,
    },
    "&:disabled, &:disabled:hover, &:disabled:active": {
      backgroundColor: theme.colors.lightGray,
      borderColor: theme.colors.transparent,
      color: theme.colors.gray,
    },
  }
})

// Take out padding for this specific button, so we can ensure it's 32x32px like other buttons in Community Cloud
export const StyledHeaderNoPaddingButton = styled(
  StyledHeaderButton
)<RequiredBaseButtonProps>(() => {
  return {
    padding: 0,
  }
})

export const StyledBorderlessIconButton = styled(
  StyledBaseButton
)<RequiredBaseButtonProps>(({ size, theme }) => {
  const iconPadding: Record<BaseButtonSize, string> = {
    [BaseButtonSize.XSMALL]: theme.spacing.threeXS,
    [BaseButtonSize.SMALL]: theme.spacing.twoXS,
    [BaseButtonSize.MEDIUM]: theme.spacing.md,
    [BaseButtonSize.LARGE]: theme.spacing.lg,
  }

  return {
    backgroundColor: theme.colors.transparent,
    color: theme.colors.fadedText60,
    padding: iconPadding[size],
    marginLeft: theme.spacing.none,
    marginRight: theme.spacing.none,

    border: "none",
    display: "flex",
    minHeight: "unset",

    "&:focus": {
      boxShadow: "none",
      outline: "none",
    },
    "&:hover": {
      color: theme.colors.text,
    },
    "&:disabled, &:disabled:hover, &:disabled:active": {
      color: theme.colors.fadedText20,
    },
  }
})

export const StyledBorderlessIconButtonActive = styled(
  StyledBorderlessIconButton
)<RequiredBaseButtonProps>(({ theme }) => {
  return {
    color: theme.colors.bodyText,
  }
})

export const StyledTooltipNormal = styled.div(({ theme }) => ({
  display: "block",
  [`@media (max-width: ${theme.breakpoints.sm})`]: {
    display: "none",
  },
}))

export const StyledTooltipMobile = styled.div(({ theme }) => ({
  display: "none",
  [`@media (max-width: ${theme.breakpoints.sm})`]: {
    display: "block",
  },
}))

export const StyledElementToolbarButton = styled(
  StyledBaseButton
)<RequiredBaseButtonProps>(({ theme }) => {
  return {
    backgroundColor: theme.colors.transparent,
    border: "none",
    padding: theme.spacing.xs,
    fontSize: theme.fontSizes.twoSm,
    marginLeft: theme.spacing.none,
    marginRight: theme.spacing.none,
    display: "flex",
    gap: theme.spacing.xs,
    alignItems: "center",
    minHeight: "unset",
    // line height should be the same as the icon size
    lineHeight: theme.iconSizes.md,

    "&:focus": {
      outline: "none",
      border: "none",
      boxShadow: "none",
    },
    "&:focus-visible": {
      outline: "none",
      border: "none",
      boxShadow: "none",
      backgroundColor: theme.colors.darkenedBgMix25,
    },
    "&:hover": {
      backgroundColor: theme.colors.darkenedBgMix25,
    },
    "&:disabled, &:disabled:hover, &:disabled:active": {
      backgroundColor: theme.colors.lightGray,
      borderColor: theme.colors.transparent,
      color: theme.colors.gray,
    },
  }
})
