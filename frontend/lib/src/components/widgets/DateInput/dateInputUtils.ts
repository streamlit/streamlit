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
  CalendarDate,
  getLocalTimeZone,
  parseDate,
  today,
} from "@internationalized/date"
import type { DateSegment as IDateSegment } from "react-stately"

import { DateInput as DateInputProto } from "@streamlit/protobuf"

/**
 * Shared date logic for the React Aria-based `DateInput` (`SingleDateInput`/
 * `RangeDateInput`). Replaces `moment`/`date-fns` entirely for this
 * component: `@internationalized/date`'s `parseDate()`/`CalendarDate.toString()`
 * round-trip the wire format (ISO 8601, `YYYY-MM-DD`) exactly, since Python
 * never sends "moment objects" — only native `date`/`datetime`/`str` values,
 * serialized to plain ISO strings (see `_parse_date_value` and
 * `time_widgets.py`'s `date.strftime(v, "%Y-%m-%d")`). `element.format`'s
 * "moment notation" (`YYYY/MM/DD` etc.) is just a familiar token-naming
 * convention for the docs, not a runtime dependency on the `moment` package.
 * `date-fns` remains a dependency of `useIntlLocale.tsx` for `DateTimeInput`
 * (BaseWeb, out of scope here) only.
 */

export type FormatToken = "Y" | "M" | "D"

const TOKEN_TO_SEGMENT_TYPE: Record<FormatToken, "year" | "month" | "day"> = {
  Y: "year",
  M: "month",
  D: "day",
}

export interface FormatOrder {
  order: FormatToken[]
  separator: string
}

/**
 * Parses Streamlit's `format` string (e.g. "DD.MM.YYYY") into the segment
 * order and separator character. `format` is validated upstream by
 * `ALLOWED_DATE_FORMATS` in `time_widgets.py`, so it's always one of
 * YYYY/MM/DD, DD/MM/YYYY, or MM/DD/YYYY with `/`, `.`, or `-` as separator.
 */
export function parseFormatOrder(format: string): FormatOrder {
  const separatorMatch = format.match(/[/.-]/)
  const separator = separatorMatch ? separatorMatch[0] : "/"
  const order = format
    .split(separator)
    .map(token => token[0].toUpperCase() as FormatToken)
  return { order, separator }
}

function makeLiteralSegment(text: string): IDateSegment {
  return {
    type: "literal",
    text,
    isPlaceholder: false,
    placeholder: "",
    isEditable: false,
  }
}

/**
 * Reorders a `DateField`'s `segments` (from `useDateFieldState`) to match
 * `format`'s order/separator instead of the locale-derived order React Aria
 * would otherwise use, splicing in literal separator segments between them.
 *
 * This is the Phase 0 spike's chosen strategy (see the migration plan):
 * `react-aria`/`react-aria-components` key every segment mutation
 * (`state.increment`, `state.setSegment`, `state.clearSegment`) by
 * `segment.type`, and keyboard segment-to-segment navigation walks DOM/tab
 * order via `focusManager`, not the internal array order — so reordering the
 * array we render from can't desync interaction or accessibility behavior.
 */
export function reorderSegments(
  segments: readonly IDateSegment[],
  format: string
): IDateSegment[] {
  const { order, separator } = parseFormatOrder(format)
  const byType: Partial<Record<string, IDateSegment>> = {}
  for (const seg of segments) {
    if (seg.type === "year" || seg.type === "month" || seg.type === "day") {
      byType[seg.type] = seg
    }
  }

  const result: IDateSegment[] = []
  order.forEach((token, i) => {
    const seg = byType[TOKEN_TO_SEGMENT_TYPE[token]]
    if (seg) result.push(seg)
    if (i < order.length - 1) result.push(makeLiteralSegment(separator))
  })
  return result
}

/** Converts an ISO 8601 (`YYYY-MM-DD`) wire-format string to a `CalendarDate`. */
export function isoToCalendarDate(value: string): CalendarDate | null {
  if (!value) return null
  try {
    return parseDate(value)
  } catch {
    return null
  }
}

/** Converts a `CalendarDate` back to the ISO 8601 wire format. */
export function calendarDateToIso(value: CalendarDate): string {
  return value.toString()
}

/**
 * Converts a native JS `Date` (as emitted by the still-BaseWeb-backed range
 * mode's `onChange`) to a `CalendarDate` by extracting its local
 * year/month/day components and discarding any time-of-day.
 *
 * This conversion *is* the fix for the old `normalizeToStartOfDay` bug
 * workaround (BaseWeb's quick select emits noon, not midnight — see
 * streamlit/streamlit#12293): `CalendarDate` has no time component to get
 * wrong, so extracting just Y/M/D here can't reproduce that bug, regardless
 * of what time-of-day the source `Date` carries.
 */
export function dateToCalendarDate(date: Date): CalendarDate {
  return new CalendarDate(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  )
}

/**
 * `element.min` is always populated by the backend (`time_widgets.py` always
 * sends a value for it), so the `?? today(...)` fallback is defensive only.
 */
export function getMinDate(element: DateInputProto): CalendarDate {
  return isoToCalendarDate(element.min) ?? today(getLocalTimeZone())
}

/**
 * `element.max` can be empty, meaning "no upper bound" — this must stay
 * `undefined` (never a sentinel date) all the way through to `Calendar`'s
 * `maxValue` prop and the error-message logic.
 */
export function getMaxDate(element: DateInputProto): CalendarDate | undefined {
  return element.max
    ? (isoToCalendarDate(element.max) ?? undefined)
    : undefined
}

