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

// Menu divider with horizontal margins
export const StyledMenuDivider = styled.div(({ theme }) => ({
  borderTop: `${theme.sizes.menuBorderWidth} solid ${theme.colors.borderColor}`,
  marginLeft: theme.spacing.sm,
  marginRight: theme.spacing.sm,
  width: `calc(100% - ${theme.spacing.sm} - ${theme.spacing.sm})`,
}))

// Main menu container with proper padding
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

// Toggle row for menu items with a switch (like Auto rerun)
export interface StyledToggleRowProps {
  isHighlighted?: boolean
}

export const StyledToggleRow = styled.div<StyledToggleRowProps>(
  ({ theme, isHighlighted }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: `${theme.spacing.threeXS} ${theme.spacing.lg}`,
    cursor: "pointer",
    fontSize: theme.fontSizes.sm,
    color: theme.colors.bodyText,
    backgroundColor: isHighlighted
      ? theme.colors.darkenedBgMix15
      : theme.colors.transparent,

    "&:hover": {
      backgroundColor: theme.colors.darkenedBgMix15,
    },
  })
)

export const StyledToggleLabel = styled.span({
  flexGrow: 1,
})

// Version footer at the bottom of the menu
export const StyledVersionFooter = styled.div(({ theme }) => ({
  width: "100%",
  paddingLeft: theme.spacing.lg,
  paddingRight: theme.spacing.lg,
  fontSize: theme.fontSizes.twoSm,
  color: theme.colors.fadedText60,
  lineHeight: theme.lineHeights.menuItem,
}))

// Menu item row for click actions
export interface StyledMenuItemRowProps {
  isDisabled?: boolean
  isRecording?: boolean
}

export const StyledMenuItemRow = styled.div<StyledMenuItemRowProps>(
  ({ theme, isDisabled, isRecording }) => ({
    display: "flex",
    alignItems: "center",
    width: "100%",
    padding: `${theme.spacing.threeXS} ${theme.spacing.lg}`,
    cursor: isDisabled ? "not-allowed" : "pointer",
    fontSize: theme.fontSizes.sm,
    color: isDisabled
      ? theme.colors.fadedText60
      : isRecording
        ? theme.colors.redTextColor
        : theme.colors.bodyText,
    fontWeight: isRecording
      ? theme.fontWeights.bold
      : theme.fontWeights.normal,
    backgroundColor: theme.colors.transparent,
    lineHeight: theme.lineHeights.menuRow,

    "&:hover": {
      backgroundColor: isDisabled
        ? theme.colors.transparent
        : theme.colors.darkenedBgMix15,
    },
  })
)
