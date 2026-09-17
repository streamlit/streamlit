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
 * Date utilities using `@internationalized/date`. Wire format is always
 * ISO 8601 (`YYYY-MM-DD`). `element.format` controls display order only.
 */

type FormatToken = "Y" | "M" | "D"

/**
 * Editable segments. Matched on `data-type` rather than `role`, which React Aria
 * replaces with `textbox` on iOS. Literals are the separators between segments.
 */
export const SEGMENT_SELECTOR = '[data-type]:not([data-type="literal"])'

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
 * Reorders segments to match `format`'s order/separator. Safe because RAC
 * keys mutations by segment.type and navigation uses DOM order, not array order.
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

export function isoToCalendarDate(value: string): CalendarDate | null {
  if (!value) return null
  try {
    return parseDate(value)
  } catch {
    return null
  }
}

export function calendarDateToIso(value: CalendarDate): string {
  return value.toString()
}

/** Value-based equality for CalendarDate (avoids object-identity pitfalls). */
export function datesEqual(
  a: CalendarDate | null,
  b: CalendarDate | null
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.compare(b) === 0
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

/** Seeds the calendar focused date so it stays controlled from mount
 * (avoids react-stately's uncontrolled→controlled warning). */
export function getInitialFocusedDate(
  value: string[],
  minDate: CalendarDate
): CalendarDate {
  const fromValue = value[0] ? isoToCalendarDate(value[0]) : null
  if (fromValue) return fromValue
  const now = today(getLocalTimeZone())
  return now.compare(minDate) < 0 ? minDate : now
}

/** Gate for enabling quick-select: only when `minDate` is more than 2 years in the past. */
export function isOlderThanTwoYears(date: CalendarDate): boolean {
  return date.compare(today(getLocalTimeZone()).subtract({ years: 2 })) < 0
}

export interface QuickSelectPreset {
  id: string
  label: string
  start: CalendarDate
  end: CalendarDate
}

/** Range-mode quick-select presets. `end` is always today. */
export function getQuickSelectPresets(): QuickSelectPreset[] {
  const end = today(getLocalTimeZone())
  return [
    { id: "pastWeek", label: "Past Week", start: end.subtract({ weeks: 1 }) },
    {
      id: "pastMonth",
      label: "Past Month",
      start: end.subtract({ months: 1 }),
    },
    {
      id: "pastThreeMonths",
      label: "Past 3 Months",
      start: end.subtract({ months: 3 }),
    },
    {
      id: "pastSixMonths",
      label: "Past 6 Months",
      start: end.subtract({ months: 6 }),
    },
    { id: "pastYear", label: "Past Year", start: end.subtract({ years: 1 }) },
    {
      id: "pastTwoYears",
      label: "Past 2 Years",
      start: end.subtract({ years: 2 }),
    },
  ].map(({ id, label, start }) => ({ id, label, start, end }))
}

export type DateValidationErrorType = "beforeMin" | "afterMax" | null

export function validateDate(
  date: CalendarDate | null,
  minDate: CalendarDate,
  maxDate: CalendarDate | undefined
): DateValidationErrorType {
  if (!date) return null
  if (maxDate && date.compare(maxDate) > 0) return "afterMax"
  if (date.compare(minDate) < 0) return "beforeMin"
  return null
}

function pad(value: number, length: number): string {
  return String(Math.abs(value)).padStart(length, "0")
}

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
 * Builds the out-of-range tooltip. In range mode, the message identifies the
 * violated bound rather than the edited field because either endpoint can
 * violate either bound.
 */
export function createDateErrorMessage(
  errorType: DateValidationErrorType,
  isRange: boolean,
  minDateString: string,
  maxDateString: string
): string | null {
  if (!errorType) return null

  if (errorType === "afterMax") {
    return `**Error**: Date set outside allowed range. Please select a date on or before ${maxDateString}.`
  }
  if (isRange || !maxDateString) {
    return `**Error**: Date set outside allowed range. Please select a date on or after ${minDateString}.`
  }
  return `**Error**: Date set outside allowed range. Please select a date between ${minDateString} and ${maxDateString}.`
}

/**
 * Parses a pasted date string (e.g. "15/01/2024") using `format`'s segment
 * order. Needed because the field's I18nProvider is pinned to en-US while
 * rendered segments are reordered to match `format`.
 */
export function parsePastedDate(
  text: string,
  format: string
): CalendarDate | null {
  const { order, separator } = parseFormatOrder(format)
  const escapedSep = separator.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")
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
    const result = new CalendarDate(year, month, day)
    // CalendarDate auto-clamps invalid days (e.g. April 31 → April 30).
    // Reject if the constructed date differs from what was pasted.
    if (result.day !== day) return null
    return result
  } catch {
    return null
  }
}

