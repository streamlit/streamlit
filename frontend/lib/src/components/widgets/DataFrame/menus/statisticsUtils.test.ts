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

import { describe, expect, it } from "vitest"

import { Quiver } from "~lib/dataframes/Quiver"

import {
  computeBooleanStatistics,
  computeDateTimeStatistics,
  computeEmptyPercentage,
  computeNumericStatistics,
  computeStatistics,
  computeTextStatistics,
  createLabeledBarDatum,
  DateTimeStatistics,
  formatChartCount,
  formatChartPercent,
  formatCountWithPercent,
  formatDatetime,
  formatNumber,
  formatTooltipDate,
  formatTooltipNumber,
  getNullOrEmptyCount,
  getStatisticsType,
  supportsStatistics,
} from "./statisticsUtils"

/**
 * Builds a minimal Quiver-like mock for `computeStatistics`, which only relies
 * on `dimensions.numDataRows` and `getCell(row, col).content`.
 */
function makeMockQuiver(
  contentFn: (row: number) => unknown,
  numDataRows = 5,
  throwOnGetCell = false
): Quiver {
  return {
    dimensions: { numDataRows },
    getCell: (row: number) => {
      if (throwOnGetCell) {
        throw new Error("malformed Arrow buffer")
      }
      return { content: contentFn(row) }
    },
  } as unknown as Quiver
}