/**
 * Gate for enabling quick-select: only when `minDate` is more than 2 years
 * in the past. Replaces `moment().subtract(2, "years").toDate()`.
 */
export function isOlderThanTwoYears(date: CalendarDate): boolean {
  return date.compare(today(getLocalTimeZone()).subtract({ years: 2 })) < 0
}

export type DateValidationErrorType = "Start" | "End" | null

/**
 * Validates a single date against min/max, mirroring the original
 * `validateDates`'s per-date branching (`"Start"` if below min, `"End"` if
 * above max). Range mode (Branch 2) calls this once per endpoint.
 *
 * Note: the original `normalizeToStartOfDay` workaround (BaseWeb quick
 * select emitting noon instead of midnight, causing spurious boundary
 * errors — streamlit/streamlit#12293) is intentionally not ported.
 * `CalendarDate` has no time-of-day component at all, so that ambiguity is
 * structurally impossible to reproduce here.
 */
export function validateDate(
  date: CalendarDate | null,
  minDate: CalendarDate,
  maxDate: CalendarDate | undefined
): DateValidationErrorType {
  if (!date) return null
  if (maxDate && date.compare(maxDate) > 0) return "End"
  if (date.compare(minDate) < 0) return "Start"
  return null
}

function pad(value: number, length: number): string {
  return String(Math.abs(value)).padStart(length, "0")
}

/**
 * Formats a `CalendarDate` according to `format` (e.g. "DD.MM.YYYY"), used
 * for min/max date strings in error messages. Replaces the old
 * moment-to-date-fns token conversion + `date-fns`'s `format()` call — this
 * reuses the same order/separator parsing as the typed field, so no
 * date-fns dependency is needed here.
 */
export function formatCalendarDate(
  date: CalendarDate,
  format: string
): string {
  const { order, separator } = parseFormatOrder(format)
  return order
    .map(token => {
      if (token === "Y") return pad(date.year, 4)
      if (token === "M") return pad(date.month, 2)
      return pad(date.day, 2)
    })
    .join(separator)
}

/**
 * Builds the exact user-facing error message wording from the original
 * `DateInput.tsx`'s `createErrorMessage`, preserved verbatim (see the
 * migration plan's parity checklist — these strings are user-facing and may
 * be documented/screenshotted elsewhere).
 */
export function createDateErrorMessage(
  errorType: DateValidationErrorType,
  isRange: boolean,
  minDateString: string,
  maxDateString: string
): string | null {
  if (!errorType) return null

  if (isRange) {
    const messageEnding =
      errorType === "End"
        ? `before ${maxDateString}`
        : `after ${minDateString}`
    return `**Error**: ${errorType} date set outside allowed range. Please select a date ${messageEnding}.`
  }

  return `**Error**: Date set outside allowed range. Please select a date between ${minDateString} and ${maxDateString}.`
}

/**
 * Parses a full pasted date string (e.g. "15/01/2024") according to
 * `format`'s segment order, returning the parsed `CalendarDate` or `null` if
 * it can't be parsed as three separator-delimited numeric groups.
 *
 * Needed because `DateField`'s built-in paste handling parses clipboard text
 * using the locale-derived segment order from its `I18nProvider` — but the
 * typed field is pinned to a fixed `en-US` `I18nProvider` while its
 * *rendered* segments are independently reordered to match `format` (Phase 0
 * decision above). RAC's native paste logic has no awareness of that
 * reordering, so this must be parsed explicitly in an `onPaste` handler
 * rather than relying on `DateField`'s default paste behavior.
 */
export function parsePastedDate(
  text: string,
  format: string
): CalendarDate | null {
  const { order, separator } = parseFormatOrder(format)
  const escapedSep = separator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const re = new RegExp(
    `^(\\d{1,4})${escapedSep}(\\d{1,4})${escapedSep}(\\d{1,4})$`
  )
  const match = re.exec(text.trim())
  if (!match) return null

  const parts: Partial<Record<FormatToken, number>> = {}
  order.forEach((token, i) => {
    parts[token] = Number(match[i + 1])
  })
  const { Y: year, M: month, D: day } = parts
  if (year === undefined || month === undefined || day === undefined) {
    return null
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  try {
    return new CalendarDate(year, month, day)
  } catch {
    return null
  }
}

export type DateSegmentType = "year" | "month" | "day"

/**
 * Parses a partial paste (pure digits, no separator) targeting a single
 * focused segment — e.g. pasting "15" into just the day segment. Mirrors
 * `TimeInput.tsx`'s `handlePaste` partial-paste path. Returns `null` if the
 * text isn't 1-4 pure digits or `segmentType` isn't a real date segment.
 */
export function parsePartialSegmentPaste(
  text: string,
  segmentType: string | null
): { segmentType: DateSegmentType; value: number } | null {
  if (
    segmentType !== "year" &&
    segmentType !== "month" &&
    segmentType !== "day"
  ) {
    return null
  }
  const digitMatch = /^\d{1,4}$/.exec(text.trim())
  if (!digitMatch) return null
  return { segmentType, value: Number(text.trim()) }
}

/** Whether `value` is in-range for `segmentType` (month 1-12, day 1-31; year
 * has no fixed upper bound but is capped at 4 digits by the paste regex). */
export function isValidSegmentValue(
  segmentType: DateSegmentType,
  value: number
): boolean {
  if (segmentType === "month") return value >= 1 && value <= 12
  if (segmentType === "day") return value >= 1 && value <= 31
  return value >= 1
}
