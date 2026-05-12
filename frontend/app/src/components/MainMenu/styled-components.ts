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

import { keyframes } from "@emotion/react"
import { Keyframes } from "@emotion/serialize"
import styled from "@emotion/styled"

import { EmotionTheme, hasLightBackgroundColor } from "@streamlit/lib"

const recordingIndicatorPulse = (theme: EmotionTheme): Keyframes => keyframes`
0% {
  box-shadow: 0 0 ${theme.spacing.twoXS} ${theme.colors.redTextColor};
}
50% {
  box-shadow: 0 0 ${theme.spacing.sm} ${theme.spacing.twoXS} ${theme.colors.redTextColor};
}
100% {
  box-shadow: 0 0 ${theme.spacing.twoXS} ${theme.colors.redTextColor};
}`

export const StyledRecordingIndicator = styled.div(({ theme }) => ({
  position: "absolute",
  bottom: theme.spacing.lg,
  right: theme.spacing.sm,
  width: theme.spacing.sm,
  height: theme.spacing.sm,
  backgroundColor: theme.colors.redTextColor,
  borderRadius: theme.radii.full,
  boxShadow: `0 0 ${theme.spacing.twoXS} ${theme.colors.redTextColor}`,
  animation: `${recordingIndicatorPulse(theme)} 2s linear infinite`,
}))

export const StyledMenuDivider = styled.div(({ theme }) => ({
  borderTop: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
  width: "100%",
}))

/**
 * Outermost wrapper for the popover body (menu + optional footer).
 * Owns outer padding; the footer adds its own horizontal padding
 * so its content width contributes to the popover's intrinsic width
 * (matching the develop-branch layout where it was inside the container).
 */
export const StyledMenuPopoverContent = styled.div(({ theme }) => ({
  padding: theme.spacing.sm,
  minWidth: theme.sizes.appMainMenu,

  "@media print": {
    display: "none",
  },
}))

export const StyledMenuContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: theme.spacing.xs,
}))

export const StyledMainMenuContainer = styled.span({
  lineHeight: "initial",
})

interface StyledMenuItemRowProps {
  isRecording?: boolean
}

/**
 * Menu item button with hover highlight.
 */
export const StyledMenuItemRow = styled.button<StyledMenuItemRowProps>(
  ({ theme, isRecording }) => ({
    display: "flex",
    alignItems: "center",
    padding: `${theme.spacing.threeXS} ${theme.spacing.sm}`,
    border: "none",
    borderRadius: theme.radii.default,
    backgroundColor: theme.colors.transparent,
    cursor: "pointer",
    fontSize: theme.fontSizes.sm,
    // Need to explicitly set unit to rem to get 24px line height
    lineHeight: `${theme.lineHeights.small}rem`,
    textAlign: "left",
    color: isRecording ? theme.colors.redTextColor : theme.colors.bodyText,
    fontWeight: isRecording
      ? theme.fontWeights.bold
      : theme.fontWeights.normal,
    transition: "background-color 100ms ease",

    "&:hover, &:focus-visible": {
      backgroundColor: theme.colors.darkenedBgMix15,
    },

    "&:focus": {
      outline: "none",
    },

    "&:focus-visible": {
      boxShadow: theme.shadows.focusRingMuted,
    },

    '&[aria-disabled="true"]': {
      color: theme.colors.fadedText60,
      cursor: "not-allowed",
    },

    '&[aria-disabled="true"]:hover': {
      backgroundColor: theme.colors.transparent,
    },
  })
)

/**
 * Container for menu item content (label + shortcut).
 */
export const StyledMenuItemContent = styled.span(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  width: "100%",
  gap: theme.spacing.sm,
}))

/**
 * Menu item label text.
 */
export const StyledMenuItemLabel = styled.span({
  display: "inline-flex",
  alignItems: "center",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
})

/**
 * Keyboard shortcut indicator for menu items.
 */
export const StyledMenuItemShortcut = styled.kbd(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  whiteSpace: "nowrap",
  fontSize: theme.fontSizes.sm,
  opacity: theme.opacities.secondary,
  fontFamily: "inherit",
  lineHeight: theme.lineHeights.tight,
  letterSpacing: "0.01em",
}))

/**
 * Flex row container for theme radio buttons.
 * Uses the full menu width with equal spacing.
 */
export const StyledThemeRadioGroup = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  gap: theme.spacing.threeXS,
  width: "100%",
}))

interface StyledThemeRadioItemProps {
  isChecked: boolean
}

/**
 * Individual theme radio button with icon + label, flex column layout.
 * Active state uses darkenedBgMix25; hover uses darkenedBgMix15.
 */
