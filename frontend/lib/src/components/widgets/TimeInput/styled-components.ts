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
import { getLuminance } from "color2k"
import { DateInput, DateSegment } from "react-aria-components"

import { getBorderColor } from "~lib/components/shared/Base/styled-components"

/** Outermost wrapper for layout. */
export const StyledTimeFieldContainer = styled.div({
  width: "100%",
})

/**
 * Visual container for the time input (border, background).
 *
 * Padding lives on StyledTimeFieldInput (DateInput) so React Aria's built-in
 * click-to-nearest-segment behaviour covers the full clickable area.
 */
export const StyledTimeInputWrapper = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  width: "100%",
  height: theme.sizes.minElementHeight,
  borderRadius: theme.radii.default,
  borderWidth: theme.sizes.borderWidth,
  borderStyle: "solid",
  borderColor: getBorderColor(theme.colors, false),
  backgroundColor: theme.colors.secondaryBg,
  cursor: "text",
  fontSize: theme.fontSizes.sm,
  lineHeight: theme.lineHeights.inputWidget,
  "&:focus-within": {
    borderColor: getBorderColor(theme.colors, true),
    outline: "none",
  },
  "&[data-has-error]": {
    borderColor: theme.colors.redTextColor,
    backgroundColor: theme.colors.redBackgroundColor,
  },
  "&[data-disabled]": {
    color: theme.colors.fadedText40,
    cursor: "not-allowed",
  },
}))

/** DateInput that fills the wrapper, with padding so clicks anywhere focus the nearest segment. */
export const StyledTimeFieldInput = styled(DateInput)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flex: 1,
  paddingTop: theme.spacing.sm,
  paddingBottom: theme.spacing.sm,
  paddingLeft: `calc(${theme.spacing.sm} + ${theme.sizes.tagMarginInsideBorder})`,
  paddingRight: theme.spacing.sm,
  outline: "none",
}))

/** Individual hour, minute, or literal separator segment. */
export const StyledTimeSegment = styled(DateSegment)(({ theme }) => {
  const isLightPrimary = getLuminance(theme.colors.primary) > 0.5

  return {
    paddingLeft: theme.spacing.threeXS,
    paddingRight: theme.spacing.threeXS,
    borderRadius: theme.radii.sm,
    color: theme.colors.bodyText,
    caretColor: "transparent",
    outline: "none",
    fontWeight: theme.fontWeights.normal,
    "&[data-type=literal]": {
      color: theme.colors.fadedText60,
      padding: 0,
    },
    "&[data-placeholder]": {
      color: theme.colors.fadedText60,
    },
    // focused must come after placeholder so contrast text always wins on the
    // primary-colored focused highlight, even when the segment is still a placeholder.
    "&[data-focused]": {
      backgroundColor: theme.colors.primary,
      color: isLightPrimary ? theme.colors.black : theme.colors.white,
    },
    // When disabled, inherit the fadedText40 color set on StyledTimeInputWrapper.
    // Without this, the explicit color: bodyText above blocks CSS inheritance.
    "&[data-disabled]": {
      color: "inherit",
    },
  }
})

/** Error icon, flex item to the right of the time segments. */
export const StyledErrorIconContainer = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  color: theme.colors.redTextColor,
  paddingLeft: theme.spacing.twoXS,
  paddingRight: theme.spacing.sm,
  flexShrink: 0,
}))

/** Clear button, flex item to the right of the time segments (or error icon). */
export const StyledClearButton = styled.button(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: `0 ${theme.spacing.twoXS}`,
  marginRight: theme.spacing.sm,
  color: theme.colors.grayTextColor,
  flexShrink: 0,
  "&:hover": {
    color: theme.colors.bodyText,
  },
  "&:focus-visible": {
    outline: `${theme.sizes.borderWidth} solid ${theme.colors.primary}`,
    borderRadius: theme.radii.sm,
  },
}))