export type DateSegmentType = "year" | "month" | "day"

/** Splits a range paste on en/em dash, a hyphen with surrounding spaces, or "to". Does not treat the date-format hyphen as a delimiter. */
const RANGE_PASTE_SEPARATOR = /\s*[\u2013\u2014]\s*|\s+-\s+|\s+to\s+/i

export type ParsedDateFieldPaste =
  | { kind: "date"; date: CalendarDate }
  | { kind: "range"; start: CalendarDate; end: CalendarDate }
  | { kind: "partial"; segmentType: DateSegmentType; value: number }

/**
 * Parses a pasted range string (e.g. "2024/03/06 – 2024/03/08") using
 * `format`'s segment order for each half.
 */
export function parsePastedDateRange(
  text: string,
  format: string
): { start: CalendarDate; end: CalendarDate } | null {
  const parts = text.trim().split(RANGE_PASTE_SEPARATOR)
  if (parts.length !== 2) return null

  const start = parsePastedDate(parts[0].trim(), format)
  const end = parsePastedDate(parts[1].trim(), format)
  if (!start || !end) return null
  return { start, end }
}

/**
 * Parses clipboard text for a DateField. Tries, in order:
 * - a full start–end range, when `allowRangePaste` is set
 * - a single full date
 * - a partial year/month/day paste, when `segmentType` is a segment token
 */
export function parseDateFieldPaste(
  text: string,
  format: string,
  options: {
    allowRangePaste?: boolean
    segmentType?: string | null
  } = {}
): ParsedDateFieldPaste | null {
  const trimmed = text.trim()

  if (options.allowRangePaste) {
    const range = parsePastedDateRange(trimmed, format)
    if (range) return { kind: "range", ...range }
  }

  const date = parsePastedDate(trimmed, format)
  if (date) return { kind: "date", date }

  const partial = parsePartialSegmentPaste(
    trimmed,
    options.segmentType ?? null
  )
  if (!partial) return null
  return { kind: "partial", ...partial }
}

/**
 * Applies a partial segment paste to `base`. Returns null when the result
 * would be invalid — `CalendarDate` clamps overflow (April 31 becomes
 * April 30) rather than rejecting, so the round-trip is compared explicitly.
 */
export function applyPartialSegmentToDate(
  base: CalendarDate,
  partial: { segmentType: DateSegmentType; value: number }
): CalendarDate | null {
  const newDate = base.set({ [partial.segmentType]: partial.value })
  if (newDate[partial.segmentType] !== partial.value) return null
  return newDate
}

/** Parses a partial paste (pure digits, no separator) targeting a single segment. */
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

/** Whether `value` is in-range for `segmentType` (month 1-12, day 1-31).
 * Day uses a universal 1-31 range; month-specific limits are enforced
 * downstream by `CalendarDate`'s constructor which rejects invalid dates. */
export function isValidSegmentValue(
  segmentType: DateSegmentType,
  value: number
): boolean {
  if (segmentType === "month") return value >= 1 && value <= 12
  if (segmentType === "day") return value >= 1 && value <= 31
  return value >= 1
}

export const noop = (): void => {}

/** Ensures start <= end for a two-element ISO date array (lexicographic). */
export function normalizeRangeOrder(isoValues: string[]): string[] {
  if (isoValues.length === 2 && isoValues[0] > isoValues[1]) {
    return [isoValues[1], isoValues[0]]
  }
  return isoValues
}

/**
 * Validates `locale` as a well-formed BCP-47 tag, falling back to `en-US`.
 * `Intl.Locale`/`Intl.DateTimeFormat` throw a `RangeError` for malformed tags,
 * so React Aria's `I18nProvider` must never receive an unvalidated string.
 */
export function getSafeLocale(locale: string): string {
  try {
    return new Intl.Locale(locale).toString()
  } catch {
    return "en-US"
  }
}
