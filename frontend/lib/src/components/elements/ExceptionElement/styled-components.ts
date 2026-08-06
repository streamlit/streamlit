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
 *
 * The ring is `currentColor`, not `theme.shadows.focusRing`. That token is
 * `primary` at 50% alpha, tuned for the app background; on the red-tinted alert
 * these buttons live in it lands around 1.8:1 — under WCAG 1.4.11's 3:1 for a
 * focus indicator, i.e. a pink halo on a pink box. Inheriting the box's own text
 * colour gets the ~4.5:1 that colour is already chosen for, and follows the box
 * when its kind flips to success or a user re-themes the alert palette.
 */
export const StyledExceptionLinkButton = styled.button(({ theme }) => ({
  all: "unset",
  font: "inherit",
  cursor: "pointer",
  textDecoration: "underline",
  borderRadius: theme.radii.default,
  "&:focus-visible": {
    boxShadow: `0 0 0 ${theme.sizes.focusRingWidth} currentColor`,
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
 * `role="alert"` for error-kind content, which is assertive and wrong for an
 * unsolicited CTA. The polite live region lives on the copy instead (see
 * `StyledSkillsInstallCalloutText`).
 */
export const StyledSkillsInstallCallout = styled(StyledAlertContainer)(
  ({ theme }) => ({
    display: "flex",
    // Icon, copy and action stay on one row and never wrap onto flex lines of
    // their own. A long message — the server's install-failure reason embeds the
    // blocking target paths and runs to several lines — is absorbed by the copy
    // shrinking and wrapping internally, so the icon stays beside it and the
    // action stays at the end of the row. With `flex-wrap: wrap` the copy's
    // max-content width would instead push it to the next flex line, stranding
    // the icon above it and the action below.
    alignItems: "center",
    gap: theme.spacing.sm,
  })
)

/**
 * Wraps the callout's decorative sparkle/status icon so it is hidden from the
 * live region on the copy — otherwise the Material ligature (e.g.
 * "auto_awesome") would be announced as text before the message.
 *
 * A real flex item rather than `display: contents`, so `flex-shrink: 0` applies
 * to it: the copy beside it is the only thing that should give way when the
 * message is long.
 */
export const StyledSkillsInstallCalloutIcon = styled.span({
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
})

/**
 * The callout's copy, and the only item that flexes. It doesn't grow, so a short
 * message (idle / success) leaves the action sitting directly after the text
 * rather than pushed to the far edge like the error box's right-aligned Copy /
 * Ask links. It does shrink, which is what lets a long message wrap to several
 * lines inside the row instead of reflowing the row. Colour comes from the box's
 * kind, so the success confirmation needs no override here.
 *
 * This — not the whole box — carries `role="status"`. `status` implies
 * `aria-atomic="true"`, so a region spanning the action too would re-read the
 * entire pitch every time the button's label changed, just to convey one word.
 * Scoped to the copy, each transition announces only the sentence that changed.
 */
export const StyledSkillsInstallCalloutText = styled.div({
  flex: "0 1 auto",
  // Shrink past min-content if it must, breaking a long unbroken path rather
  // than overflowing the box on a narrow viewport.
  minWidth: 0,
  overflowWrap: "break-word",
})

/**
 * The callout's action. Built on the same link-button as the error box's own
 * `Copy` so the two stay visually identical by construction — the CTA reads as a
 * peer of those links rather than a filled button. Adds only what's specific to
 * this callout: it holds its width at the end of the row while the copy beside it
 * wraps, and its label never breaks mid-phrase.
 *
 * Unavailability is `aria-disabled`, never the `disabled` attribute: a disabled
 * button is not a focusable area, so the browser blurs it mid-interaction and
 * whoever just pressed Enter is dumped back to the top of the document — with
 * `Retry` (the same element, re-enabled) now unreachable without tabbing through
 * the whole page. Styling therefore keys off the attribute. No `opacity` here
 * either: WCAG only exempts *inactive* controls from contrast, and this one stays
 * active, so "Installing…" must stay legible. Losing the underline and the
 * pointer carries the state instead.
 */
export const StyledSkillsInstallCalloutButton = styled(
  StyledExceptionLinkButton
)({
  flexShrink: 0,
  whiteSpace: "nowrap",
  '&[aria-disabled="true"]': {
    cursor: "default",
    textDecoration: "none",
  },
})
