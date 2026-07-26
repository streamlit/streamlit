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

import { ReactElement, useState } from "react"

import { KeyboardArrowDown } from "@emotion-icons/material-outlined"
import { ChevronLeft, ChevronRight } from "@emotion-icons/material-rounded"
import {
  CalendarMonthPicker,
  CalendarYearPicker,
  Heading,
  Key,
} from "react-aria-components"

import Icon from "~lib/components/shared/Icon/Icon"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useOverlayDismissal } from "~lib/hooks/useOverlayDismissal"

import {
  StyledCalendarHeader,
  StyledCalendarHeaderButton,
  StyledCalendarHeaderSelect,
  StyledCalendarHeaderSelectChevron,
  StyledCalendarHeaderSelectListBox,
  StyledCalendarHeaderSelectListBoxItem,
  StyledCalendarHeaderSelectPopover,
  StyledCalendarHeaderSelectTrigger,
  StyledCalendarHeadingFallback,
} from "./styled-components"

/** Structurally identical across `CalendarMonthPickerItem`/
 * `CalendarYearPickerItem` (`{id, date, formatted}`) — declared locally
 * so `HeaderPickerSelect` below can serve both pickers without importing
 * either concrete type. */
interface HeaderPickerItem {
  id: number
  formatted: string
}

/**
 * Render a single month/year row. The item is received untyped because
 * emotion's `styled(ListBox)` erases React Aria's generic item type (same
 * issue as `renderOption` in `Selectbox.tsx`), so it's asserted back to
 * `HeaderPickerItem`. Defined at module scope for a stable identity across
 * renders.
 */
const renderPickerItem = (item: unknown): ReactElement => {
  const pickerItem = item as HeaderPickerItem
  return (
    <StyledCalendarHeaderSelectListBoxItem id={pickerItem.id}>
      {pickerItem.formatted}
    </StyledCalendarHeaderSelectListBoxItem>
  )
}

/** Stable no-op passed as `useOverlayDismissal`'s `floatingSetFn` — this
 * popover doesn't use Floating UI (see docstring below), so there's no
 * positioning ref to also notify when the panel mounts/unmounts. */
const noop = (): void => {}

/**
 * One `<Select>` for month or year, wired to `CalendarMonthPicker`'s/
 * `CalendarYearPicker`'s render-prop data. A single generic component
 * (rather than duplicating this block per picker) since both hand back the
 * identical `{ 'aria-label', value, onChange, items }` shape — see the
 * docstring below for why this composes RAC's own `Select`/`Popover`/
 * `ListBox` rather than a native `<select>`.
 *
 * `isOpen`/`onOpenChange` are controlled (rather than left to `Select`'s
 * own internal state) so this can pair with `isNonModal` on the popover:
 * by default RAC's `Popover` marks the entire rest of the page `inert`
 * while open (via `ariaHideOutside`) to implement its own outside-click
 * dismissal — but "the entire rest of the page" also includes the outer
 * calendar popover this picker lives inside, making every other control in
 * it (day cells, nav buttons, the weekday header) briefly unclickable.
 * `isNonModal` opts out of that, at the cost of RAC's built-in
 * outside-click dismissal (tied to the same flag), so `useOverlayDismissal`
 * reimplements just that part, scoped to this picker's own trigger/panel.
 */
