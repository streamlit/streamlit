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

import {
  computeBooleanStatistics,
  computeDateTimeStatistics,
  computeNumericStatistics,
  computeTextStatistics,
  getStatisticsType,
  supportsStatistics,
} from "./statisticsUtils"

describe("statisticsUtils", () => {
  describe("supportsStatistics", () => {
    it.each([
      ["number", true],
      ["progress", true],
      ["text", true],
      ["selectbox", true],
      ["link", true],
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
      ["selectbox", "text"],
      ["link", "text"],
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
      expect(stats.unique).toBe(5)
      expect(stats.min).toBe(baseDate.getTime())
      expect(stats.max).toBe(baseDate.getTime() + dayMs * 4)
      expect(stats.q25).toBe(baseDate.getTime() + dayMs)
      expect(stats.median).toBe(baseDate.getTime() + dayMs * 2)
      expect(stats.q75).toBe(baseDate.getTime() + dayMs * 3)
      expect(stats.range).toBe("4 days")
    })

    it("computes unique count with duplicate timestamps", () => {
      const baseDate = new Date("2023-01-01T00:00:00Z")
      const dayMs = 1000 * 60 * 60 * 24
      const values = [
        new Date(baseDate.getTime()),
        new Date(baseDate.getTime()), // duplicate
        new Date(baseDate.getTime() + dayMs),
        new Date(baseDate.getTime() + dayMs), // duplicate
        new Date(baseDate.getTime() + dayMs * 2),
      ]
      const stats = computeDateTimeStatistics(values, false)

      expect(stats.count).toBe(5)
      expect(stats.unique).toBe(3)
    })

    it("handles null values", () => {
      const values = [new Date("2023-01-01"), null, new Date("2023-01-02")]
      const stats = computeDateTimeStatistics(values, false)

      expect(stats.count).toBe(2)
      expect(stats.nullCount).toBe(1)
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
})