describe("statisticsUtils", () => {
  describe("supportsStatistics", () => {
    it.each([
      ["number", true],
      ["progress", true],
      ["text", true],
      ["selectbox", false], // excluded - display label differs from raw content
      ["link", false], // excluded - display label differs from raw content
      ["datetime", true],
      ["date", true],
      ["time", false], // time excluded - toSafeDate() lacks field metadata
      ["checkbox", true],
      ["multiselect", false],
      ["list", false],
      ["json", false],
      ["image", false],
      ["chart", false],
    ])("returns %s for %s column kind", (kind, expected) => {
      expect(supportsStatistics(kind)).toBe(expected)
    })
  })

  describe("getStatisticsType", () => {
    it.each([
      ["number", "numeric"],
      ["progress", "numeric"],
      ["text", "text"],
      ["selectbox", null], // excluded - display label differs from raw content
      ["link", null], // excluded - display label differs from raw content
      ["datetime", "datetime"],
      ["date", "datetime"],
      ["time", null], // time excluded - toSafeDate() lacks field metadata
      ["checkbox", "boolean"],
      ["multiselect", null],
      ["list", null],
    ])("returns %s for %s column kind", (kind, expected) => {
      expect(getStatisticsType(kind)).toBe(expected)
    })
  })

  describe("computeNumericStatistics", () => {
    it("computes correct statistics for numeric values", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const stats = computeNumericStatistics(values, false)

      expect(stats.type).toBe("numeric")
      expect(stats.count).toBe(10)
      expect(stats.nullCount).toBe(0)
      expect(stats.unique).toBe(10)
      expect(stats.sum).toBe(55)
      expect(stats.mean).toBe(5.5)
      expect(stats.q25).toBeCloseTo(3.25, 5)
      expect(stats.median).toBe(5.5)
      expect(stats.q75).toBeCloseTo(7.75, 5)
      expect(stats.min).toBe(1)
      expect(stats.max).toBe(10)
      expect(stats.isSampled).toBe(false)
      expect(stats.histogram.length).toBeGreaterThan(0)
    })

    it("computes unique count with duplicate values", () => {
      const values = [1, 2, 2, 3, 3, 3, 4, 4, 4, 4]
      const stats = computeNumericStatistics(values, false)

      expect(stats.count).toBe(10)
      expect(stats.unique).toBe(4)
    })

    it("handles null and undefined values", () => {
      const values = [1, null, 2, undefined, 3]
      const stats = computeNumericStatistics(values, false)

      expect(stats.count).toBe(3)
      expect(stats.nullCount).toBe(2)
      expect(stats.mean).toBe(2)
    })

    it("treats empty and whitespace strings as null, not zero", () => {
      const values = [10, "", "   ", 20]
      const stats = computeNumericStatistics(values, false)

      // Blank strings must not be coerced to 0 (which would skew the metrics).
      expect(stats.count).toBe(2)
      expect(stats.nullCount).toBe(2)
      expect(stats.min).toBe(10)
      expect(stats.mean).toBe(15)
    })

    it("handles empty array", () => {
      const stats = computeNumericStatistics([], false)

      expect(stats.count).toBe(0)
      expect(stats.nullCount).toBe(0)
      expect(stats.sum).toBe(0)
      expect(stats.histogram).toHaveLength(0)
    })

    it("handles single value", () => {
      const stats = computeNumericStatistics([42], false)

      expect(stats.count).toBe(1)
      expect(stats.mean).toBe(42)
      expect(stats.median).toBe(42)
      expect(stats.min).toBe(42)
      expect(stats.max).toBe(42)
    })

    it("uses fewer histogram bins for small datasets", () => {
      const stats = computeNumericStatistics([1, 2, 3, 4, 5, 6, 7, 8], false)

      expect(stats.histogram).toHaveLength(3)
      expect(
        stats.histogram.reduce((total, bin) => total + bin.count, 0)
      ).toBe(8)
    })

    it("caps histogram bins for larger datasets", () => {
      const values = Array.from({ length: 400 }, (_, index) => index)
      const stats = computeNumericStatistics(values, false)

      expect(stats.histogram).toHaveLength(15)
      expect(
        stats.histogram.reduce((total, bin) => total + bin.count, 0)
      ).toBe(400)
    })

    it("calculates standard deviation and variance correctly", () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9]
      const stats = computeNumericStatistics(values, false)

      // Population std dev for [2,4,4,4,5,5,7,9] is 2
      expect(stats.stdDev).toBeCloseTo(2, 5)
      // Variance is stdDev squared = 4
      expect(stats.variance).toBeCloseTo(4, 5)
    })
  })

  describe("computeTextStatistics", () => {
    it("computes correct statistics for text values", () => {
      const values = ["apple", "banana", "apple", "cherry", "apple", "banana"]
      const stats = computeTextStatistics(values, false)

      expect(stats.type).toBe("text")
      expect(stats.count).toBe(6)
      expect(stats.empty).toBe(0)
      expect(stats.unique).toBe(3)
      expect(stats.topValues).toHaveLength(3)
      expect(stats.topValues[0].value).toBe("apple")
      expect(stats.topValues[0].count).toBe(3)
      // Length statistics: apple=5, banana=6, cherry=6
      expect(stats.minLength).toBe(5)
      expect(stats.maxLength).toBe(6)
      expect(stats.avgLength).toBeCloseTo(5.5, 1) // (5+6+5+6+5+6)/6 = 5.5
    })

    it("handles null and empty string values", () => {
      const values = ["apple", null, "", undefined, "banana"]
      const stats = computeTextStatistics(values, false)

      expect(stats.count).toBe(2)
      expect(stats.empty).toBe(3)
      expect(stats.unique).toBe(2)
    })

    it("handles empty array", () => {
      const stats = computeTextStatistics([], false)

      expect(stats.count).toBe(0)
      expect(stats.empty).toBe(0)
      expect(stats.unique).toBe(0)
      expect(stats.topValues).toHaveLength(0)
      expect(stats.minLength).toBe(0)
      expect(stats.maxLength).toBe(0)
      expect(stats.avgLength).toBe(0)
    })

    it("limits top values to 5", () => {
      const values = [
        "a",
        "b",
        "c",
        "d",
        "e",
        "f",
        "g",
        "a",
        "b",
        "c",
        "d",
        "e",
      ]
      const stats = computeTextStatistics(values, false)

      expect(stats.topValues).toHaveLength(5)
    })
  })

  describe("computeDateTimeStatistics", () => {
    it("computes correct statistics for date values", () => {
      const baseDate = new Date("2023-01-01T00:00:00Z")
      const dayMs = 1000 * 60 * 60 * 24
      const values = [
        new Date(baseDate.getTime()),
        new Date(baseDate.getTime() + dayMs), // +1 day
        new Date(baseDate.getTime() + dayMs * 2), // +2 days
        new Date(baseDate.getTime() + dayMs * 3), // +3 days
        new Date(baseDate.getTime() + dayMs * 4), // +4 days
      ]
      const stats = computeDateTimeStatistics(values, false)

      expect(stats.type).toBe("datetime")
      expect(stats.count).toBe(5)
      expect(stats.nullCount).toBe(0)
      expect(stats.min).toBe(baseDate.getTime())
      expect(stats.max).toBe(baseDate.getTime() + dayMs * 4)
      expect(stats.q25).toBe(baseDate.getTime() + dayMs)
      expect(stats.median).toBe(baseDate.getTime() + dayMs * 2)
      expect(stats.q75).toBe(baseDate.getTime() + dayMs * 3)
      expect(stats.range).toBe("4 days")
    })

    it("handles null values", () => {
      const values = [new Date("2023-01-01"), null, new Date("2023-01-02")]
      const stats = computeDateTimeStatistics(values, false)

      expect(stats.count).toBe(2)
      expect(stats.nullCount).toBe(1)
    })

    it("counts empty and unparseable values as null", () => {
      const values = [new Date("2023-01-01"), null, "", "not-a-date"]
      const stats = computeDateTimeStatistics(values, false)

      // Empty strings and unparseable values must increment nullCount so that
      // count + nullCount reflects the total number of rows.
      expect(stats.count).toBe(1)
      expect(stats.nullCount).toBe(3)
    })

    it("handles timestamp numbers", () => {
      const ts1 = new Date("2023-01-01").getTime()
      const ts2 = new Date("2023-01-02").getTime()
      const values = [ts1, ts2]
      const stats = computeDateTimeStatistics(values, false)

      expect(stats.count).toBe(2)
      expect(stats.min).toBe(ts1)
      expect(stats.max).toBe(ts2)
    })

    it("handles empty array", () => {
      const stats = computeDateTimeStatistics([], false)

      expect(stats.count).toBe(0)
      expect(stats.histogram).toHaveLength(0)
    })

    it("computes range string for various time spans", () => {
      const baseDate = new Date("2023-01-01T00:00:00Z")

      // Years
      const yearsValues = [
        baseDate,
        new Date(baseDate.getTime() + 1000 * 60 * 60 * 24 * 365 * 2),
      ]
      expect(computeDateTimeStatistics(yearsValues, false).range).toBe(
        "2 years"
      )

      // Months
      const monthsValues = [
        baseDate,
        new Date(baseDate.getTime() + 1000 * 60 * 60 * 24 * 60),
      ]
      expect(computeDateTimeStatistics(monthsValues, false).range).toBe(
        "2 months"
      )

      // Hours
      const hoursValues = [
        baseDate,
        new Date(baseDate.getTime() + 1000 * 60 * 60 * 3),
      ]
      expect(computeDateTimeStatistics(hoursValues, false).range).toBe(
        "3 hours"
      )
    })

    it("preserves timezone parameter in statistics", () => {
      const values = [new Date("2023-01-01"), new Date("2023-01-02")]

      // Without timezone
      const statsNoTz = computeDateTimeStatistics(values, false)
      expect(statsNoTz.timezone).toBeUndefined()

      // With timezone
      const statsWithTz = computeDateTimeStatistics(
        values,
        false,
        false,
        "America/New_York"
      )
      expect(statsWithTz.timezone).toBe("America/New_York")

      // With UTC timezone
      const statsUtc = computeDateTimeStatistics(values, false, false, "UTC")
      expect(statsUtc.timezone).toBe("UTC")
    })

    it("preserves timezone for date-only columns", () => {
      const values = [new Date("2023-01-01")]
      const stats = computeDateTimeStatistics(
        values,
        false,
        true,
        "Europe/London"
      )
      expect(stats.isDateOnly).toBe(true)
      expect(stats.timezone).toBe("Europe/London")
    })
  })

  describe("computeBooleanStatistics", () => {
    it("computes correct statistics for boolean values", () => {
      const values = [true, false, true, true, false]
      const stats = computeBooleanStatistics(values, false)

      expect(stats.type).toBe("boolean")
      expect(stats.count).toBe(5)
      expect(stats.nullCount).toBe(0)
      expect(stats.trueCount).toBe(3)
      expect(stats.falseCount).toBe(2)
      expect(stats.truePercentage).toBe(60)
      expect(stats.falsePercentage).toBe(40)
    })

    it("handles null values", () => {
      const values = [true, null, false, undefined]
      const stats = computeBooleanStatistics(values, false)

      expect(stats.count).toBe(2)
      expect(stats.nullCount).toBe(2)
      expect(stats.trueCount).toBe(1)
      expect(stats.falseCount).toBe(1)
    })

    it("handles truthy string values", () => {
      const values = [true, "true", 1, "1", false, "false", 0]
      const stats = computeBooleanStatistics(values, false)

      expect(stats.trueCount).toBe(4)
      expect(stats.falseCount).toBe(3)
    })

    it("handles empty array", () => {
      const stats = computeBooleanStatistics([], false)

      expect(stats.count).toBe(0)
      expect(stats.truePercentage).toBe(0)
      expect(stats.falsePercentage).toBe(0)
    })
  })

  describe("computeStatistics", () => {
    it.each([
      ["number", "numeric", (row: number) => row],
      ["progress", "numeric", (row: number) => row],
      ["text", "text", (row: number) => `value-${row}`],
      ["datetime", "datetime", (row: number) => new Date(2023, 0, row + 1)],
      ["date", "datetime", (row: number) => new Date(2023, 0, row + 1)],
      ["checkbox", "boolean", (row: number) => row % 2 === 0],
    ])(
      "dispatches %s column kind to %s statistics",
      (kind, expectedType, contentFn) => {
        const data = makeMockQuiver(contentFn)
        const stats = computeStatistics(kind, data, 0)

        expect(stats?.type).toBe(expectedType)
        expect(stats?.count).toBe(5)
      }
    )

    it("passes isDateOnly=true for date columns and false for datetime", () => {
      const data = makeMockQuiver(row => new Date(2023, 0, row + 1))

      const dateOnly = computeStatistics("date", data, 0) as DateTimeStatistics
      expect(dateOnly.isDateOnly).toBe(true)

      const datetime = computeStatistics(
        "datetime",
        data,
        0
      ) as DateTimeStatistics
      expect(datetime.isDateOnly).toBe(false)
    })

    it("returns null for unsupported column kinds", () => {
      const data = makeMockQuiver(row => row)
      expect(computeStatistics("image", data, 0)).toBeNull()
    })

    it("samples large datasets and marks results as sampled", () => {
      // 200k rows exceeds SAMPLE_THRESHOLD (100k), so values are capped at
      // SAMPLE_SIZE (10k) via systematic sampling.
      const data = makeMockQuiver(row => row, 200_000)
      const stats = computeStatistics("number", data, 0)

      expect(stats?.isSampled).toBe(true)
      expect(stats?.count).toBe(10_000)
    })

    it("does not sample datasets below the threshold", () => {
      const data = makeMockQuiver(row => row, 10)
      const stats = computeStatistics("number", data, 0)

      expect(stats?.isSampled).toBe(false)
      expect(stats?.count).toBe(10)
    })

    it("returns null when cell extraction fails", () => {
      const data = makeMockQuiver(row => row, 5, true)
      expect(computeStatistics("number", data, 0)).toBeNull()
    })
  })

  describe("formatNumber", () => {
    it("returns '-' for non-finite values", () => {
      expect(formatNumber(NaN)).toBe("-")
      expect(formatNumber(Infinity)).toBe("-")
      expect(formatNumber(-Infinity)).toBe("-")
    })

    it("formats integers without fraction digits", () => {
      // Strip grouping/decimal separators so the assertion is locale-independent.
      expect(formatNumber(1000).replace(/\D/g, "")).toBe("1000")
      expect(formatNumber(42, 0).replace(/\D/g, "")).toBe("42")
    })

    it("rounds to the requested precision", () => {
      // Separators vary by locale, so match digits around an arbitrary separator.
      expect(formatNumber(3.14159, 2)).toMatch(/^3\D14$/)
      expect(formatNumber(2.5)).toMatch(/^2\D5$/)
      expect(formatNumber(2.6, 0).replace(/\D/g, "")).toBe("3")
    })
  })

  describe("formatDatetime", () => {
    // Fixed UTC noon timestamp so the calendar day is unambiguous everywhere.
    const ts = Date.UTC(2023, 0, 15, 12, 0, 0)

    it("omits the time component when isDateOnly is true", () => {
      const dateOnly = formatDatetime(ts, true, "UTC")
      const withTime = formatDatetime(ts, false, "UTC")

      expect(withTime).not.toBe(dateOnly)
      // The datetime variant adds the hour/minute, so it is strictly longer.
      expect(withTime.length).toBeGreaterThan(dateOnly.length)
      expect(dateOnly).toContain("2023")
      expect(withTime).toContain("2023")
    })

    it("defaults to UTC when no timezone is provided", () => {
      expect(formatDatetime(ts, true)).toBe(formatDatetime(ts, true, "UTC"))
      expect(formatDatetime(ts, false)).toBe(formatDatetime(ts, false, "UTC"))
    })

    it("respects an explicit timezone", () => {
      // 02:00 UTC falls on the previous calendar day in Honolulu (UTC-10), so
      // the rendered date differs from the UTC rendering.
      const earlyTs = Date.UTC(2023, 0, 15, 2, 0, 0)
      expect(formatDatetime(earlyTs, true, "Pacific/Honolulu")).not.toBe(
        formatDatetime(earlyTs, true, "UTC")
      )
    })
  })

  describe("computeEmptyPercentage", () => {
    it("computes the empty share of the total", () => {
      expect(computeEmptyPercentage(75, 25)).toBe(25)
      expect(computeEmptyPercentage(3, 1)).toBe(25)
    })

    it("returns 0 when there are no values", () => {
      expect(computeEmptyPercentage(0, 0)).toBe(0)
    })
  })

  describe("formatCountWithPercent", () => {
    it("renders the count followed by the percentage in parentheses", () => {
      const result = formatCountWithPercent(1234, 50)
      const [countPart, percentPart] = result.split(" (")

      expect(result.endsWith("%)")).toBe(true)
      expect(countPart.replace(/\D/g, "")).toBe("1234")
      expect(percentPart.replace(/\D/g, "")).toBe("50")
    })
  })

  describe("getNullOrEmptyCount", () => {
    it("returns nullCount for numeric statistics", () => {
      const stats = computeNumericStatistics([1, null, 2, undefined, 3], false)
      expect(stats.nullCount).toBe(2)
      expect(getNullOrEmptyCount(stats)).toBe(2)
    })

    it("returns nullCount for datetime statistics", () => {
      const stats = computeDateTimeStatistics(
        [new Date("2023-01-01T00:00:00Z"), null],
        false
      )
      expect(stats.nullCount).toBe(1)
      expect(getNullOrEmptyCount(stats)).toBe(1)
    })

    it("returns nullCount for boolean statistics", () => {
      const stats = computeBooleanStatistics([true, null, false], false)
      expect(getNullOrEmptyCount(stats)).toBe(stats.nullCount)
    })

    it("returns the empty count for text statistics", () => {
      const stats = computeTextStatistics(["a", "", null], false)
      expect(stats.empty).toBe(2)
      expect(getNullOrEmptyCount(stats)).toBe(2)
    })
  })

  describe("formatTooltipNumber", () => {
    it("formats integers without decimals", () => {
      expect(formatTooltipNumber(1000).replace(/\D/g, "")).toBe("1000")
      expect(formatTooltipNumber(0)).toBe("0")
    })

    it("keeps up to two fraction digits for decimals", () => {
      expect(formatTooltipNumber(1.23456)).toMatch(/^1\D23$/)
    })
  })

  describe("formatChartCount", () => {
    it("rounds to a whole number", () => {
      expect(formatChartCount(1234.6).replace(/\D/g, "")).toBe("1235")
      expect(formatChartCount(0)).toBe("0")
    })
  })

  describe("formatChartPercent", () => {
    it("appends a percent sign", () => {
      expect(formatChartPercent(50)).toBe("50%")
    })

    it("keeps at most one fraction digit", () => {
      const result = formatChartPercent(33.33)
      expect(result.endsWith("%")).toBe(true)
      // 33.33 -> "33.3%"; digits only (separator-agnostic) are "333".
      expect(result.replace(/\D/g, "")).toBe("333")
    })
  })

  describe("formatTooltipDate", () => {
    const ts = Date.UTC(2023, 0, 15, 12, 0, 0)

    it("includes the time only when includeTime is true", () => {
      const dateOnly = formatTooltipDate(ts, false, "UTC")
      const withTime = formatTooltipDate(ts, true, "UTC")

      expect(withTime).not.toBe(dateOnly)
      expect(withTime.length).toBeGreaterThan(dateOnly.length)
    })

    it("defaults to UTC when no timezone is provided", () => {
      expect(formatTooltipDate(ts, false)).toBe(
        formatTooltipDate(ts, false, "UTC")
      )
    })
  })

  describe("createLabeledBarDatum", () => {
    it("builds a datum with label, percent share, and a descriptive title", () => {
      const datum = createLabeledBarDatum("True", 30, 60)

      expect(datum.label).toBe("True")
      expect(datum.percent).toBe(60)
      // The visible value label shows the percentage.
      expect(datum.valueLabel).toBe("60%")
      // The hover title carries the label, raw count, and percentage.
      expect(datum.title).toBe("True: 30 (60%)")
    })
  })
})
