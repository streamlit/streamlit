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

import { CalendarDateTime } from "@internationalized/date"

import { DateTimeInput as DateTimeInputProto } from "@streamlit/protobuf"

import { parseFormatOrder } from "~lib/components/widgets/DateInput/dateInputUtils"
import { ValueWithSource } from "~lib/hooks/useBasicWidgetState"
import { WidgetStateManager } from "~lib/WidgetStateManager"

function pad(value: number, length: number): string {
  return String(Math.abs(value)).padStart(length, "0")
}

/** Parse an ISO datetime string (`YYYY-MM-DDTHH:mm` or `YYYY-MM-DDTHH:mm:ss`) into a CalendarDateTime. Seconds are accepted but discarded. */
export function isoToCalendarDateTime(
  value: string | null | undefined
): CalendarDateTime | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::[0-5]\d)?$/.exec(
    value.trim()
  )
  if (!match) return null
  const [, yearStr, monthStr, dayStr, hourStr, minuteStr] = match
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  const hour = Number(hourStr)
  const minute = Number(minuteStr)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  try {
    const result = new CalendarDateTime(year, month, day, hour, minute)
    if (result.day !== day) return null
    return result
  } catch {
    return null
  }
}

/** Serialize a CalendarDateTime to the wire format (`YYYY-MM-DDTHH:mm`). */
export function calendarDateTimeToIso(dt: CalendarDateTime): string {
  return `${pad(dt.year, 4)}-${pad(dt.month, 2)}-${pad(dt.day, 2)}T${pad(dt.hour, 2)}:${pad(dt.minute, 2)}`
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
  dateFormat: string
): string {
  const { order, separator } = parseFormatOrder(dateFormat)
  const datePart = order
    .map(token => {
      if (token === "Y") return pad(dt.year, 4)
      if (token === "M") return pad(dt.month, 2)
      return pad(dt.day, 2)
    })
    .join(separator)
  return `${datePart}, ${pad(dt.hour, 2)}:${pad(dt.minute, 2)}`
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
 * (`YYYY-MM-DDTHH:mm`) and the display format (`DD/MM/YYYY, HH:mm` etc).
 */
export function parsePastedDateTime(
  text: string,
  dateFormat: string
): CalendarDateTime | null {
  const trimmed = text.trim()

  const isoResult = isoToCalendarDateTime(trimmed)
  if (isoResult) return isoResult

  const { order, separator } = parseFormatOrder(dateFormat)
  const escapedSep = separator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const datePartRe = `(\\d{1,4})${escapedSep}(\\d{1,4})${escapedSep}(\\d{1,4})`
  const timePartRe = `(\\d{1,2}):(\\d{2})`
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
  if (year === undefined || month === undefined || day === undefined)
    return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null

  try {
    const result = new CalendarDateTime(year, month, day, hour, minute)
    if (result.day !== day) return null
    return result
  } catch {
    return null
  }
}

// --- Step-snapping arithmetic ---

/**
 * Compute the next step-snapped value given the current total, step size,
 * direction, and wrap boundary. Used for minute-granular (max=1440) and
 * hour-only (max=24) step snapping on ArrowUp/ArrowDown.
 */
export function snapTimeStep(
  current: number,
  step: number,
  up: boolean,
  max: number
): number {
  const next = up
    ? Math.floor(current / step) * step + step
    : Math.ceil(current / step) * step - step
  if (next >= max) return 0
  if (next < 0) return Math.floor((max - 1) / step) * step
  return next
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
  if (segmentType === "minute" && step % 60 === 0) {
    const stepMins = step / 60
    if (stepMins <= 1) return null
    const totalMins = current.hour * 60 + current.minute
    const wrapped = snapTimeStep(totalMins, stepMins, up, 1440)
    return current.set({
      hour: Math.floor(wrapped / 60),
      minute: wrapped % 60,
    })
  }
  if (segmentType === "hour" && step % 3600 === 0) {
    const stepHours = step / 3600
    if (stepHours <= 1) return null
    const wrapped = snapTimeStep(current.hour, stepHours, up, 24)
    return current.set({ hour: wrapped, minute: 0 })
  }
  return null
}

// --- Segment state helper ---

export interface SegmentState {
  totalSegments: number
  placeholderCount: number
  isPartiallyTyped: boolean
  isFullyCleared: boolean
}

/** Query spinbutton segments in a container to determine their placeholder state. */
export function getSegmentState(container: HTMLElement): SegmentState {
  const segments = container.querySelectorAll('[role="spinbutton"]')
  const placeholders = container.querySelectorAll(
    '[role="spinbutton"][data-placeholder="true"]'
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
  return element.default?.length ? element.default[0] : null
}

export function getCurrStateFromProto(
  element: DateTimeInputProto
): string | null {
  return element.value?.length ? element.value[0] : null
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
    widgetMgr.setStringArrayValue(element.id, val ? [val] : [], {
      formId: element.formId,
      fragmentId,
      fromUser: vws.fromUser,
    })
  }

  if (vws.value) {
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
