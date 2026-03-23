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

import moment, { Moment } from "moment-timezone"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { withTimezones } from "~lib/util/withTimezones"

import { formatMoment } from "./formatMoment"

// Tests for timezone-sensitive formatting (format strings with timezone components).
// These run across multiple timezones to verify consistent behavior.
withTimezones(() => {
  describe("formatMoment timezone-sensitive formats", () => {
    it.each([
      [
        "YYYY-MM-DD HH:mm:ss z",
        moment.utc("2023-04-27T10:20:30Z"),
        "2023-04-27 10:20:30 UTC",
      ],
      [
        "YYYY-MM-DD HH:mm:ss z",
        moment.utc("2023-04-27T10:20:30Z").tz("America/Los_Angeles"),
        "2023-04-27 03:20:30 PDT",
      ],
      [
        "YYYY-MM-DD HH:mm:ss Z",
        moment.utc("2023-04-27T10:20:30Z").tz("America/Los_Angeles"),
        "2023-04-27 03:20:30 -07:00",
      ],
      [
        "YYYY-MM-DD HH:mm:ss Z",
        moment.utc("2023-04-27T10:20:30Z").utcOffset("+04:00"),
        "2023-04-27 14:20:30 +04:00",
      ],
      ["YYYY-MM-DD", moment.utc("2023-04-27T10:20:30Z"), "2023-04-27"],
      [
        "MMM Do, YYYY [at] h:mm A",
        moment.utc("2023-04-27T15:45:00Z"),
        "Apr 27th, 2023 at 3:45 PM",
      ],
      [
        "MMMM Do, YYYY Z",
        moment.utc("2023-04-27T10:20:30Z").utcOffset("-02:30"),
        "April 27th, 2023 -02:30",
      ],
      [
        "iso8601",
        moment.utc("2023-04-27T10:20:30.123Z"),
        "2023-04-27T10:20:30.123Z",
      ],
    ])(
      "uses %s format to format %s to %s",
      (format: string, momentDate: Moment, expected: string) => {
        expect(formatMoment(momentDate, format)).toBe(expected)
      }
    )

    describe("iso8601 with momentKind", () => {
      it("formats date in ISO 8601 format", () => {
        const momentDate = moment.utc("2023-04-27")
        const result = formatMoment(momentDate, "iso8601", "date")
        expect(result).toBe("2023-04-27")
      })

      it("formats time in ISO 8601 format", () => {
        const momentDate = moment.utc("2023-04-27T10:20:30.123Z")
        const result = formatMoment(momentDate, "iso8601", "time")
        expect(result).toBe("10:20:30.123Z")
      })

      it("formats datetime in ISO 8601 format", () => {
        const momentDate = moment.utc("2023-04-27T10:20:30.123Z")
        const result = formatMoment(momentDate, "iso8601", "datetime")
        expect(result).toBe("2023-04-27T10:20:30.123Z")
      })
    })

    describe("localized with momentKind", () => {
      it("formats date in localized format (date only)", () => {
        const momentDate = moment.utc("2023-04-27T10:20:30Z")
        const result = formatMoment(momentDate, "localized", "date")
        // The exact format depends on the browser's locale, but it should
        // contain the date components and not the time components
        expect(result).toContain("2023")
        expect(result).not.toContain("10:20")
      })

      it("formats time in localized format (time only)", () => {
        const momentDate = moment.utc("2023-04-27T10:20:30Z")
        const result = formatMoment(momentDate, "localized", "time")
        // The exact format depends on the browser's locale, but it should
        // contain time components and not date components
        expect(result).toContain("10")
        expect(result).toContain("20")
        expect(result).not.toContain("2023")
      })

      it("formats datetime in localized format (date and time)", () => {
        const momentDate = moment.utc("2023-04-27T10:20:30Z")
        const result = formatMoment(momentDate, "localized", "datetime")
        // The exact format depends on the browser's locale, but it should
        // contain both date and time components
        expect(result).toContain("2023")
        expect(result).toContain("10")
      })
    })
  })
})

// Tests for relative time formats (distance, calendar).
// These require fake timers for consistent results but are timezone-agnostic.
// Run separately from withTimezones since timezone-mock interferes with vitest's
// fake timers - timezone-mock wraps the Date constructor and doesn't respect
// vi.setSystemTime().
describe("formatMoment relative time formats", () => {
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2022-04-28T00:00:00Z"))
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it.each([
    ["distance", moment.utc("2022-04-10T20:20:30Z"), "17 days ago"],
    ["distance", moment.utc("2020-04-10T20:20:30Z"), "2 years ago"],
    ["distance", moment.utc("2022-04-27T23:59:59Z"), "a few seconds ago"],
    ["distance", moment.utc("2022-04-20T00:00:00Z"), "8 days ago"],
    ["distance", moment.utc("2022-05-27T23:59:59Z"), "in a month"],
    ["calendar", moment.utc("2022-04-30T15:30:00Z"), "Saturday at 3:30 PM"],
    [
      "calendar",
      moment.utc("2022-04-24T12:20:30Z"),
      "Last Sunday at 12:20 PM",
    ],
    ["calendar", moment.utc("2022-04-28T12:00:00Z"), "Today at 12:00 PM"],
    ["calendar", moment.utc("2022-04-29T12:00:00Z"), "Tomorrow at 12:00 PM"],
  ])(
    "uses %s format to format %s to %s",
    (format: string, momentDate: Moment, expected: string) => {
      expect(formatMoment(momentDate, format)).toBe(expected)
    }
  )
})
