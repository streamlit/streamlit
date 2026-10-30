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

const SCATTER_THRESHOLD = LARGE_MODE_THRESHOLDS.get("scatter") ?? 0
/** The smallest scatter series that gets large mode. */
const DENSE_SCATTER = SCATTER_THRESHOLD + 1
/** The smallest bar series that gets large mode. */
const DENSE_BARS = (LARGE_MODE_THRESHOLDS.get("bar") ?? 0) + 1

/** Rows shaped like a hydrated Arrow ``dataset.source``. */
function rows(count: number): Array<Record<string, number>> {
  return Array.from({ length: count }, (_, i) => ({ x: i, y: i % 7 }))
}

/** A single-series chart that reads ``count`` rows from a dataset. */
function datasetChart(
  series: Series,
  count: number,
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

function firstSeries(option: EChartsOptionObject): Series {
  const { series } = option
  return (Array.isArray(series) ? series[0] : series) as Series
}

function prepare(
  option: EChartsOptionObject,
  selectionActivated = false
): Series {
  return firstSeries(applyLargeDataDefaults(option, selectionActivated))
}

describe("applyLargeDataDefaults: large mode", () => {
  it.each([...LARGE_MODE_THRESHOLDS])(
    "sets large on a %s series above %i items",
    (type, threshold) => {
      expect(prepare(datasetChart({ type }, threshold + 1)).large).toBe(true)
      expect(prepare(datasetChart({ type }, threshold))).not.toHaveProperty(
        "large"
      )
    }
  )

  it.each([true, false])("keeps an explicit large: %s", large => {
    const option = datasetChart({ type: "scatter", large }, 100_000)
    expect(applyLargeDataDefaults(option, false)).toBe(option)
    expect(prepare(option).large).toBe(large)
  })

  it("leaves a small chart's option untouched", () => {
    const option = datasetChart({ type: "scatter" }, SCATTER_THRESHOLD)
    expect(applyLargeDataDefaults(option, false)).toBe(option)
  })

  it("counts inline series data", () => {
    const data = Array.from({ length: DENSE_BARS }, (_, i) => [i, i])
    const option = { xAxis: {}, yAxis: {}, series: { type: "bar", data } }
    const prepared = applyLargeDataDefaults(option, false)
    expect((prepared.series as Series).large).toBe(true)
    expect(option.series).not.toHaveProperty("large")
  })

  it.each([
    ["a selection", {}, true],
    ["a brush", { brush: {} }, false],
    ["a toolbox brush", { toolbox: { feature: { brush: {} } } }, false],
    ["a visualMap", { visualMap: { min: 0, max: 7 } }, false],
    [
      "decal patterns",
      { aria: { enabled: true, decal: { show: true } } },
      false,
    ],
  ])("skips a chart with %s", (_, extra, selectionActivated) => {
    const option = datasetChart({ type: "scatter" }, DENSE_SCATTER, extra)
    expect(applyLargeDataDefaults(option, selectionActivated)).toBe(option)
  })

  it.each([
    ["selectedMode", { selectedMode: "multiple" }],
    ["colorBy data", { colorBy: "data" }],
    ["shown labels", { label: { show: true } }],
    ["emphasis", { emphasis: { focus: "series" } }],
    ["select", { select: { itemStyle: { color: "red" } } }],
    ["blur", { blur: { itemStyle: { opacity: 0.1 } } }],
    ["small symbols", { symbolSize: 3 }],
    ["small symbol widths", { symbolSize: [2, 10] }],
    ["image symbols", { symbol: "image://chart.png" }],
    ["hollow symbols", { symbol: "emptyCircle" }],
    ["rotated symbols", { symbolRotate: 45 }],
    ["offset symbols", { symbolOffset: [0, 5] }],
    [
      "gradient fills",
      { itemStyle: { color: { type: "linear", colorStops: [] } } },
    ],
  ])("skips a scatter series with %s", (_, series) => {
    expect(
      prepare(datasetChart({ type: "scatter", ...series }, DENSE_SCATTER))
    ).not.toHaveProperty("large")
  })

  it.each([
    ["polar coordinates", { coordinateSystem: "polar" }],
    ["borders", { itemStyle: { borderWidth: 1 } }],
    ["rounded corners", { itemStyle: { borderRadius: [4, 4, 0, 0] } }],
    [
      "rounded backgrounds",
      { showBackground: true, backgroundStyle: { borderRadius: 4 } },
    ],
  ])("skips a bar series with %s", (_, series) => {
    expect(
      prepare(datasetChart({ type: "bar", ...series }, 5000))
    ).not.toHaveProperty("large")
  })

  it("keeps plain shapes, path symbols, and series styles", () => {
    for (const series of [
      { symbol: "diamond", symbolSize: 6 },
      { symbol: "path://M0,0L1,1Z" },
      { itemStyle: { color: "#f00", opacity: 0.5 } },
    ]) {
      expect(
        prepare(datasetChart({ type: "scatter", ...series }, DENSE_SCATTER))
          .large
      ).toBe(true)
    }
    expect(
      prepare(datasetChart({ type: "bar", stack: "total" }, 5000)).large
    ).toBe(true)
  })

  it("skips series data items with their own style", () => {
    const data: unknown[] = Array.from({ length: DENSE_SCATTER }, (_, i) => [
      i,
      i,
    ])
    data[10] = { value: [10, 10], itemStyle: { color: "red" } }
    const option = { xAxis: {}, yAxis: {}, series: { type: "scatter", data } }
    expect(applyLargeDataDefaults(option, false)).toBe(option)

    data[10] = { value: [10, 10], name: "Point" }
    expect(
      (applyLargeDataDefaults(option, false).series as Series).large
    ).toBe(true)
  })

  it.each(["pie", "heatmap", "candlestick"])(
    "leaves %s series alone",
    type => {
      const option = datasetChart({ type }, 10_000)
      expect(applyLargeDataDefaults(option, false)).toBe(option)
    }
  )
})

describe("applyLargeDataDefaults: dataset row counts", () => {
  it("picks the dataset by datasetIndex or datasetId", () => {
    const datasets = [
      { source: rows(10) },
      { id: "big", source: rows(DENSE_SCATTER) },
    ]
    const byIndex = {
      dataset: datasets,
      series: [{ type: "scatter", datasetIndex: 1 }],
    }
    const byId = {
      dataset: datasets,
      series: [{ type: "scatter", datasetId: "big" }],
    }
    const defaultDataset = { dataset: datasets, series: [{ type: "scatter" }] }

    expect(prepare(byIndex).large).toBe(true)
    expect(prepare(byId).large).toBe(true)
    expect(prepare(defaultDataset)).not.toHaveProperty("large")
  })

  it("counts column-oriented sources by their longest column", () => {
    const source = {
      x: Array.from({ length: DENSE_BARS }, (_, i) => i),
      y: [1],
    }
    expect(
      prepare({ dataset: { source }, series: [{ type: "bar" }] }).large
    ).toBe(true)
  })

  it.each([
    ["a transformed dataset", { transform: { type: "filter" } }],
    ["a dataset that reads another one", { fromDatasetIndex: 0 }],
  ])("skips %s", (_, dataset) => {
    const option = {
      dataset: [
        { source: rows(DENSE_SCATTER) },
        { source: rows(DENSE_SCATTER), ...dataset },
      ],
      series: [{ type: "scatter", datasetIndex: 1 }],
    }
    expect(applyLargeDataDefaults(option, false)).toBe(option)
  })

  it("skips row layouts", () => {
    const option = datasetChart({ type: "bar", seriesLayoutBy: "row" }, 5000)
    expect(applyLargeDataDefaults(option, false)).toBe(option)
  })

  it("fills timeline charts on baseOption only", () => {
    const option = {
      baseOption: datasetChart({ type: "scatter" }, DENSE_SCATTER),
      options: [{ series: [{ type: "scatter", data: rows(5000) }] }],
    }
    const prepared = applyLargeDataDefaults(option, false)
    expect(firstSeries(prepared.baseOption as EChartsOptionObject).large).toBe(
      true
    )
    expect(prepared.options).toBe(option.options)
  })
})

describe("applyLargeDataDefaults: line symbols", () => {
  it("hides symbols above the threshold", () => {
    expect(
      prepare(datasetChart({ type: "line" }, LINE_SYMBOL_THRESHOLD + 1))
        .showSymbol
    ).toBe(false)
    expect(
      prepare(datasetChart({ type: "line" }, LINE_SYMBOL_THRESHOLD))
    ).not.toHaveProperty("showSymbol")
  })

  it.each([true, false])("keeps an explicit showSymbol: %s", showSymbol => {
    const option = datasetChart({ type: "line", showSymbol }, 100_000)
    expect(applyLargeDataDefaults(option, false)).toBe(option)
  })

  it.each([
    ["a value x-axis", { type: "value" }, { type: "value" }, true],
    ["a log y-axis", { type: "time" }, { type: "log" }, true],
    ["a category x-axis", { type: "category" }, { type: "value" }, false],
    ["an x-axis with data", { data: ["a", "b"] }, { type: "value" }, false],
    ["a category y-axis", { type: "value" }, { type: "category" }, false],
  ])("on %s hides symbols: %s", (_, xAxis, yAxis, hides) => {
    const option = datasetChart({ type: "line" }, 5000, { xAxis, yAxis })
    expect(prepare(option).showSymbol === false).toBe(hides)
  })

  it("resolves the series' own axes", () => {
    const option = datasetChart({ type: "line", xAxisIndex: 1 }, 5000, {
      xAxis: [{ type: "value" }, { type: "category" }],
    })
    expect(applyLargeDataDefaults(option, false)).toBe(option)

    const byId = datasetChart({ type: "line", xAxisId: "time" }, 5000, {
      xAxis: [{ type: "category" }, { id: "time", type: "time" }],
    })
    expect(prepare(byId).showSymbol).toBe(false)
  })

  it.each([
    ["an item tooltip", { tooltip: {} }],
    ["an explicit item tooltip", { tooltip: { trigger: "item" } }],
    ["a brush", { brush: {} }],
    ["a dataZoom", { dataZoom: [{ type: "inside" }] }],
    ["a toolbox zoom", { toolbox: { feature: { dataZoom: {} } } }],
    ["no x-axis", { xAxis: undefined }],
  ])("skips a chart with %s", (_, extra) => {
    const option = datasetChart({ type: "line" }, 5000, extra)
    expect(applyLargeDataDefaults(option, false)).toBe(option)
  })

  it("keeps hiding symbols with an axis tooltip or a hidden tooltip", () => {
    for (const tooltip of [{ trigger: "axis" }, { show: false }]) {
      expect(
        prepare(datasetChart({ type: "line" }, 5000, { tooltip })).showSymbol
      ).toBe(false)
    }
  })

  it.each([
    ["sampling", { sampling: "lttb" }],
    ["a symbol", { symbol: "diamond" }],
    ["a symbol size", { symbolSize: 8 }],
    ["selectedMode", { selectedMode: "single" }],
    ["shown labels", { label: { show: true } }],
    ["polar coordinates", { coordinateSystem: "polar" }],
  ])("skips a line series with %s", (_, series) => {
    const option = datasetChart({ type: "line", ...series }, 5000)
    expect(applyLargeDataDefaults(option, false)).toBe(option)
  })

  it("skips a selection-activated chart", () => {
    const option = datasetChart({ type: "line" }, 5000)
    expect(applyLargeDataDefaults(option, true)).toBe(option)
  })

  it("keeps symbols on lines with gaps unless connectNulls is set", () => {
    const source: Array<Record<string, number | null>> = rows(5000)
    source[100] = { x: 100, y: null }
    expect(
      applyLargeDataDefaults(
        datasetChart({ type: "line" }, 0, { dataset: { source } }),
        false
      ).series
    ).toEqual([{ encode: { x: "x", y: "y" }, type: "line" }])
    expect(
      prepare(
        datasetChart({ type: "line", connectNulls: true }, 0, {
          dataset: { source },
        })
      ).showSymbol
    ).toBe(false)

    // Only the encoded y column counts.
    source[100] = { x: 100, y: 1, note: null }
    expect(
      prepare(datasetChart({ type: "line" }, 0, { dataset: { source } }))
        .showSymbol
    ).toBe(false)
  })

  it.each([
    ["a null point", [[1, 1], null, [3, 3]]],
    [
      "a null value",
      [
        [1, 1],
        [2, null],
        [3, 3],
      ],
    ],
    [
      "a '-' value",
      [
        [1, 1],
        [2, "-"],
        [3, 3],
      ],
    ],
    ["an empty item value", [[1, 1], { value: [2, null] }, [3, 3]]],
  ])("keeps symbols on inline data with %s", (_, gap) => {
    const data: unknown[] = Array.from({ length: 5000 }, (_, i) => [i, i])
    data.splice(10, 3, ...gap)
    const option = {
      xAxis: { type: "value" },
      yAxis: { type: "value" },
      series: [{ type: "line", data }],
    }
    expect(applyLargeDataDefaults(option, false)).toBe(option)
  })

  it("keeps symbols on column sources with a gap in the y column", () => {
    const x = Array.from({ length: 5000 }, (_, i) => i)
    const y: Array<number | null> = [...x]
    y[7] = null
    const option = datasetChart({ type: "line" }, 0, {
      dataset: { source: { x, y } },
    })
    expect(applyLargeDataDefaults(option, false)).toBe(option)
  })

  it("skips lines with highlighted data items", () => {
    const data: unknown[] = Array.from({ length: 5000 }, (_, i) => [i, i])
    data[42] = { value: [42, 42], symbol: "diamond", symbolSize: 12 }
    const option = {
      xAxis: { type: "value" },
      yAxis: { type: "value" },
      series: [{ type: "line", data }],
    }
    expect(applyLargeDataDefaults(option, false)).toBe(option)
  })

  it("only changes the dense series of a multi-series chart", () => {
    const option = {
      dataset: [{ source: rows(DENSE_SCATTER) }, { source: rows(100) }],
      xAxis: { type: "time" },
      yAxis: { type: "value" },
      series: [
        { type: "line", datasetIndex: 0 },
        { type: "line", datasetIndex: 1 },
        { type: "scatter", datasetIndex: 0 },
      ],
    }
    const series = applyLargeDataDefaults(option, false).series as Series[]
    expect(series[0].showSymbol).toBe(false)
    expect(series[1]).toBe(option.series[1])
    expect(series[2].large).toBe(true)
  })
})
