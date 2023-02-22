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
import { darken, transparentize } from "color2k"
import { Theme, hasLightBackgroundColor } from "src/theme"
import { IAlertTypeMessage, AlertTypeMessage } from "src/autogen/proto"

export enum Kind {
  PRIMARY = "primary",
  SECONDARY = "secondary",
  TERTIARY = "tertiary",
  LINK = "link",
  ICON = "icon",
  BORDERLESS_ICON = "borderlessIcon",
  MINIMAL = "minimal",
  PRIMARY_FORM_SUBMIT = "primaryFormSubmit",
  SECONDARY_FORM_SUBMIT = "secondaryFormSubmit",
  HEADER_BUTTON = "header",
  MODAL_ALERT_BUTTON = "modalAlert",
  HIDDEN_BUTTON = "hiddenButton",
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
  alertType?: IAlertTypeMessage | null
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
  color: theme.colors.white,
  border: `1px solid ${theme.colors.primary}`,
  "&:hover": {
    backgroundColor: darken(theme.colors.primary, 0.05),
  },
  "&:active": {
    backgroundColor: "transparent",
    color: theme.colors.primary,
  },
  "&:disabled, &:disabled:hover, &:disabled:active": {
    borderColor: theme.colors.fadedText10,
    backgroundColor: theme.colors.transparent,
    color: theme.colors.fadedText40,
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
    borderColor: theme.colors.fadedText10,
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

export const StyledPrimaryFormSubmitButton =
  styled(StyledPrimaryButton)<RequiredButtonProps>()

export const StyledSecondaryFormSubmitButton = styled(
  StyledSecondaryButton
)<RequiredButtonProps>()

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

export const StyledModalAlertButton = styled(
  StyledBaseButton
)<RequiredButtonProps>(({ size, theme, alertType }) => {
  let backgroundColor = theme.colors.lightenedBg05
  let border = `1px solid ${theme.colors.fadedText10}`
  let hoverBorderColor = theme.colors.primary
  let hoverColor = theme.colors.primary
  let activeColor = hasLightBackgroundColor(theme)
    ? theme.colors.fadedText80
    : theme.colors.white
  let activeBorderColor = border
  let activeBackgroundColor = backgroundColor
  let focusBorderColor = border
  let focusColor = activeColor
  let otherBorderColor = theme.colors.fadedText10
  let otherBackgroundColor = theme.colors.transparent
  let otherColor = theme.colors.fadedText40
  if (
    alertType &&
    alertType?.value === AlertTypeMessage.AlertTypeOptions.SUCCESS
  ) {
    backgroundColor = theme.colors.successBg
    border = `1px solid ${theme.colors.successBg}`
    hoverBorderColor = theme.colors.success
    hoverColor = theme.colors.success
    activeColor = theme.colors.success
    activeBorderColor = theme.colors.success
    activeBackgroundColor = theme.colors.successBg
    focusBorderColor = theme.colors.success
    focusColor = theme.colors.success
    otherBorderColor = theme.colors.successBg
    otherBackgroundColor = theme.colors.successBg
    otherColor = theme.colors.success
  } else if (
    alertType &&
    alertType?.value === AlertTypeMessage.AlertTypeOptions.WARNING
  ) {
    backgroundColor = theme.colors.warningBg
    border = `1px solid ${theme.colors.warningBg}`
    hoverBorderColor = theme.colors.warning
    hoverColor = theme.colors.warning
    activeColor = theme.colors.warning
    activeBorderColor = theme.colors.warning
    activeBackgroundColor = theme.colors.warningBg
    focusBorderColor = theme.colors.warning
    focusColor = theme.colors.warning
    otherBorderColor = theme.colors.warningBg
    otherBackgroundColor = theme.colors.warningBg
    otherColor = theme.colors.warning
  } else if (
    alertType &&
    alertType?.value === AlertTypeMessage.AlertTypeOptions.ERROR
  ) {
    backgroundColor = theme.colors.dangerBg
    border = `1px solid ${theme.colors.dangerBg}`
    hoverBorderColor = theme.colors.danger
    hoverColor = theme.colors.danger
    activeColor = theme.colors.danger
    activeBorderColor = theme.colors.danger
    activeBackgroundColor = theme.colors.dangerBg
    focusBorderColor = theme.colors.danger
    focusColor = theme.colors.danger
    otherBorderColor = theme.colors.dangerBg
    otherBackgroundColor = theme.colors.dangerBg
    otherColor = theme.colors.danger
  } else if (
    alertType &&
    alertType?.value === AlertTypeMessage.AlertTypeOptions.INFO
  ) {
    backgroundColor = theme.colors.infoBg
    border = `1px solid ${theme.colors.infoBg}`
    hoverBorderColor = theme.colors.info
    hoverColor = theme.colors.info
    activeColor = theme.colors.info
    activeBorderColor = theme.colors.info
    activeBackgroundColor = theme.colors.infoBg
    focusBorderColor = theme.colors.info
    focusColor = theme.colors.info
    otherBorderColor = theme.colors.infoBg
    otherBackgroundColor = theme.colors.infoBg
    otherColor = theme.colors.info
  }
  return {
    backgroundColor: backgroundColor,
    border: border,
    "&:hover": {
      borderColor: hoverBorderColor,
      color: hoverColor,
    },
    "&:active": {
      color: activeColor,
      borderColor: activeBorderColor,
      backgroundColor: activeBackgroundColor,
    },
    "&:focus": {
      boxShadow: "none",
    },
    "&:focus:not(:active)": {
      borderColor: focusBorderColor,
      color: focusColor,
      boxShadow: "none",
    },
    "&:disabled, &:disabled:hover, &:disabled:active": {
      borderColor: otherBorderColor,
      backgroundColor: otherBackgroundColor,
      color: otherColor,
      cursor: "not-allowed",
    },
  }
})

export const StyledHiddenButton = styled(
  StyledMinimalButton
)<RequiredButtonProps>(() => ({
  display: "none",
  visibility: "hidden",
}))
