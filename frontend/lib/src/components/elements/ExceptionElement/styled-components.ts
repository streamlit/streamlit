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

import styled from "@emotion/styled"

import { StyledAlertContainer } from "~lib/components/shared/AlertContainer/styled-components"

export const StyledStackTraceRow = styled.div(({ theme }) => ({
  marginTop: theme.spacing.sm,
  "&:first-of-type": {
    marginTop: 0,
  },
}))

export const StyledMessageType = styled.span(({ theme }) => ({
  fontWeight: theme.fontWeights.bold,
}))

export const StyledStackTraceTitle = styled.div(({ theme }) => ({
  marginBottom: theme.spacing.sm,
}))

/**
 * Preserve a visible right-side gutter in horizontally scrolled stack
 * traces. The inner `StyledCode` (rendered with `wrapLines={false}`) carries
 * its own `padding-right` via `codeBlockStyle`; wrapping it in this
 * `inline-block` + `minWidth: 100%` div guarantees the code cell always
 * stretches to at least the outer `<pre>` width so the gutter stays inside
 * the scrollable content. See issue #8206.
 */
export const StyledStackTraceContent = styled.div({
  display: "inline-block",
  minWidth: "100%",
})

export const StyledExceptionMessage = styled.div({
  wordWrap: "break-word",
})

export const StyledExceptionLinks = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.sm,
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing.md,
  justifyContent: "flex-end",
}))

/**
 * A button that reads as one of the error box's text links (Copy, and the
 * skills callout's action) rather than as a control: no chrome, inheriting the
 * surrounding font and color, underlined like the `Ask …` anchors beside it.
 *
 * `all: unset` also drops the focus outline, so the ring is restored explicitly
 * — see the a11y guidance in `frontend/AGENTS.md` about never removing a focus
 * indicator without replacing it.
 */
export const StyledExceptionLinkButton = styled.button(({ theme }) => ({
  all: "unset",
  font: "inherit",
  cursor: "pointer",
  textDecoration: "underline",
  borderRadius: theme.radii.default,
  "&:focus-visible": {
    boxShadow: theme.shadows.focusRing,
  },
}))

export const StyledExceptionWrapper = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.lg,
}))

/**
 * Stacks the error box and the optional "install Streamlit skills" callout that
 * follows it. `spacing.sm` is the design system's XSMALL gap step — one notch
 * tighter than the SMALL gap Streamlit puts between ordinary elements — so the
 * two boxes read as an attached pair (the callout belongs to *this* error) rather
 * than as two unrelated blocks. With no callout there is a single child and this
 * is a no-op.
 */
export const StyledExceptionWithCallout = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.sm,
}))

/**
 * The "install Streamlit skills" call-to-action shown below an error box in local
 * development: its own box, matching the error's tint, corner radius, and padding
 * because it reuses the same `StyledAlertContainer` the error box is built from.
 * Sharing that base is what keeps the two boxes aligned — the sparkle icon lines
 * up with the exception type above it, and a theme change moves both together.
 *
 * Deliberately *not* wrapped in `AlertContainer` itself: that component hardcodes
 * `role="alert"` for error-kind content, which is assertive and wrong for a
 * dismissable-by-success CTA. `SkillsInstallCallout` sets `role="status"` and
 * `aria-live="polite"` instead.
 */
export const StyledSkillsInstallCallout = styled(StyledAlertContainer)(
  ({ theme }) => ({
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  })
)

/**
 * Wraps the callout's decorative sparkle/status icon so it is hidden from the
 * `role="status"` / `aria-live` region — otherwise the Material ligature (e.g.
 * "auto_awesome") would be announced as text before the message. `display:
 * contents` keeps the icon a direct flex child of the group below, so this adds
 * no layout box.
 */
export const StyledSkillsInstallCalloutIcon = styled.span({
  display: "contents",
})

/**
 * Binds the icon to the copy so a wrapping message can't strand the icon on a
 * line of its own.
 *
 * The callout is a wrapping flex row of icon / copy / action. Flex breaks lines
 * on whole items using each item's max-content width, so a long message — the
 * server's install-failure reason embeds target paths and runs to several lines
 * — doesn't fit beside the icon and gets pushed to the next flex line, leaving
 * the icon alone above it. Grouping the two makes them one unbreakable item that
 * shrinks and wraps internally instead.
 */
export const StyledSkillsInstallCalloutMessage = styled.div(({ theme }) => ({
  display: "flex",
  // Matches the outer container, so single-line content (idle / success, and the
  // group's own inner alignment) renders exactly as it did before the grouping.
  alignItems: "center",
  gap: theme.spacing.sm,
  flex: "0 1 auto",
}))

/**
 * The callout's copy. Deliberately doesn't grow: the action sits directly after
 * the text (per the design), not pushed to the far edge like the error box's
 * right-aligned Copy / Ask links. Colour comes from the box's kind, so the
 * success confirmation needs no override here.
 */
export const StyledSkillsInstallCalloutText = styled.div({
  flex: "0 1 auto",
})

/**
 * The callout's action. Built on the same link-button as the error box's own
 * `Copy` so the two stay visually identical by construction — the CTA reads as a
 * peer of those links rather than a filled button. Adds only what's specific to
 * this callout: the label never wraps mid-phrase, and the disabled
 * ("Installing…") state stops looking clickable.
 */
export const StyledSkillsInstallCalloutButton = styled(
  StyledExceptionLinkButton
)({
  whiteSpace: "nowrap",
  "&:disabled": {
    cursor: "default",
    opacity: 0.7,
    textDecoration: "none",
  },
})
