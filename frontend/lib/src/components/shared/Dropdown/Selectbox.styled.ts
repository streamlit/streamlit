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
import {
  Button,
  Group,
  Input,
  ListBox,
  ListBoxItem,
  Popover,
} from "react-aria-components"

import { getBorderColor } from "~lib/components/shared/Base/styled-components"

import {
  getDropdownEmptyStateStyles,
  getDropdownItemHighlightStyles,
  getDropdownListBoxItemStyles,
  getDropdownListBoxStyles,
  getDropdownPopoverStyles,
} from "./dropdownStyles"

/**
 * Outer row container for the ComboBox trigger: input + buttons.
 * Uses `[data-focus-within]` (set by React Aria when any descendant is
 * focused) to switch border colour to `primary`, mirroring the focus ring
 * on other Streamlit input widgets.
 */
export const StyledGroup = styled(Group)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "stretch",
  width: "100%",
  // Use a fixed height so that subpixel line-height rounding in
  // WebKit/Chromium cannot push the element 1px over the minimum.
  // overflow:hidden prevents any content from leaking.
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
 *
 * `$typingDisabled` (FILTER_MODE_NONE) hides the text caret and shows a pointer
 * cursor so the input looks non-editable — like a plain select — even though it
 * stays focusable for keyboard navigation.
 */
export const StyledInput = styled(Input, {
  shouldForwardProp: (prop: string) => !prop.startsWith("$"),
})<{ $placeholderColor?: string; $typingDisabled?: boolean }>(
  ({ theme, $placeholderColor, $typingDisabled }) => ({
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
    caretColor: $typingDisabled ? "transparent" : theme.colors.bodyText,
    cursor: $typingDisabled ? "pointer" : undefined,
    // Non-selectable text reinforces the non-editable, plain-select feel.
    userSelect: $typingDisabled ? "none" : undefined,
    boxSizing: "border-box",
    "&::placeholder": {
      color: $placeholderColor ?? theme.colors.fadedText60,
    },
    "&[data-disabled]": {
      cursor: "not-allowed",
      color: theme.colors.fadedText40,
    },
  })
)

/** Chevron button that opens/closes the dropdown list. */
export const StyledOpenButton = styled(Button)(({ theme }) => ({
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
export const StyledClearButton = styled(Button)(({ theme }) => ({
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
 * Uses the shared popover container style (border-radius, border, shadow)
 * and constrains the max height to match other Streamlit dropdowns.
 *
 * Positioning is handled by Floating UI (applied via the style prop) rather
 * than React Aria's useOverlayPosition. The !important overrides neutralize
 * RAC's imperative inline style writes so Floating UI's transform takes over.
 */
export const StyledPopover = styled(Popover)<{ $isInSidebar?: boolean }>(
  ({ theme, $isInSidebar }) =>
    getDropdownPopoverStyles(theme, { isInSidebar: $isInSidebar })
)

/**
 * The scrollable list of options. Removes default list styles and outline,
 * letting the popover control overflow.
 */
export const StyledListBox = styled(ListBox)(({ theme }) =>
  getDropdownListBoxStyles(theme)
)

/**
 * Message shown when filtering leaves the dropdown without any options.
 * Matches the empty state used by the Multiselect dropdown.
 */
export const StyledEmptyState = styled.span(({ theme }) =>
  getDropdownEmptyStateStyles(theme)
)

interface StyledListBoxItemProps {
  $isCreatable?: boolean
}

/**
 * Individual option row. Provides correct item height and outer inset
 * padding. The hover/focus highlight is applied to the inner
 * `StyledItemHighlight` pill (via the `[data-item-hl]` attribute selector)
 * to match the rounded-pill style of the Multiselect dropdown.
 *
 * The `$isCreatable` variant adds a top separator line to visually separate
 * the "Add: …" option from the normal list.
 */
export const StyledListBoxItem = styled(ListBoxItem, {
  shouldForwardProp: (prop: string) => !prop.startsWith("$"),
})<StyledListBoxItemProps>(({ theme, $isCreatable }) =>
  getDropdownListBoxItemStyles(theme, { isCreatable: $isCreatable })
)

/**
 * Inner pill wrapper rendered inside each `StyledListBoxItem`. Mirrors
 * `StyledHighlightWrapper` from the shared Dropdown styled-components:
 * a rounded pill (`radii.md2`) at `elementHighlightHeight` that receives
 * the hover/focus background, creating the "pill inside a row" visual that
 * matches the Multiselect dropdown.
 */
export const StyledItemHighlight = styled.div(({ theme }) =>
  getDropdownItemHighlightStyles(theme)
)
