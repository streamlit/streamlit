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

export const StyledTextAreaContainer = styled.div<{
  $isStretchHeight: boolean
}>(({ $isStretchHeight }) => ({
  // Only a stretch-height text area fills its element container. Otherwise, a
  // container stretched by its row (for example with
  // vertical_alignment="distribute") would show an empty field below the
  // textarea.
  height: $isStretchHeight ? "100%" : "auto",
  display: "flex",
  flexDirection: "column",
  // Anchors the absolutely positioned input instructions to the field instead
  // of a taller element container.
  position: "relative",
}))

export const StyledTextAreaRoot = styled.div(({ theme }) => ({
  border: `${theme.sizes.borderWidth} solid`,
  borderColor: theme.colors.widgetBorderColor ?? theme.colors.secondaryBg,
  borderRadius: theme.radii.default,
  backgroundColor: theme.colors.secondaryBg,
  flexGrow: 1,
  "&:focus-within": {
    borderColor: theme.colors.primary,
  },
}))

export const StyledTextAreaInput = styled.textarea<{
  $height: string
  $maxHeight: string
  $resize: "vertical" | "none"
}>(({ theme, $height, $maxHeight, $resize }) => ({
  width: "100%",
  height: $height,
  maxHeight: $maxHeight,
  // The root's border adds to this, so subtract it to keep the minimum field
  // height at largestElementHeight like other large widgets.
  minHeight: `calc(${theme.sizes.largestElementHeight} - 2 * ${theme.sizes.borderWidth})`,
  resize: $resize,
  fontWeight: theme.fontWeights.normal,
  lineHeight: theme.lineHeights.inputWidget,
  fontFamily: "inherit",
  fontSize: theme.fontSizes.sm,
  color: "inherit",
  backgroundColor: "transparent",
  border: "none",
  outline: "none",
  boxSizing: "border-box",
  display: "block",
  overflowY: "auto",
  padding: theme.spacing.md,
  "&::placeholder": { color: theme.colors.fadedText60 },
  "&:disabled": {
    cursor: "not-allowed",
    color: theme.colors.fadedText40,
    WebkitTextFillColor: theme.colors.fadedText40,
  },
}))
