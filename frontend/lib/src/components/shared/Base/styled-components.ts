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

import type { CSSProperties } from "react"

import type { CSSObject } from "@emotion/react"
import styled from "@emotion/styled"

import { hasLightBackgroundColor } from "~lib/theme/getColors"
import type { EmotionTheme, EmotionThemeColors } from "~lib/theme/types"

export const Box = styled.div<{
  width?: CSSProperties["width"]
  height?: CSSProperties["height"]
}>(({ width = "100%", height }) => ({
  width,
  height,
}))

/**
 * Returns the z-index override needed for React Aria positioned overlays.
 * React Aria's useOverlayPosition hard-codes zIndex: 100000 as an inline
 * style, which is below Streamlit's header (999990). !important in a CSS
 * class overrides a non-!important inline style, placing overlays above all
 * fixed UI. Apply this to every styled component wrapping RAC's Popover.
 *
 * @see StyledPopover — Selectbox.styled.ts
 * @see StyledPopoverBody — Popover/styled-components.ts
 * @see StyledMenuPopover — MenuButton/styled-components.ts
 */
export const getOverlayZIndex = (theme: EmotionTheme): string =>
  `${theme.zIndices.popup} !important`

/**
 * Returns the shared popover container style: border-radius, border,
 * and box-shadow.
 *
 * @see Selectbox DropdownContainer
 * @see Multiselect DropdownContainer
 * @see TimeInput DropdownContainer
 * @see DateInput Popover Body
 * @see DateTimeInput Popover Body and TimeSelect DropdownContainer
 * @see Popover Body
 * @see BaseColorPicker Body
 * @see TopNavSection Body
 * @see Modal Dialog
 * @see ColumnMenu Inner
 * @see FormattingMenu Body
 * @see ColumnVisibilityMenu Body
 * @see StyledResizableContainer .gdg-search-bar
 */
export const getPopoverContainerStyle = (
  theme: EmotionTheme
): Record<string, string> => {
  const lightBackground = hasLightBackgroundColor(theme)
  return {
    boxSizing: "border-box",

    borderTopLeftRadius: theme.radii.default,
    borderTopRightRadius: theme.radii.default,
    borderBottomRightRadius: theme.radii.default,
    borderBottomLeftRadius: theme.radii.default,

    // Always use same border width - in light mode, match background
    // so we don't need to adjust for pixel shifts
    borderWidth: theme.sizes.borderWidth,
    borderStyle: "solid",
    borderColor: lightBackground
      ? theme.colors.bgColor
      : theme.colors.borderColor,

    // Only show shadow in light mode
    boxShadow: lightBackground ? theme.shadows.popover : theme.shadows.none,
  }
}

/**
 * Helper function to handle the border color for input widgets
 * @see Selectbox
 * @see Multiselect
 * @see DateInput
 * @see TimeInput
 * @see TextInput
 * @see TextArea
 * @see NumberInput
 */
export const getBorderColor = (
  colors: EmotionThemeColors,
  $isFocused: boolean
): string => {
  let borderColor = colors.widgetBorderColor ?? colors.secondaryBg
  if ($isFocused) {
    borderColor = colors.primary
  }
  return borderColor
}

type SecondaryIconButtonColorOptions = {
  /** Override resting color (defaults to `fadedText60`). */
  restColor?: string
  /**
   * Override hover, keyboard-focus, and React Aria `data-hovered` color
   * (defaults to `bodyText`).
   */
  hoverColor?: string
  /** Override disabled color (defaults to `fadedText40`). */
  disabledColor?: string
}

/** Hover / focus-visible / React Aria hovered selector for secondary icon buttons. */
export const SECONDARY_ICON_HOVER_SELECTOR =
  "&:hover:not(:disabled):not([data-disabled]), &:focus-visible:not(:disabled):not([data-disabled]), &[data-hovered]:not(:disabled):not([data-disabled])"

/** Native `:disabled` and React Aria `[data-disabled]` states for secondary icon buttons. */
export const SECONDARY_ICON_DISABLED_SELECTOR =
  "&:disabled, &:disabled:hover, &:disabled:active, &:disabled:focus-visible, &[data-disabled], &[data-disabled]:hover, &[data-disabled]:active, &[data-disabled]:focus-visible"

/**
 * Shared colors for muted icon buttons in widgets (clear, mic, play, chat add).
 * Rest uses `fadedText60`, hover/focus-visible uses `bodyText`, and disabled uses
 * `fadedText40`. Avoid `grayTextColor` — that token is for gray text content.
 *
 * Callers that also set `&:active` must use
 * `&:active:not(:disabled):not([data-disabled])` and place that rule after
 * spreading these styles so equal specificity + source order keeps press color
 * on top while hovered.
 *
 * @see NumberInput StyledClearButton
 * @see TextInput StyledClearButton
 * @see DateInput StyledClearButton
 * @see TimeInput StyledClearButton
 * @see Multiselect StyledClearButton
 * @see Selectbox StyledClearButton
 * @see AudioInput StyledSecondaryIconActionButton
 * @see ChatInput StyledSendIconButton (non-primary)
 */
export function getSecondaryIconButtonColorStyles(
  theme: EmotionTheme,
  {
    restColor = theme.colors.fadedText60,
    hoverColor = theme.colors.bodyText,
    disabledColor = theme.colors.fadedText40,
  }: SecondaryIconButtonColorOptions = {}
): CSSObject {
  return {
    color: restColor,
    // React Aria `data-*` attributes are included unconditionally; they are inert
    // on plain <button> elements. `:focus-visible` rather than `:focus` so the
    // hover color does not stick after a pointer click.
    [SECONDARY_ICON_HOVER_SELECTOR]: {
      color: hoverColor,
    },
    [SECONDARY_ICON_DISABLED_SELECTOR]: {
      color: disabledColor,
      cursor: "not-allowed",
    },
  }
}
