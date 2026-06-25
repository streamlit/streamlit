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

import isPropValid from "@emotion/is-prop-valid"
import styled from "@emotion/styled"
import { StyledDropdownListItem } from "baseui/select"
import {
  Button,
  Group,
  Input,
  ListBox,
  ListBoxItem,
  Popover,
} from "react-aria-components"

import {
  getBorderColor,
  getOverlayZIndex,
  getPopoverContainerStyle,
} from "~lib/components/shared/Base/styled-components"
import type { EmotionTheme } from "~lib/theme/types"

/**
 * Calculate the right inset for dropdown items, accounting for scrollbar gutter
 * and border width in dark mode.
 */
function getRightInset(theme: EmotionTheme): string {
  return `max(0px, calc(${theme.sizes.tagMarginInsideBorder} - var(--scrollbar-gutter-size, 0px)))`
}

interface ThemedStyledDropdownListItemProps {
  $isSelectAll?: boolean
  $isCreatable?: boolean
}

export const ThemedStyledDropdownListItem = styled(StyledDropdownListItem, {
  shouldForwardProp: prop =>
    isPropValid(prop) && prop !== "$isSelectAll" && prop !== "$isCreatable",
})<ThemedStyledDropdownListItemProps>(({
  theme,
  $isSelectAll,
  $isCreatable,
}) => {
  // Separator line style shared by select all (::after) and creatable (::before).
  // The left/right offsets align with the item highlight's edges.
  const separatorStyle = {
    content: '""',
    position: "absolute" as const,
    left: theme.sizes.tagMarginInsideBorder,
    right: getRightInset(theme),
    height: theme.sizes.borderWidth,
    backgroundColor: theme.colors.fadedText10,
  }

  return {
    position: "relative",
    display: "flex",
    alignItems: "center",

    margin: theme.spacing.none,
    height: theme.sizes.dropdownItemHeight,
    paddingTop: theme.spacing.none,
    paddingBottom: theme.spacing.none,
    paddingLeft: theme.sizes.tagMarginInsideBorder,
    paddingRight: getRightInset(theme),
    background: "transparent",
    fontWeight: theme.fontWeights.normal,

    // Override the default itemSize set on the component's JSX
    // on mobile, so we can make list items taller and scrollable
    [`@media (max-width: ${theme.breakpoints.md})`]: {
      minHeight: theme.sizes.dropdownItemHeight,
      height: "auto !important",
    },

    // Separator line BEFORE creatable "Add:" items (centered on top edge)
    "&::before": $isCreatable
      ? { ...separatorStyle, top: 0, transform: "translateY(-50%)" }
      : undefined,
    // Separator line AFTER select all items (centered on bottom edge)
    "&::after": $isSelectAll
      ? { ...separatorStyle, bottom: 0, transform: "translateY(50%)" }
      : undefined,
  }
})

// ---------------------------------------------------------------------------
// React Aria Components – Selectbox
// ---------------------------------------------------------------------------

/**
 * Outer row container for the ComboBox trigger: input + buttons.
 * Uses `[data-focus-within]` (set by React Aria when any descendant is
 * focused) to switch border colour to `primary`, mirroring the focus ring
 * on other Streamlit input widgets.
 */
export const StyledSelectboxGroup = styled(Group)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "stretch",
  width: "100%",
  height: theme.sizes.minElementHeight,
  overflow: "hidden",
  borderLeftWidth: theme.sizes.borderWidth,
  borderRightWidth: theme.sizes.borderWidth,
  borderTopWidth: theme.sizes.borderWidth,
  borderBottomWidth: theme.sizes.borderWidth,
  borderStyle: "solid",
  borderColor: getBorderColor(theme.colors, false),
  boxSizing: "border-box",
  borderRadius: theme.radii.default,
  backgroundColor: theme.colors.secondaryBg,
  "&[data-focus-within]": {
    borderColor: getBorderColor(theme.colors, true),
  },
}))

/**
 * The text input inside the ComboBox. Grows to fill available space and
 * shows `$placeholderColor` when disabled (faded vs. normal faded text).
 */
export const StyledSelectboxInput = styled(Input, {
  shouldForwardProp: (prop: string) => !prop.startsWith("$"),
})<{ $placeholderColor?: string }>(({ theme, $placeholderColor }) => ({
  flexGrow: 1,
  flexShrink: 1,
  minWidth: theme.spacing.threeXS,
  padding: theme.spacing.sm,
  border: "none",
  outline: "none",
  background: "transparent",
  fontSize: theme.fontSizes.sm,
  lineHeight: theme.lineHeights.inputWidget,
  fontWeight: theme.fontWeights.normal,
  color: theme.colors.bodyText,
  caretColor: theme.colors.bodyText,
  boxSizing: "border-box",
  "&::placeholder": {
    color: $placeholderColor ?? theme.colors.fadedText60,
  },
  "&[data-disabled]": {
    cursor: "not-allowed",
    color: theme.colors.fadedText40,
  },
}))

