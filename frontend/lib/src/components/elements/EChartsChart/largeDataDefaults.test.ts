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
import {
  applyLargeDataDefaults,
  LARGE_MODE_THRESHOLDS,
  LINE_SYMBOL_THRESHOLD,
} from "./largeDataDefaults"

type Series = Record<string, unknown>

const DENSE = 30_000

/** Rows shaped like a hydrated Arrow ``dataset.source``. */
function rows(count: number): Array<Record<string, number | null>> {
  return Array.from({ length: count }, (_, i) => ({ x: i, y: i % 7 }))
}

/** A single-series chart that reads ``count`` rows from a dataset. */
function chart(
  series: Series,
  count = DENSE,
  extra: EChartsOptionObject = {}
): EChartsOptionObject {
  return {
    dataset: { source: rows(count) },
    xAxis: { type: series.type === "line" ? "time" : "value" },
    yAxis: { type: "value" },
    series: [{ encode: { x: "x", y: "y" }, ...series }],
    ...extra,
  }
}

function prepare(
  option: EChartsOptionObject,
  selectionActivated = false
): Series {
  return (
    applyLargeDataDefaults(option, selectionActivated).series as Series[]
  )[0]
}

describe("applyLargeDataDefaults", () => {
  it.each([
    ...LARGE_MODE_THRESHOLDS,
    ["line", LINE_SYMBOL_THRESHOLD] as const,
  ])("applies to a %s series above %i items", (type, threshold) => {
    const key = type === "line" ? "showSymbol" : "large"
    expect(prepare(chart({ type }, threshold + 1))[key]).toBe(type !== "line")
    const small = chart({ type }, threshold)
    expect(applyLargeDataDefaults(small, false)).toBe(small)
  })

  it.each([
    ["large", true],
    ["large", false],
    ["showSymbol", true],
    ["showSymbol", false],
  ])("keeps an explicit %s: %s", (key, value) => {
    const type = key === "large" ? "scatter" : "line"
    const option = chart({ type, [key]: value })
    expect(applyLargeDataDefaults(option, false)).toBe(option)
  })

  it("counts inline series data and the referenced dataset", () => {
    const data = Array.from({ length: DENSE }, (_, i) => [i, i])
    expect(prepare({ series: [{ type: "scatter", data }] }).large).toBe(true)

    const option = {
      dataset: [{ source: rows(10) }, { source: rows(DENSE) }],
      series: [
        { type: "scatter" },
        { type: "scatter", datasetIndex: 1 },
        // Datasets referenced by id aren't counted.
        { type: "scatter", datasetId: "big" },
      ],
    }
    const series = applyLargeDataDefaults(option, false).series as Series[]
    expect(series.map(entry => entry.large)).toEqual([
      undefined,
      true,
      undefined,
    ])
  })

  it.each([
    ["on_select", {}, true],
    ["a brush", { brush: {} }, false],
    ["a toolbox brush", { toolbox: { feature: { brush: {} } } }, false],
  ])("skips charts with %s", (_, extra, selectionActivated) => {
    for (const type of ["scatter", "line"]) {
      const option = chart({ type }, DENSE, extra)
      expect(applyLargeDataDefaults(option, selectionActivated)).toBe(option)
    }
  })

  it.each([
    ["selectedMode", { selectedMode: "multiple" }, {}],
    ["a visualMap", {}, { visualMap: { min: 0, max: 7 } }],
    ["per-item colors", { colorBy: "data" }, {}],
    ["chart-level per-item colors", {}, { colorBy: "data" }],
    ["a row layout", { seriesLayoutBy: "row" }, {}],
    ["polar coordinates", { coordinateSystem: "polar" }, {}],
  ])("skips large mode for %s", (_, series, extra) => {
    const option = chart({ type: "bar", ...series }, DENSE, extra)
    expect(applyLargeDataDefaults(option, false)).toBe(option)
  })

  it("lets a series colorBy override the chart's", () => {
    const option = chart({ type: "bar", colorBy: "series" }, DENSE, {
      colorBy: "data",
    })
    expect(prepare(option).large).toBe(true)
  })

  it("skips series whose data items carry their own settings", () => {
    const data: unknown[] = Array.from({ length: DENSE }, (_, i) => [i, i])
    data[10] = { value: [10, 10], itemStyle: { color: "red" } }
    const option = { series: [{ type: "scatter", data }] }
    expect(applyLargeDataDefaults(option, false)).toBe(option)
  })

  it.each([
    ["a category x-axis", { xAxis: { type: "category" } }],
    ["an x-axis with data", { xAxis: { data: ["a"] } }],
    ["an item tooltip", { tooltip: {} }],
  ])("keeps line symbols on charts with %s", (_, extra) => {
    const option = chart({ type: "line" }, DENSE, extra)
    expect(applyLargeDataDefaults(option, false)).toBe(option)
  })

  it("hides line symbols with an axis tooltip", () => {
    const option = chart({ type: "line" }, DENSE, {
      tooltip: { trigger: "axis" },
    })
    expect(prepare(option).showSymbol).toBe(false)
  })

  it("reads the series tooltip trigger before the chart's", () => {
    const itemSeries = chart(
      { type: "line", tooltip: { trigger: "item" } },
      DENSE,
      { tooltip: { trigger: "axis" } }
    )
    expect(applyLargeDataDefaults(itemSeries, false)).toBe(itemSeries)

    const axisSeries = chart(
      { type: "line", tooltip: { trigger: "axis" } },
      DENSE,
      { tooltip: {} }
    )
    expect(prepare(axisSeries).showSymbol).toBe(false)
  })

  it("keeps line symbols when gaps would hide points", () => {
    const source = rows(DENSE)
    source[100] = { x: 100, y: null }
    const option = chart({ type: "line" }, 0, { dataset: { source } })
    expect(applyLargeDataDefaults(option, false)).toBe(option)

    const connected = chart({ type: "line", connectNulls: true }, 0, {
      dataset: { source },
    })
    expect(prepare(connected).showSymbol).toBe(false)
  })

  it("only changes the dense series", () => {
    const option = {
      dataset: [{ source: rows(DENSE) }, { source: rows(100) }],
      xAxis: { type: "time" },
      series: [
        { type: "line" },
        { type: "line", datasetIndex: 1 },
        { type: "pie" },
      ],
    }
    const series = applyLargeDataDefaults(option, false).series as Series[]
    expect(series[0].showSymbol).toBe(false)
    expect(series[1]).toBe(option.series[1])
    expect(series[2]).toBe(option.series[2])
  })
})