function HeaderPickerSelect({
  ariaLabel,
  value,
  onChange,
  items,
}: {
  ariaLabel: string
  value: Key
  onChange: (key: Key | null) => void
  items: HeaderPickerItem[]
}): ReactElement {
  const theme = useEmotionTheme()
  const selectedLabel = items.find(item => item.id === value)?.formatted ?? ""

  const [isOpen, setIsOpen] = useState(false)
  const { setFloatingRef, setReferenceRef } = useOverlayDismissal({
    isOpen,
    onClose: () => setIsOpen(false),
    floatingSetFn: noop,
  })

  return (
    <StyledCalendarHeaderSelect
      aria-label={ariaLabel}
      selectedKey={value}
      onSelectionChange={onChange}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
    >
      <StyledCalendarHeaderSelectTrigger ref={setReferenceRef}>
        {selectedLabel}
        <StyledCalendarHeaderSelectChevron>
          <KeyboardArrowDown size={theme.iconSizes.base} />
        </StyledCalendarHeaderSelectChevron>
      </StyledCalendarHeaderSelectTrigger>
      <StyledCalendarHeaderSelectPopover
        ref={setFloatingRef}
        isNonModal
        data-testid="stDateInputHeaderPickerPopover"
      >
        <StyledCalendarHeaderSelectListBox items={items}>
          {renderPickerItem}
        </StyledCalendarHeaderSelectListBox>
      </StyledCalendarHeaderSelectPopover>
    </StyledCalendarHeaderSelect>
  )
}

/**
 * Shared prev/next navigation + month/year pickers for the calendar popover,
 * used by both `SingleDateInput` and (Branch 2) `RangeDateInput`. Must be
 * rendered as a child of `Calendar`/`RangeCalendar` — it reads calendar
 * state from React Aria's `CalendarStateContext`/`RangeCalendarStateContext`
 * via `CalendarMonthPicker`/`CalendarYearPicker`.
 *
 * `CalendarMonthPicker`/`CalendarYearPicker` are headless render-prop
 * components (confirmed via direct inspection of
 * `react-aria-components@1.19.0`'s `Calendar.mjs`/`useCalendarMonthPicker.d.ts`):
 * they hand back a plain `{ 'aria-label', value, onChange, items }` data
 * shape, not a pre-built dropdown. This was originally rendered as a native
 * `<select>` to sidestep a nested-popover-inside-popover concern, but a
 * native select's *open* dropdown list is painted entirely by the OS/browser
 * (checkmarks, vibrancy/blur, platform-default month abbreviations) with
 * essentially no CSS control — visibly inconsistent with the rest of
 * Streamlit's dropdowns. Composing RAC's own `Select`/`Popover`/`ListBox`
 * (the same primitives `Selectbox`'s combobox popover is built from)
 * instead gives full styling control over the open list too. Unlike
 * `Selectbox`/`Multiselect`, this `Popover` deliberately skips
 * `useFloatingOverlay`/Floating UI and just uses RAC's own default
 * `useOverlayPosition` anchoring — nesting a second Floating UI instance
 * inside the outer calendar popover's own Floating UI-positioned container
 * would add coordination complexity this small, always-on-screen dropdown
 * doesn't need.
 *
 * `format="long"` on `CalendarMonthPicker` requests full month names
 * ("January") to match the old BaseWeb `Datepicker`'s month dropdown — RAC's
 * default (no `format`) is abbreviated ("Jan").
 */
export function CalendarPopoverHeader(): ReactElement {
  return (
    <StyledCalendarHeader>
      <StyledCalendarHeaderButton slot="previous" aria-label="Previous month">
        <Icon content={ChevronLeft} size="base" />
      </StyledCalendarHeaderButton>
      <CalendarMonthPicker format="long">
        {({ "aria-label": ariaLabel, value, onChange, items }) => (
          <HeaderPickerSelect
            ariaLabel={ariaLabel}
            value={value}
            onChange={onChange}
            items={items}
          />
        )}
      </CalendarMonthPicker>
      <CalendarYearPicker>
        {({ "aria-label": ariaLabel, value, onChange, items }) => (
          <HeaderPickerSelect
            ariaLabel={ariaLabel}
            value={value}
            onChange={onChange}
            items={items}
          />
        )}
      </CalendarYearPicker>
      {/* Visually-hidden Heading kept for the accessible name RAC otherwise
          derives from it (screen readers still announce month/year via the
          selects above); avoids two duplicate announcements. */}
      <StyledCalendarHeadingFallback>
        <Heading />
      </StyledCalendarHeadingFallback>
      <StyledCalendarHeaderButton slot="next" aria-label="Next month">
        <Icon content={ChevronRight} size="base" />
      </StyledCalendarHeaderButton>
    </StyledCalendarHeader>
  )
}
