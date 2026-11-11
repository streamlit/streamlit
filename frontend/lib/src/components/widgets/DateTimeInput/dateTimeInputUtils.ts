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

import { CalendarDate, CalendarDateTime, Time } from "@internationalized/date"

import type { DateTimeInput as DateTimeInputProto } from "@streamlit/protobuf"
import { isNullOrEmptyString } from "@streamlit/utils"

import {
  parseFormatOrder,
  SEGMENT_SELECTOR,
} from "~lib/components/widgets/DateInput/dateInputUtils"
import { snapTimeParts } from "~lib/components/widgets/timeStepSnap"
import type { ValueWithSource } from "~lib/hooks/useBasicWidgetState"
import type { WidgetStateManager } from "~lib/WidgetStateManager"

export { SEGMENT_SELECTOR }

function pad(value: number, length: number): string {
  return String(Math.abs(value)).padStart(length, "0")
}

/**
 * Parse an ISO datetime string (`YYYY-MM-DDTHH:mm` or `YYYY-MM-DDTHH:mm:ss`)
 * into a CalendarDateTime. Optional seconds are preserved when present.
 */
export function isoToCalendarDateTime(
  value: string | null | undefined
): CalendarDateTime | null {
  if (isNullOrEmptyString(value)) return null
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::([0-5]\d))?$/.exec(
      value.trim()
    )
  if (!match) return null
  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr] = match
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  const hour = Number(hourStr)
  const minute = Number(minuteStr)
  const second = secondStr ? Number(secondStr) : 0
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  try {
    const result = new CalendarDateTime(year, month, day, hour, minute, second)
    if (result.day !== day) return null
    return result
  } catch {
    return null
  }
}

/**
 * Serialize a CalendarDateTime to the wire format.
 * Appends `:ss` only when `includeSeconds` is true. Callers set it for
 * sub-minute steps.
 */
export function calendarDateTimeToIso(
  dt: CalendarDateTime,
  includeSeconds = false
): string {
  const base = `${pad(dt.year, 4)}-${pad(dt.month, 2)}-${pad(dt.day, 2)}T${pad(dt.hour, 2)}:${pad(dt.minute, 2)}`
  return includeSeconds ? `${base}:${pad(dt.second, 2)}` : base
}

/** Value-based equality for CalendarDateTime (avoids object-identity pitfalls). */
export function dateTimesEqual(
  a: CalendarDateTime | null,
  b: CalendarDateTime | null
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.compare(b) === 0
}

export type DateTimeValidationErrorType = "beforeMin" | "afterMax" | null

export function validateDateTime(
  dt: CalendarDateTime | null,
  minDateTime: CalendarDateTime | null,
  maxDateTime: CalendarDateTime | null
): DateTimeValidationErrorType {
  if (!dt) return null
  if (maxDateTime && dt.compare(maxDateTime) > 0) return "afterMax"
  if (minDateTime && dt.compare(minDateTime) < 0) return "beforeMin"
  return null
}

/** Format a CalendarDateTime for error messages using the element's date format + time. */
export function formatCalendarDateTime(
  dt: CalendarDateTime,
  dateFormat: string,
  includeSeconds = false
): string {
  const { order, separator } = parseFormatOrder(dateFormat)
  const datePart = order
    .map(token => {
      if (token === "Y") return pad(dt.year, 4)
      if (token === "M") return pad(dt.month, 2)
      return pad(dt.day, 2)
    })
    .join(separator)
  const timePart = includeSeconds
    ? `${pad(dt.hour, 2)}:${pad(dt.minute, 2)}:${pad(dt.second, 2)}`
    : `${pad(dt.hour, 2)}:${pad(dt.minute, 2)}`
  return `${datePart}, ${timePart}`
}

/** Build the user-facing error message for out-of-range datetimes.
 * afterMax always shows just the upper bound (mentioning min adds noise).
 * beforeMin shows the full range when both bounds exist, or just min otherwise. */