/** Chevron button that opens/closes the dropdown list. */
export const StyledSelectboxOpenButton = styled(Button)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  paddingRight: theme.spacing.sm,
  paddingLeft: theme.spacing.twoXS,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: theme.colors.bodyText,
  "&[data-disabled]": {
    cursor: "not-allowed",
    color: theme.colors.fadedText40,
  },
}))

/**
 * Clear-value button rendered between the input and the open button when
 * `clearable` is true and a value is selected.
 */
export const StyledSelectboxClearButton = styled(Button)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  padding: theme.spacing.threeXS,
  width: theme.sizes.clearIconSize,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: theme.colors.grayTextColor,
  "&:hover, &[data-hovered]": {
    color: theme.colors.bodyText,
  },
}))

/**
 * Popover that positions the options list below the trigger group.
 * Positioning is handled by Floating UI (applied via the style prop) rather
 * than React Aria's useOverlayPosition.
 */
export const StyledSelectboxPopover = styled(Popover)<{
  $isInSidebar?: boolean
}>(({ theme, $isInSidebar }) => ({
  ...getPopoverContainerStyle(theme),
  backgroundColor: $isInSidebar
    ? theme.colors.secondaryBg
    : theme.colors.bgColor,
  zIndex: getOverlayZIndex(theme),
  maxHeight: `min(${theme.sizes.maxDropdownHeight}, 70vh)`,
  overflow: "hidden",
  ...({
    position: "fixed !important",
    top: "0 !important",
    left: "0 !important",
    right: "auto !important",
    bottom: "auto !important",
  } as Record<string, string>),
}))

/**
 * The scrollable list of options. Removes default list styles and outline,
 * letting the popover control overflow.
 */
export const StyledSelectboxListBox = styled(ListBox)(({ theme }) => ({
  outline: "none",
  maxHeight: `min(${theme.sizes.maxDropdownHeight}, 70vh)`,
  overflowY: "auto",
  overflowX: "hidden",
  paddingTop: theme.spacing.none,
  paddingBottom: theme.spacing.none,
  paddingLeft: theme.spacing.none,
  paddingRight: theme.spacing.none,
  listStyle: "none",
  margin: theme.spacing.none,
}))

interface StyledSelectboxListBoxItemProps {
  $isCreatable?: boolean
}

/**
 * Individual option row. The `$isCreatable` variant adds a top separator line.
 */
export const StyledSelectboxListBoxItem = styled(ListBoxItem, {
  shouldForwardProp: (prop: string) => !prop.startsWith("$"),
})<StyledSelectboxListBoxItemProps>(({ theme, $isCreatable }) => ({
  display: "flex",
  alignItems: "center",
  height: theme.sizes.dropdownItemHeight,
  paddingLeft: theme.sizes.tagMarginInsideBorder,
  paddingRight: getRightInset(theme),
  cursor: "pointer",
  background: "transparent",
  fontSize: theme.fontSizes.sm,
  fontWeight: theme.fontWeights.normal,
  color: theme.colors.bodyText,
  outline: "none",
  position: "relative",
  "&[data-hovered] [data-item-hl], &[data-focused] [data-item-hl]": {
    backgroundColor: theme.colors.darkenedBgMix15,
  },
  "&[data-disabled]": {
    cursor: "not-allowed",
    color: theme.colors.fadedText40,
  },
  ...($isCreatable && {
    "&::before": {
      content: '""',
      position: "absolute",
      top: 0,
      left: theme.sizes.tagMarginInsideBorder,
      right: theme.sizes.tagMarginInsideBorder,
      height: theme.sizes.borderWidth,
      backgroundColor: theme.colors.fadedText10,
      transform: "translateY(-50%)",
    },
  }),
}))

/**
 * Inner pill wrapper rendered inside each list item. A rounded pill
 * (`radii.md2`) at `elementHighlightHeight` that receives hover/focus
 * background.
 */
export const StyledSelectboxItemHighlight = styled.div(({ theme }) => ({
  flexGrow: 1,
  display: "flex",
  alignItems: "center",
  paddingLeft: theme.spacing.sm,
  paddingRight: theme.spacing.sm,
  height: theme.sizes.elementHighlightHeight,
  borderRadius: theme.radii.md2,
  background: "transparent",
  overflow: "hidden",
  whiteSpace: "nowrap",
  transition: "background 50ms ease",
  minWidth: 0,
}))
