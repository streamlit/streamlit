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

import {
  ContextType,
  KeyboardEvent,
  ReactElement,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react"

import { KeyboardArrowDown } from "@emotion-icons/material-outlined"
import { ArrowBack, ArrowForward } from "@emotion-icons/material-rounded"
import {
  CalendarDate,
  endOfMonth,
  startOfMonth,
  toCalendar,
  toCalendarDate,
} from "@internationalized/date"
import { useDateFormatter } from "react-aria"
import {
  CalendarMonthPicker,
  CalendarStateContext,
  CalendarYearPicker,
  Heading,
  Key,
  RangeCalendarStateContext,
} from "react-aria-components"

import Icon from "~lib/components/shared/Icon/Icon"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useOverlayDismissal } from "~lib/hooks/useOverlayDismissal"
import { isNullOrUndefined } from "~lib/util/utils"

import { noop } from "./dateInputUtils"
import {
  StyledCalendarHeader,
  StyledCalendarHeaderButton,
  StyledCalendarHeaderPickerGroup,
  StyledCalendarHeaderSelect,
  StyledCalendarHeaderSelectChevron,
  StyledCalendarHeaderSelectTrigger,
  StyledCalendarHeadingFallback,
  StyledDropdownListBox,
  StyledDropdownListBoxItem,
  StyledDropdownPopover,
} from "./styled-components"

interface HeaderPickerItem {
  id: number
  formatted: string
  isDisabled?: boolean
}

/** Marks the month/year picker popover so the calendar ignores nested clicks and Escape. */
export const DATE_INPUT_HEADER_PICKER_POPOVER_CLASS =
  "stDateInputHeaderPickerPopover"

// Item is untyped because styled(ListBox) erases RAC's generic.
const renderPickerItem = (item: unknown): ReactElement => {
  const pickerItem = item as HeaderPickerItem
  return (
    <StyledDropdownListBoxItem
      id={pickerItem.id}
      isDisabled={pickerItem.isDisabled}
    >
      {pickerItem.formatted}
    </StyledDropdownListBoxItem>
  )
}

/**
 * Controlled Select so we can use `isNonModal` on the popover — without it,
 * RAC marks the rest of the page (including the outer calendar) as inert.
 * `useOverlayDismissal` provides the outside-click dismissal that isNonModal
 * disables.
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
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const { setFloatingRef, setReferenceRef } = useOverlayDismissal({
    isOpen,
    onClose: () => setIsOpen(false),
    // No floating-ui positioning needed — the picker uses CSS absolute positioning.
    floatingSetFn: noop,
  })

  const handlePickerKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.key === "Tab") {
        e.preventDefault()
        e.stopPropagation()
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    },
    []
  )

  return (
    <StyledCalendarHeaderSelect
      aria-label={ariaLabel}
      selectedKey={value}
      onSelectionChange={onChange}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
    >
      <StyledCalendarHeaderSelectTrigger
        ref={(node: HTMLButtonElement | null) => {
          triggerRef.current = node
          setReferenceRef(node)
        }}
      >
        {selectedLabel}
        <StyledCalendarHeaderSelectChevron>
          <KeyboardArrowDown size={theme.iconSizes.base} />
        </StyledCalendarHeaderSelectChevron>
      </StyledCalendarHeaderSelectTrigger>
      <StyledDropdownPopover
        className={DATE_INPUT_HEADER_PICKER_POPOVER_CLASS}
        ref={setFloatingRef}
        isNonModal
        data-testid="stDateInputHeaderPickerPopover"
      >
        {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div onKeyDown={handlePickerKeyDown}>
          <StyledDropdownListBox items={items}>
            {renderPickerItem}
          </StyledDropdownListBox>
        </div>
      </StyledDropdownPopover>
    </StyledCalendarHeaderSelect>
  )
}

/**
 * Number of year options offered at once, matching React Aria's `visibleYears`
 * default so the dropdown keeps its familiar length.
 */
