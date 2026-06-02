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

export const StyledTextInput = styled.div`
  position: relative;
`

interface StyledInputRootProps {
  $isFocused: boolean
  $hasIcon: boolean
}

export const StyledInputRoot = styled.div<StyledInputRootProps>(
  ({ theme, $isFocused, $hasIcon }) => ({
    display: "flex",
    alignItems: "center",
    height: theme.sizes.minElementHeight,
    borderWidth: theme.sizes.borderWidth,
    borderStyle: "solid",
    borderColor: getBorderColor(theme.colors, $isFocused),
    borderRadius: theme.radii.default,
    backgroundColor: theme.colors.secondaryBg,
    paddingLeft: $hasIcon ? theme.spacing.sm : 0,
    overflow: "hidden",
    transitionDuration: "200ms",
    transitionProperty: "border",
    transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.4, 1)",
    // Show the focused border whenever any descendant (input or password toggle)
    // has keyboard focus — handles the case where Tab moves focus to the toggle.
    "&:focus-within": {
      borderColor: getBorderColor(theme.colors, true),
    },
  })
)

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
  "&[disabled]": {
    cursor: "not-allowed",
    color: theme.colors.fadedText40,
    // Override browser's -webkit-text-fill-color which takes precedence over color
    WebkitTextFillColor: theme.colors.fadedText40,
    // Prevent browsers from applying a gray background to disabled inputs
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
    paddingLeft: 0,
    paddingRight: 0,
    minWidth: theme.iconSizes.base,
    color: $isMaterialIcon ? theme.colors.fadedText60 : "inherit",
    flexShrink: 0,
  })
)

export const StyledPasswordToggle = styled.button(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: `0 ${theme.spacing.sm}`,
  color: theme.colors.bodyText,
  flexShrink: 0,
  "&:hover:not(:disabled)": { opacity: 0.7 },
  "&:disabled": {
    cursor: "not-allowed",
    color: theme.colors.fadedText40,
  },
  // Inset shadow stays inside the button's own bounds and is not clipped by
  // the parent StyledInputRoot's overflow:hidden.
  "&:focus-visible": {
    outline: "none",
    borderRadius: theme.radii.default,
    boxShadow: `inset ${theme.shadows.focusRing}`,
  },
}))
