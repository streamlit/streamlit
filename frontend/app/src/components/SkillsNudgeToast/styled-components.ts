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

import { CSSObject, keyframes } from "@emotion/react"
import styled from "@emotion/styled"

import { EmotionTheme, getToastCardStyle } from "@streamlit/lib"

/**
 * Slide-in entrance for the nudge card. Defined at module scope (with a literal
 * start offset rather than a theme token) so the ``@keyframes`` block is
 * serialized once instead of recreated on every render/theme-eval of the card.
 */
const slideIn = keyframes({
  from: { opacity: 0, transform: "translateX(1.5rem)" },
  to: { opacity: 1, transform: "translateX(0)" },
})

/**
 * The standalone nudge card. Shares the toast surface's look via
 * ``getToastCardStyle`` (so it stays visually matched to ``st.toast`` without
 * being routed through the toast queue) and adds a slide-in entrance that
 * honors ``prefers-reduced-motion``. Positioning is supplied by the toast
 * column it is pinned to in ``AppView``.
 */
export const StyledSkillsNudgeCard = styled.div(({ theme }) => ({
  ...getToastCardStyle(theme),
  // Even 1rem padding on all sides. ``getToastCardStyle`` is tuned for the
  // ``st.toast`` surface (16px vertical / 24px horizontal); the nudge is its
  // own persistent card, so we square it off to a uniform 1rem per design.
  paddingLeft: theme.spacing.lg,
  paddingRight: theme.spacing.lg,
  animation: `${slideIn} 0.2s ease-out`,
  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
  },
}))

/**
 * Row holding the leading icon and the message column. Mirrors the toast's
 * inner wrapper but pins the icon to the *top* line of text instead of the
 * vertical center: the toast centers a single line against its icon, whereas
 * this card is multi-line (heading + body + actions), so centering would leave
 * the icon stranded next to the body. ``align-items: flex-start`` pins it to the
 * top so its optical center sits on the bold heading's first line.
 */
export const StyledSkillsNudgeContent = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "flex-start",
  gap: theme.spacing.lg,
  flex: 1,
  minWidth: 0,
}))

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

export const StyledSkillsNudgeActions = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.lg,
  marginTop: theme.spacing.twoXS,
  // Match the deploy dialog's buttons: stock BaseButton (default size), which
  // renders against the dialog's 16px text — the card body is 14px, so set the
  // action row to 16px so the buttons look identical to the deploy dialog.
  fontSize: theme.fontSizes.md,
}))
