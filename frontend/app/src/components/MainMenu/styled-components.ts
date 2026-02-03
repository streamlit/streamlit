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
  borderTop: `${theme.sizes.menuBorderWidth} solid ${theme.colors.borderColor}`,
  marginLeft: theme.spacing.sm,
  marginRight: theme.spacing.sm,
  width: `calc(100% - ${theme.spacing.sm} - ${theme.spacing.sm})`,
}))

export const StyledMenuContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  paddingTop: theme.spacing.sm,
  paddingBottom: theme.spacing.xs,
  gap: theme.spacing.twoXS,

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

export const StyledMenuItemRow = styled.button<StyledMenuItemRowProps>(
  ({ theme, isRecording }) => ({
    position: "relative",
    display: "flex",
    alignItems: "center",
    width: "100%",
    padding: `${theme.spacing.threeXS} ${theme.spacing.lg}`,
    cursor: "pointer",
    fontSize: theme.fontSizes.sm,
    color: isRecording ? theme.colors.redTextColor : theme.colors.bodyText,
    fontWeight: isRecording
      ? theme.fontWeights.bold
      : theme.fontWeights.normal,
    lineHeight: theme.lineHeights.menuRow,
    border: "none",
    textAlign: "left",
    backgroundColor: theme.colors.transparent,
    borderRadius: theme.radii.default,
    overflow: "hidden",

    "&::before": {
      content: '""',
      position: "absolute",
      inset: `2px ${theme.spacing.sm}`,
      borderRadius: theme.radii.default,
      backgroundColor: theme.colors.darkenedBgMix15,
      opacity: 0,
      transition: "opacity 120ms ease",
      pointerEvents: "none",
      zIndex: theme.zIndices.base,
    },

    "&:hover::before, &:focus-visible::before, &:active::before": {
      opacity: 1,
    },

    "& > *": {
      position: "relative",
      zIndex: theme.zIndices.priority,
    },

    "&:focus-visible": {
      outline: "none",
      boxShadow: theme.shadows.focusRing,
    },

    "&:disabled": {
      backgroundColor: theme.colors.transparent,
      color: theme.colors.fadedText60,
      cursor: "not-allowed",
    },

    "&:disabled::before": {
      opacity: 0,
    },
  })
)

export const StyledMenuItemContent = styled.span(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  width: "100%",
  gap: theme.spacing.sm,
}))

export const StyledMenuItemLabel = styled.span({
  display: "inline-flex",
  alignItems: "center",
  minWidth: 0,
})

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

export interface StyledToggleRowProps {
  isDisabled?: boolean
}

export const StyledToggleRow = styled.div<StyledToggleRowProps>(
  ({ theme, isDisabled }) => ({
    width: "100%",
    color: isDisabled ? theme.colors.fadedText60 : theme.colors.bodyText,
  })
)

export const StyledVersionFooter = styled.div(({ theme }) => ({
  width: "100%",
  paddingLeft: theme.spacing.lg,
  paddingRight: theme.spacing.lg,
  fontSize: theme.fontSizes.twoSm,
  color: theme.colors.fadedText60,
  lineHeight: theme.lineHeights.menuItem,
}))

export const StyledThemeSwitcherContainer = styled.div(({ theme }) => ({
  display: "flex",
  width: "100%",
  gap: theme.spacing.threeXS,
  paddingLeft: theme.spacing.sm,
  paddingRight: theme.spacing.sm,
  paddingBottom: theme.spacing.twoXS,
}))

export interface StyledThemeButtonProps {
  isActive: boolean
  isDisabled: boolean
}

export const StyledThemeButton = styled.button<StyledThemeButtonProps>(
  ({ theme, isActive, isDisabled }) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.twoXS,
    flex: 1,
    padding: `0.375rem ${theme.spacing.sm}`,
    border: "none",
    borderRadius: theme.radii.default,
    backgroundColor: isActive
      ? theme.colors.darkenedBgMix25
      : theme.colors.transparent,
    color: isDisabled ? theme.colors.fadedText60 : theme.colors.bodyText,
    cursor: isDisabled ? "not-allowed" : "pointer",
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.normal,
    lineHeight: theme.lineHeights.none,
    transition: "all 150ms ease-out",
    minWidth: theme.sizes.themeSelectionButtonWidth,
    opacity: isDisabled ? 0.6 : 1,

    "&:hover": {
      backgroundColor: isDisabled
        ? theme.colors.transparent
        : isActive
          ? theme.colors.darkenedBgMix25
          : theme.colors.darkenedBgMix15,
    },
    "&:focus-visible": {
      outline: "none",
      boxShadow: theme.shadows.focusRing,
      zIndex: theme.zIndices.priority,
    },
  })
)

export const StyledIconWrapper = styled.span(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: theme.fontSizes.xl,
}))