export function createDateTimeErrorMessage(
  errorType: DateTimeValidationErrorType,
  minString: string,
  maxString: string
): string | null {
  if (!errorType) return null
  if (errorType === "afterMax") {
    return `**Error**: Date and time set outside allowed range. Please select a date and time on or before ${maxString}.`
  }
  if (!maxString) {
    return `**Error**: Date and time set outside allowed range. Please select a date and time on or after ${minString}.`
  }
  return `**Error**: Date and time set outside allowed range. Please select a date and time between ${minString} and ${maxString}.`
}

/**
 * Parse a pasted datetime string. Supports both the ISO wire format
 * (`YYYY-MM-DDTHH:mm` or with `:ss`) and the display format
 * (`DD/MM/YYYY, HH:mm` or with `:ss`).
 */
export function parsePastedDateTime(
  text: string,
  dateFormat: string
): CalendarDateTime | null {
  const trimmed = text.trim()

  const isoResult = isoToCalendarDateTime(trimmed)
  if (isoResult) return isoResult

  const { order, separator } = parseFormatOrder(dateFormat)
  const escapedSep = separator.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const datePartRe = `(\\d{1,4})${escapedSep}(\\d{1,4})${escapedSep}(\\d{1,4})`
  const timePartRe = `(\\d{1,2}):(\\d{2})(?::([0-5]\\d))?`
  const re = new RegExp(`^${datePartRe}[,\\s]+${timePartRe}$`)
  const match = re.exec(trimmed)
  if (!match) return null

  const parts: Partial<Record<"Y" | "M" | "D", number>> = {}
  order.forEach((token, i) => {
    parts[token] = Number(match[i + 1])
  })
  const { Y: year, M: month, D: day } = parts
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = match[6] ? Number(match[6]) : 0
  if (year === undefined || month === undefined || day === undefined)
    return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null

  try {
    const result = new CalendarDateTime(year, month, day, hour, minute, second)
    if (result.day !== day) return null
    return result
  } catch {
    return null
  }
}

/**
 * Apply step-snapping to a CalendarDateTime based on segment type and step.
 * Returns the new datetime if snapping applies, or null if default behavior should be used.
 */
export function computeStepSnap(
  current: CalendarDateTime,
  segmentType: string | null,
  step: number,
  up: boolean
): CalendarDateTime | null {
  const snapped = snapTimeParts(
    {
      hour: current.hour,
      minute: current.minute,
      second: current.second,
    },
    segmentType,
    step,
    up
  )
  if (!snapped) return null
  return current.set(snapped)
}

// --- Segment state helper ---

export interface SegmentState {
  totalSegments: number
  placeholderCount: number
  isPartiallyTyped: boolean
  isFullyCleared: boolean
}

/** Query the editable segments in a container to determine their placeholder state. */
export function getSegmentState(container: HTMLElement): SegmentState {
  const segments = container.querySelectorAll(SEGMENT_SELECTOR)
  const placeholders = container.querySelectorAll(
    `${SEGMENT_SELECTOR}[data-placeholder="true"]`
  )
  const totalSegments = segments.length
  const placeholderCount = placeholders.length
  return {
    totalSegments,
    placeholderCount,
    isPartiallyTyped: placeholderCount > 0 && placeholderCount < totalSegments,
    isFullyCleared: totalSegments > 0 && placeholderCount === totalSegments,
  }
}

const SEGMENT_MAX = {
  hour: 23,
  minute: 59,
  second: 59,
  year: 9999,
  month: 12,
  day: 31,
} as const

/**
 * Recover one segment's value from the DOM, for the window before the field has
 * emitted an `onChange`. Null when the segment is absent, still a placeholder, or
 * outside its range.
 *
 * Matches on `data-type` rather than `role`, so iOS is included: React Aria
 * renders segments there as textboxes, not spinbuttons, and drops
 * `aria-valuenow`, hence the `textContent` fallback. Safe to parse — both fields
 * are pinned to en-US so the digits are ASCII, and `shouldForceLeadingZeros` only
 * ever prefixes a zero. The `data-placeholder` filter also guards that fallback,
 * where a placeholder's dashes would otherwise parse.
 *
 * Range-guarded so a value the caller cannot represent degrades to "not given"
 * rather than reaching a `Time` or `CalendarDate` constructor: `Time` stores
 * whatever it is handed, and `CalendarDate` silently clamps.
 */
