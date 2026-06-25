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

import {
  getBorderColor,
  getOverlayZIndex,
  getPopoverContainerStyle,
} from "~lib/components/shared/Base/styled-components"
import type { EmotionTheme } from "~lib/theme/types"

/**
 * Compute the right inset for dropdown items, accounting for the scrollbar
 * gutter. Mirrors the same helper in the shared Dropdown styled-components.
 */
function getRightInset(theme: EmotionTheme): string {
  return `max(0px, calc(${theme.sizes.tagMarginInsideBorder} - var(--scrollbar-gutter-size, 0px)))`
}

/**
 * Outer bordered row container for the Multiselect trigger.
 *
 * Uses `[data-focus-within]` (set by React Aria when any descendant is
 * focused) to switch the border to the primary colour, matching other widgets.
 * Unlike Selectbox's StyledGroup (fixed height), the Multiselect group has a
 * min-height so it can grow to accommodate multiple rows of tags.
 */
export const StyledGroup = styled(Group)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "stretch",
  width: "100%",
  minHeight: theme.sizes.minElementHeight,
  borderLeftWidth: theme.sizes.borderWidth,
  borderRightWidth: theme.sizes.borderWidth,
  borderTopWidth: theme.sizes.borderWidth,
  borderBottomWidth: theme.sizes.borderWidth,
  borderStyle: "solid",
  borderColor: getBorderColor(theme.colors, false),
  boxSizing: "border-box",
  borderRadius: theme.radii.default,
  backgroundColor: theme.colors.secondaryBg,
  overflow: "hidden",
  "&[data-focus-within]": {
    borderColor: getBorderColor(theme.colors, true),
  },
}))

/**
 * The right-hand column holding the clear and open buttons.
 *
 * Uses `alignSelf: "flex-start"` and `minHeight` to pin the buttons to the
 * top-right corner when the tag area wraps to multiple rows, while remaining
 * vertically centred within the single-row (minElementHeight) case.
 */
export const StyledRightControls = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  alignSelf: "flex-start",
  flexShrink: 0,
  minHeight: theme.sizes.minElementHeight,
  paddingRight: theme.spacing.sm,
  paddingLeft: theme.spacing.none,
}))

/**
 * Borderless text input inside the tag container. Grows to fill available
 * space on the current flex-wrap line and is visually seamless (no border,
 * transparent background).
 */
export const StyledInput = styled(Input, {
  shouldForwardProp: (prop: string) => !prop.startsWith("$"),
})<{ $placeholderColor?: string }>(({ theme, $placeholderColor }) => ({
  flex: "1 1 4rem",
  minWidth: "4rem",
  padding: theme.spacing.none,
  paddingLeft: theme.spacing.sm,
  // Match tag marginBottom so the input sits in the same visual row as tags
  // with equal top (from container paddingTop) and bottom spacing.
  marginBottom: theme.sizes.tagMarginInsideBorder,
  // Use flex-start alignment (no alignSelf:center) so the input starts at
  // the top of its flex row, matching the tags. The equal container paddingTop
  // + tag/input marginBottom produces symmetric visual centering in a
  // single-row layout without relying on flexbox centering.
  height: theme.sizes.elementHighlightHeight,
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

/** Clear-all button (×) shown when at least one item is selected. */
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
 * Chevron button that opens/closes the dropdown list.
 * Uses a native `<button>` (not RAC Button) so that HTML attributes like
 * `title` are forwarded directly to the DOM.
 */
export const StyledOpenButton = styled.button<{ $disabled?: boolean }>(
  ({ theme, $disabled }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    padding: theme.spacing.none,
    width: theme.sizes.clearIconSize,
    border: "none",
    background: "transparent",
    cursor: $disabled ? "not-allowed" : "pointer",
    color: $disabled ? theme.colors.fadedText40 : theme.colors.bodyText,
  })
)

/**
 * Popover that positions the options list below the trigger group.
 * Uses the same floating-position strategy as Selectbox.
 */
export const StyledPopover = styled(Popover)<{ $isInSidebar?: boolean }>(
  ({ theme, $isInSidebar }) => ({
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
  })
)

/**
 * The scrollable options list. Removes list styles and outline; the popover
 * controls the overall max height / overflow.
 */
export const StyledListBox = styled(ListBox)(({ theme }) => ({
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

interface StyledListBoxItemProps {
  $isCreatable?: boolean
  $isSelectAll?: boolean
}

/**
 * Individual option row. Hover/focus highlight is delegated to the inner
 * `StyledItemHighlight` pill (via `[data-item-hl]`) for the rounded-pill look.
 *
 * `$isSelectAll` adds a separator line AFTER the row (matching Baseweb's
 * `ThemedStyledDropdownListItem` `::after` rule for select-all items).
 * `$isCreatable` adds a separator line BEFORE the row.
 */
export const StyledListBoxItem = styled(ListBoxItem, {
  shouldForwardProp: (prop: string) => !prop.startsWith("$"),
})<StyledListBoxItemProps>(({ theme, $isCreatable, $isSelectAll }) => {
  const separatorStyle = {
    content: '""',
    position: "absolute" as const,
    left: theme.sizes.tagMarginInsideBorder,
    right: getRightInset(theme),
    height: theme.sizes.borderWidth,
    backgroundColor: theme.colors.fadedText10,
  }

  return {
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
    // Separator line BEFORE creatable "Add: …" items
    "&::before": $isCreatable
      ? { ...separatorStyle, top: 0, transform: "translateY(-50%)" }
      : undefined,
    // Separator line AFTER "Select all" / "Select X matches" items
    "&::after": $isSelectAll
      ? { ...separatorStyle, bottom: 0, transform: "translateY(50%)" }
      : undefined,
  }
})

/**
 * Inner pill highlight wrapper inside each option row.
 */
export const StyledItemHighlight = styled.div(({ theme }) => ({
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

/**
 * Empty-state row rendered by `renderEmptyState` when the options list is
 * empty. Mirrors Baseweb's default "No results" / custom message styling:
 * centred text at `fontSizes.sm` in a faded colour, matching the item row
 * height so the dropdown feels consistent in size.
 */
export const StyledEmptyState = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: theme.sizes.dropdownItemHeight,
  fontSize: theme.fontSizes.sm,
  fontWeight: theme.fontWeights.normal,
  color: theme.colors.fadedText60,
  paddingLeft: theme.sizes.tagMarginInsideBorder,
  paddingRight: theme.sizes.tagMarginInsideBorder,
}))
