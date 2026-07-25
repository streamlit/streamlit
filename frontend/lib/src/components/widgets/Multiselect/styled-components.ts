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

function getRightInset(theme: EmotionTheme): string {
  return `max(0px, calc(${theme.sizes.tagMarginInsideBorder} - var(--scrollbar-gutter-size, 0px)))`
}

/**
 * Outer container for the ComboBox trigger: tags area + chevron button.
 * Uses `[data-focus-within]` to switch border colour on focus.
 * Unlike the Selectbox trigger, this has variable height (grows with tags)
 * up to a max-height that cuts through the 5th tag row.
 */
export const StyledTrigger = styled(Group, {
  shouldForwardProp: (prop: string) => !prop.startsWith("$"),
})<{ $maxHeight: string }>(({ theme, $maxHeight }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "stretch",
  width: "100%",
  minHeight: theme.sizes.minElementHeight,
  maxHeight: $maxHeight,
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
 * Scrollable area inside the trigger that holds tags + the filter input.
 * Wraps tags into multiple rows and scrolls vertically when overflowing.
 */
export const StyledTagsContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap" as const,
  alignItems: "center",
  flexGrow: 1,
  overflowY: "auto" as const,
  overflowX: "hidden" as const,
  paddingLeft: theme.sizes.tagMarginInsideBorder,
  paddingTop: theme.sizes.tagMarginInsideBorder,
  paddingBottom: theme.spacing.none,
  paddingRight: theme.spacing.none,
  cursor: "text",
}))

/** Individual removable tag pill displaying a selected value. */
export const StyledTag = styled.span<{ $disabled?: boolean }>(
  ({ theme, $disabled }) => ({
    display: "inline-flex",
    alignItems: "center",
    height: theme.sizes.elementHighlightHeight,
    maxWidth: `calc(100% - ${theme.spacing.lg})`,
    borderRadius: theme.radii.md2,
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.normal,
    paddingLeft: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
    marginRight: theme.spacing.twoXS,
    marginBottom: theme.sizes.tagMarginInsideBorder,
    marginTop: theme.spacing.none,
    marginLeft: theme.spacing.none,
    backgroundColor: $disabled
      ? theme.colors.fadedText10
      : theme.colors.primary,
    color: $disabled ? theme.colors.fadedText40 : theme.colors.white,
    cursor: "default",
    overflow: "hidden",
    whiteSpace: "nowrap",
  })
)

/** Text content inside a tag — truncates with ellipsis and shows title tooltip. */
export const StyledTagText = styled.span({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  pointerEvents: "auto",
})

/** Accessible remove button inside each tag. */
export const StyledTagRemoveButton = styled.button<{ $disabled?: boolean }>(
  ({ theme, $disabled }) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    background: "transparent",
    padding: theme.spacing.none,
    paddingLeft: theme.spacing.sm,
    cursor: $disabled ? "not-allowed" : "pointer",
    color: "inherit",
    pointerEvents: $disabled ? "none" : "auto",
    flexShrink: 0,
  })
)

/**
 * Filter input inline with tags. Fills remaining space on the current flex line.
 * When no tags are present, it fills the available width for placeholder display.
 */
export const StyledFilterInput = styled(Input, {
  shouldForwardProp: (prop: string) => !prop.startsWith("$"),
})<{ $typingDisabled?: boolean; $hasValues?: boolean }>(
  ({ theme, $typingDisabled, $hasValues }) => ({
    height: theme.sizes.elementHighlightHeight,
    marginBottom: theme.sizes.tagMarginInsideBorder,
    marginTop: theme.spacing.none,
    marginLeft: theme.spacing.none,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: $hasValues ? 0 : "100%",
    minWidth: $hasValues ? theme.spacing.sm : theme.spacing.threeXS,
    "&:focus": {
      minWidth: "3rem",
    },
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: theme.fontSizes.sm,
    lineHeight: theme.lineHeights.inputWidget,
    fontWeight: theme.fontWeights.normal,
    color: theme.colors.bodyText,
    paddingLeft: theme.spacing.twoXS,
    paddingRight: theme.spacing.twoXS,
    paddingTop: theme.spacing.none,
    paddingBottom: theme.spacing.none,
    boxSizing: "border-box",
    caretColor: $typingDisabled ? "transparent" : theme.colors.bodyText,
    cursor: $typingDisabled ? "pointer" : undefined,
    userSelect: $typingDisabled ? "none" : undefined,
    "&::placeholder": {
      color: theme.colors.fadedText60,
    },
    "&[data-disabled]": {
      cursor: "not-allowed",
      color: theme.colors.fadedText40,
      "&::placeholder": {
        color: theme.colors.fadedText40,
      },
    },
  })
)

/** Chevron button that opens/closes the dropdown list. */
export const StyledOpenButton = styled(Button)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  alignSelf: "center",
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

/** Clear-all button between the tags area and the chevron. */
export const StyledClearButton = styled(Button)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  alignSelf: "center",
  flexShrink: 0,
  padding: theme.spacing.threeXS,
  width: theme.sizes.clearIconSize,
  height: theme.sizes.clearIconSize,
  border: "none",
  outline: "none",
  borderRadius: theme.radii.default,
  background: "transparent",
  cursor: "pointer",
  color: theme.colors.grayTextColor,
  "&:hover, &[data-hovered]": {
    color: theme.colors.bodyText,
  },
  "&:focus-visible": {
    boxShadow: theme.shadows.focusRing,
  },
}))

/**
 * Popover positioned below the trigger via Floating UI.
 * !important overrides neutralize RAC's imperative inline style writes.
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
    opacity: 1,
    transition: "opacity 120ms ease-out",
    "&[data-entering], &[data-exiting]": {
      opacity: 0,
    },
    ...({
      position: "fixed !important",
      top: "0 !important",
      left: "0 !important",
      right: "auto !important",
      bottom: "auto !important",
    } as Record<string, string>),
  })
)

/** Scrollable list of options inside the popover. */
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

export const StyledEmptyState = styled.span(({ theme }) => ({
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: theme.sizes.emptyDropdownHeight,
  padding: theme.spacing.sm,
  color: theme.colors.fadedText60,
  fontSize: theme.fontSizes.sm,
  fontWeight: theme.fontWeights.normal,
  lineHeight: theme.lineHeights.base,
  textAlign: "center",
  cursor: "not-allowed",
}))

interface StyledListBoxItemProps {
  $isCreatable?: boolean
  $isBulkAction?: boolean
}

/**
 * Individual option row. Selected items show a highlight background.
 * `$isCreatable` adds a top separator for the "Add: …" option.
 * `$isBulkAction` adds a bottom separator for "Select all" / "Select X matches".
 */
export const StyledListBoxItem = styled(ListBoxItem, {
  shouldForwardProp: (prop: string) => !prop.startsWith("$"),
})<StyledListBoxItemProps>(({ theme, $isCreatable, $isBulkAction }) => ({
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
  "&[data-selected] [data-item-hl]": {
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
  ...($isBulkAction && {
    "&::after": {
      content: '""',
      position: "absolute",
      bottom: 0,
      left: theme.sizes.tagMarginInsideBorder,
      right: theme.sizes.tagMarginInsideBorder,
      height: theme.sizes.borderWidth,
      backgroundColor: theme.colors.fadedText10,
      transform: "translateY(50%)",
    },
  }),
}))

/**
 * Inner pill wrapper inside each ListBoxItem. Receives hover/focus/selected
 * background via the `[data-item-hl]` attribute selector.
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
