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

import { ComponentType } from "react"

import styled from "@emotion/styled"
import { CalendarDate } from "@internationalized/date"
import { getLuminance } from "color2k"
import {
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarHeaderCell,
  CalendarProps,
  DateSegment,
  Group,
  RangeCalendar,
} from "react-aria-components"

import {
  getBorderColor,
  getOverlayZIndex,
  getPopoverContainerStyle,
} from "~lib/components/shared/Base/styled-components"
import { hasLightBackgroundColor } from "~lib/theme/getColors"

/**
 * Visual-parity target for this file: replicate what the old `DateInput.tsx`'s
 * BaseWeb `overrides` block (sizing/border/selection colors/popover chrome)
 * encoded, driven by `react-aria-components`' render-prop `data-*` attributes
 * instead of BaseWeb's override props. See the migration plan's "Visual
 * parity" checklist for the full enumeration this file targets.
 */

/** Outermost wrapper for layout. */
export const StyledDateFieldContainer = styled.div({
  width: "100%",
})

/** DateField fills the flex row so error/clear icons stay at the trailing edge. */
export const StyledDateField = styled.div({
  flex: 1,
  minWidth: 0,
})

/**
 * Visual container for the date input (border, background) — mirrors
 * `TimeInput`'s `StyledTimeInputWrapper` so the migrated `DateInput` is
 * pixel-consistent with `TimeInput`/`TextInput`/etc., not just consistent
 * with its own old self.
 */
export const StyledDateInputWrapper = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  width: "100%",
  height: theme.sizes.minElementHeight,
  borderRadius: theme.radii.default,
  borderWidth: theme.sizes.borderWidth,
  borderStyle: "solid",
  borderColor: getBorderColor(theme.colors, false),
  backgroundColor: theme.colors.secondaryBg,
  cursor: "text",
  fontSize: theme.fontSizes.sm,
  lineHeight: theme.lineHeights.inputWidget,
  "&:focus-within": {
    borderColor: getBorderColor(theme.colors, true),
    outline: "none",
  },
  "&[data-has-error]": {
    borderColor: theme.colors.redTextColor,
    backgroundColor: theme.colors.redBackgroundColor,
  },
  "&[data-disabled]": {
    color: theme.colors.fadedText40,
    cursor: "not-allowed",
  },
}))

/** We render our own reordered segment list (see `ReorderedDateSegments` in
 * `SingleDateInput.tsx`) rather than using RAC's `DateInput` segment-group
 * primitive, since that component's `children` is a render-prop invoked
 * once per segment in *default* locale order — it has no hook for
 * overriding order. `Group` gives us the same focus/aria wiring (it reads
 * segment/field context from `DateFieldStateContext` via `useContextProps`
 * internally through the segments themselves) without imposing an order. */
export const StyledDateFieldInput = styled(Group)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flex: 1,
  minWidth: 0,
  paddingTop: theme.spacing.sm,
  paddingBottom: theme.spacing.sm,
  paddingLeft: `calc(${theme.spacing.sm} + ${theme.sizes.tagMarginInsideBorder})`,
  paddingRight: theme.spacing.sm,
  outline: "none",
}))

/** Individual year, month, day, or literal separator segment. */
export const StyledDateSegment = styled(DateSegment)(({ theme }) => {
  const isLightPrimary = getLuminance(theme.colors.primary) > 0.5

  return {
    paddingLeft: theme.spacing.threeXS,
    paddingRight: theme.spacing.threeXS,
    borderRadius: theme.radii.sm,
    color: theme.colors.bodyText,
    caretColor: "transparent",
    outline: "none",
    fontWeight: theme.fontWeights.normal,
    whiteSpace: "pre",
    "&[data-type=literal]": {
      color: theme.colors.fadedText60,
      padding: 0,
    },
    "&[data-placeholder]": {
      color: theme.colors.fadedText60,
    },
    // focused must come after placeholder so contrast text always wins on the
    // primary-colored focused highlight, even when the segment is still a placeholder.
    "&[data-focused]": {
      backgroundColor: theme.colors.primary,
      color: isLightPrimary ? theme.colors.black : theme.colors.white,
    },
    // When disabled, inherit the fadedText40 color set on StyledDateInputWrapper.
    // Without this, the explicit color: bodyText above blocks CSS inheritance.
    "&[data-disabled]": {
      color: "inherit",
    },
  }
})

/** Error icon, flex item to the right of the date segments. */
export const StyledErrorIconContainer = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  color: theme.colors.redTextColor,
  paddingLeft: theme.spacing.twoXS,
  paddingRight: theme.spacing.sm,
  flexShrink: 0,
}))

/** Clear button, flex item to the right of the date segments (or error icon).
 * Matches `TimeInput`'s `StyledClearButton` exactly. */
export const StyledClearButton = styled.button(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: `0 ${theme.spacing.twoXS}`,
  marginRight: theme.spacing.sm,
  color: theme.colors.grayTextColor,
  flexShrink: 0,
  "&:hover": {
    color: theme.colors.bodyText,
  },
  "&:focus-visible": {
    outline: `${theme.sizes.borderWidth} solid ${theme.colors.primary}`,
    borderRadius: theme.radii.sm,
  },
}))

/* eslint-disable streamlit-custom/no-hardcoded-theme-values */
/** Visually hidden but accessible to screen readers. */
export const StyledVisuallyHidden = styled.span({
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
})
/* eslint-enable streamlit-custom/no-hardcoded-theme-values */

// ---------------------------------------------------------------------------
// Calendar popover
// ---------------------------------------------------------------------------

