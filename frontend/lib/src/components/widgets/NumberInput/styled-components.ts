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
import { Input as RAInput } from "react-aria-components"

import { getBorderColor } from "~lib/components/shared/Base/styled-components"

interface StyledInputContainerProps {
  $isFocused: boolean
}

export const StyledInputContainer = styled.div<StyledInputContainerProps>(
  ({ theme, $isFocused }) => ({
    display: "flex",
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    height: theme.sizes.minElementHeight,
    borderWidth: theme.sizes.borderWidth,
    borderStyle: "solid",
    borderColor: getBorderColor(theme.colors, $isFocused),
    backgroundColor: theme.colors.secondaryBg,
    transitionDuration: "200ms",
    transitionProperty: "border",
    transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.4, 1)",
    borderRadius: theme.radii.default,
    overflow: "hidden",
  })
)

export const StyledInputControls = styled.div({
  display: "flex",
  flexDirection: "row",
  alignSelf: "stretch",
})

export const StyledInputControl = styled.button(({ theme }) => ({
  margin: theme.spacing.none,
  border: "none",
  height: theme.sizes.full,
  display: "flex",
  alignItems: "center",
  width: theme.sizes.numberInputControlsWidth,
  justifyContent: "center",
  color: theme.colors.bodyText,
  transition: "color 300ms, backgroundColor 300ms",
  backgroundColor: theme.colors.secondaryBg,
  "&:hover:enabled, &:focus:enabled": {
    color: theme.colors.white,
    backgroundColor: theme.colors.primary,
    transition: "none",
    outline: "none",
  },
  "&:active": {
    outline: "none",
    border: "none",
  },
  "&:disabled": {
    cursor: "not-allowed",
    color: theme.colors.fadedText40,
  },
}))

/**
 * The RAInput-based element that receives user keystrokes.
 * Spin-button appearance is suppressed here because NumberInput renders
 * its own +/- controls to the right of the field.
 */
export const StyledInputElement = styled(RAInput)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  border: "none",
  background: "transparent",
  outline: "none",
  color: theme.colors.bodyText,
  fontFamily: theme.genericFonts.bodyFont,
  fontSize: theme.fontSizes.sm,
  fontWeight: theme.fontWeights.normal,
  lineHeight: theme.lineHeights.inputWidget,
  paddingTop: theme.spacing.sm,
  paddingBottom: theme.spacing.sm,
  paddingLeft: theme.spacing.md,
  paddingRight: theme.spacing.sm,
  "::placeholder": { color: theme.colors.fadedText60 },
  // Suppress the native spin buttons — NumberInput renders its own controls.
  MozAppearance: "textfield",
  "&::-webkit-inner-spin-button, &::-webkit-outer-spin-button": {
    WebkitAppearance: "none",
    margin: theme.spacing.none,
  },
  "&[disabled]": {
    cursor: "not-allowed",
    color: theme.colors.fadedText40,
    // Override browser's -webkit-text-fill-color which takes precedence over color
    WebkitTextFillColor: theme.colors.fadedText40,
    backgroundColor: "transparent",
  },
}))

interface StyledStartEnhancerProps {
  $isMaterialIcon: boolean
}

export const StyledStartEnhancer = styled.div<StyledStartEnhancerProps>(
  ({ theme, $isMaterialIcon }) => ({
    display: "flex",
    alignItems: "center",
    paddingLeft: theme.spacing.sm,
    paddingRight: 0,
    minWidth: theme.iconSizes.base,
    // Material icons are rendered as inactionable decorations — fade them.
    color: $isMaterialIcon ? theme.colors.fadedText60 : "inherit",
    flexShrink: 0,
  })
)

/**
 * SVG icon for the clear button — the exact "circle with ×" path borrowed from
 * BaseWeb's deleteAlt icon. Using an inline SVG (rather than a Material font
 * glyph) ensures the × is a genuine evenodd transparent cutout, so the input's
 * background colour shows through correctly in every theme.
 */
export const StyledClearSvg = styled.svg(({ theme }) => ({
  width: theme.iconSizes.base,
  height: theme.iconSizes.base,
  fill: "currentColor",
  flexShrink: 0,
  display: "block",
}))

/** Clear (×) button shown when the widget has no default and holds a value. */
export const StyledClearButton = styled.button(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: `0 ${theme.spacing.twoXS}`,
  color: theme.colors.grayTextColor,
  flexShrink: 0,
  "&:hover:not(:disabled)": {
    color: theme.colors.bodyText,
  },
  "&:disabled": {
    cursor: "not-allowed",
  },
}))

interface StyledInstructionsContainerProps {
  // If widget is clearable, the instruction needs to be moved a couple
  // pixels to the left to avoid overlapping with the clear button.
  clearable: boolean
}

export const StyledInstructionsContainer =
  styled.div<StyledInstructionsContainerProps>(({ theme, clearable }) => ({
    position: "absolute",
    marginRight: theme.spacing.twoXS,
    left: 0,
    // The instructions should be placed after the two controls
    // and the clear button if it's present.
    right: `calc(${theme.sizes.numberInputControlsWidth} * 2 + ${
      clearable ? "1em" : "0em"
    })`,
  }))