const VISIBLE_YEARS = 20

/**
 * Calendar state from the single or range calendar context, or null when
 * neither provider is above this component.
 */
type CalendarHeaderState =
  | ContextType<typeof CalendarStateContext>
  | ContextType<typeof RangeCalendarStateContext>

/**
 * Builds the year dropdown's options and selected value, replacing React Aria's,
 * which gets two things wrong for Streamlit's bounds:
 *
 * - Its list steps whole years from `minValue`, so it drops the final year
 *   whenever `maxValue`'s month/day precedes `minValue`'s (2024-08-03 ->
 *   2025-02-03 lists only 2024).
 * - Its `value` is an index that falls back to 0 when the focused year is
 *   missing, so the trigger names a year the grid isn't on.
 *
 * See https://github.com/streamlit/streamlit/issues/16686.
 *
 * Keys are year numbers, which is safe only because the bounds are converted
 * into the focused date's calendar first: the visitor's locale picks the
 * calendar system, so `minValue`/`maxValue` arrive Gregorian while `focusedDate`
 * may be Buddhist or Persian. React Aria keys by index to survive era resets in
 * calendars like the Japanese; that can't reach us, because the locale comes
 * from `window.navigator.language` (see `LibConfigContext`), which never carries
 * `-u-ca-japanese`.
 */
function useYearPickerItems(state: CalendarHeaderState): {
  items: HeaderPickerItem[]
  value: number
} {
  const formatter = useDateFormatter({
    year: "numeric",
    calendar: state?.focusedDate.calendar.identifier,
    timeZone: state?.timeZone,
  })

  if (!state) return { items: [], value: 0 }

  const { focusedDate, timeZone } = state
  const { calendar } = focusedDate
  const focusedYear = focusedDate.year

  /** Reads a bound's year in the focused date's calendar system. */
  const boundYear = (
    bound: typeof state.minValue,
    fallback: number
  ): number =>
    bound ? toCalendar(toCalendarDate(bound), calendar).year : fallback

  const halfWindow = Math.floor(VISIBLE_YEARS / 2)
  // The fallbacks are defensive: Streamlit's backend always sends both bounds.
  const minYear = boundYear(state.minValue, focusedYear - halfWindow)
  const maxYear = boundYear(state.maxValue, focusedYear + halfWindow)

  // Anchor a VISIBLE_YEARS window on the focused year, then slide it inside
  // [minYear, maxYear]. React Aria centers the window as
  // [focused - 10, focused + 9]; mirror that.
  const anchorEnd = Math.min(
    focusedYear + Math.ceil(VISIBLE_YEARS / 2) - 1,
    maxYear
  )
  const startYear = Math.max(anchorEnd - VISIBLE_YEARS + 1, minYear)
  const endYear = Math.min(startYear + VISIBLE_YEARS - 1, maxYear)

  const items: HeaderPickerItem[] = []
  for (let year = startYear; year <= endYear; year++) {
    items.push({
      id: year,
      formatted: formatter.format(focusedDate.set({ year }).toDate(timeZone)),
    })
  }

  // The window always contains the focused year when `focusedDate` is in
  // bounds. It can fall outside for a single render, while React Aria corrects
  // a controlled `focusedValue` through `onFocusChange`; clamp so the trigger
  // shows a year rather than going blank. Clamping rather than widening keeps
  // the list bounded — a focused year far outside the bounds would otherwise
  // stretch it to hundreds of options.
  return {
    items,
    value: Math.min(Math.max(focusedYear, startYear), endYear),
  }
}

/**
 * Copies React Aria's month options, disabling the ones that hold no selectable
 * day. React Aria offers every month in the focused year regardless of the
 * bounds, and picking an unreachable one relocates the calendar entirely
 * (`constrainValue` clamps to the nearest bound), so the user asks for January
 * and lands in August.
 *
 * Mapping over React Aria's items rather than rebuilding 1-12 keeps the month
 * count right in calendars whose year length varies, like the Hebrew.
 *
 * Only months where *every* day is out of bounds get disabled. Partly reachable
 * months stay selectable — with `maxValue` 2025-02-03, February 2025 still
 * offers the 1st through the 3rd.
 */