export const StyledThemeRadioItem = styled.button<StyledThemeRadioItemProps>(
  ({ theme, isChecked }) => ({
    display: "flex",
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.twoXS,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    border: "none",
    borderRadius: theme.radii.default,
    backgroundColor: isChecked
      ? theme.colors.darkenedBgMix25
      : theme.colors.transparent,
    cursor: "pointer",
    fontSize: theme.fontSizes.sm,
    lineHeight: theme.lineHeights.tight,
    color: theme.colors.bodyText,
    transition: "background-color 100ms ease",

    "&:hover": {
      backgroundColor: isChecked
        ? theme.colors.darkenedBgMix25
        : theme.colors.darkenedBgMix15,
    },

    "&:focus": {
      outline: "none",
    },

    "&:focus-visible": {
      boxShadow: theme.shadows.focusRingMuted,
      backgroundColor: isChecked
        ? theme.colors.darkenedBgMix25
        : theme.colors.darkenedBgMix15,
    },
  })
)

/**
 * Wrapper for DynamicIcon sizing inside theme radio buttons.
 */
export const StyledThemeRadioIcon = styled.span({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
})

interface StyledToggleRowProps {
  isDisabled?: boolean
}

/**
 * Row container for a toggle switch inside the menu.
 * Owns focus, click handling, and hover/focus-visible styling
 * consistent with StyledMenuItemRow.
 */
export const StyledToggleRow = styled.button<StyledToggleRowProps>(
  ({ theme, isDisabled }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: `${theme.spacing.threeXS} ${theme.spacing.sm}`,
    border: "none",
    borderRadius: theme.radii.default,
    backgroundColor: theme.colors.transparent,
    cursor: isDisabled ? "not-allowed" : "pointer",
    color: isDisabled ? theme.colors.fadedText60 : theme.colors.bodyText,
    fontSize: theme.fontSizes.sm,
    lineHeight: `${theme.lineHeights.small}rem`,
    textAlign: "left",
    fontWeight: theme.fontWeights.normal,
    transition: "background-color 100ms ease",

    "&:hover": {
      backgroundColor: isDisabled
        ? theme.colors.transparent
        : theme.colors.darkenedBgMix15,
    },

    "&:focus": {
      outline: "none",
    },

    "&:focus-visible": {
      backgroundColor: theme.colors.darkenedBgMix15,
      boxShadow: theme.shadows.focusRingMuted,
    },
  })
)

interface StyledToggleProps {
  isChecked: boolean
  isDisabled?: boolean
}

export const StyledToggleTrack = styled.div<StyledToggleProps>(
  ({ theme, isChecked, isDisabled }) => ({
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
    width: `calc(2 * ${theme.sizes.checkbox})`,
    minWidth: `calc(2 * ${theme.sizes.checkbox})`,
    height: theme.sizes.checkbox,
    minHeight: theme.sizes.checkbox,
    padding: `0 ${theme.spacing.threeXS}`,
    borderRadius: theme.radii.full,
    backgroundColor:
      isChecked && !isDisabled
        ? theme.colors.primary
        : theme.colors.borderColor,
    transition: "background-color 100ms ease",
  })
)

export const StyledToggleKnob = styled.div<StyledToggleProps>(
  ({ theme, isChecked, isDisabled }) => {
    const lightTheme = hasLightBackgroundColor(theme)

    let backgroundColor = lightTheme
      ? theme.colors.bgColor
      : theme.colors.bodyText
    if (isDisabled) {
      backgroundColor = lightTheme ? theme.colors.gray70 : theme.colors.gray90
    }

    return {
      width: `calc(${theme.sizes.checkbox} - ${theme.spacing.twoXS})`,
      height: `calc(${theme.sizes.checkbox} - ${theme.spacing.twoXS})`,
      borderRadius: theme.radii.full,
      backgroundColor,
      transform: isChecked ? `translateX(${theme.sizes.checkbox})` : "none",
      transition: "transform 100ms ease, background-color 100ms ease",
    }
  }
)

/**
 * Footer container for the version string.
 * Lives outside the role="menu" container (as a sibling within the
 * popover) so the CopyButton is not an invalid child of role="menu".
 * Keyboard users reach the CopyButton via Tab; focus-lock keeps
 * focus within the popover.
 */
export const StyledMenuVersionFooter = styled.div(({ theme }) => ({
  paddingLeft: theme.spacing.sm,
  paddingRight: theme.spacing.sm,
}))

/**
 * Flex row for version text + copy button.
 * The copy button is hidden until hover/focus-within.
 */
export const StyledMenuVersionRow = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.sm,
  marginTop: theme.spacing.xs,

  ".stMenuVersionCopyButton": {
    opacity: 0,
    pointerEvents: "none",
    transition: "opacity 120ms ease",
  },

  "&:hover .stMenuVersionCopyButton, &:focus-within .stMenuVersionCopyButton":
    {
      opacity: 1,
      pointerEvents: "auto",
    },
}))

export const StyledMenuVersionText = styled.span(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  opacity: theme.opacities.secondary,
  fontSize: theme.fontSizes.twoSm,
  lineHeight: theme.lineHeights.menuItem,
  color: theme.colors.bodyText,
  whiteSpace: "nowrap",
}))
