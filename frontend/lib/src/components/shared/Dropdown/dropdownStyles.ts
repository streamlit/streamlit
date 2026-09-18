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

import type { CSSObject } from "@emotion/react"

import {
  getOverlayZIndex,
  getPopoverContainerStyle,
} from "~lib/components/shared/Base/styled-components"
import type { EmotionTheme } from "~lib/theme/types"

/**
 * Right inset for dropdown items, accounting for scrollbar gutter and
 * border width so Selectbox, Multiselect, and text-input suggestions share
 * the same item padding.
 */
function getDropdownRightInset(theme: EmotionTheme): string {
  return `max(0px, calc(${theme.sizes.tagMarginInsideBorder} - var(--scrollbar-gutter-size, 0px)))`
}

/**
 * Popover that positions the options list below the trigger.
 * Uses the shared popover container style (border-radius, border, shadow)
 * and constrains the max height to match other Streamlit dropdowns.
 *
 * Positioning is handled by Floating UI (applied via the style prop) rather
 * than React Aria's useOverlayPosition. The !important overrides neutralize
 * RAC's imperative inline style writes so Floating UI's transform takes over.
 */
export function getDropdownPopoverStyles(
  theme: EmotionTheme,
  { isInSidebar }: { isInSidebar?: boolean } = {}
): CSSObject {
  return {
    ...getPopoverContainerStyle(theme),
    backgroundColor: isInSidebar
      ? theme.colors.secondaryBg
      : theme.colors.bgColor,
    zIndex: getOverlayZIndex(theme),
    maxHeight: `min(${theme.sizes.maxDropdownHeight}, 70vh)`,
    overflow: "hidden",
    // Override RAC's useOverlayPosition imperative style writes.
    // Floating UI with strategy:"fixed" positions via transform: translate(x,y)
    // while emitting top:0/left:0 as the origin. These !important overrides
    // pin RAC's top/left to 0 so the transform controls placement. If a future
    // Floating UI version switches to direct top/left positioning instead of
    // transform, these overrides would need to be removed.
    ...({
      position: "fixed !important",
      top: "0 !important",
      left: "0 !important",
      right: "auto !important",
      bottom: "auto !important",
    } as Record<string, string>),
  }
}

/**
 * The scrollable list of options. Removes default list styles and outline,
 * letting the popover control overflow.
 */
export function getDropdownListBoxStyles(theme: EmotionTheme): CSSObject {
  return {
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
  }
}

/**
 * Message shown when filtering leaves the dropdown without any options.
 * Matches the empty state used by the Multiselect dropdown.
 */
export function getDropdownEmptyStateStyles(theme: EmotionTheme): CSSObject {
  return {
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
  }
}

/**
 * Individual option row. Provides correct item height and outer inset
 * padding. The hover/focus highlight is applied to the inner
 * highlight pill (via the `[data-item-hl]` attribute selector)
 * to match the rounded-pill style of the Multiselect dropdown.
 *
 * The `isCreatable` variant adds a top separator line to visually separate
 * the "Add: …" option from the normal list.
 */
export function getDropdownListBoxItemStyles(
  theme: EmotionTheme,
  { isCreatable }: { isCreatable?: boolean } = {}
): CSSObject {
  return {
    display: "flex",
    alignItems: "center",
    height: theme.sizes.dropdownItemHeight,
    paddingLeft: theme.sizes.tagMarginInsideBorder,
    paddingRight: getDropdownRightInset(theme),
    cursor: "pointer",
    background: "transparent",
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.normal,
    color: theme.colors.bodyText,
    outline: "none",
    position: "relative",
    "&:hover [data-item-hl], &[data-hovered] [data-item-hl], &[data-focused] [data-item-hl]":
      {
        backgroundColor: theme.colors.darkenedBgMix15,
      },
    "&[data-disabled]": {
      cursor: "not-allowed",
      color: theme.colors.fadedText40,
    },
    ...(isCreatable && {
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
  }
}

/**
 * Inner pill wrapper rendered inside each list-box item: a rounded pill
 * (`radii.md2`) at `elementHighlightHeight` that receives the hover/focus
 * background, creating the "pill inside a row" visual that matches the
 * Multiselect dropdown.
 */
export function getDropdownItemHighlightStyles(
  theme: EmotionTheme
): CSSObject {
  return {
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
  }
}
