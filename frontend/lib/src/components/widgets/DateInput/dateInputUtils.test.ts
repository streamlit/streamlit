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

import { CalendarDate } from "@internationalized/date"
import type { DateSegment as IDateSegment } from "react-stately"

import { DateInput as DateInputProto } from "@streamlit/protobuf"

import {
  calendarDateToIso,
  createDateErrorMessage,
  formatCalendarDate,
  getInitialFocusedDate,
  getMaxDate,
  getMinDate,
  getQuickSelectPresets,
  isOlderThanTwoYears,
  isoToCalendarDate,
  isValidSegmentValue,
  normalizeRangeOrder,
  parseFormatOrder,
  parsePartialSegmentPaste,
  parsePastedDate,
  reorderSegments,
  validateDate,
} from "./dateInputUtils"

function makeSegment(type: IDateSegment["type"], text: string): IDateSegment {
  return {
    type,
    text,
    isPlaceholder: false,
    placeholder: "",
    isEditable: true,
  }
}

describe("parseFormatOrder", () => {
  it("parses YYYY/MM/DD", () => {
    expect(parseFormatOrder("YYYY/MM/DD")).toEqual({
      order: ["Y", "M", "D"],
      separator: "/",
    })
  })

  it("parses DD.MM.YYYY with a period separator", () => {
    expect(parseFormatOrder("DD.MM.YYYY")).toEqual({
      order: ["D", "M", "Y"],
      separator: ".",
    })
  })

  it("parses MM-DD-YYYY with a hyphen separator", () => {
    expect(parseFormatOrder("MM-DD-YYYY")).toEqual({
      order: ["M", "D", "Y"],
      separator: "-",
    })
  })
})

describe("reorderSegments", () => {
  const yearSeg = makeSegment("year", "2024")
  const monthSeg = makeSegment("month", "03")
  const daySeg = makeSegment("day", "15")
  const segments = [yearSeg, monthSeg, daySeg]

  it("keeps the natural order for YYYY/MM/DD", () => {
    const result = reorderSegments(segments, "YYYY/MM/DD")
    expect(result.map(s => s.type)).toEqual([
      "year",
      "literal",
      "month",
      "literal",
      "day",
    ])
    expect(result.map(s => s.text)).toEqual(["2024", "/", "03", "/", "15"])
  })

  it("reorders to day, month, year for DD.MM.YYYY", () => {
    const result = reorderSegments(segments, "DD.MM.YYYY")
    expect(result.map(s => s.type)).toEqual([
      "day",
      "literal",
      "month",
      "literal",
      "year",
    ])
    expect(result.map(s => s.text)).toEqual(["15", ".", "03", ".", "2024"])
  })

  it("reorders to month, day, year for MM-DD-YYYY", () => {
    const result = reorderSegments(segments, "MM-DD-YYYY")
    expect(result.map(s => s.type)).toEqual([
      "month",
      "literal",
      "day",
      "literal",
      "year",
    ])
  })

  it("ignores extraneous segment types (e.g. AM/PM) not in year/month/day", () => {
    const withExtra = [...segments, makeSegment("dayPeriod", "AM")]
    const result = reorderSegments(withExtra, "YYYY/MM/DD")
    expect(result).toHaveLength(5)
  })
})

describe("isoToCalendarDate / calendarDateToIso", () => {
  it("round-trips a valid ISO date", () => {
    const date = isoToCalendarDate("2024-03-15")
    expect(date).toEqual(new CalendarDate(2024, 3, 15))
    expect(calendarDateToIso(date ?? new CalendarDate(1970, 1, 1))).toBe(
      "2024-03-15"
    )
  })

  it("returns null for an empty string", () => {
    expect(isoToCalendarDate("")).toBeNull()
  })

  it("returns null for a malformed string", () => {
    expect(isoToCalendarDate("not-a-date")).toBeNull()
  })
})

describe("getMinDate / getMaxDate", () => {
  it("parses element.min", () => {
    const element = DateInputProto.create({ min: "2020-01-01" })
    expect(getMinDate(element)).toEqual(new CalendarDate(2020, 1, 1))
  })

  it("falls back to today when element.min is unparsable", () => {
    const element = DateInputProto.create({ min: "" })
    // Just verify it doesn't throw and returns a CalendarDate.
    expect(getMinDate(element)).toBeInstanceOf(CalendarDate)
  })

  it("parses element.max when present", () => {
    const element = DateInputProto.create({ max: "2020-12-31" })
    expect(getMaxDate(element)).toEqual(new CalendarDate(2020, 12, 31))
  })

  it("returns undefined (not a sentinel date) when element.max is empty", () => {
    const element = DateInputProto.create({ max: "" })
    expect(getMaxDate(element)).toBeUndefined()
  })
})

