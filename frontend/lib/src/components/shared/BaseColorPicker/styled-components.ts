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

interface StyledColorPickerProps {
  disabled: boolean
}

export const StyledColorPicker = styled.div<StyledColorPickerProps>(
  ({ disabled, theme }) => ({
    fontFamily: theme.genericFonts.bodyFont,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    cursor: disabled ? "not-allowed" : "default",
    // Enforce minimum width to prevent shrinking below the color block's
    // intrinsic size. The color block uses theme.sizes.minElementHeight (40px)
    // for both its width and height, so we use the same value here to keep
    // them in sync.
    minWidth: theme.sizes.minElementHeight,
  })
)

// We need this to override the default font-family: 'Menlo' rule,
// Which causes the font to change to a serif one in Windows
export const StyledChromePicker = styled.div(({ theme }) => ({
  div: {
    fontFamily: `${theme.genericFonts.bodyFont} !important`,
  },
  // The overrides below are a bit hacky but unfortunately the ChromePicker component
  // doesn't offer a way to override labels and inputs, see
  // https://github.com/casesandberg/react-color/issues/643
  label: {
    fontSize: `${theme.fontSizes.sm} !important`,
    color: `${theme.colors.bodyText} !important`,
  },
  input: {
    fontSize: `${theme.fontSizes.md} !important`,
    height: `${theme.sizes.minElementHeight} !important`,
    backgroundColor: `${theme.colors.secondaryBg} !important`,
    color: `${theme.colors.bodyText} !important`,
    borderRadius: `${theme.radii.default} !important`,
    boxShadow: `none !important`,
    "&:focus-visible": {
      outline: `${theme.sizes.borderWidth} solid ${theme.colors.primary} !important`,
    },
  },
  svg: {
    // This is the arrow button on the right. The hover color for the background is
    // apparently set by JS and not CSS, so we can't override it.
    fill: `${theme.colors.bodyText} !important`,
  },
}))

interface StyledColorPreviewProps {
  disabled: boolean
}

export const StyledColorPreview = styled.div<StyledColorPreviewProps>(
  ({ disabled, theme }) => ({
    height: theme.sizes.minElementHeight,
    borderRadius: theme.radii.default,
    borderColor: theme.colors.borderColor,
    cursor: disabled ? "not-allowed" : "pointer",
    pointerEvents: disabled ? "none" : "auto",
    boxShadow: "none",
    lineHeight: theme.lineHeights.base,
    gap: theme.spacing.md,
    "&:focus": {
      outline: "none",
    },
    display: "flex",
  })
)

interface StyledColorBlockProps {
  disabled: boolean
  backgroundColor: string
}

export const StyledColorBlock = styled.div<StyledColorBlockProps>(
  ({ backgroundColor, disabled, theme }) => ({
    width: theme.sizes.minElementHeight,
    height: theme.sizes.minElementHeight,
    borderRadius: theme.radii.default,
    borderColor: theme.colors.borderColor,
    borderWidth: theme.sizes.borderWidth,
    opacity: disabled ? "0.4" : "",
    backgroundColor,
    borderStyle: "solid",
    cursor: "pointer",
    lineHeight: theme.lineHeights.base,
    "&:focus": {
      outline: "none",
    },
  })
)

export const StyledColorValue = styled.div({
  display: "flex",
  alignItems: "center",
})
