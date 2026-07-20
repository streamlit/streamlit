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
import { DateInput, DateSegment } from "react-aria-components"

import { getBorderColor } from "~lib/components/shared/Base/styled-components"

/** Outermost wrapper; provides relative positioning for the clear button. */
export const StyledTimeFieldContainer = styled.div({
  position: "relative",
  width: "100%",
})

/**
 * Visual container for the time input (border, background, padding).
 *
 * Using a plain `styled.div` instead of `styled(DateInput)` because React
 * Aria Components applies className via render-props, which can prevent
 * Emotion's layout styles (e.g. paddingLeft) from reaching the DOM element
 * reliably. A plain div guarantees consistent behaviour.
 */
export const StyledTimeInputWrapper = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  width: "100%",
  height: theme.sizes.minElementHeight,
  paddingTop: theme.spacing.sm,
  paddingBottom: theme.spacing.sm,
  paddingLeft: `calc(${theme.spacing.sm} + ${theme.sizes.tagMarginInsideBorder})`,
  paddingRight: theme.spacing.sm,
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
  "&[data-disabled]": {
    color: theme.colors.fadedText40,
    cursor: "not-allowed",
  },
}))

/** DateInput stripped to a bare flex container — layout only, no visual styling. */
export const StyledTimeFieldInput = styled(DateInput)({
  display: "flex",
  alignItems: "center",
  flex: 1,
  outline: "none",
})

/** Individual hour, minute, or literal separator segment. */
export const StyledTimeSegment = styled(DateSegment)(({ theme }) => ({
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
  // focused must come after placeholder so white text always wins on the
  // primary-colored focused highlight, even when the segment is still a placeholder.
  "&[data-focused]": {
    backgroundColor: theme.colors.primary,
    color: theme.colors.white,
  },
  // When disabled, inherit the fadedText40 color set on StyledTimeInputWrapper.
  // Without this, the explicit color: bodyText above blocks CSS inheritance.
  "&[data-disabled]": {
    color: "inherit",
  },
}))

/** Icon-only clear button, absolute-positioned to the right of the input. */
export const StyledClearButton = styled.button(({ theme }) => ({
  position: "absolute",
  top: "50%",
  right: theme.spacing.sm,
  transform: "translateY(-50%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: theme.spacing.threeXS,
  color: theme.colors.grayTextColor,
  lineHeight: theme.lineHeights.none,
  "&:hover": {
    color: theme.colors.bodyText,
  },
  "&:focus-visible": {
    outline: `${theme.sizes.borderWidth} solid ${theme.colors.primary}`,
    borderRadius: theme.radii.sm,
  },
}))
