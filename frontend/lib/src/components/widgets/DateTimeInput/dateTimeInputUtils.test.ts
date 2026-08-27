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
  computeStepSnap,
  createDateTimeErrorMessage,
  dateTimesEqual,
  formatCalendarDateTime,
  getTypedTimeFromDom,
  isoToCalendarDateTime,
  parsePastedDateTime,
  snapTimeStep,
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

  it("rejects out-of-range seconds", () => {
    expect(isoToCalendarDateTime("2024-07-04T08:15:99")).toBeNull()
    expect(isoToCalendarDateTime("2024-07-04T08:15:60")).toBeNull()
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
      fromUser: true,
    }

    updateWidgetMgrState(element, widgetMgr, vws, "fragment")

    expect(widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      element.id,
      ["2024-06-01T12:00"],
      { formId: element.formId, fragmentId: "fragment", fromUser: true }
    )
  })

  it("rejects values outside bounds", () => {
    const widgetMgr = makeWidgetMgr()
    const vws: ValueWithSource<string | null> = {
      value: "2025-01-01T12:00",
      fromUser: true,
    }

    updateWidgetMgrState(element, widgetMgr, vws, undefined)

    expect(widgetMgr.setStringArrayValue).not.toHaveBeenCalled()
  })

  it("allows null values", () => {
    const widgetMgr = makeWidgetMgr()
    const vws: ValueWithSource<string | null> = {
      value: null,
      fromUser: false,
    }

    updateWidgetMgrState(element, widgetMgr, vws, undefined)

    expect(widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      element.id,
      [],
      { formId: element.formId, fragmentId: undefined, fromUser: false }
    )
  })
})

describe("snapTimeStep", () => {
  describe("minute-granular (max=1440)", () => {
    it("snaps up from aligned position", () => {
      // 16:00 (960 min), step=15 → 16:15 (975)
      expect(snapTimeStep(960, 15, true, 1440)).toBe(975)
    })

    it("snaps up from unaligned position", () => {
      // 16:45 (1005 min), step=15 → 17:00 (1020)
      expect(snapTimeStep(1005, 15, true, 1440)).toBe(1020)
    })

    it("snaps down from aligned position", () => {
      // 16:15 (975 min), step=15 → 16:00 (960)
      expect(snapTimeStep(975, 15, false, 1440)).toBe(960)
    })

    it("snaps down from unaligned position", () => {
      // 16:47 (1007 min), step=15 → 16:45 (1005)
      expect(snapTimeStep(1007, 15, false, 1440)).toBe(1005)
    })

    it("wraps past midnight on ArrowUp", () => {
      // 23:45 (1425 min), step=15 → 00:00 (0)
      expect(snapTimeStep(1425, 15, true, 1440)).toBe(0)
    })

    it("wraps below zero on ArrowDown", () => {
      // 00:00 (0 min), step=15 → 23:45 (1425)
      expect(snapTimeStep(0, 15, false, 1440)).toBe(1425)
    })

    it("handles step=30 correctly", () => {
      // 10:15 (615 min), step=30, up → 10:30 (630)
      expect(snapTimeStep(615, 30, true, 1440)).toBe(630)
      // 10:15 (615 min), step=30, down → 10:00 (600)
      expect(snapTimeStep(615, 30, false, 1440)).toBe(600)
    })

    it("already on boundary goes to next/prev", () => {
      // 10:00 (600 min), step=15, up → 10:15 (615)
      expect(snapTimeStep(600, 15, true, 1440)).toBe(615)
      // 10:00 (600 min), step=15, down → 09:45 (585)
      expect(snapTimeStep(600, 15, false, 1440)).toBe(585)
    })
  })

  describe("hour-granular (max=24)", () => {
    it("snaps up from aligned hour", () => {
      // hour=6, step=3 → 9
      expect(snapTimeStep(6, 3, true, 24)).toBe(9)
    })

    it("snaps up from unaligned hour", () => {
      // hour=10, step=3 → 12
      expect(snapTimeStep(10, 3, true, 24)).toBe(12)
    })

    it("snaps down from aligned hour", () => {
      // hour=9, step=3 → 6
      expect(snapTimeStep(9, 3, false, 24)).toBe(6)
    })

    it("wraps past 24 on ArrowUp", () => {
      // hour=23, step=3 → 0
      expect(snapTimeStep(23, 3, true, 24)).toBe(0)
    })

    it("wraps below zero on ArrowDown", () => {
      // hour=0, step=3 → 21
      expect(snapTimeStep(0, 3, false, 24)).toBe(21)
    })

    it("handles step=2 correctly", () => {
      // hour=5, step=2, up → 6
      expect(snapTimeStep(5, 2, true, 24)).toBe(6)
      // hour=5, step=2, down → 4
      expect(snapTimeStep(5, 2, false, 24)).toBe(4)
    })
  })
})

