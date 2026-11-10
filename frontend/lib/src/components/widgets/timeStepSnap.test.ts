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
  snapTimeParts,
  snapTimeStep,
  stepIncludesSeconds,
} from "./timeStepSnap"

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

describe("snapTimeParts", () => {
  it("snaps minute segment with a minute-aligned step", () => {
    const result = snapTimeParts(
      { hour: 16, minute: 45, second: 0 },
      "minute",
      900,
      true
    )
    expect(result).toEqual({ hour: 17, minute: 0, second: 0 })
  })

  it("snaps second segment for a sub-minute step", () => {
    const result = snapTimeParts(
      { hour: 16, minute: 45, second: 0 },
      "second",
      30,
      true
    )
    expect(result).toEqual({ hour: 16, minute: 45, second: 30 })
  })

  it("returns null for ±1 steps that React Aria should handle", () => {
    expect(
      snapTimeParts({ hour: 16, minute: 45, second: 0 }, "minute", 60, true)
    ).toBeNull()
  })

  it("wraps ArrowUp past midnight to 00:00 for a non-divisor step", () => {
    // 23:59:54 with step=7 → next candidate 86401; land on first boundary.
    expect(
      snapTimeParts({ hour: 23, minute: 59, second: 54 }, "second", 7, true)
    ).toEqual({ hour: 0, minute: 0, second: 0 })
  })

  it("wraps ArrowDown from midnight to the last in-day step boundary", () => {
    // step=7 → last boundary is floor(86399/7)*7 = 86394 → 23:59:54.
    expect(
      snapTimeParts({ hour: 0, minute: 0, second: 0 }, "second", 7, false)
    ).toEqual({ hour: 23, minute: 59, second: 54 })
  })
})

describe("stepIncludesSeconds", () => {
  it("is true when step is not a whole number of minutes", () => {
    expect(stepIncludesSeconds(30)).toBe(true)
    expect(stepIncludesSeconds(1)).toBe(true)
    expect(stepIncludesSeconds(90)).toBe(true)
  })

  it("is false for minute-aligned steps", () => {
    expect(stepIncludesSeconds(60)).toBe(false)
    expect(stepIncludesSeconds(900)).toBe(false)
  })
})
