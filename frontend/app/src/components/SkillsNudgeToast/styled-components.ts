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
import styled from "@emotion/styled"

import { hasLightBackgroundColor } from "@streamlit/lib"

/**
 * Fixed, top-right notification injected by Streamlit (not the app author) to
 * recommend installing the bundled agent skills during local development.
 * Mirrors the elevation/spacing of the native ``st.toast`` so it feels native.
 */
export const StyledSkillsNudgeToast = styled.div(({ theme }) => {
  const slideIn = keyframes({
    from: { opacity: 0, transform: `translateX(${theme.spacing.threeXL})` },
    to: { opacity: 1, transform: "translateX(0)" },
  })
  return {
    position: "fixed",
    top: theme.spacing.xl,
    right: theme.spacing.xl,
    zIndex: theme.zIndices.toast,
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.lg,
    width: `calc(${theme.sizes.toastWidth} + ${theme.spacing.threeXL})`,
    maxWidth: `calc(100vw - 2 * ${theme.spacing.xl})`,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    paddingLeft: theme.spacing.twoXL,
    paddingRight: theme.spacing.twoXL,
    borderRadius: theme.radii.default,
    backgroundColor: theme.colors.bgColor,
    // Subtle elevation matching st.toast: darken slightly on light themes,
    // brighten on dark themes — no hard border needed.
    filter: hasLightBackgroundColor(theme)
      ? "brightness(0.98)"
      : "brightness(1.2)",
    color: theme.colors.bodyText,
    boxShadow: theme.shadows.popover,
    fontSize: theme.fontSizes.sm,
    lineHeight: theme.lineHeights.base,
    animation: `${slideIn} 0.2s ease-out`,
  }
})

export const StyledSkillsNudgeIcon = styled.div(({ theme }) => ({
  display: "flex",
  flexShrink: 0,
  marginTop: theme.spacing.threeXS,
}))

export const StyledSkillsNudgeContent = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  flex: 1,
  alignItems: "flex-start",
  gap: theme.spacing.sm,
  minWidth: theme.spacing.none,
}))

/** Close (✕) button in the top-right corner that snoozes the nudge. */
export const StyledSkillsNudgeClose = styled.button(({ theme }) => ({
  display: "flex",
  flexShrink: 0,
  alignSelf: "flex-start",
  alignItems: "center",
  justifyContent: "center",
  margin: theme.spacing.none,
  marginTop: theme.spacing.threeXS,
  padding: theme.spacing.none,
  border: "none",
  backgroundColor: theme.colors.transparent,
  color: theme.colors.fadedText40,
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
 * Quiet text-link button used for the secondary "Not right now" / "Don't show
 * again" dismiss actions, matching the native toast "view more" affordance.
 */
export const StyledSkillsNudgeLink = styled.button(({ theme }) => ({
  fontSize: theme.fontSizes.sm,
  lineHeight: theme.lineHeights.base,
  color: theme.colors.fadedText60,
  backgroundColor: theme.colors.transparent,
  fontFamily: "inherit",
  margin: theme.spacing.none,
  padding: theme.spacing.none,
  border: "none",
  boxShadow: "none",
  cursor: "pointer",
  whiteSpace: "nowrap",
  borderRadius: theme.radii.default,
  "&:hover, &:active": {
    border: "none",
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
    color: theme.colors.fadedText40,
    cursor: "not-allowed",
  },
}))
