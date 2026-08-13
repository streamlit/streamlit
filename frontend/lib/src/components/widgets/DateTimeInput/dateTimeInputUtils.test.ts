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
import { describe, expect, it, vi } from "vitest"

import { DateTimeInput as DateTimeInputProto } from "@streamlit/protobuf"

import { ValueWithSource } from "~lib/hooks/useBasicWidgetState"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  calendarDateTimeToIso,
  createDateTimeErrorMessage,
  dateTimesEqual,
  formatCalendarDateTime,
  isoToCalendarDateTime,
  parsePastedDateTime,
  updateWidgetMgrState,
  validateDateTime,
} from "./dateTimeInputUtils"

describe("isoToCalendarDateTime", () => {
  it("parses a valid ISO datetime string", () => {
    const result = isoToCalendarDateTime("2024-05-10T13:47")
    expect(result).toMatchObject({
      year: 2024,
      month: 5,
      day: 10,
      hour: 13,
      minute: 47,
    })
  })

  it("returns null for invalid or falsy values", () => {
    expect(isoToCalendarDateTime("invalid")).toBeNull()
    expect(isoToCalendarDateTime(null)).toBeNull()
    expect(isoToCalendarDateTime(undefined)).toBeNull()
    expect(isoToCalendarDateTime("")).toBeNull()
  })

  it("rejects values with invalid month/day/hour/minute", () => {
    expect(isoToCalendarDateTime("2024-13-01T00:00")).toBeNull()
    expect(isoToCalendarDateTime("2024-01-32T00:00")).toBeNull()
    expect(isoToCalendarDateTime("2024-01-01T24:00")).toBeNull()
    expect(isoToCalendarDateTime("2024-01-01T00:60")).toBeNull()
  })

  it("accepts ISO with seconds (discards seconds)", () => {
    const result = isoToCalendarDateTime("2024-07-04T08:15:30")
    expect(result).toMatchObject({
      year: 2024,
      month: 7,
      day: 4,
      hour: 8,
      minute: 15,
    })
  })
})

describe("calendarDateTimeToIso", () => {
  it("serializes to the expected wire format", () => {
    const dt = new CalendarDateTime(2024, 1, 5, 9, 3)
    expect(calendarDateTimeToIso(dt)).toBe("2024-01-05T09:03")
  })
})

describe("dateTimesEqual", () => {
  it("returns true for equal values", () => {
    const a = new CalendarDateTime(2024, 6, 1, 12, 0)
    const b = new CalendarDateTime(2024, 6, 1, 12, 0)
    expect(dateTimesEqual(a, b)).toBe(true)
  })

  it("returns false for different values", () => {
    const a = new CalendarDateTime(2024, 6, 1, 12, 0)
    const b = new CalendarDateTime(2024, 6, 1, 12, 1)
    expect(dateTimesEqual(a, b)).toBe(false)
  })

  it("handles null values", () => {
    expect(dateTimesEqual(null, null)).toBe(true)
    expect(dateTimesEqual(new CalendarDateTime(2024, 1, 1, 0, 0), null)).toBe(
      false
    )
    expect(dateTimesEqual(null, new CalendarDateTime(2024, 1, 1, 0, 0))).toBe(
      false
    )
  })
})

describe("validateDateTime", () => {
  const min = new CalendarDateTime(2024, 1, 1, 0, 0)
  const max = new CalendarDateTime(2024, 12, 31, 23, 45)

  it("returns null for in-range values", () => {
    expect(
      validateDateTime(new CalendarDateTime(2024, 6, 1, 12, 0), min, max)
    ).toBeNull()
  })

  it("returns 'beforeMin' for values before min", () => {
    expect(
      validateDateTime(new CalendarDateTime(2023, 12, 31, 23, 59), min, max)
    ).toBe("beforeMin")
  })

  it("returns 'afterMax' for values after max", () => {
    expect(
      validateDateTime(new CalendarDateTime(2025, 1, 1, 0, 0), min, max)
    ).toBe("afterMax")
  })

  it("returns null for null value", () => {
    expect(validateDateTime(null, min, max)).toBeNull()
  })
})

