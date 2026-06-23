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
import { transparentize } from "color2k"

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
 * Inline "install Streamlit skills" call-to-action shown beneath an error in
 * local development, styled as a tasteful "tip" band: a brand-accent left
 * stripe + a faint accent tint, so it draws the eye without the mass of a card
 * and reads as a peer of the error's Copy / Ask links rather than overpowering
 * them.
 */
export const StyledSkillsInstallCallout = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing.sm,
  marginTop: theme.spacing.sm,
  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
  borderLeft: `0.1875rem solid ${theme.colors.primary}`,
  borderRadius: `0 ${theme.radii.default} ${theme.radii.default} 0`,
  // Faint wash of the brand accent (≈8%) — a hint of color, not a panel.
  backgroundColor: transparentize(theme.colors.primary, 0.92),
  color: theme.colors.bodyText,
  fontSize: theme.fontSizes.sm,
}))

export const StyledSkillsInstallCalloutText = styled.div({
  flex: "1 1 auto",
})

/**
 * The callout's action. A text-style link-button (brand accent, underlined) —
 * the same lightweight treatment as the sibling "Copy" / "Ask …" links — so the
 * CTA reads as a peer action rather than out-weighing the error or its links.
 */
export const StyledSkillsInstallCalloutButton = styled.button(({ theme }) => ({
  all: "unset",
  cursor: "pointer",
  whiteSpace: "nowrap",
  color: theme.colors.primary,
  fontWeight: theme.fontWeights.bold,
  fontSize: theme.fontSizes.sm,
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
