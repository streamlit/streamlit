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

import { EmotionTheme } from "@streamlit/lib"

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

export const StyledMenuContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: theme.spacing.xs,
  minWidth: theme.sizes.appMainMenu,
  padding: theme.spacing.sm,

  "@media print": {
    display: "none",
  },
}))

export const StyledMainMenuContainer = styled.span({
  lineHeight: "initial",
})

export interface StyledMenuItemRowProps {
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
  opacity: 0.6,
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

export interface StyledThemeRadioItemProps {
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
