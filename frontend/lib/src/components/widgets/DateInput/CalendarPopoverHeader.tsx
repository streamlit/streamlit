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

import { ReactElement } from "react"

import { ChevronLeft, ChevronRight } from "@emotion-icons/material-outlined"
import {
  Button,
  CalendarMonthPicker,
  CalendarYearPicker,
  Heading,
} from "react-aria-components"

import Icon from "~lib/components/shared/Icon/Icon"

import {
  StyledCalendarHeader,
  StyledCalendarHeaderButton,
  StyledCalendarHeaderSelect,
  StyledCalendarHeadingFallback,
} from "./styled-components"

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
 * shape, not a pre-built dropdown. Rendering that as a native `<select>`
 * (rather than composing RAC's own `Select`/`Popover`/`ListBox`) avoids a
 * nested-popover-inside-popover z-index problem entirely, since native
 * `<select>` dropdowns are painted by the browser itself, not positioned by
 * our own floating-ui/CSS stacking.
 */
export function CalendarPopoverHeader(): ReactElement {
  return (
    <StyledCalendarHeader>
      <Button slot="previous" aria-label="Previous month">
        <StyledCalendarHeaderButton>
          <Icon content={ChevronLeft} size="base" />
        </StyledCalendarHeaderButton>
      </Button>
      <CalendarMonthPicker>
        {({ "aria-label": ariaLabel, value, onChange, items }) => (
          <StyledCalendarHeaderSelect
            aria-label={ariaLabel}
            value={value}
            onChange={e => onChange(Number(e.target.value))}
          >
            {items.map(item => (
              <option key={item.id} value={item.id}>
                {item.formatted}
              </option>
            ))}
          </StyledCalendarHeaderSelect>
        )}
      </CalendarMonthPicker>
      <CalendarYearPicker>
        {({ "aria-label": ariaLabel, value, onChange, items }) => (
          <StyledCalendarHeaderSelect
            aria-label={ariaLabel}
            value={value}
            onChange={e => onChange(Number(e.target.value))}
          >
            {items.map(item => (
              <option key={item.id} value={item.id}>
                {item.formatted}
              </option>
            ))}
          </StyledCalendarHeaderSelect>
        )}
      </CalendarYearPicker>
      {/* Visually-hidden Heading kept for the accessible name RAC otherwise
          derives from it (screen readers still announce month/year via the
          selects above); avoids two duplicate announcements. */}
      <StyledCalendarHeadingFallback>
        <Heading />
      </StyledCalendarHeadingFallback>
      <Button slot="next" aria-label="Next month">
        <StyledCalendarHeaderButton>
          <Icon content={ChevronRight} size="base" />
        </StyledCalendarHeaderButton>
      </Button>
    </StyledCalendarHeader>
  )
}
