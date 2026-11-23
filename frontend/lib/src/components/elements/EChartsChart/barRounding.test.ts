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

import { mockTheme } from "~lib/mocks/mockTheme"
import type { EmotionTheme } from "~lib/theme/types"

import { applyBarRounding, getBarRadiusPx } from "./barRounding"
import { type EChartsOptionObject, STREAMLIT_THEME } from "./CustomTheme"

type Series = Record<string, unknown>

const theme = mockTheme.emotion
const R = getBarRadiusPx(theme)

function themeWithSmallRadius(sm: string): EmotionTheme {
  return { ...theme, radii: { ...theme.radii, sm } }
}

/** A vertical bar chart with one series over a category x-axis. */
function barChart(
  series: Series = {},
  overrides: EChartsOptionObject = {}
): EChartsOptionObject {
  return {
    xAxis: { type: "category", data: ["a", "b", "c"] },
    yAxis: { type: "value" },
    series: [{ type: "bar", data: [3, 5, 2], ...series }],
    ...overrides,
  }
}

/** The first series after ``applyBarRounding`` under the Streamlit theme. */
function roundFirstSeries(
  option: EChartsOptionObject,
  emotionTheme: EmotionTheme = theme
): Series {
  return (
    applyBarRounding(option, STREAMLIT_THEME, emotionTheme).series as Series[]
  )[0]
}

describe("getBarRadiusPx", () => {
  it("scales with the theme's small radius in rem or px", () => {
    expect(R).toBe(4)
    expect(getBarRadiusPx(themeWithSmallRadius("0.5rem"))).toBe(8)
    expect(getBarRadiusPx(themeWithSmallRadius("5px"))).toBe(5)
    expect(getBarRadiusPx(themeWithSmallRadius("0rem"))).toBe(0)
  })
})

describe("applyBarRounding", () => {
  it.each([
    ["vertical bars on a category x-axis", {}, [R, R, 0, 0]],
    [
      "horizontal bars on a category y-axis",
      {
        xAxis: { type: "value" },
        yAxis: { type: "category", data: ["a", "b", "c"] },
      },
      [0, R, R, 0],
    ],
    [
      "an untyped axis with data as the category axis",
      { xAxis: { type: "value" }, yAxis: { data: ["a", "b", "c"] } },
      [0, R, R, 0],
    ],
    [
      "vertical bars on a time x-axis",
      { xAxis: { type: "time" } },
      [R, R, 0, 0],
    ],
    [
      "horizontal bars on a time y-axis",
      { xAxis: { type: "value" }, yAxis: { type: "time" } },
      [0, R, R, 0],
    ],
    [
      "vertical bars on two value axes",
      { xAxis: { type: "value" }, yAxis: { type: "value" } },
      [R, R, 0, 0],
    ],
    [
      "an inverse value axis",
      { yAxis: { type: "value", inverse: true } },
      [0, 0, R, R],
    ],
    [
      "an inverse horizontal value axis",
      {
        xAxis: { type: "value", inverse: true },
        yAxis: { type: "category", data: ["a", "b", "c"] },
      },
      [R, 0, 0, R],
    ],
    [
      "an inverse category axis",
      {
        xAxis: { type: "value" },
        yAxis: { type: "category", inverse: true, data: ["a", "b", "c"] },
      },
      [0, R, R, 0],
    ],
  ])("rounds the outer end for %s", (_, axes, borderRadius) => {
    const series = roundFirstSeries(barChart({}, axes))

    expect((series.itemStyle as Series).borderRadius).toEqual(borderRadius)
  })

  it("rounds bars read from dataset rows and keeps other item styles", () => {
    const series = roundFirstSeries(
      barChart(
        { data: undefined, itemStyle: { opacity: 0.5 } },
        {
          dataset: {
            source: [
              ["product", "2015"],
              ["Matcha", 43.3],
              ["Milk Tea", 0],
            ],
          },
        }
      )
    )

    expect(series.itemStyle).toEqual({
      opacity: 0.5,
      borderRadius: [R, R, 0, 0],
    })
  })

  it("rounds each series on its own axes", () => {
    const option: EChartsOptionObject = {
      xAxis: [{ type: "category", data: ["a"] }, { type: "value" }],
      yAxis: [{ type: "value" }, { type: "category", data: ["a"] }],
      series: [
        { type: "bar", data: [1] },
        { type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: [1] },
      ],
    }
    const [vertical, horizontal] = applyBarRounding(
      option,
      STREAMLIT_THEME,
      theme
    ).series as Series[]

    expect((vertical.itemStyle as Series).borderRadius).toEqual([R, R, 0, 0])
    expect((horizontal.itemStyle as Series).borderRadius).toEqual([0, R, R, 0])
  })

  it.each([
    ["a stacked series", barChart({ stack: "total" })],
    ["a polar series", barChart({ coordinateSystem: "polar" })],
    ["a histogram without a category gap", barChart({ barCategoryGap: "0%" })],
    ["a numeric zero category gap", barChart({ barCategoryGap: 0 })],
    ["a negative value", barChart({ data: [3, -5, 2] })],
    ["a negative numeric string", barChart({ data: ["3", "-5"] })],
    ["a negative value in a data item", barChart({ data: [{ value: -1 }] })],
    [
      "a negative value in a dataset row",
      barChart(
        { data: undefined },
        {
          dataset: {
            source: [
              ["Matcha", 3],
              ["Cocoa", -1],
            ],
          },
        }
      ),
    ],
    [
      "data from a dataset by id",
      barChart({ data: undefined, datasetId: "d" }),
    ],
    ["a log value axis", barChart({}, { yAxis: { type: "log" } })],
    [
      "a value axis with a start value",
      barChart({}, { yAxis: { type: "value", startValue: 10 } }),
    ],
    ["axes picked by id", barChart({ yAxisId: "right" })],
    ["a missing axis", barChart({ xAxisIndex: 2 })],
    ["an author border radius", barChart({ itemStyle: { borderRadius: 0 } })],
    ["a non-bar series", barChart({ type: "line" })],
  ])("keeps square bars for %s", (_, option) => {
    expect(applyBarRounding(option, STREAMLIT_THEME, theme)).toBe(option)
  })

  it.each([
    ["outside the Streamlit theme", "", theme],
    ["with a 0rem base radius", STREAMLIT_THEME, themeWithSmallRadius("0rem")],
    ["with a 0px base radius", STREAMLIT_THEME, themeWithSmallRadius("0px")],
  ])("keeps square bars %s", (_, themeStr, emotionTheme) => {
    const option = barChart()

    expect(applyBarRounding(option, themeStr, emotionTheme)).toBe(option)
  })

  it("uses a larger radius for a larger base radius", () => {
    const series = roundFirstSeries(barChart(), themeWithSmallRadius("0.5rem"))

    expect((series.itemStyle as Series).borderRadius).toEqual([8, 8, 0, 0])
  })
})
