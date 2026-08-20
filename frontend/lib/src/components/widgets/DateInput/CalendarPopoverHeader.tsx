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
  date?: { year: number; month: number; day: number }
}

// Item is untyped because styled(ListBox) erases RAC's generic.
const renderPickerItem = (item: unknown): ReactElement => {
  const pickerItem = item as HeaderPickerItem
  return (
    <StyledDropdownListBoxItem id={pickerItem.id}>
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
        ref={setFloatingRef}
        isNonModal
        data-testid="stDateInputHeaderPickerPopover"
      >
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
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
 * Shared calendar header (prev/next nav + month/year pickers).
 * Must be a child of `Calendar`/`RangeCalendar` to access calendar state.
 * Uses RAC `Select`/`Popover`/`ListBox` (not native `<select>`) for
 * consistent styling with other Streamlit dropdowns.
 */
export function CalendarPopoverHeader(): ReactElement {
  const calendarState = useContext(CalendarStateContext)
  const rangeCalendarState = useContext(RangeCalendarStateContext)
  const state = calendarState || rangeCalendarState

  // Workaround for React Aria bug: CalendarYearPicker's items may embed a
  // stale month when focusedValue is controlled. When the user changes the
  // month and then picks a year, the library would propagate the old month
  // from items[key].date. We intercept onChange to use state.focusedDate
  // (which always reflects the correct month) and only change the year.
  const handleYearChange = useCallback(
    (key: Key | null, items: HeaderPickerItem[]): void => {
      if (isNullOrUndefined(key) || !state) return
      const selectedItem = items.find(i => i.id === Number(key))
      if (!selectedItem) return
      const selectedYear = selectedItem.date?.year
      if (isNullOrUndefined(selectedYear)) return
      state.setFocusedDate(state.focusedDate.set({ year: selectedYear }))
    },
    [state]
  )

  return (
    <StyledCalendarHeader>
      {/* No aria-label on the nav buttons: React Aria's ButtonContext supplies
          a localized "Previous"/"Next" for these slots, and a local aria-label
          would override it (mergeProps prefers the local prop). */}
      <StyledCalendarHeaderButton slot="previous">
        <Icon content={ArrowBack} size="base" />
      </StyledCalendarHeaderButton>
      <StyledCalendarHeaderPickerGroup>
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
          {({ "aria-label": ariaLabel, value, items }) => (
            <HeaderPickerSelect
              ariaLabel={ariaLabel}
              value={value}
              onChange={key => handleYearChange(key, items)}
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
      </StyledCalendarHeaderPickerGroup>
      <StyledCalendarHeaderButton slot="next">
        <Icon content={ArrowForward} size="base" />
      </StyledCalendarHeaderButton>
    </StyledCalendarHeader>
  )
}
