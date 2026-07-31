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
import { ArrowBack, ArrowForward } from "@emotion-icons/material-rounded"
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
  StyledCalendarHeaderPickerGroup,
  StyledCalendarHeaderSelect,
  StyledCalendarHeaderSelectChevron,
  StyledCalendarHeaderSelectListBox,
  StyledCalendarHeaderSelectListBoxItem,
  StyledCalendarHeaderSelectPopover,
  StyledCalendarHeaderSelectTrigger,
  StyledCalendarHeadingFallback,
} from "./styled-components"

interface HeaderPickerItem {
  id: number
  formatted: string
}

// Item is untyped because styled(ListBox) erases RAC's generic.
const renderPickerItem = (item: unknown): ReactElement => {
  const pickerItem = item as HeaderPickerItem
  return (
    <StyledCalendarHeaderSelectListBoxItem id={pickerItem.id}>
      {pickerItem.formatted}
    </StyledCalendarHeaderSelectListBoxItem>
  )
}

const noop = (): void => {}

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
 * Shared calendar header (prev/next nav + month/year pickers).
 * Must be a child of `Calendar`/`RangeCalendar` to access calendar state.
 * Uses RAC `Select`/`Popover`/`ListBox` (not native `<select>`) for
 * consistent styling with other Streamlit dropdowns.
 */
export function CalendarPopoverHeader(): ReactElement {
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
      </StyledCalendarHeaderPickerGroup>
      <StyledCalendarHeaderButton slot="next" aria-label="Next month">
        <Icon content={ArrowForward} size="base" />
      </StyledCalendarHeaderButton>
    </StyledCalendarHeader>
  )
}
