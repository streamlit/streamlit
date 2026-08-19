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

import { hasLightBackgroundColor } from "~lib/theme/getColors"

export const StyledJsonWrapper = styled.div(({ theme }) => ({
  overflowY: "auto",
  position: "relative",
  ".react-json-view .copy-icon svg": {
    // Make the copy icon responsive to the root font size.
    fontSize: `1em !important`,
    marginRight: `${theme.spacing.threeXS} !important`,
    verticalAlign: "middle !important",
  },
}))

export const StyledPathTooltip = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.sm,
  padding: theme.spacing.sm,
  paddingLeft: theme.spacing.md,
  fontFamily: theme.genericFonts.codeFont,
  fontSize: theme.fontSizes.twoSm,
  color: theme.colors.bodyText,
  maxWidth: "90vw",
  wordBreak: "break-all",
}))

export const StyledCopyButton = styled.button(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: theme.spacing.threeXS,
  backgroundColor: "transparent",
  border: "none",
  borderRadius: theme.radii.sm,
  cursor: "pointer",
  color: theme.colors.fadedText60,
  transition: "color 0.15s ease, background-color 0.15s ease",
  "&:hover": {
    backgroundColor: theme.colors.darkenedBgMix15,
    color: theme.colors.bodyText,
  },
  "&:active": {
    backgroundColor: theme.colors.darkenedBgMix25,
  },
  "&:focus": {
    outline: "none",
  },
  "&:focus-visible": {
    boxShadow: theme.shadows.focusRing,
  },
}))

/**
 * Floating overlay container for the JSON path tooltip.
 * Positioned by floating-ui via inline `style` (floatingStyles).
 */
export const StyledJsonPathTooltipBody = styled.div(({ theme }) => ({
  backgroundColor: hasLightBackgroundColor(theme)
    ? theme.colors.bgColor
    : theme.colors.secondaryBg,
  borderRadius: theme.radii.default,
  boxShadow: theme.shadows.tooltip,
  overflow: "hidden",
  zIndex: theme.zIndices.popup,
}))
