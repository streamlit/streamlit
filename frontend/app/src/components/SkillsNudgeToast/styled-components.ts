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

import { CSSObject } from "@emotion/react"
import styled from "@emotion/styled"

import { EmotionTheme } from "@streamlit/lib"

/**
 * Shared reset + interaction styles for the toast's borderless buttons (the
 * close ✕ and the secondary text link), so their hover/focus behavior stays
 * in sync.
 */
const nudgeButtonBase = (theme: EmotionTheme): CSSObject => ({
  margin: theme.spacing.none,
  padding: theme.spacing.none,
  border: "none",
  boxShadow: "none",
  backgroundColor: theme.colors.transparent,
  cursor: "pointer",
  borderRadius: theme.radii.default,
  "&:hover, &:active": {
    boxShadow: "none",
  },
  "&:hover": {
    color: theme.colors.bodyText,
  },
  "&:focus-visible": {
    outline: "none",
    boxShadow: theme.shadows.focusRingMuted,
  },
  "&:disabled": {
    cursor: "not-allowed",
  },
})

/** Close (✕) button in the top-right corner that snoozes the nudge. */
export const StyledSkillsNudgeClose = styled.button(({ theme }) => ({
  ...nudgeButtonBase(theme),
  display: "flex",
  flexShrink: 0,
  alignSelf: "flex-start",
  alignItems: "center",
  justifyContent: "center",
  marginTop: theme.spacing.threeXS,
  color: theme.colors.fadedText40,
}))

export const StyledSkillsNudgeHeading = styled.div(({ theme }) => ({
  fontWeight: theme.fontWeights.bold,
  color: theme.colors.bodyText,
}))

export const StyledSkillsNudgeBody = styled.div(({ theme }) => ({
  color: theme.colors.fadedText60,
}))

export const StyledSkillsNudgeError = styled.div(({ theme }) => ({
  color: theme.colors.redTextColor,
}))

export const StyledSkillsNudgeActions = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.lg,
  marginTop: theme.spacing.twoXS,
}))

/**
 * Quiet text-link button used for the secondary "Don't show again" dismiss
 * action, matching the native toast "view more" affordance.
 */
export const StyledSkillsNudgeLink = styled.button(({ theme }) => ({
  ...nudgeButtonBase(theme),
  fontSize: theme.fontSizes.sm,
  lineHeight: theme.lineHeights.base,
  fontFamily: "inherit",
  color: theme.colors.fadedText60,
  whiteSpace: "nowrap",
  "&:disabled": {
    color: theme.colors.fadedText40,
    cursor: "not-allowed",
  },
}))
