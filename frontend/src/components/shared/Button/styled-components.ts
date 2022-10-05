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

import { MouseEvent, ReactNode } from "react"
import styled, { CSSObject } from "@emotion/styled"
import { transparentize } from "color2k"
import { Theme } from "src/theme"

export enum Kind {
  PRIMARY = "primary",
  SECONDARY = "secondary",
  TERTIARY = "tertiary",
  LINK = "link",
  ICON = "icon",
  BORDERLESS_ICON = "borderlessIcon",
  MINIMAL = "minimal",
  FORM_SUBMIT = "formSubmit",
  HEADER_BUTTON = "header",
}

export enum Size {
  XSMALL = "xsmall",
  SMALL = "small",
  MEDIUM = "medium",
  LARGE = "large",
}

export interface ButtonProps {
  kind: Kind
  size?: Size
  onClick?: (event: MouseEvent<HTMLButtonElement>) => any
  disabled?: boolean
  fluidWidth?: boolean
  children: ReactNode
  autoFocus?: boolean
}

type RequiredButtonProps = Required<ButtonProps>

function getSizeStyle(size: Size, theme: Theme): CSSObject {
  switch (size) {
    case Size.XSMALL:
      return {
        padding: `${theme.spacing.twoXS} ${theme.spacing.sm}`,
        fontSize: theme.fontSizes.sm,
      }
    case Size.SMALL:
      return {
        padding: `${theme.spacing.twoXS} ${theme.spacing.md}`,
      }
    case Size.LARGE:
      return {
        padding: `${theme.spacing.md} ${theme.spacing.md}`,
      }
    default:
      return {
        padding: `${theme.spacing.xs} ${theme.spacing.md}`,
      }
  }
}

export const StyledBaseButton = styled.button<RequiredButtonProps>(
  ({ fluidWidth, size, theme }) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: theme.fontWeights.normal,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.radii.md,
    margin: 0,
    lineHeight: theme.lineHeights.base,
    color: "inherit",
    width: fluidWidth ? "100%" : "auto",
    userSelect: "none",
    "&:focus": {
      boxShadow: `0 0 0 0.2rem ${transparentize(theme.colors.primary, 0.5)}`,
      outline: "none",
    },
    ...getSizeStyle(size, theme),
  })
)

export const StyledPrimaryButton = styled(
  StyledBaseButton
)<RequiredButtonProps>(({ theme }) => ({
  backgroundColor: theme.colors.primary,
  color: theme.colors.lightenedBg05,
  border: `1px solid ${theme.colors.fadedText40}`,
  "&:hover": {
    borderColor: theme.colors.fadedText60,
    color: theme.colors.black,
    opacity: "75%",
  },
  "&:active": {
    // color: theme.colors.white,
    // borderColor: theme.colors.fadedText60,
    // backgroundColor: theme.colors.fadedText60,
  },
  "&:focus:not(:active)": {
    borderColor: theme.colors.fadedText60,
    color: theme.colors.black,
    opacity: "75%",
  },
  "&:disabled, &:disabled:hover, &:disabled:active": {
    borderColor: theme.colors.fadedText40,
    backgroundColor: theme.colors.primary,
    color: theme.colors.black,
    opacity: "30%",
    cursor: "not-allowed",
  },
}))

export const StyledSecondaryButton = styled(
  StyledBaseButton
)<RequiredButtonProps>(({ theme }) => ({
  backgroundColor: theme.colors.lightenedBg05,
  border: `1px solid ${theme.colors.fadedText10}`,
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
    borderColor: theme.colors.fadedText40,
    backgroundColor: theme.colors.transparent,
    color: theme.colors.fadedText40,
    cursor: "not-allowed",
  },
}))

export const StyledTertiaryButton = styled(
  StyledBaseButton
)<RequiredButtonProps>(({ theme }) => ({
  backgroundColor: theme.colors.transparent,
  border: `1px solid ${theme.colors.transparent}`,
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

export const StyledLinkButton = styled(StyledBaseButton)<RequiredButtonProps>(
  ({ theme }) => ({
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
  })
)

export const StyledMinimalButton = styled(
  StyledBaseButton
)<RequiredButtonProps>(({ theme }) => ({
  backgroundColor: theme.colors.transparent,
  border: "none",
  boxShadow: "none",
  padding: 0,
  "&:hover, &:active, &:focus": {
    color: theme.colors.primary,
  },
}))

export const StyledFormSubmitButton =
  styled(StyledPrimaryButton)<RequiredButtonProps>()

export const StyledIconButton = styled(StyledBaseButton)<RequiredButtonProps>(
  ({ size, theme }) => {
    const iconPadding: Record<Size, string> = {
      [Size.XSMALL]: theme.spacing.threeXS,
      [Size.SMALL]: theme.spacing.twoXS,
      [Size.MEDIUM]: theme.spacing.md,
      [Size.LARGE]: theme.spacing.lg,
    }
    return {
      backgroundColor: theme.colors.transparent,
      border: `1px solid ${theme.colors.transparent}`,
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
  }
)

export const StyledHeaderButton = styled(
  StyledBaseButton
)<RequiredButtonProps>(({ theme }) => {
  return {
    backgroundColor: theme.colors.transparent,
    border: "none",
    padding: theme.spacing.sm,
    fontSize: theme.fontSizes.sm,
    marginLeft: theme.spacing.threeXS,
    marginRight: theme.spacing.threeXS,
    lineHeight: 1,

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

export const StyledBorderlessIconButton = styled(
  StyledBaseButton
)<RequiredButtonProps>(({ size, theme }) => {
  const iconPadding: Record<Size, string> = {
    [Size.XSMALL]: theme.spacing.threeXS,
    [Size.SMALL]: theme.spacing.twoXS,
    [Size.MEDIUM]: theme.spacing.md,
    [Size.LARGE]: theme.spacing.lg,
  }

  return {
    backgroundColor: theme.colors.transparent,
    border: `1px solid ${theme.colors.transparent}`,
    padding: iconPadding[size],

    "&:focus": {
      boxShadow: "none",
      outline: "none",
    },
    "&:disabled, &:disabled:hover, &:disabled:active": {
      backgroundColor: theme.colors.lightGray,
      borderColor: theme.colors.transparent,
      color: theme.colors.gray,
    },
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
