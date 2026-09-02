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

import * as echarts from "echarts"
import type { EChartsOption, EChartsType, SelectChangedEvent } from "echarts"

const SOURCE: (string | number)[][] = [
  ["a", 0, 10],
  ["b", 1, 20],
  ["c", 2, 30],
  ["d", 3, 40],
  ["e", 4, 50],
]

interface BrushSelectedEvent {
  batch: Array<{
    selected: Array<{
      seriesIndex: number
      dataIndex: number[]
    }>
  }>
}

const charts: EChartsType[] = []

afterEach(() => {
  charts.splice(0).forEach(chart => chart.dispose())
})

function createChart({
  selectedMode,
  dataset,
  dataZoom,
}: {
  selectedMode: "series" | "multiple"
  dataset: NonNullable<EChartsOption["dataset"]>
  dataZoom?: EChartsOption["dataZoom"]
}): EChartsType {
  const chart = echarts.init(null, null, {
    renderer: "svg",
    ssr: true,
    width: 600,
    height: 400,
  })
  charts.push(chart)

  chart.setOption({
    animation: false,
    dataset,
    xAxis: { type: "value" },
    yAxis: { type: "value" },
    dataZoom,
    brush: {
      xAxisIndex: "all",
      yAxisIndex: "all",
      throttleType: "fixRate",
      throttleDelay: 0,
    },
    series: {
      type: "scatter",
      datasetIndex: Array.isArray(dataset) ? dataset.length - 1 : 0,
      encode: { x: "x", y: "y", itemName: "name" },
      selectedMode,
    },
  })

  return chart
}

function selectByNames(chart: EChartsType, names: string[]): number[] {
  let indices: number[] | undefined

  chart.on("selectchanged", event => {
    indices = (event as SelectChangedEvent).selected.find(
      entry => entry.seriesIndex === 0
    )?.dataIndex
  })

  names.forEach(name => {
    chart.dispatchAction({
      type: "select",
      seriesIndex: 0,
      name,
    })
  })

  expect(indices).toBeDefined()
  return indices as number[]
}

function brushAllData(chart: EChartsType): number[] {
  let indices: number[] | undefined

  chart.on("brushSelected", event => {
    indices = (event as BrushSelectedEvent).batch[0]?.selected.find(
      entry => entry.seriesIndex === 0
    )?.dataIndex
  })

  chart.dispatchAction({
    type: "brush",
    areas: [
      {
        brushType: "rect",
        coordRange: [
          [-1, 10],
          [-1, 100],
        ],
        xAxisIndex: 0,
        yAxisIndex: 0,
      },
    ],
  })

  expect(indices).toBeDefined()
  return indices as number[]
}

describe("ECharts selection index semantics", () => {
  it("uses raw pre-zoom indices for series, ordinary, and brush selection", () => {
    const dataset = {
      dimensions: ["name", "x", "y"],
      source: SOURCE,
    }
    const dataZoom = {
      type: "inside" as const,
      xAxisIndex: 0,
      filterMode: "filter" as const,
      startValue: 2,
      endValue: 3,
    }

    const seriesChart = createChart({
      selectedMode: "series",
      dataset,
      dataZoom,
    })
    const ordinaryChart = createChart({
      selectedMode: "multiple",
      dataset,
      dataZoom,
    })

    // Zoom leaves c and d. Their current-list positions are 0 and 1,
    // but their pre-zoom raw indices remain 2 and 3.
    expect(selectByNames(seriesChart, ["c"])).toEqual([2, 3])
    expect(selectByNames(ordinaryChart, ["c", "d"])).toEqual([2, 3])
    expect(brushAllData(seriesChart)).toEqual([2, 3])
  })

  it("starts a new raw index space at a dataset transform output", () => {
    const dataset = [
      {
        dimensions: ["name", "x", "y"],
        source: SOURCE,
      },
      {
        fromDatasetIndex: 0,
        transform: {
          type: "filter",
          config: { dimension: "y", gte: 20 },
        },
      },
    ]

    const seriesChart = createChart({
      selectedMode: "series",
      dataset,
    })
    const ordinaryChart = createChart({
      selectedMode: "multiple",
      dataset,
    })

    // The transform removes a. Its output b, c, d, e receives a new
    // raw index space 0..3 rather than retaining upstream indices 1..4.
    expect(selectByNames(seriesChart, ["b"])).toEqual([0, 1, 2, 3])
    expect(selectByNames(ordinaryChart, ["b"])).toEqual([0])
    expect(brushAllData(seriesChart)).toEqual([0, 1, 2, 3])
  })
})