function markUnavailableMonths(
  items: readonly { id: number; formatted: string; date: CalendarDate }[],
  state: NonNullable<CalendarHeaderState>
): HeaderPickerItem[] {
  // No calendar conversion needed here: `compare` works on absolute days, so a
  // Buddhist month start compares correctly against a Gregorian bound. Year
  // *numbers* do need converting — see useYearPickerItems.
  const minDate = state.minValue ? toCalendarDate(state.minValue) : null
  const maxDate = state.maxValue ? toCalendarDate(state.maxValue) : null

  return items.map(({ id, formatted, date }) => ({
    id,
    formatted,
    isDisabled:
      (maxDate !== null && startOfMonth(date).compare(maxDate) > 0) ||
      (minDate !== null && endOfMonth(date).compare(minDate) < 0),
  }))
}

/**
 * Shared calendar header (prev/next nav + month/year pickers).
 * Must be a child of `Calendar`/`RangeCalendar` to access calendar state.
 * Uses RAC `Select`/`Popover`/`ListBox` (not native `<select>`) for
 * consistent styling with other Streamlit dropdowns.
 */
export function CalendarPopoverHeader(): ReactElement {
  const calendarState = useContext(CalendarStateContext)
  const rangeCalendarState = useContext(RangeCalendarStateContext)
  const state = calendarState || rangeCalendarState
  const { items: yearItems, value: yearValue } = useYearPickerItems(state)

  // Keys are year numbers, so picking one changes only the year and keeps the
  // focused month. React Aria's own onChange would move the month too: each of
  // its items carries the window start's month/day — usually minValue's — not
  // the focused month.
  const handleYearChange = useCallback(
    (key: Key | null): void => {
      if (isNullOrUndefined(key) || !state) return
      state.setFocusedDate(state.focusedDate.set({ year: Number(key) }))
    },
    [state]
  )

  return (
    <StyledCalendarHeader>
      <StyledCalendarHeaderButton slot="previous" aria-label="Previous month">
        <Icon content={ArrowBack} size="base" />
      </StyledCalendarHeaderButton>
      <StyledCalendarHeaderPickerGroup>
        <CalendarMonthPicker format="long">
          {({ "aria-label": ariaLabel, value, onChange, items }) => (
            <HeaderPickerSelect
              ariaLabel={ariaLabel}
              value={value}
              onChange={onChange}
              items={state ? markUnavailableMonths(items, state) : items}
            />
          )}
        </CalendarMonthPicker>
        {/* items/value come from useYearPickerItems, not React Aria.
            CalendarYearPicker is kept mounted, rather than inlining its label,
            so this workaround reverts cleanly once the upstream fix lands:
            https://github.com/adobe/react-spectrum/issues/10531 */}
        <CalendarYearPicker>
          {({ "aria-label": ariaLabel }) => (
            <HeaderPickerSelect
              ariaLabel={ariaLabel}
              value={yearValue}
              onChange={handleYearChange}
              items={yearItems}
            />
          )}
        </CalendarYearPicker>
        {/* Visually-hidden Heading kept for the accessible name RAC otherwise
            derives from it (screen readers still announce month/year via the
            selects above); avoids two duplicate announcements. */}
        <StyledCalendarHeadingFallback>
          <Heading />
        </StyledCalendarHeadingFallback>
      </StyledCalendarHeaderPickerGroup>
      <StyledCalendarHeaderButton slot="next" aria-label="Next month">
        <Icon content={ArrowForward} size="base" />
      </StyledCalendarHeaderButton>
    </StyledCalendarHeader>
  )
}