describe("formatCalendarDateTime", () => {
  it("formats with YYYY/MM/DD format", () => {
    const dt = new CalendarDateTime(2024, 1, 5, 9, 3)
    expect(formatCalendarDateTime(dt, "YYYY/MM/DD")).toBe("2024/01/05, 09:03")
  })

  it("formats with DD/MM/YYYY format", () => {
    const dt = new CalendarDateTime(2024, 1, 5, 14, 30)
    expect(formatCalendarDateTime(dt, "DD/MM/YYYY")).toBe("05/01/2024, 14:30")
  })
})

describe("createDateTimeErrorMessage", () => {
  it("returns null for null error type", () => {
    expect(createDateTimeErrorMessage(null, "min", "max")).toBeNull()
  })

  it("returns afterMax message", () => {
    const msg = createDateTimeErrorMessage("afterMax", "min", "max")
    expect(msg).toContain("on or before max")
  })

  it("returns beforeMin message with no max", () => {
    const msg = createDateTimeErrorMessage("beforeMin", "min", "")
    expect(msg).toContain("on or after min")
  })

  it("returns between message", () => {
    const msg = createDateTimeErrorMessage("beforeMin", "min", "max")
    expect(msg).toContain("between min and max")
  })
})

describe("parsePastedDateTime", () => {
  it("parses ISO format", () => {
    const result = parsePastedDateTime("2024-06-15T14:30", "YYYY/MM/DD")
    expect(result).toMatchObject({
      year: 2024,
      month: 6,
      day: 15,
      hour: 14,
      minute: 30,
    })
  })

  it("parses display format with date reordering", () => {
    const result = parsePastedDateTime("15/06/2024, 14:30", "DD/MM/YYYY")
    expect(result).toMatchObject({
      year: 2024,
      month: 6,
      day: 15,
      hour: 14,
      minute: 30,
    })
  })

  it("returns null for invalid paste text", () => {
    expect(parsePastedDateTime("not a date", "YYYY/MM/DD")).toBeNull()
  })

  it("rejects invalid dates that would be clamped", () => {
    expect(parsePastedDateTime("2024-02-30T12:00", "YYYY/MM/DD")).toBeNull()
  })
})

describe("updateWidgetMgrState", () => {
  const element = {
    min: "2024-01-01T00:00",
    max: "2024-12-31T23:45",
  } as unknown as DateTimeInputProto

  const makeWidgetMgr = (): WidgetStateManager =>
    ({
      setStringArrayValue: vi.fn(),
    }) as unknown as WidgetStateManager

  it("commits values within bounds", () => {
    const widgetMgr = makeWidgetMgr()
    const vws: ValueWithSource<string | null> = {
      value: "2024-06-01T12:00",
      fromUi: true,
    }

    updateWidgetMgrState(element, widgetMgr, vws, "fragment")

    expect(widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      element,
      ["2024-06-01T12:00"],
      { fromUi: true },
      "fragment"
    )
  })

  it("rejects values outside bounds", () => {
    const widgetMgr = makeWidgetMgr()
    const vws: ValueWithSource<string | null> = {
      value: "2025-01-01T12:00",
      fromUi: true,
    }

    updateWidgetMgrState(element, widgetMgr, vws, undefined)

    expect(widgetMgr.setStringArrayValue).not.toHaveBeenCalled()
  })

  it("allows null values", () => {
    const widgetMgr = makeWidgetMgr()
    const vws: ValueWithSource<string | null> = {
      value: null,
      fromUi: false,
    }

    updateWidgetMgrState(element, widgetMgr, vws, undefined)

    expect(widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      element,
      [],
      { fromUi: false },
      undefined
    )
  })
})