describe("getInitialFocusedDate", () => {
  it("prefers the first selected value when present", () => {
    expect(
      getInitialFocusedDate(["2019-07-06"], new CalendarDate(1970, 1, 1))
    ).toEqual(new CalendarDate(2019, 7, 6))
  })

  it("falls back to today when there's no value and minDate is in the past", () => {
    const result = getInitialFocusedDate([], new CalendarDate(1970, 1, 1))
    // "today" isn't mockable here without freezing global Date — just
    // confirm it's a real CalendarDate rather than the far-past minDate.
    expect(result).toBeInstanceOf(CalendarDate)
    expect(result.compare(new CalendarDate(1970, 1, 1))).toBeGreaterThan(0)
  })

  it("falls back to minDate when there's no value and minDate is in the future", () => {
    const farFuture = new CalendarDate(2999, 1, 1)
    expect(getInitialFocusedDate([], farFuture)).toEqual(farFuture)
  })

  it("never returns null, even for an unparsable value", () => {
    const result = getInitialFocusedDate(
      ["not-a-date"],
      new CalendarDate(1970, 1, 1)
    )
    expect(result).toBeInstanceOf(CalendarDate)
  })
})

describe("isOlderThanTwoYears", () => {
  it("returns true for a date more than 2 years in the past", () => {
    expect(isOlderThanTwoYears(new CalendarDate(2000, 1, 1))).toBe(true)
  })

  it("returns false for a date within the last 2 years", () => {
    const now = new Date()
    const oneYearAgo = new CalendarDate(
      now.getFullYear() - 1,
      now.getMonth() + 1,
      now.getDate()
    )
    expect(isOlderThanTwoYears(oneYearAgo)).toBe(false)
  })
})

describe("validateDate", () => {
  const minDate = new CalendarDate(2020, 1, 1)
  const maxDate = new CalendarDate(2020, 12, 31)

  it("returns null for null input", () => {
    expect(validateDate(null, minDate, maxDate)).toBeNull()
  })

  it("returns null for an in-range date", () => {
    expect(validateDate(new CalendarDate(2020, 6, 1), minDate, maxDate)).toBe(
      null
    )
  })

  it("returns 'beforeMin' for a date before minDate", () => {
    expect(
      validateDate(new CalendarDate(2019, 12, 31), minDate, maxDate)
    ).toBe("beforeMin")
  })

  it("returns 'afterMax' for a date after maxDate", () => {
    expect(validateDate(new CalendarDate(2021, 1, 1), minDate, maxDate)).toBe(
      "afterMax"
    )
  })

  it("has no upper bound when maxDate is undefined", () => {
    expect(
      validateDate(new CalendarDate(2099, 1, 1), minDate, undefined)
    ).toBeNull()
  })
})

describe("formatCalendarDate", () => {
  it("formats according to format's order and separator", () => {
    const date = new CalendarDate(2024, 3, 5)
    expect(formatCalendarDate(date, "YYYY/MM/DD")).toBe("2024/03/05")
    expect(formatCalendarDate(date, "DD.MM.YYYY")).toBe("05.03.2024")
    expect(formatCalendarDate(date, "MM-DD-YYYY")).toBe("03-05-2024")
  })
})

describe("createDateErrorMessage", () => {
  it("returns null when there's no error", () => {
    expect(
      createDateErrorMessage(null, false, "2020/01/01", "2020/12/31")
    ).toBeNull()
  })

  it("builds the single-date message with both bounds", () => {
    expect(
      createDateErrorMessage("beforeMin", false, "2020/01/01", "2020/12/31")
    ).toBe(
      "**Error**: Date set outside allowed range. Please select a date between 2020/01/01 and 2020/12/31."
    )
  })

  it("builds the single-date message with no max", () => {
    expect(createDateErrorMessage("beforeMin", false, "2020/01/01", "")).toBe(
      "**Error**: Date set outside allowed range. Please select a date on or after 2020/01/01."
    )
  })

  it("builds the single-date afterMax message", () => {
    expect(
      createDateErrorMessage("afterMax", false, "2020/01/01", "2020/12/31")
    ).toBe(
      "**Error**: Date set outside allowed range. Please select a date on or before 2020/12/31."
    )
  })

  it("builds the range 'beforeMin' message", () => {
    expect(
      createDateErrorMessage("beforeMin", true, "2020/01/01", "2020/12/31")
    ).toBe(
      "**Error**: Start date set outside allowed range. Please select a date after 2020/01/01."
    )
  })

  it("builds the range 'afterMax' message", () => {
    expect(
      createDateErrorMessage("afterMax", true, "2020/01/01", "2020/12/31")
    ).toBe(
      "**Error**: End date set outside allowed range. Please select a date before 2020/12/31."
    )
  })
})