/** Floating-ui-positioned popover panel — same chrome as every other
 * Streamlit overlay (Selectbox/Multiselect/TimeInput dropdowns, MenuButton
 * menu), via the shared `getPopoverContainerStyle` helper. */
export const StyledCalendarPopover = styled.div(({ theme }) => ({
  ...getPopoverContainerStyle(theme),
  zIndex: getOverlayZIndex(theme),
  padding: theme.spacing.xs,
  // Override: zero border in light mode because the calendar header's
  // shaded background conflicts with the background-color-as-border trick.
  // Preserved verbatim from the old DateInput.tsx's Popover.Body override.
  ...(hasLightBackgroundColor(theme) && {
    borderWidth: theme.spacing.none,
  }),
}))

/**
 * `Calendar` is generic over its date type `T` and selection mode `M`; when
 * passed through `styled()` untyped, TS widens `M` across both `'single'`
 * and `'multiple'`, which makes `onChange` accept `DateValue | DateValue[]`
 * instead of the single `CalendarDate` we actually use. Pinning the generic
 * here (we only ever use `Calendar` in single-date mode) keeps
 * `SingleDateInput.tsx`'s `onChange={(date: CalendarDate) => ...}` typed
 * correctly at the call site.
 */
const TypedCalendar = Calendar as ComponentType<
  CalendarProps<CalendarDate, "single">
>

export const StyledCalendarRoot = styled(TypedCalendar)(({ theme }) => ({
  fontSize: theme.fontSizes.sm,
}))

export const StyledRangeCalendarRoot = styled(RangeCalendar)(({ theme }) => ({
  fontSize: theme.fontSizes.sm,
}))

/** Prev/next month nav row + month/year pickers, shared by single and range. */
export const StyledCalendarHeader = styled.header(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing.twoXS,
  paddingBottom: theme.spacing.xs,
}))

export const StyledCalendarHeaderButton = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: theme.sizes.smallElementHeight,
  height: theme.sizes.smallElementHeight,
  borderRadius: theme.radii.default,
  color: theme.colors.bodyText,
  cursor: "pointer",
  // Suppress BaseWeb-style click/focus background flash — matches old
  // PrevButton/NextButton overrides' explicit `:active`/`:focus` suppression.
  "[data-pressed] > &, [data-focused] > &": {
    backgroundColor: "transparent",
  },
  "[data-disabled] > &": {
    color: theme.colors.fadedText40,
    cursor: "not-allowed",
  },
}))

/** Native `<select>` for month/year — see `CalendarPopoverHeader.tsx` for
 * why a native select is used instead of composing RAC's own Select. */
export const StyledCalendarHeaderSelect = styled.select(({ theme }) => ({
  border: "none",
  background: "none",
  color: theme.colors.bodyText,
  fontSize: theme.fontSizes.sm,
  fontWeight: theme.fontWeights.bold,
  cursor: "pointer",
  padding: `${theme.spacing.threeXS} ${theme.spacing.twoXS}`,
  borderRadius: theme.radii.sm,
  "&:hover": {
    backgroundColor: theme.colors.darkenedBgMix15,
  },
  "&:focus-visible": {
    outline: `${theme.sizes.borderWidth} solid ${theme.colors.primary}`,
  },
}))

/* eslint-disable streamlit-custom/no-hardcoded-theme-values */
export const StyledCalendarHeadingFallback = styled.div({
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
})
/* eslint-enable streamlit-custom/no-hardcoded-theme-values */

export const StyledCalendarGrid = styled(CalendarGrid)(({ theme }) => ({
  width: "100%",
  borderCollapse: "collapse",
  fontSize: theme.fontSizes.sm,
}))

export const StyledCalendarHeaderCell = styled(CalendarHeaderCell)(
  ({ theme }) => ({
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.normal,
    color: theme.colors.fadedText60,
    paddingBottom: theme.spacing.twoXS,
  })
)

/**
 * Day cell. Replaces the old `Day` override's `$pseudoHighlighted`/
 * `$pseudoSelected` BaseWeb-bug workaround with clean `CalendarCell`
 * render-prop selectors, while preserving the *intent* (and exact theme
 * tokens) of that override: selected/hovered/in-range-preview all use
 * `darkenedBgMix15`, keyboard-focused gets a `primary`-colored ring.
 */
export const StyledCalendarCell = styled(CalendarCell)(({ theme }) => {
  const lightHoverTextFlip = hasLightBackgroundColor(theme)

  return {
    textAlign: "center",
    verticalAlign: "middle",
    cursor: "pointer",
    fontSize: theme.fontSizes.sm,
    lineHeight: theme.lineHeights.base,
    padding: theme.spacing.twoXS,
    borderRadius: theme.radii.default,
    outline: "none",

    "&[data-selected], &[data-selection-start], &[data-selection-end], &[data-hovered]":
      {
        backgroundColor: theme.colors.darkenedBgMix15,
      },

    // Light-theme-only: hovering an in-progress range-selection date that
    // isn't itself the start/end flips text color for contrast against the
    // darkened hover background. No dark-theme equivalent.
    ...(lightHoverTextFlip && {
      "&[data-hovered][data-selected]:not([data-selection-start]):not([data-selection-end])":
        {
          color: theme.colors.secondaryBg,
        },
    }),

    "&[data-focus-visible]": {
      boxShadow: `inset 0 0 0 ${theme.sizes.borderWidth} ${theme.colors.primary}`,
    },

    "&[data-disabled], &[data-unavailable]": {
      color: theme.colors.fadedText40,
      cursor: "not-allowed",
    },

    "&[data-outside-month]": {
      color: theme.colors.fadedText40,
    },
  }
})