function readSegment(
  container: HTMLElement | null,
  type: keyof typeof SEGMENT_MAX
): number | null {
  const max = SEGMENT_MAX[type]
  const segment = container?.querySelector(
    `[data-type="${type}"]:not([data-placeholder="true"])`
  )
  if (!segment) return null
  const raw = segment.getAttribute("aria-valuenow") ?? segment.textContent
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= max
    ? parsed
    : null
}

/**
 * Read hour, minute, and optional second from a container's rendered segments,
 * for the window before the field has emitted an `onChange`. Returns null when
 * hour, minute, and second are all empty.
 *
 * `DateField` and `TimeField` both withhold `onChange` until every one of their
 * segments is filled, so a time entered while its partner segments are still
 * placeholders reaches no handler — the rendered segments are its only record.
 * Unfilled segments count as 0, so a lone hour, minute, or second still
 * produces a time (e.g. seconds-only drafts with a sub-minute step).
 *
 * Assumes a 24-hour cycle: with `hourCycle={12}` the hour reports 1–12 and needs
 * the `dayPeriod` segment to disambiguate.
 */
export function getTypedTimeFromDom(
  container: HTMLElement | null
): Time | null {
  const hour = readSegment(container, "hour")
  const minute = readSegment(container, "minute")
  const second = readSegment(container, "second")
  if (hour === null && minute === null && second === null) return null
  return new Time(hour ?? 0, minute ?? 0, second ?? 0)
}

/**
 * Read year, month and day from a container's rendered segments, before the
 * field has emitted an `onChange`. Returns null unless all three are filled and
 * form a real date.
 *
 * Unlike a time, a date has nothing to default: a missing part means no date.
 * The day segment's maximum is the longest month rather than the current one, so
 * `2025/02/30` is typeable — the `CalendarDate` constructor clamps it to Feb 28,
 * so reading the day back out rejects it. Same check `isoToCalendarDateTime` uses.
 */
export function getTypedDateFromDom(
  container: HTMLElement | null
): CalendarDate | null {
  const year = readSegment(container, "year")
  const month = readSegment(container, "month")
  const day = readSegment(container, "day")
  if (year === null || month === null || day === null) return null
  if (year < 1 || month < 1 || day < 1) return null
  const result = new CalendarDate(year, month, day)
  return result.day === day ? result : null
}

// --- useBasicWidgetState integration ---

export function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: DateTimeInputProto
): string | null | undefined {
  const values = widgetMgr.getStringArrayValue(element)
  if (values === undefined) return undefined
  return values.length > 0 ? values[0] : null
}

export function getDefaultStateFromProto(
  element: DateTimeInputProto
): string | null {
  return element.default.length ? element.default[0] : null
}

export function getCurrStateFromProto(
  element: DateTimeInputProto
): string | null {
  return element.value.length ? element.value[0] : null
}

export function updateWidgetMgrState(
  element: DateTimeInputProto,
  widgetMgr: WidgetStateManager,
  vws: ValueWithSource<string | null>,
  fragmentId: string | undefined
): void {
  const minDateTime = isoToCalendarDateTime(element.min)
  const maxDateTime = isoToCalendarDateTime(element.max)

  const setArrayValue = (val: string | null): void => {
    widgetMgr.setStringArrayValue(
      element.id,
      isNullOrEmptyString(val) ? [] : [val],
      {
        formId: element.formId,
        fragmentId,
        fromUser: vws.fromUser,
        // on_change="ignore" buffers the value without scheduling a rerun.
        // WidgetStateManager ignores triggerRerun inside forms (the form owns
        // commit timing).
        ...(element.ignoreRerun ? { triggerRerun: false } : {}),
      }
    )
  }

  if (!isNullOrEmptyString(vws.value)) {
    const dt = isoToCalendarDateTime(vws.value)
    if (dt) {
      const isOutOfBounds = !!validateDateTime(dt, minDateTime, maxDateTime)
      if (!isOutOfBounds) {
        setArrayValue(vws.value)
      }
      return
    }
  }

  setArrayValue(vws.value)
}