describe("parsePastedDate", () => {
  it("parses a full date matching format's order/separator", () => {
    expect(parsePastedDate("15/01/2024", "DD/MM/YYYY")).toEqual(
      new CalendarDate(2024, 1, 15)
    )
  })

  it("parses with a period separator", () => {
    expect(parsePastedDate("2024.01.15", "YYYY.MM.DD")).toEqual(
      new CalendarDate(2024, 1, 15)
    )
  })

  it("returns null for text that doesn't match the 3-group pattern", () => {
    expect(parsePastedDate("not a date", "YYYY/MM/DD")).toBeNull()
  })

  it("returns null for an out-of-range month/day", () => {
    expect(parsePastedDate("2024/13/01", "YYYY/MM/DD")).toBeNull()
    expect(parsePastedDate("2024/01/32", "YYYY/MM/DD")).toBeNull()
  })

  it("rejects an invalid day-of-month (April has 30 days)", () => {
    // CalendarDate's constructor would clamp April 31 → 30, but we
    // verify the constructed day matches the input to reject ambiguous
    // pastes rather than silently clamping.
    expect(parsePastedDate("2024/04/31", "YYYY/MM/DD")).toBeNull()
  })

  it("accepts valid day-of-month at month boundary (April 30)", () => {
    expect(parsePastedDate("2024/04/30", "YYYY/MM/DD")).toEqual(
      new CalendarDate(2024, 4, 30)
    )
  })
})

describe("parsePartialSegmentPaste", () => {
  it("parses digits targeting a valid segment type", () => {
    expect(parsePartialSegmentPaste("15", "day")).toEqual({
      segmentType: "day",
      value: 15,
    })
  })

  it("returns null for a non-date segment type", () => {
    expect(parsePartialSegmentPaste("15", "literal")).toBeNull()
    expect(parsePartialSegmentPaste("15", null)).toBeNull()
  })

  it("returns null for non-numeric text", () => {
    expect(parsePartialSegmentPaste("ab", "day")).toBeNull()
  })

  it("returns null for text longer than 4 digits", () => {
    expect(parsePartialSegmentPaste("12345", "year")).toBeNull()
  })
})

