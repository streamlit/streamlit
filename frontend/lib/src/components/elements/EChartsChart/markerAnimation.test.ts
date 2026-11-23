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

import type { EChartsOptionObject } from "./CustomTheme"
import { withoutMarkerEntryAnimations } from "./markerAnimation"

type Series = Record<string, unknown>

const MARK_LINE = { data: [{ name: "Launch", xAxis: "b" }] }
const MARK_POINT = { data: [{ type: "max" }] }
const MARK_AREA = { data: [[{ xAxis: "a" }, { xAxis: "b" }]] }

function lineChart(seriesOverrides: Series): EChartsOptionObject {
  return {
    xAxis: { type: "category", data: ["a", "b", "c"] },
    yAxis: { type: "value" },
    series: [{ type: "line", data: [1, 2, 3], ...seriesOverrides }],
  }
}

function firstSeries(option: EChartsOptionObject): Series {
  return (option.series as Series[])[0]
}

describe("withoutMarkerEntryAnimations", () => {
  it("skips the markLine and markPoint entry animations", () => {
    const option = lineChart({ markLine: MARK_LINE, markPoint: MARK_POINT })

    const series = firstSeries(withoutMarkerEntryAnimations(option))

    expect(series.markLine).toEqual({ ...MARK_LINE, animationDuration: 0 })
    expect(series.markPoint).toEqual({ ...MARK_POINT, animationDuration: 0 })
    // Zero the enter duration only. `animation` and `animationDurationUpdate`
    // stay unset, so in-place tweens still run.
    expect(series.markLine).not.toHaveProperty("animation")
    expect(series.markLine).not.toHaveProperty("animationDurationUpdate")
    // The input option is left as is.
    expect(firstSeries(option).markLine).toBe(MARK_LINE)
    expect(MARK_LINE).not.toHaveProperty("animationDuration")
  })

  it("keeps a marker's own animationDuration", () => {
    const markLine = { ...MARK_LINE, animationDuration: 800 }

    const series = firstSeries(
      withoutMarkerEntryAnimations(lineChart({ markLine }))
    )

    expect(series.markLine).toBe(markLine)
  })

  it("leaves markArea in place and adds no markers", () => {
    const option = lineChart({ markArea: MARK_AREA })

    const series = firstSeries(withoutMarkerEntryAnimations(option))

    expect(series.markArea).toBe(MARK_AREA)
    expect(series).not.toHaveProperty("markLine")
    expect(series).not.toHaveProperty("markPoint")
  })

  it("skips marker entry animations in timeline base and tick options", () => {
    const option: EChartsOptionObject = {
      baseOption: { series: [{ type: "line", markLine: MARK_LINE }] },
      options: [{ series: [{ markPoint: MARK_POINT }] }],
    }

    const result = withoutMarkerEntryAnimations(option)

    const baseOption = result.baseOption as EChartsOptionObject
    const [tick] = result.options as EChartsOptionObject[]
    expect(firstSeries(baseOption).markLine).toEqual({
      ...MARK_LINE,
      animationDuration: 0,
    })
    expect(firstSeries(tick).markPoint).toEqual({
      ...MARK_POINT,
      animationDuration: 0,
    })
  })
})
