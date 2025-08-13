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

import { MouseEvent, ReactNode } from "react"

import styled, { CSSObject } from "@emotion/styled"
import { darken, transparentize } from "color2k"

import { EmotionTheme } from "~lib/theme"

export enum BaseButtonKind {
  PRIMARY = "primary",
  SECONDARY = "secondary",
  TERTIARY = "tertiary",
  GHOST = "ghost",
  BORDERLESS_ICON = "borderlessIcon",
  BORDERLESS_ICON_ACTIVE = "borderlessIconActive",
  MINIMAL = "minimal",
  PRIMARY_FORM_SUBMIT = "primaryFormSubmit",
  SECONDARY_FORM_SUBMIT = "secondaryFormSubmit",
  TERTIARY_FORM_SUBMIT = "tertiaryFormSubmit",
  HEADER_BUTTON = "header",
  HEADER_NO_PADDING = "headerNoPadding",
  ELEMENT_TOOLBAR = "elementToolbar",
  PILLS = "pills",
  PILLS_ACTIVE = "pillsActive",
  SEGMENTED_CONTROL = "segmented_control",
  SEGMENTED_CONTROL_ACTIVE = "segmented_controlActive",
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  onClick?: (event: MouseEvent<HTMLButtonElement>) => any
  disabled?: boolean
  // If true, the button should take up container's full width
  containerWidth?: boolean
  children: ReactNode
  autoFocus?: boolean
  "data-testid"?: string
  "aria-label"?: string
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
  ({ containerWidth, size, theme }) => {
    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: theme.fontWeights.normal,
      padding: `${theme.spacing.xs} ${theme.spacing.md}`,
      borderRadius: theme.radii.button,
      minHeight: theme.sizes.minElementHeight,
      margin: theme.spacing.none,
      lineHeight: theme.lineHeights.base,
      textTransform: "none",
      fontSize: "inherit",
      fontFamily: "inherit",
      color: "inherit",
      width: containerWidth ? "100%" : "auto",
      cursor: "pointer",
      userSelect: "none",
      "&:focus": {
        outline: "none",
      },
      "&:focus-visible": {
        // When focus-visible (e.g. if the button was focused via keyboard navigation)
        // we use the hover style of the respective button type (see below) and
        // additionally show a colored focus ring
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
  "&:hover, &:focus-visible": {
    backgroundColor: darken(theme.colors.primary, 0.15),
    borderColor: darken(theme.colors.primary, 0.15),
  },
  "&:active": {
    backgroundColor: theme.colors.primary,
    // Keep the border darker when clicked so that the button looks "pressed"
    borderColor: darken(theme.colors.primary, 0.15),
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
  "&:hover, &:focus-visible": {
    backgroundColor: theme.colors.darkenedBgMix15,
  },
  "&:active": {
    backgroundColor: theme.colors.darkenedBgMix25,
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
)<RequiredBaseButtonProps>(({ theme }) => {
  return {
    padding: theme.spacing.none,
    backgroundColor: theme.colors.transparent,
    border: "none",
    "&:hover, &:focus-visible": {
      color: theme.colors.primary,
    },
    "&:hover:not(:disabled), &:focus-visible:not(:disabled)": {
      // Also make colored text have the primary color on hover. Since text color is
      // applied as an inline style we need to use !important to override it.
      // Note that we're not doing this when disabled. We should probably do that as
      // well but we don't do it anywhere else.
      "span.stMarkdownColoredText": {
        color: "inherit !important",
      },
    },
    "&:active": {
      color: darken(theme.colors.primary, 0.25),
    },
    "&:disabled, &:disabled:hover, &:disabled:active": {
      backgroundColor: theme.colors.transparent,
      color: theme.colors.fadedText40,
      cursor: "not-allowed",
    },
  }
})

export const StyledGhostButton = styled(
  StyledBaseButton
)<RequiredBaseButtonProps>(({ theme }) => ({
  backgroundColor: theme.colors.transparent,
  border: `${theme.sizes.borderWidth} solid ${theme.colors.transparent}`,
  "&:hover, &:focus-visible": {
    borderColor: theme.colors.transparent,
    color: theme.colors.primary,
  },
  "&:active": {
    color: theme.colors.primary,
    borderColor: theme.colors.transparent,
    backgroundColor: theme.colors.transparent,
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
  padding: theme.spacing.none,
  "&:hover, &:active, &:focus-visible": {
    color: theme.colors.primary,
  },
  "&:disabled, &:disabled:hover, &:disabled:active": {
    color: theme.colors.fadedText40,
    cursor: "not-allowed",
  },
}))

export const StyledPrimaryFormSubmitButton =
  styled(StyledPrimaryButton)<RequiredBaseButtonProps>()

export const StyledSecondaryFormSubmitButton = styled(
  StyledSecondaryButton
)<RequiredBaseButtonProps>()

export const StyledTertiaryFormSubmitButton = styled(
  StyledTertiaryButton
)<RequiredBaseButtonProps>()

const StyledButtonGroupBaseButton = styled(
  StyledBaseButton
)<RequiredBaseButtonProps>(({ theme }) => {
  return {
    background: theme.colors.bgColor,
    color: theme.colors.text,
    border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
    fontSize: theme.fontSizes.sm,
    lineHeight: theme.lineHeights.base,
    fontWeight: theme.fontWeights.normal,
    height: theme.sizes.largeLogoHeight,
    minHeight: theme.sizes.largeLogoHeight,
    maxWidth: theme.sizes.contentMaxWidth,

    // show pills with long text in single line and use ellipsis for overflow
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",

    "&:hover, &:focus-visible": {
      backgroundColor: theme.colors.darkenedBgMix15,
    },
    "&:disabled, &:disabled:hover, &:disabled:active": {
      color: theme.colors.fadedText20,
      borderColor: theme.colors.borderColor,
      backgroundColor: theme.colors.bgColor,
      cursor: "not-allowed",
    },

    "& div": {
      textOverflow: "ellipsis",
      overflow: "hidden",
    },
    "& p": {
      textOverflow: "ellipsis",
      overflow: "hidden",
    },
  }
})

export const StyledPillsButton = styled(
  StyledButtonGroupBaseButton
)<RequiredBaseButtonProps>(({ theme, containerWidth }) => {
  return {
    borderRadius: theme.radii.full,
    padding: `${theme.spacing.twoXS} ${theme.spacing.md}`,
    // When containerWidth is true, the buttons will stretch to fill the container.
    flex: containerWidth ? "1 1 fit-content" : "",
  }
})

export const StyledPillsButtonActive = styled(
  StyledPillsButton
)<RequiredBaseButtonProps>(({ theme }) => {
  return {
    backgroundColor: transparentize(theme.colors.primary, 0.9),
    borderColor: theme.colors.primary,
    color: theme.colors.primary,
    "&:hover, &:focus-visible": {
      backgroundColor: transparentize(theme.colors.primary, 0.8),
      borderColor: theme.colors.primary,
      color: theme.colors.primary,
    },
  }
})

export const StyledSegmentedControlButton = styled(
  StyledButtonGroupBaseButton
)<RequiredBaseButtonProps>(({ theme, containerWidth }) => {
  return {
    padding: `${theme.spacing.twoXS} ${theme.spacing.lg}`,
    borderRadius: "0",
    // When containerWidth is true, the buttons will stretch to fill the container.
    flex: containerWidth ? "1 1 fit-content" : "",
    maxWidth: "100%",
    marginRight: `-${theme.sizes.borderWidth}`, // Add negative margin to overlap borders

    "&:first-child": {
      borderTopLeftRadius: theme.radii.button,
      borderBottomLeftRadius: theme.radii.button,
    },
    "&:last-child": {
      borderTopRightRadius: theme.radii.button,
      borderBottomRightRadius: theme.radii.button,
      marginRight: theme.spacing.none, // Reset margin for the last child
    },
    "&:focus-visible": {
      // Make sure the focus ring isn't below the previous/next button.
      zIndex: theme.zIndices.priority,
    },
  }
})

export const StyledSegmentedControlButtonActive = styled(
  StyledSegmentedControlButton
)<RequiredBaseButtonProps>(({ theme }) => {
  return {
    backgroundColor: transparentize(theme.colors.primary, 0.9),
    borderColor: theme.colors.primary,
    color: theme.colors.primary,
    zIndex: theme.zIndices.priority,
    "&:hover, &:focus-visible": {
      backgroundColor: transparentize(theme.colors.primary, 0.8),
    },
  }
})

export const StyledHeaderButton = styled(
  StyledBaseButton
)<RequiredBaseButtonProps>(({ theme }) => {
  return {
    backgroundColor: theme.colors.transparent,
    border: "none",
    padding: `0 ${theme.spacing.sm}`,
    fontSize: theme.fontSizes.sm,
    marginLeft: theme.spacing.threeXS,
    marginRight: theme.spacing.threeXS,

    lineHeight: theme.lineHeights.none,

    minWidth: theme.sizes.headerItemHeight,
    minHeight: theme.sizes.headerItemHeight,

    "&:focus": {
      outline: "none",
    },
    "&:focus-visible": {
      boxShadow: `0 0 0 0.2rem ${transparentize(theme.colors.gray90, 0.8)}`,
    },
    "&:hover": {
      backgroundColor: theme.colors.darkenedBgMix15,
    },
    "&:active": {
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

    // Keeps the buttons from stacking when in containerWidth mode.
    // These buttons should stay together and not stretch to fill the container.
    flex: "0 0 fit-content",

    border: "none",
    display: "flex",
    minHeight: "unset",

    "&:focus": {
      boxShadow: "none",
      outline: "none",
    },
    "&:hover": {
      color: theme.colors.bodyText,
    },
    "&:disabled, &:disabled:hover, &:disabled:active": {
      color: theme.colors.fadedText10,
      cursor: "not-allowed",

      // For image content
      img: {
        opacity: 0.4,
      },
    },
  }
})

export const StyledBorderlessIconButtonActive = styled(
  StyledBorderlessIconButton
)<RequiredBaseButtonProps>(({ theme }) => {
  return {
    color: theme.colors.bodyText,
    "&:disabled, &:disabled:hover, &:disabled:active": {
      color: theme.colors.fadedText40,
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

export const StyledElementToolbarButton = styled(
  StyledBaseButton
)<RequiredBaseButtonProps>(({ theme }) => {
  return {
    backgroundColor: theme.colors.transparent,
    border: "none",
    padding: theme.spacing.twoXS,
    fontSize: theme.fontSizes.twoSm,
    marginLeft: theme.spacing.none,
    marginRight: theme.spacing.none,
    display: "flex",
    gap: theme.spacing.xs,
    alignItems: "center",
    minHeight: "unset",
    // line height should be the same as the icon size
    lineHeight: theme.iconSizes.md,
    width: "auto",

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
      backgroundColor: theme.colors.darkenedBgMix15,
    },
    "&:active": {
      backgroundColor: theme.colors.darkenedBgMix25,
    },
    "&:disabled, &:disabled:hover, &:disabled:active": {
      backgroundColor: theme.colors.lightGray,
      borderColor: theme.colors.transparent,
      color: theme.colors.gray,
    },
  }
})

export const StyledButtonGroup = styled.div<{ containerWidth: boolean }>(
  ({ containerWidth }) => ({
    width: containerWidth ? "100%" : "auto",
  })
)