describe("computeStepSnap", () => {
  it("snaps minute segment with 15-min step", () => {
    const dt = new CalendarDateTime(2025, 11, 19, 16, 45)
    const result = computeStepSnap(dt, "minute", 900, true)
    expect(result).toMatchObject({ hour: 17, minute: 0 })
  })

  it("snaps hour segment with 3-hour step", () => {
    const dt = new CalendarDateTime(2025, 11, 19, 9, 30)
    const result = computeStepSnap(dt, "hour", 10800, true)
    expect(result).toMatchObject({ hour: 12, minute: 0 })
  })

  it("returns null for minute segment with stepMins <= 1", () => {
    const dt = new CalendarDateTime(2025, 11, 19, 16, 45)
    expect(computeStepSnap(dt, "minute", 60, true)).toBeNull()
  })

  it("returns null for hour segment with stepHours <= 1", () => {
    const dt = new CalendarDateTime(2025, 11, 19, 16, 45)
    expect(computeStepSnap(dt, "hour", 3600, true)).toBeNull()
  })

  it("returns null for non-matching segment type", () => {
    const dt = new CalendarDateTime(2025, 11, 19, 16, 45)
    expect(computeStepSnap(dt, "year", 900, true)).toBeNull()
  })

  it("returns null when step is not divisible by 60 (minute segment)", () => {
    const dt = new CalendarDateTime(2025, 11, 19, 16, 45)
    expect(computeStepSnap(dt, "minute", 90, true)).toBeNull()
  })

  it("preserves date fields when snapping time", () => {
    const dt = new CalendarDateTime(2025, 3, 15, 10, 30)
    const result = computeStepSnap(dt, "minute", 900, false)
    expect(result).toMatchObject({
      year: 2025,
      month: 3,
      day: 15,
      hour: 10,
      minute: 15,
    })
  })
})

describe("getTypedTimeFromDom", () => {
  /** Builds a container of rendered segments in the shape React Aria produces:
   * a numeric `aria-valuenow` once the user has typed, and `data-placeholder`
   * with no `aria-valuenow` until then. */
  const container = (
    segments: Partial<Record<"year" | "hour" | "minute", number | null>>
  ): HTMLElement => {
    const el = document.createElement("div")
    el.innerHTML = Object.entries(segments)
      .map(([type, value]) =>
        value === null || value === undefined
          ? `<div role="spinbutton" data-type="${type}" data-placeholder="true">––</div>`
          : `<div role="spinbutton" data-type="${type}" aria-valuenow="${value}">${value}</div>`
      )
      .join("")
    return el
  }

  it("returns null for a missing container", () => {
    expect(getTypedTimeFromDom(null)).toBeNull()
  })

  it("returns null when neither hour nor minute is typed", () => {
    expect(
      getTypedTimeFromDom(container({ year: null, hour: null, minute: null }))
    ).toBeNull()
  })

  it("reads a time typed while the date segments are still placeholders", () => {
    expect(
      getTypedTimeFromDom(container({ year: null, hour: 3, minute: 24 }))
    ).toMatchObject({ hour: 3, minute: 24 })
  })

  it("treats an untyped half of the pair as zero", () => {
    expect(
      getTypedTimeFromDom(container({ hour: 3, minute: null }))
    ).toMatchObject({ hour: 3, minute: 0 })
    expect(
      getTypedTimeFromDom(container({ hour: null, minute: 24 }))
    ).toMatchObject({ hour: 0, minute: 24 })
  })

  it("reads hour 0 as typed rather than as absent", () => {
    expect(
      getTypedTimeFromDom(container({ hour: 0, minute: 30 }))
    ).toMatchObject({ hour: 0, minute: 30 })
  })

  it("returns null when only the date segments are typed", () => {
    expect(
      getTypedTimeFromDom(container({ year: 2025, hour: null, minute: null }))
    ).toBeNull()
  })

  it("prefers the placeholder marker over a value on the same segment", () => {
    // Defensive: for hour and minute React Aria omits `aria-valuenow` on a
    // placeholder, so it never emits this shape — but other segment types
    // (`era`) do carry a value while placeholdered.
    const el = document.createElement("div")
    el.innerHTML =
      '<div role="spinbutton" data-type="hour" data-placeholder="true" aria-valuenow="7">07</div>'
    expect(getTypedTimeFromDom(el)).toBeNull()
  })

  it("falls back to the rendered text where aria-valuenow is absent", () => {
    // React Aria renders segments as textboxes with no aria-valuenow on iOS.
    const el = document.createElement("div")
    el.innerHTML =
      '<div role="textbox" data-type="hour">09</div>' +
      '<div role="textbox" data-type="minute">45</div>'
    expect(getTypedTimeFromDom(el)).toMatchObject({ hour: 9, minute: 45 })
  })

  it("ignores a non-numeric segment value", () => {
    const el = document.createElement("div")
    el.innerHTML = '<div role="textbox" data-type="hour">––</div>'
    expect(getTypedTimeFromDom(el)).toBeNull()
  })
})
