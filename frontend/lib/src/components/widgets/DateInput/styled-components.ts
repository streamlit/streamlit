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
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarHeaderCell,
  CalendarProps,
  DateSegment,
  Group,
  ListBox,
  ListBoxItem,
  Popover,
  RangeCalendar,
  Select,
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
    color: theme.colors.redTextColor,
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
    // Same inheritance for error state (redTextColor set on wrapper).
    "[data-has-error] &:not([data-focused])": {
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
  paddingRight: `calc(${theme.spacing.sm} + ${theme.sizes.tagMarginInsideBorder})`,
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
/** Standard visually-hidden-but-accessible-to-screen-readers technique,
 * shared by `StyledVisuallyHidden` (error text) and
 * `StyledCalendarHeadingFallback` (calendar heading) below — same rules,
 * just different tags for each usage's own content model (inline error
 * text vs. the `<h2>` `Heading` renders). */
const visuallyHiddenStyle = {
  position: "absolute" as const,
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap" as const,
  border: 0,
}

/** Visually hidden but accessible to screen readers. */
export const StyledVisuallyHidden = styled.span(visuallyHiddenStyle)
/* eslint-enable streamlit-custom/no-hardcoded-theme-values */

// ---------------------------------------------------------------------------
// Calendar popover
// ---------------------------------------------------------------------------

/** Floating-ui-positioned popover panel — same chrome as every other
 * Streamlit overlay (Selectbox/Multiselect/TimeInput dropdowns, MenuButton
 * menu), via the shared `getPopoverContainerStyle` helper. */
export const StyledCalendarPopover = styled.div(({ theme }) => ({
  ...getPopoverContainerStyle(theme),
  // getPopoverContainerStyle only sets border/radius/shadow, not a
  // background — every other consumer either paints an opaque inner child
  // (e.g. MenuButton's StyledMenuList) or sets it directly on the popover
  // itself (Selectbox's StyledPopover). This popover has no single opaque
  // child (the header and weekday row paint their own shaded background —
  // see StyledCalendarHeader/StyledCalendarHeaderCell — but the day-grid
  // and quick-select rows don't), so it's set here instead; without it, the
  // popover is fully transparent and page content behind it bleeds through.
  backgroundColor: theme.colors.bgColor,
  zIndex: getOverlayZIndex(theme),
  padding: theme.spacing.sm,
  // Override: zero border in light mode, preserved verbatim from the old
  // DateInput.tsx's Popover.Body override.
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

/**
 * Prev/next month nav row + month/year pickers, shared by single and range.
 * Given a shaded background distinct from the calendar body — mirrors the
 * old BaseWeb `Datepicker`'s `CalendarHeader`, which was shaded by baseui's
 * own default theming (see `getPopoverContainerStyle`'s light-mode
 * zero-border override, whose comment refers to this same shading).
 *
 * Bled out to the popover's own edges (negative margin equal to
 * `StyledCalendarPopover`'s padding) with matching top corner radii, so it's
 * flush with the popover's rounded corners — confirmed against the old
 * BaseWeb `Datepicker`'s own (unmodified) e2e snapshot
 * (`st_date_input-range_two_dates_calendar`), where this band runs fully
 * edge-to-edge. `StyledCalendarGrid` bleeds by the same amount so the
 * weekday row right below lines up exactly (see that component's docstring
 * for why a naive version of this seemed to create a seam between the two).
 *
 * Deliberately margin-only — no explicit `width` alongside it. The popover
 * has no explicit width of its own (`position: fixed`, sized via
 * shrink-to-fit to its content, unlike the trigger field), so a `%`-based
 * `width` here (e.g. `calc(100% + ...)`) has no definite basis to resolve
 * against; browsers fall back to the *viewport* for that, which blew the
 * whole popover up to full page width. Plain negative margins don't have
 * this problem — shrink-to-fit sizing naturally accounts for a block's
 * margins (including negative ones) when computing the popover's own
 * width from its widest child.
 */
export const StyledCalendarHeader = styled.header(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing.twoXS,
  margin: `calc(${theme.spacing.sm} * -1) calc(${theme.spacing.sm} * -1) 0`,
  paddingTop: theme.spacing.xs,
  // Less than paddingTop: this nav row and the weekday row below share the
  // same shaded background band (see StyledCalendarHeaderCell), so the
  // whitespace between them is this padding plus that row's own paddingTop
  // stacked together — kept small here so the combined gap doesn't read as
  // bigger than the (intentionally larger) gap from the weekday row down to
  // the day grid just below it.
  paddingBottom: theme.spacing.threeXS,
  paddingLeft: theme.spacing.sm,
  paddingRight: theme.spacing.sm,
  backgroundColor: theme.colors.secondaryBg,
  borderTopLeftRadius: theme.radii.default,
  borderTopRightRadius: theme.radii.default,
}))

/**
 * Prev/next month nav buttons. Styles the RAC `Button` itself (not just an
 * inner wrapper) — `Button` renders a bare native `<button>` with no visual
 * reset of its own, so leaving it unstyled left the browser's default
 * button chrome (border/padding/background) visible around the chevron
 * icon.
 */
export const StyledCalendarHeaderButton = styled(Button)(({ theme }) => ({
  appearance: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: theme.sizes.smallElementHeight,
  height: theme.sizes.smallElementHeight,
  flexShrink: 0,
  border: "none",
  borderRadius: theme.radii.default,
  backgroundColor: "transparent",
  color: theme.colors.bodyText,
  cursor: "pointer",
  "&[data-hovered]": {
    backgroundColor: theme.colors.darkenedBgMix15,
  },
  "&[data-pressed]": {
    backgroundColor: theme.colors.darkenedBgMix25,
  },
  "&[data-focus-visible]": {
    outline: `${theme.sizes.borderWidth} solid ${theme.colors.primary}`,
    outlineOffset: theme.spacing.threeXS,
  },
  "&[data-disabled]": {
    color: theme.colors.fadedText40,
    cursor: "not-allowed",
    backgroundColor: "transparent",
  },
}))

/**
 * Month/year `<Select>` for the calendar header — composes RAC's own
 * `Select`/`Popover`/`ListBox` (see `CalendarPopoverHeader.tsx` for why,
 * rather than a native `<select>`) so both the closed trigger and the open
 * dropdown list are fully themeable. `position: relative` + `display:
 * inline-flex` just lets it size to its trigger's content, matching the
 * old BaseWeb `Datepicker`'s compact month/year text.
 */
export const StyledCalendarHeaderSelect = styled(Select)({
  position: "relative",
  display: "inline-flex",
  minWidth: 0,
})

/**
 * The *closed* trigger: bold month/year text + trailing chevron, no
 * border/background of its own — sits directly on `StyledCalendarHeader`'s
 * shaded backdrop, matching the old BaseWeb `Datepicker`'s seamless
 * month/year text rather than a boxed dropdown trigger.
 */
export const StyledCalendarHeaderSelectTrigger = styled(Button)(
  ({ theme }) => ({
    appearance: "none",
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.threeXS,
    border: "none",
    borderRadius: theme.radii.sm,
    backgroundColor: "transparent",
    color: theme.colors.bodyText,
    fontSize: theme.fontSizes.sm,
    cursor: "pointer",
    padding: `${theme.spacing.twoXS} ${theme.spacing.twoXS}`,
    maxWidth: "100%",
    "&[data-hovered]": {
      backgroundColor: theme.colors.darkenedBgMix15,
    },
    "&[data-pressed]": {
      backgroundColor: theme.colors.darkenedBgMix25,
    },
    "&[data-focus-visible]": {
      outline: "none",
      boxShadow: `inset 0 0 0 ${theme.sizes.borderWidth} ${theme.colors.primary}`,
    },
  })
)

/** Trailing chevron inside `StyledCalendarHeaderSelectTrigger` — a plain
 * flex child now (not overlaid via `position: absolute`, since there's no
 * longer a native `<select>` arrow underneath it to hide). */
export const StyledCalendarHeaderSelectChevron = styled.div({
  display: "flex",
})

/**
 * Popover for the open month/year list. Deliberately relies on RAC's own
 * default `useOverlayPosition` anchoring (no `useFloatingOverlay`/Floating
 * UI, unlike `Selectbox`'s combobox popover) — nesting a second Floating UI
 * instance inside the outer calendar popover's own Floating UI-positioned
 * container isn't necessary for a small dropdown anchored to a trigger
 * that's already on-screen, and avoids coordinating two independent
 * positioning engines.
 */
export const StyledCalendarHeaderSelectPopover = styled(Popover)(
  ({ theme }) => ({
    ...getPopoverContainerStyle(theme),
    backgroundColor: theme.colors.bgColor,
    zIndex: getOverlayZIndex(theme),
  })
)

/** Scrollable month/year list — capped so the year list (up to 20 rows)
 * doesn't grow taller than the calendar grid below it. `min(..., 70vh)`
 * matches every other Streamlit dropdown's cap (`Selectbox`/`Multiselect`/
 * `TimeInput`/etc., see `Selectbox.styled.ts`), so this one doesn't
 * overflow a short viewport the way a bare `maxDropdownHeight` could. */
export const StyledCalendarHeaderSelectListBox = styled(ListBox)(
  ({ theme }) => ({
    outline: "none",
    maxHeight: `min(${theme.sizes.maxDropdownHeight}, 70vh)`,
    overflowY: "auto",
    overflowX: "hidden",
    padding: theme.spacing.threeXS,
    listStyle: "none",
    margin: theme.spacing.none,
  })
)

/**
 * Individual month/year row. Matches `st.selectbox`'s dropdown treatment —
 * a neutral `darkenedBgMix15`/`25` highlight rather than colored text, so
 * the currently-selected month/year doesn't stand out as an error/warning
 * state the way primary-colored (red-ish in the default theme) text would.
 */
export const StyledCalendarHeaderSelectListBoxItem = styled(ListBoxItem)(
  ({ theme }) => ({
    display: "flex",
    alignItems: "center",
    borderRadius: theme.radii.sm,
    padding: `${theme.spacing.twoXS} ${theme.spacing.sm}`,
    cursor: "pointer",
    fontSize: theme.fontSizes.sm,
    color: theme.colors.bodyText,
    outline: "none",
    "&[data-hovered], &[data-focused]": {
      backgroundColor: theme.colors.darkenedBgMix15,
    },
    // Declared after the hover/focus rule so a selected row that's also
    // hovered/focused keeps this (slightly stronger) highlight.
    "&[data-selected]": {
      backgroundColor: theme.colors.darkenedBgMix25,
    },
  })
)

export const StyledCalendarHeadingFallback = styled.div(visuallyHiddenStyle)

/**
 * `border-spacing` — breathing room both between the weekday abbreviations
 * (`Sun`/`Mon`/...) in the header row, and (vertically) between that header
 * row and the day grid below it, and between each week row within the grid.
 * Unlike `StyledCalendarHeaderCell`'s own padding (which is *inside* its
 * shaded `secondaryBg` box), `border-spacing` gaps fall *outside* every
 * cell's box, in the table's own background — i.e. `StyledCalendarPopover`'s
 * plain, unshaded background shows through. That's what makes it the right
 * tool for the vertical gap specifically: padding on the header cells alone
 * can grow the space above the day grid, but can only ever do so as more of
 * the *shaded* band, never as plain popover background.
 *
 * The horizontal component puts the same small gap between the day cells in
 * the body too, and the vertical component the same small gap between every
 * pair of week rows (not just right below the header) — both read as
 * harmless (arguably nicer) side effects rather than problems:
 * `StyledCalendarCell` already renders each day as a circle noticeably
 * smaller than its `<td>`, so it wasn't relying on zero spacing in either
 * axis for its own visual separation.
 *
 * Border-spacing also inserts a gap *before* the first row and *after* the
 * last, same as it does for the first/last column (see
 * `StyledCalendarHeaderCell`'s docstring) — vertically, that would push the
 * header row down from the table's own top edge, opening an unwanted seam
 * of plain background between it and `StyledCalendarHeader` right above,
 * which the two are otherwise meant to butt up against seamlessly. Table
 * elements (unlike `<tr>`/`<td>`) support ordinary margins, so pulling the
 * whole table back up by that same amount cancels it out exactly, leaving
 * only the *internal* vertical gaps this was actually added for. (No
 * equivalent horizontal fix is needed: `StyledCalendarHeaderCell`'s
 * `bleedToPopoverEdge` box-shadows already account for the pre-first-column/
 * post-last-column gaps as part of their own offset.)
 *
 * Every column already comes out the same width without an explicit
 * `table-layout: fixed`: each `<td>`'s content (`StyledCalendarCell`) forces
 * the same intrinsic width in every column, in both the header and body
 * rows, and auto table layout gives every cell in a column that same
 * resolved width. (`table-layout: fixed` was tried instead, to make that an
 * explicit guarantee rather than an incidental one — but combined with this
 * table's `width: 100%`, it made the whole popover expand to fill the
 * viewport: the unstyled `Calendar` wrapping this table has no width of its
 * own for `100%` to resolve against besides the viewport, the same failure
 * mode this file's history already hit once with `width: calc(100% + ...)`
 * — so it's left as `auto` instead.)
 *
 * Deliberately *not* bled out to the popover's edges the way
 * `StyledCalendarHeader` is: this single `<table>` is shared by both the
 * weekday header row (`<thead>`, wants to reach the popover's edges) and
 * the day-grid body (`<tbody>`, wants to stay inset like the rest of the
 * popover's content) — bleeding the `<table>` itself via negative margin
 * would drag *both* out edge-to-edge, since margin applies to the whole
 * element and can't be scoped to just one internal row. So the table
 * itself stays at a normal inset width, and only the weekday row's
 * *painted background* (not its layout box) bleeds — via `box-shadow` on
 * `StyledCalendarHeaderCell`, which extends paint without affecting any
 * box's size/position. See that component's docstring.
 */
export const StyledCalendarGrid = styled(CalendarGrid)(({ theme }) => ({
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: `${theme.spacing.threeXS} ${theme.spacing.sm}`,
  marginTop: `calc(${theme.spacing.sm} * -1)`,
  fontSize: theme.fontSizes.sm,
}))

/**
 * Weekday-abbreviation row (`Sun`/`Mon`/...). Shares `StyledCalendarHeader`'s
 * `secondaryBg` shading so the nav row and weekday row read as one
 * continuous shaded band, matching the old BaseWeb `Datepicker`'s header —
 * see the migration's visual-parity follow-up. Each `<th>` paints its own
 * background rather than the `<thead>` as a whole: React Aria's
 * `CalendarGridHeader` renders as a real `<thead>`, and `margin`/most
 * `padding` on internal table elements (`<thead>`/`<tr>`) has no effect per
 * the CSS table layout spec.
 *
 * The row's *box* stays at the table's normal inset width (see
 * `StyledCalendarGrid`'s docstring on why the table itself can't bleed),
 * but the shaded *background* still needs to reach the popover's edges to
 * match `StyledCalendarHeader` above it, *and* fill the small horizontal
 * `border-spacing` gaps `StyledCalendarGrid` now puts between every column
 * (otherwise each would show as a hairline cut of the popover's own
 * background color through the middle of this band). Each unblurred,
 * zero-spread `box-shadow` below paints an extra copy of this same
 * background color shifted sideways by some offset — filling a gap over to
 * one side — without changing the cell's (or table's) actual layout box,
 * so the day-grid below stays correctly inset:
 * - Every cell fills the gap immediately to its *left* (a no-op for the
 *   very first cell, which has nothing there to fill — its own rule below
 *   replaces this with the popover-edge bleed instead).
 * - `:first-of-type`/`:last-of-type` additionally (`:last-of-type`) or
 *   instead (`:first-of-type`, no cell precedes it) bleed out to the
 *   popover's own edge — offset by its padding *plus* one more gap-width,
 *   since `border-spacing` also inserts one gap before the first column
 *   and after the last.
 *
 * Written physical-`left`/`right` (not logical), matching
 * `StyledCalendarHeader`'s own physical `borderTopLeftRadius`/
 * `borderTopRightRadius` a few lines up — this component doesn't otherwise
 * account for RTL locales.
 */
export const StyledCalendarHeaderCell = styled(CalendarHeaderCell)(({
  theme,
}) => {
  const { secondaryBg } = theme.colors
  const gapWidth = theme.spacing.threeXS
  const fillGapLeft = `calc(${gapWidth} * -1) 0 0 0 ${secondaryBg}`
  const bleedToPopoverEdge = `calc((${theme.spacing.sm} + ${gapWidth}) * -1) 0 0 0 ${secondaryBg}`
  const bleedToPopoverEdgeReversed = `calc(${theme.spacing.sm} + ${gapWidth}) 0 0 0 ${secondaryBg}`

  return {
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.normal,
    color: theme.colors.fadedText60,
    backgroundColor: secondaryBg,
    // Small and symmetric: this cell's own shaded box only needs to fit
    // its text comfortably. The (larger, and deliberately *un*-shaded) gap
    // between this row and the day grid below comes from
    // `StyledCalendarGrid`'s vertical `border-spacing` instead, not from
    // padding here — see that component's docstring for why.
    paddingTop: theme.spacing.twoXS,
    paddingBottom: theme.spacing.twoXS,
    boxShadow: fillGapLeft,
    "&:first-of-type": {
      boxShadow: bleedToPopoverEdge,
    },
    "&:last-of-type": {
      boxShadow: `${fillGapLeft}, ${bleedToPopoverEdgeReversed}`,
    },
  }
})

/**
 * Day cell. Selected-date indication now matches the old BaseWeb
 * `Datepicker`'s native look (a solid `primary`-colored circle — BaseWeb
 * drew that itself with no override needed, so the pre-migration `Day`
 * override only ever layered a subtle `darkenedBgMix15` *underneath* it;
 * React Aria's `CalendarCell` has no built-in fill to layer under, so that
 * fill has to become the primary indicator itself here) — see the
 * migration's "Visual parity" follow-up. Hover is a `primary`-colored ring
 * (via `boxShadow`, so it doesn't shift layout) rather than a fill, to keep
 * hover and selected visually distinct.
 *
 * `$isRangeMode` distinguishes the two consumers (confirmed via direct
 * inspection of `react-aria-components@1.19.0`'s private `Calendar.mjs`):
 * `data-selection-start`/`data-selection-end` are only ever set when the
 * cell's state has a `highlightedRange` (`RangeCalendar`) — a plain
 * `Calendar`'s single selected date carries *only* `data-selected`, never
 * the start/end attributes. So single mode needs `data-selected` alone to
 * draw the solid circle, while range mode must reserve the solid fill for
 * just the two endpoints and give days *between* them (`data-selected`
 * without either start/end attribute) a softer tinted fill instead.
 */
export const StyledCalendarCell = styled(CalendarCell, {
  shouldForwardProp: (prop: string) => !prop.startsWith("$"),
})<{ $isRangeMode: boolean }>(({ theme, $isRangeMode }) => {
  const isLightPrimary = getLuminance(theme.colors.primary) > 0.5
  const selectedTextColor = isLightPrimary
    ? theme.colors.black
    : theme.colors.white

  const soloSelectedSelector = $isRangeMode
    ? "&[data-selection-start], &[data-selection-end]"
    : "&[data-selected]"

  // A touch larger than smallElementHeight alone (used by the nav chevrons)
  // so cells don't feel as cramped as a bare 1.5rem circle, while staying
  // well under BaseWeb's original day-cell footprint.
  const cellSize = `calc(${theme.sizes.smallElementHeight} + ${theme.spacing.twoXS})`

  return {
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: cellSize,
    height: cellSize,
    marginTop: theme.spacing.none,
    marginBottom: theme.spacing.none,
    marginLeft: "auto",
    marginRight: "auto",
    textAlign: "center",
    cursor: "pointer",
    fontSize: theme.fontSizes.sm,
    lineHeight: theme.lineHeights.base,
    borderRadius: theme.radii.full,
    outline: "none",

    // In-range preview fill for range middles — only reachable in range
    // mode, since single mode's lone selected day is always matched by
    // soloSelectedSelector above instead.
    ...($isRangeMode && {
      "&[data-selected]:not([data-selection-start]):not([data-selection-end])":
        {
          backgroundColor: theme.colors.darkenedBgMix15,
          borderRadius: theme.radii.sm,
        },
    }),

    [soloSelectedSelector]: {
      backgroundColor: theme.colors.primary,
      color: selectedTextColor,
    },

    "&[data-hovered]": {
      boxShadow: `inset 0 0 0 ${theme.sizes.borderWidth} ${theme.colors.primary}`,
    },

    "&[data-focus-visible]": {
      boxShadow: `inset 0 0 0 ${theme.sizes.borderWidth} ${theme.colors.primary}`,
    },

    "&[data-selected][data-focus-visible]": {
      outline: `2px solid ${theme.colors.primary}`,
      outlineOffset: "2px",
    },

    "&[data-disabled], &[data-unavailable]": {
      color: theme.colors.fadedText40,
      cursor: "not-allowed",
      boxShadow: "none",
    },

    "&[data-outside-month]": {
      color: theme.colors.fadedText40,
    },
  }
})