describe("getQuickSelectPresets", () => {
  const RealDate = globalThis.Date

  beforeEach(() => {
    // Freeze "today" so preset start/end dates are deterministic.
    class MockDate extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(2024, 2, 15) // 2024-03-15
          return
        }
        super(...(args as ConstructorParameters<typeof RealDate>))
      }

      static override now(): number {
        return new RealDate(2024, 2, 15).getTime()
      }
    }
    globalThis.Date = MockDate as unknown as typeof Date
  })

  afterEach(() => {
    globalThis.Date = RealDate
  })

  const EN_LABELS = [
    "Past Week",
    "Past Month",
    "Past 3 Months",
    "Past 6 Months",
    "Past Year",
    "Past 2 Years",
  ]

  it.each(["en", "en-US", "en-GB"])(
    "keeps the hardcoded English labels for %s",
    locale => {
      expect(getQuickSelectPresets(locale).map(p => p.label)).toEqual(
        EN_LABELS
      )
    }
  )

  it.each<[string, string[]]>([
    [
      "ja",
      ["1 週間前", "1 か月前", "3 か月前", "6 か月前", "1 年前", "2 年前"],
    ],
    [
      "de",
      [
        "vor 1 Woche",
        "vor 1 Monat",
        "vor 3 Monaten",
        "vor 6 Monaten",
        "vor 1 Jahr",
        "vor 2 Jahren",
      ],
    ],
    [
      "es",
      [
        "hace 1 semana",
        "hace 1 mes",
        "hace 3 meses",
        "hace 6 meses",
        "hace 1 año",
        "hace 2 años",
      ],
    ],
  ])(
    "localizes labels via Intl.RelativeTimeFormat for %s",
    (locale, expected) => {
      const labels = getQuickSelectPresets(locale).map(p => p.label)
      expect(labels).toEqual(expected)
      expect(labels).not.toContain("Past Week")
    }
  )

  it.each(["does-not-exist", "!!!"])(
    "falls back to English labels for the malformed tag %s",
    locale => {
      expect(getQuickSelectPresets(locale).map(p => p.label)).toEqual(
        EN_LABELS
      )
    }
  )

  // `Intl.RelativeTimeFormat` has no long-form data for 105 language subtags
  // and emits the root pattern ("-1 w") instead, less useful than English.
  it.each(["ig", "haw", "xh", "gsw", "eo", "ckb"])(
    "falls back to English labels for %s, which has no relative-time data",
    locale => {
      expect(getQuickSelectPresets(locale).map(p => p.label)).toEqual(
        EN_LABELS
      )
    }
  )

  it.each(["und", "zz"])("treats the data-less tag %s as English", locale => {
    // Intl has no data for these at all, so they would otherwise resolve to
    // the environment's default locale rather than to English.
    expect(getQuickSelectPresets(locale).map(p => p.label)).toEqual(EN_LABELS)
  })

  it.each(["mi", "ak"])(
    "substitutes English for the individual %s labels whose translations lead with the sign prefix",
    locale => {
      // Accepted imprecision in isRootFallbackLabel: `mi` ("-1 wiki i mua")
      // and `ak` ship real translations starting with "-", so they are
      // substituted too rather than shipping a stray leading minus.
      const labels = getQuickSelectPresets(locale).map(p => p.label)
      expect(labels.some(label => label.startsWith("-"))).toBe(false)
      // How many labels get substituted differs per locale (`mi` loses four of
      // six, `ak` only one), so assert that some label was substituted rather
      // than naming one.
      expect(labels.some(label => EN_LABELS.includes(label))).toBe(true)
    }
  )

  it("applies the root-pattern fallback per label, not per locale", () => {
    // Yoruba has data for years but not for weeks or months, so the first four
    // labels fall back to English while the last two stay localized.
    const labels = getQuickSelectPresets("yo").map(p => p.label)

    expect(labels.slice(0, 4)).toEqual(EN_LABELS.slice(0, 4))
    expect(labels[4]).not.toEqual(EN_LABELS[4])
    expect(labels[5]).not.toEqual(EN_LABELS[5])
    expect(labels.some(label => label.startsWith("-"))).toBe(false)
  })

  it("localizes only the label, leaving ids and dates untouched", () => {
    const english = getQuickSelectPresets("en-US")
    const japanese = getQuickSelectPresets("ja")

    expect(japanese.map(p => p.id)).toEqual(english.map(p => p.id))
    expect(japanese.map(p => p.start)).toEqual(english.map(p => p.start))
    expect(japanese.map(p => p.end)).toEqual(english.map(p => p.end))
    expect(japanese.map(p => p.label)).not.toEqual(english.map(p => p.label))
  })

  it("always ends at today", () => {
    const presets = getQuickSelectPresets("en-US")
    const today = new CalendarDate(2024, 3, 15)
    presets.forEach(p => expect(p.end).toEqual(today))
  })

  it("computes each preset's start by subtracting its duration from today", () => {
    const presets = getQuickSelectPresets("en-US")
    const byId = Object.fromEntries(presets.map(p => [p.id, p.start]))
    expect(byId.pastWeek).toEqual(new CalendarDate(2024, 3, 8))
    expect(byId.pastMonth).toEqual(new CalendarDate(2024, 2, 15))
    expect(byId.pastThreeMonths).toEqual(new CalendarDate(2023, 12, 15))
    expect(byId.pastSixMonths).toEqual(new CalendarDate(2023, 9, 15))
    expect(byId.pastYear).toEqual(new CalendarDate(2023, 3, 15))
    expect(byId.pastTwoYears).toEqual(new CalendarDate(2022, 3, 15))
  })
})

describe("isValidSegmentValue", () => {
  it("validates month range 1-12", () => {
    expect(isValidSegmentValue("month", 1)).toBe(true)
    expect(isValidSegmentValue("month", 12)).toBe(true)
    expect(isValidSegmentValue("month", 0)).toBe(false)
    expect(isValidSegmentValue("month", 13)).toBe(false)
  })

  it("validates day range 1-31", () => {
    expect(isValidSegmentValue("day", 31)).toBe(true)
    expect(isValidSegmentValue("day", 32)).toBe(false)
  })

  it("validates year has no fixed upper bound", () => {
    expect(isValidSegmentValue("year", 9999)).toBe(true)
    expect(isValidSegmentValue("year", 0)).toBe(false)
  })
})

describe("normalizeRangeOrder", () => {
  it("swaps when start > end", () => {
    expect(normalizeRangeOrder(["2024-03-15", "2024-01-01"])).toEqual([
      "2024-01-01",
      "2024-03-15",
    ])
  })

  it("no-op when start <= end", () => {
    expect(normalizeRangeOrder(["2024-01-01", "2024-03-15"])).toEqual([
      "2024-01-01",
      "2024-03-15",
    ])
  })

  it("no-op for equal dates", () => {
    expect(normalizeRangeOrder(["2024-01-01", "2024-01-01"])).toEqual([
      "2024-01-01",
      "2024-01-01",
    ])
  })

  it("no-op for single-element array", () => {
    expect(normalizeRangeOrder(["2024-01-01"])).toEqual(["2024-01-01"])
  })

  it("no-op for empty array", () => {
    expect(normalizeRangeOrder([])).toEqual([])
  })
})
