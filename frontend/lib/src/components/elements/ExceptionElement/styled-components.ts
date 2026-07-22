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

// This extra div makes sure that we also have a padding on the right side of the stack
// trace when scrolled to the right.
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
 * Inline "install Streamlit skills" call-to-action shown at the foot of an error
 * box in local development. It lives *inside* the error's AlertContainer and
 * inherits its tint and text color (no separate band, wash, or accent stripe),
 * so it reads as one more line on the error — a peer of the Copy / Ask links —
 * rather than a panel that overpowers them.
 */
export const StyledSkillsInstallCallout = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing.sm,
  color: "inherit",
}))

export const StyledSkillsInstallCalloutText = styled.div({
  // Don't grow: the action sits directly after the copy (per the design pass),
  // not pushed to the far edge like the right-aligned Copy / Ask links.
  flex: "0 1 auto",
})

/**
 * The callout's action: a text link-button that inherits the error box's text
 * color and underline treatment — the same lightweight look as the sibling
 * "Copy" / "Ask …" links — so the CTA reads as a peer action.
 */
export const StyledSkillsInstallCalloutButton = styled.button(({ theme }) => ({
  all: "unset",
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
