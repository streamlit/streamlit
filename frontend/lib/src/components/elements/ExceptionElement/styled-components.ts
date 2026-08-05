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

export const StyledExceptionCopyButton = styled.button({
  all: "unset",
  font: "inherit",
  textDecoration: "underline",
})

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
 * contents` keeps the icon a direct flex child, so this adds no layout box.
 */
export const StyledSkillsInstallCalloutIcon = styled.span({
  display: "contents",
})

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
 * The callout's action: a text link-button that inherits the box's text color and
 * underline treatment — the same lightweight look as the error box's "Copy" /
 * "Ask …" links — so the CTA reads as a peer action rather than a filled button.
 */
export const StyledSkillsInstallCalloutButton = styled.button(({ theme }) => ({
  all: "unset",
  font: "inherit",
  cursor: "pointer",
  whiteSpace: "nowrap",
  color: "inherit",
  textDecoration: "underline",
  borderRadius: theme.radii.default,
  "&:focus-visible": {
    boxShadow: theme.shadows.focusRing,
  },
  "&:disabled": {
    cursor: "default",
    opacity: 0.7,
    textDecoration: "none",
  },
}))
