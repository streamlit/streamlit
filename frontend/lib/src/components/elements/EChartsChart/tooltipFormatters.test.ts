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
import type { EChartsOption } from "echarts"
import { get } from "lodash-es"
import { getLogger } from "loglevel"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { EChartsOptionObject } from "./CustomTheme"
import {
  applyLabelNumberFormats,
  applyTimeLabelFormatters,
  applyTooltipFormatters,
} from "./tooltipFormatters"

const LOG = getLogger("EChartsChart")

type Formatter = (params: unknown) => string
type ValueFormatter = (value: unknown) => string | string[]

/** Build the params ECharts passes to a tooltip formatter for one item. */
function itemParams(
  overrides: Record<string, unknown>
): Record<string, unknown> {
  return {
    seriesName: "Sessions",
    name: "11:00",
    // ECharts maps ``{a}``, ``{b}``, and ``{c}`` to these fields.
    $vars: ["seriesName", "name", "value"],
    ...overrides,
  }
}

function tooltipOf(option: EChartsOptionObject): Record<string, unknown> {
  return option.tooltip as Record<string, unknown>
}

function formatterOf(option: EChartsOptionObject): Formatter {
  const { formatter } = tooltipOf(option)
  expect(formatter).toBeTypeOf("function")
  return formatter as Formatter
}

function valueFormatterOf(option: EChartsOptionObject): ValueFormatter {
  const { valueFormatter } = tooltipOf(option)
  expect(valueFormatter).toBeTypeOf("function")
  return valueFormatter as ValueFormatter
}

describe("applyTooltipFormatters", () => {
  let originalLanguages: readonly string[]

  beforeEach(() => {
    originalLanguages = navigator.languages
    // Named formats such as "dollar" use the browser locale.
    Object.defineProperty(navigator, "languages", {
      value: ["en-US"],
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, "languages", {
      value: originalLanguages,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  it("returns the input when no formatter needs converting", () => {
    const option = {
      tooltip: { trigger: "item", formatter: "{b}: {c}" },
      series: [{ type: "bar", tooltip: { formatter: "{a}" } }, "not-a-series"],
      media: [{ option: { tooltip: { show: true } } }],
    }

    const result = applyTooltipFormatters(option)

    expect(result).toBe(option)
    expect(tooltipOf(result).formatter).toBe("{b}: {c}")
  })

  describe("dimension placeholders in templates", () => {
    it("expands {@[n]} after ECharts' own placeholders", () => {
      const formatter = formatterOf(
        applyTooltipFormatters({
          tooltip: { formatter: "{a} · {b} · {@[2]} sessions" },
        })
      )

      expect(formatter(itemParams({ value: [11, 0, 654] }))).toBe(
        "Sessions · 11:00 · 654 sessions"
      )
    })

    it("reads named dimensions from array and object rows", () => {
      const formatter = formatterOf(
        applyTooltipFormatters({
          tooltip: { formatter: "{@day} {@[1]}: {@sessions}" },
        })
      )
      const dimensionNames = ["day", "hour", "sessions"]

      expect(
        formatter(itemParams({ value: ["Mon", "11:00", 654], dimensionNames }))
      ).toBe("Mon 11:00: 654")
      expect(
        formatter(
          itemParams({
            value: { day: "Tue", hour: "12:00", sessions: 321 },
            dimensionNames,
          })
        )
      ).toBe("Tue 12:00: 321")
    })

    describe.each(["pie", "funnel"])(
      "on a %s series, which gets no dimensionNames",
      seriesType => {
        const dataset = {
          source: [
            ["Fintech", 120.5],
            ["Media", 40.1],
          ],
          dimensions: ["industry", "mrr"],
          sourceHeader: false,
        }
        const template = "{b}: mrr={@mrr} i1={@[1]}"
        const params = itemParams({
          name: "Media",
          value: ["Media", 40.1],
          dimensionNames: [],
          seriesIndex: 0,
        })

        it("reads names from the dataset in a top-level tooltip", () => {
          const formatter = formatterOf(
            applyTooltipFormatters({
              dataset,
              tooltip: { trigger: "item", formatter: template },
              series: [{ type: seriesType }],
            })
          )

          expect(formatter(params)).toBe("Media: mrr=40.1 i1=40.1")
        })

        it("reads names from the dataset in a series tooltip", () => {
          const result = applyTooltipFormatters({
            dataset,
            series: [{ type: seriesType, tooltip: { formatter: template } }],
          })
          const [series] = result.series as EChartsOptionObject[]

          expect(formatterOf(series)(params)).toBe("Media: mrr=40.1 i1=40.1")
        })
      }
    )

    it.each([
      {
        case: "the series' own dimensions",
        option: {
          dataset: { dimensions: ["x", "y"] },
          series: [{ dimensions: ["y", { name: "x" }] }],
        },
        expected: "2/1",
      },
      {
        case: "the dataset at datasetIndex, which wins over datasetId",
        option: {
          dataset: [
            { id: "first", dimensions: ["y", "x"] },
            { dimensions: ["x", "y"] },
          ],
          series: [{ datasetIndex: 1, datasetId: "first" }],
        },
        expected: "1/2",
      },
      {
        case: "the dataset with datasetId",
        option: {
          dataset: [
            { dimensions: ["x", "y"] },
            { id: 7, dimensions: ["y", "x"] },
          ],
          series: [{ datasetId: "7" }],
        },
        expected: "2/1",
      },
      {
        case: "the upstream dataset of a transform",
        option: {
          dataset: [
            { dimensions: ["y", "x"] },
            { dimensions: ["x", "y"] },
            { transform: { type: "sort" }, fromDatasetIndex: 1 },
          ],
          series: [{ datasetIndex: 2 }],
        },
        expected: "1/2",
      },
      {
        case: "the upstream dataset of a transform that sets dimensions",
        option: {
          dataset: [
            { dimensions: ["x", "y"] },
            { dimensions: ["y", "x"], transform: { type: "filter" } },
          ],
          series: [{ datasetIndex: 1 }],
        },
        expected: "1/2",
      },
      {
        case: "the upstream dataset of a list of transforms",
        option: {
          dataset: [
            { id: "raw", dimensions: ["x", "y"] },
            {
              transform: [{ type: "echarts:filter" }, { type: "sort" }],
              fromDatasetId: "raw",
            },
          ],
          series: [{ datasetIndex: 1 }],
        },
        expected: "1/2",
      },
      {
        case: "no dataset for a transform that renames dimensions",
        option: {
          dataset: [
            { dimensions: ["x", "y"] },
            { transform: [{ type: "sort" }, { type: "boxplot" }] },
          ],
          series: [{ datasetIndex: 1 }],
        },
        expected: "/",
      },
      {
        case: "no dataset for transforms that form a cycle",
        option: {
          dataset: [
            { transform: { type: "sort" }, fromDatasetIndex: 1 },
            { transform: { type: "filter" }, fromDatasetIndex: 0 },
          ],
          series: [{}],
        },
        expected: "/",
      },
      {
        case: "no dataset for a series with its own data",
        option: {
          dataset: { dimensions: ["x", "y"] },
          series: [{ data: [] }],
        },
        expected: "/",
      },
      {
        case: "no dataset for a transform without an upstream dataset",
        option: {
          dataset: [{ transform: { type: "sort" }, fromDatasetId: "nowhere" }],
          series: [{}],
        },
        expected: "/",
      },
    ])("finds dimension names from $case", ({ option, expected }) => {
      const formatter = formatterOf(
        applyTooltipFormatters({
          ...option,
          tooltip: { formatter: "{@y}/{@x}" },
        })
      )

      expect(
        formatter(
          itemParams({ value: [2, 1], dimensionNames: [], seriesIndex: 0 })
        )
      ).toBe(expected)
    })

    it("reads the dataset of the item's series and prefers ECharts' names", () => {
      const formatter = formatterOf(
        applyTooltipFormatters({
          dataset: [{ dimensions: ["a", "b"] }, { dimensions: ["b", "a"] }],
          tooltip: { formatter: "{@a}" },
          series: [{ type: "pie" }, { type: "pie", datasetIndex: 1 }],
        })
      )
      const value = [1, 2]

      expect(formatter(itemParams({ value, seriesIndex: 0 }))).toBe("1")
      expect(formatter(itemParams({ value, seriesIndex: 1 }))).toBe("2")
      expect(formatter(itemParams({ value, seriesIndex: 2 }))).toBe("")
      // Names ECharts passes win over the option's.
      expect(
        formatter(
          itemParams({ value, seriesIndex: 0, dimensionNames: ["b", "a"] })
        )
      ).toBe("2")
    })

    it("reads a timeline tick's series from the base option", () => {
      const result = applyTooltipFormatters({
        baseOption: {
          dataset: { dimensions: ["industry", "mrr"] },
          series: [{ type: "pie" }],
        },
        options: [{ tooltip: { formatter: "{@mrr}" } }],
      })
      const [tick] = result.options as EChartsOptionObject[]

      expect(
        formatterOf(tick)(
          itemParams({
            value: ["Media", 40.1],
            dimensionNames: [],
            seriesIndex: 0,
          })
        )
      ).toBe("40.1")
    })

    it("treats a number-like name as an index unless a dimension has it", () => {
      const formatter = formatterOf(
        applyTooltipFormatters({ tooltip: { formatter: "{@1}/{@2}" } })
      )

      expect(
        formatter(itemParams({ value: [10, 20, 30], dimensionNames: [] }))
      ).toBe("20/30")
      expect(
        formatter(itemParams({ value: [10, 20], dimensionNames: ["2", "1"] }))
      ).toBe("20/10")
    })

    it("uses a single value for every placeholder and blanks missing ones", () => {
      const formatter = formatterOf(
        applyTooltipFormatters({
          tooltip: { formatter: "{@[0]}|{@value}|{@[]}" },
        })
      )

      expect(formatter(itemParams({ value: 42 }))).toBe("42|42|42")
      expect(
        formatter(itemParams({ value: [1, 2], dimensionNames: ["x", "y"] }))
      ).toBe("1||1")
      expect(formatter(itemParams({ value: null }))).toBe("||")
      // A nested object prints nothing instead of "[object Object]".
      expect(formatter(itemParams({ value: [{ nested: 1 }] }))).toBe("||")
    })

    it("reads the first series in an axis tooltip", () => {
      const formatter = formatterOf(
        applyTooltipFormatters({
          tooltip: { trigger: "axis", formatter: "{b0}: {@[1]} / {c1}" },
        })
      )

      expect(
        formatter([
          itemParams({ name: "Mon", value: ["Mon", 5] }),
          itemParams({ name: "Mon", value: 7 }),
        ])
      ).toBe("Mon: 5 / 7")
      expect(formatter([])).toBe("")
    })

    it("fills time tokens on a time axis", () => {
      const formatter = formatterOf(
        applyTooltipFormatters({
          useUTC: true,
          tooltip: { trigger: "axis", formatter: "{yyyy}-{MM}-{dd}: {@[1]}" },
        })
      )
      const timestamp = Date.UTC(2026, 0, 2)

      expect(
        formatter([
          itemParams({
            axisType: "xAxis.time",
            axisValue: timestamp,
            value: [timestamp, 5],
          }),
        ])
      ).toBe("2026-01-02: 5")
    })

    it("reads useUTC from a declared baseOption, not the root", () => {
      const timestamp = Date.UTC(2026, 0, 2, 23)
      const timeParams = [
        itemParams({
          axisType: "xAxis.time",
          axisValue: timestamp,
          value: [timestamp, 5],
        }),
      ]
      const tooltip = { trigger: "axis", formatter: "{HH}: {@[1]}" }
      const localHours = String(new Date(timestamp).getHours()).padStart(
        2,
        "0"
      )

      const utcBase = applyTooltipFormatters({
        useUTC: false,
        baseOption: { useUTC: true, tooltip },
      })
      const localBase = applyTooltipFormatters({
        useUTC: true,
        baseOption: { tooltip },
      })

      expect(
        formatterOf(utcBase.baseOption as EChartsOptionObject)(timeParams)
      ).toBe("23: 5")
      expect(
        formatterOf(localBase.baseOption as EChartsOptionObject)(timeParams)
      ).toBe(`${localHours}: 5`)
    })

    it("escapes HTML in expanded values but keeps template markup", () => {
      const formatter = formatterOf(
        applyTooltipFormatters({
          tooltip: { formatter: "<b>{b}</b> {@[0]}" },
        })
      )
      const payload = "<img src=x onerror=alert(1)>"

      const html = formatter(itemParams({ name: payload, value: [payload] }))

      expect(html).toBe(
        "<b>&lt;img src=x onerror=alert(1)&gt;</b> &lt;img src=x onerror=alert(1)&gt;"
      )
      expect(html).not.toContain("<img")
    })
  })

  describe("string valueFormatter", () => {
    it.each([
      ["dollar", 1234.567, "$1,234.57"],
      ["dollar", 55680, "$55,680"],
      ["compact", 1234567, "1.2M"],
      ["percent", 0.256, "25.6%"],
      ["%,d sessions", 1234, "1,234 sessions"],
      ["%.1f%%", 12.34, "12.3%"],
    ])("formats numbers with %j", (format, value, expected) => {
      const valueFormatter = valueFormatterOf(
        applyTooltipFormatters({ tooltip: { valueFormatter: format } })
      )

      expect(valueFormatter(value)).toBe(expected)
    })

    it("formats numeric strings and arrays, and keeps other values", () => {
      const valueFormatter = valueFormatterOf(
        applyTooltipFormatters({ tooltip: { valueFormatter: "dollar" } })
      )

      expect(valueFormatter("1234.5")).toBe("$1,234.50")
      expect(valueFormatter([1, 2.5])).toEqual(["$1", "$2.50"])
      expect(valueFormatter("N/A")).toBe("N/A")
      expect(valueFormatter("2026-01-02T00:00:00.000")).toBe("2026-01-02")
      expect(valueFormatter("")).toBe("-")
      expect(valueFormatter(Number.NaN)).toBe("-")
      expect(valueFormatter(null)).toBe("-")
    })

    it.each([
      ["a template without a placeholder", "{value} €"],
      ["a malformed printf string", "100%"],
      ["a printf string with only an escaped percent sign", "100%%"],
      ["a JavaScript arrow function", "(v) => v + '%'"],
      ["a non-string value", 42],
    ])("drops %s with a warning", (_case, valueFormatter) => {
      const warnSpy = vi.spyOn(LOG, "warn").mockImplementation(() => {})

      const result = applyTooltipFormatters({
        tooltip: { trigger: "axis", valueFormatter },
      })

      expect(tooltipOf(result)).toEqual({ trigger: "axis" })
      expect(warnSpy).toHaveBeenCalledOnce()
      expect(warnSpy.mock.calls[0][0]).toContain("valueFormatter")
    })

    it("leaves a null valueFormatter alone without warning", () => {
      const warnSpy = vi.spyOn(LOG, "warn")
      const option = { tooltip: { valueFormatter: null } }

      expect(applyTooltipFormatters(option)).toBe(option)
      expect(warnSpy).not.toHaveBeenCalled()
    })
  })

  it("converts series, timeline, and media tooltips", () => {
    const seriesTooltip = { valueFormatter: "dollar" }
    const untouchedSeries = { type: "line", tooltip: { formatter: "{c}" } }
    const result = applyTooltipFormatters({
      baseOption: {
        tooltip: { formatter: "{@[0]}" },
        series: { type: "bar", tooltip: seriesTooltip },
        media: [{ option: { tooltip: { valueFormatter: "compact" } } }],
      },
      options: [{ series: [untouchedSeries, { tooltip: seriesTooltip }] }, 1],
      media: [{ query: {}, option: { tooltip: { formatter: "{@x}" } } }],
    })

    const baseOption = result.baseOption as EChartsOptionObject
    const baseSeries = baseOption.series as Record<string, unknown>
    const baseMedia = baseOption.media as Array<{
      option: EChartsOptionObject
    }>
    const tick = (result.options as EChartsOptionObject[])[0]
    const tickSeries = tick.series as Array<Record<string, unknown>>
    const rootMedia = result.media as Array<{ option: EChartsOptionObject }>

    expect(formatterOf(baseOption)(itemParams({ value: [3] }))).toBe("3")
    expect(valueFormatterOf(baseSeries as EChartsOptionObject)(5)).toBe("$5")
    expect(valueFormatterOf(baseMedia[0].option)(1500)).toBe("1.5K")
    expect(tickSeries[0]).toBe(untouchedSeries)
    expect(valueFormatterOf(tickSeries[1] as EChartsOptionObject)(5)).toBe(
      "$5"
    )
    expect((result.options as unknown[])[1]).toBe(1)
    expect(
      formatterOf(rootMedia[0].option)(
        itemParams({ value: [8], dimensionNames: ["x"] })
      )
    ).toBe("8")
    // The input spec is not mutated.
    expect(seriesTooltip.valueFormatter).toBe("dollar")
  })

  it("converts each entry of a tooltip list", () => {
    const untouched = { formatter: "{b}" }

    const result = applyTooltipFormatters({
      tooltip: [{ valueFormatter: "dollar" }, untouched],
    })

    const [converted, second] = result.tooltip as EChartsOptionObject[]
    expect((converted.valueFormatter as ValueFormatter)(5)).toBe("$5")
    expect(second).toBe(untouched)
  })

  it("does not convert per-data-item tooltips", () => {
    const dataItem = { value: 5, tooltip: { valueFormatter: "dollar" } }
    const option = { series: [{ type: "bar", data: [dataItem] }] }

    const result = applyTooltipFormatters(option)

    expect(result).toBe(option)
    expect(dataItem.tooltip.valueFormatter).toBe("dollar")
  })

  describe("with the params of a rendered chart", () => {
    const charts: echarts.ECharts[] = []

    afterEach(() => {
      charts.splice(0).forEach(chart => chart.dispose())
    })

    interface RenderedSeries {
      getDataParams: (dataIndex: number) => unknown
      getFormattedLabel: (dataIndex: number, status: string) => string
    }

    /**
     * Render ``option`` and return the model of its first series, through
     * ECharts' internal ``getModel()`` API. If these tests fail after an
     * ECharts upgrade, ECharts may now pass ``dimensionNames`` itself, so the
     * option fallback in ``getSeriesDimensionNames`` may no longer be needed.
     */
    function renderFirstSeries(option: EChartsOptionObject): RenderedSeries {
      const chart = echarts.init(null, null, {
        renderer: "svg",
        ssr: true,
        width: 400,
        height: 300,
      })
      charts.push(chart)
      chart.setOption(option as EChartsOption)
      return (
        chart as unknown as {
          getModel: () => {
            getSeriesByIndex: (index: number) => RenderedSeries
          }
        }
      )
        .getModel()
        .getSeriesByIndex(0)
    }

    it.each(["pie", "funnel", "gauge"])(
      "expands the dimensions a %s label shows",
      seriesType => {
        // Shaped like a dataset Streamlit hydrates from a dataframe.
        const dataset = {
          source: [
            ["Fintech", 120.5, 3],
            ["Retail", 80.2, 2],
            ["Media", 40.1, 1],
          ],
          dimensions: ["industry", "mrr", "rank"],
          sourceHeader: false,
        }
        const template = "{@mrr} {@[1]} #{@rank}"
        const result = applyTooltipFormatters({
          dataset,
          tooltip: { trigger: "item", formatter: template },
          series: [
            {
              type: seriesType,
              encode: { itemName: "industry", value: "mrr" },
              label: { formatter: template },
              tooltip: { formatter: template },
            },
          ],
        })
        const [seriesOption] = result.series as EChartsOptionObject[]
        const series = renderFirstSeries(result)
        const params = series.getDataParams(2)

        // ECharts gives these series no names, so the tooltip reads the option's.
        expect(params).toMatchObject({ dimensionNames: [] })
        expect(series.getFormattedLabel(2, "normal")).toBe("40.1 40.1 #1")
        expect(formatterOf(result)(params)).toBe("40.1 40.1 #1")
        expect(formatterOf(seriesOption)(params)).toBe("40.1 40.1 #1")
      }
    )
  })
})

type AxisPointerFormatter = (params: { value: unknown }) => string

const AUTHOR_AXIS_POINTER = { label: { formatter: "{value}" } }

/** Read the axis pointer label formatter set on an axis config. */
function axisPointerFormatterOf(axis: unknown): AxisPointerFormatter {
  const formatter = (
    axis as { axisPointer?: { label?: { formatter?: unknown } } }
  ).axisPointer?.label?.formatter
  expect(formatter).toBeTypeOf("function")
  return formatter as AxisPointerFormatter
}

/** A timestamp on 2026-08-18 in the test's local time zone. */
function localTime(hours = 0, minutes = 0, milliseconds = 0): number {
  return new Date(2026, 7, 18, hours, minutes, 0, milliseconds).getTime()
}

describe("applyTimeLabelFormatters", () => {
  const timeAxisOption = {
    xAxis: { type: "time" },
    yAxis: { type: "value" },
    tooltip: { trigger: "axis" },
  }

  beforeEach(() => {
    // A zone behind UTC, so local and UTC midnight differ. Streamlit sends
    // naive datetimes as local ISO strings.
    process.env.TZ = "America/New_York"
  })

  afterEach(() => {
    process.env.TZ = "UTC"
  })

  it("shows midnight values on a time axis as dates", () => {
    const result = applyTimeLabelFormatters(timeAxisOption, "streamlit")
    const formatter = axisPointerFormatterOf(result.xAxis)

    expect(formatter({ value: localTime() })).toBe("2026-08-18")
    expect(formatter({ value: localTime(14, 30) })).toBe("2026-08-18 14:30:00")
    // An axis pointer that doesn't snap to data passes any instant, so the
    // label stops at seconds instead of printing a changing millisecond.
    expect(formatter({ value: localTime(0, 0, 250) })).toBe(
      "2026-08-18 00:00:00"
    )
    // ECharts parses naive ISO and date-only strings as local time.
    expect(formatter({ value: "2026-08-18T00:00:00.000" })).toBe("2026-08-18")
    expect(formatter({ value: "2026-08-18" })).toBe("2026-08-18")
    // A value axis keeps ECharts' number labels.
    expect(result.yAxis).toBe(timeAxisOption.yAxis)
    // The input spec is not mutated.
    expect(timeAxisOption.xAxis).toEqual({ type: "time" })
  })

  it("formats in UTC when the chart sets useUTC", () => {
    const utcMidnight = Date.UTC(2026, 7, 18)
    const format = (option: EChartsOptionObject, value: number): string =>
      axisPointerFormatterOf(
        applyTimeLabelFormatters(option, "streamlit").xAxis
      )({ value })

    expect(
      format({ useUTC: true, xAxis: { type: "time" } }, utcMidnight)
    ).toBe("2026-08-18")
    // Local midnight in New York is 04:00 UTC.
    expect(
      format({ useUTC: true, xAxis: { type: "time" } }, localTime())
    ).toBe("2026-08-18 04:00:00")
    expect(format({ xAxis: { type: "time" } }, utcMidnight)).toBe(
      "2026-08-17 20:00:00"
    )
  })

  it("converts a timeline's baseOption and reads its useUTC", () => {
    const tick = { xAxis: { type: "time" } }
    const result = applyTimeLabelFormatters(
      {
        useUTC: false,
        baseOption: { useUTC: true, xAxis: { type: "time" } },
        options: [tick],
      },
      "streamlit"
    )
    const baseOption = result.baseOption as EChartsOptionObject

    expect(
      axisPointerFormatterOf(baseOption.xAxis)({
        value: Date.UTC(2026, 7, 18),
      })
    ).toBe("2026-08-18")
    // Timeline ticks merge into the base axis, so they stay as given.
    expect((result.options as unknown[])[0]).toBe(tick)
  })

  it("fills every time axis and keeps existing axis pointer settings", () => {
    const result = applyTimeLabelFormatters(
      {
        xAxis: [
          { type: "time", axisPointer: { label: { show: true } } },
          { type: "category" },
        ],
        yAxis: { type: "time" },
      },
      "streamlit"
    )

    const [timeAxis, categoryAxis] = result.xAxis as Array<{
      axisPointer?: { label?: { show?: boolean } }
    }>
    expect(axisPointerFormatterOf(timeAxis)({ value: localTime() })).toBe(
      "2026-08-18"
    )
    expect(timeAxis.axisPointer?.label?.show).toBe(true)
    expect(categoryAxis).toEqual({ type: "category" })
    expect(axisPointerFormatterOf(result.yAxis)({ value: localTime() })).toBe(
      "2026-08-18"
    )
  })

  it.each([
    [
      "the axis",
      { xAxis: { type: "time", axisPointer: AUTHOR_AXIS_POINTER } },
    ],
    [
      "tooltip.axisPointer",
      { ...timeAxisOption, tooltip: { axisPointer: AUTHOR_AXIS_POINTER } },
    ],
    [
      "a tooltip in a list",
      {
        ...timeAxisOption,
        tooltip: [{ trigger: "axis" }, { axisPointer: AUTHOR_AXIS_POINTER }],
      },
    ],
    [
      "grid.tooltip.axisPointer",
      {
        ...timeAxisOption,
        grid: [{ tooltip: { axisPointer: AUTHOR_AXIS_POINTER } }],
      },
    ],
    [
      "the top-level axisPointer",
      { ...timeAxisOption, axisPointer: AUTHOR_AXIS_POINTER },
    ],
    [
      "a timeline tick's tooltip",
      {
        baseOption: timeAxisOption,
        options: [{ tooltip: { axisPointer: AUTHOR_AXIS_POINTER } }],
      },
    ],
    [
      "a media override's top-level axisPointer",
      {
        ...timeAxisOption,
        media: [{ query: {}, option: { axisPointer: AUTHOR_AXIS_POINTER } }],
      },
    ],
    [
      "a media override in baseOption",
      {
        baseOption: {
          ...timeAxisOption,
          media: [
            {
              option: {
                grid: { tooltip: { axisPointer: AUTHOR_AXIS_POINTER } },
              },
            },
          ],
        },
      },
    ],
  ])("keeps an axis pointer formatter set on %s", (_case, option) => {
    expect(applyTimeLabelFormatters(option, "streamlit")).toBe(option)
  })

  it.each([
    ["theme=None", timeAxisOption, ""],
    [
      "a chart without a time axis",
      { xAxis: { type: "category" }, yAxis: {} },
      "streamlit",
    ],
  ])("returns the input for %s", (_case, option, theme) => {
    expect(applyTimeLabelFormatters(option, theme)).toBe(option)
  })
})

type LabelFormatter = (argument: unknown) => string

/** Read the converted formatter at ``path`` of an option. */
function labelFormatterAt(option: unknown, path: string): LabelFormatter {
  const formatter: unknown = get(option, path)
  expect(formatter).toBeTypeOf("function")
  return formatter as LabelFormatter
}

describe("applyLabelNumberFormats", () => {
  let originalLanguages: readonly string[]

  beforeEach(() => {
    originalLanguages = navigator.languages
    // Named formats such as "dollar" use the browser locale.
    Object.defineProperty(navigator, "languages", {
      value: ["en-US"],
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, "languages", {
      value: originalLanguages,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  it.each([
    ["percent", 0.05, "5%"],
    ["dollar", 0, "$0"],
    ["dollar", 50000, "$50,000"],
    ["compact", 1_200_000, "1.2M"],
    ["%,.0f", 98765.4, "98,765"],
    ["%.1f%%", 12.34, "12.3%"],
  ])("formats axis ticks with %j", (format, value, expected) => {
    const option = { yAxis: { axisLabel: { formatter: format, rotate: 45 } } }

    const result = applyLabelNumberFormats(option)

    expect(labelFormatterAt(result, "yAxis.axisLabel.formatter")(value)).toBe(
      expected
    )
    expect(get(result, "yAxis.axisLabel.rotate")).toBe(45)
    // The input spec is not mutated.
    expect(option.yAxis.axisLabel.formatter).toBe(format)
  })

  it("formats numeric category names and keeps other ones", () => {
    const formatter = labelFormatterAt(
      applyLabelNumberFormats({
        xAxis: { type: "category", axisLabel: { formatter: "percent" } },
      }),
      "xAxis.axisLabel.formatter"
    )

    expect(formatter("0.25")).toBe("25%")
    expect(formatter("Mon")).toBe("Mon")
    expect(formatter(null)).toBe("")
  })

  it("converts every axis component and each axis in a list", () => {
    const untouchedAxis = {
      type: "value",
      axisLabel: { formatter: "{value}" },
    }
    const result = applyLabelNumberFormats({
      xAxis: [{ axisLabel: { formatter: "compact" } }, untouchedAxis],
      radiusAxis: { axisLabel: { formatter: "compact" } },
      angleAxis: { axisLabel: { formatter: "compact" } },
      singleAxis: { axisLabel: { formatter: "compact" } },
      parallelAxis: [{ dim: 0, axisLabel: { formatter: "compact" } }],
    })

    for (const path of [
      "xAxis[0].axisLabel.formatter",
      "radiusAxis.axisLabel.formatter",
      "angleAxis.axisLabel.formatter",
      "singleAxis.axisLabel.formatter",
      "parallelAxis[0].axisLabel.formatter",
    ]) {
      expect(labelFormatterAt(result, path)(1500)).toBe("1.5K")
    }
    expect(get(result, "xAxis[1]")).toBe(untouchedAxis)
  })

  it.each([
    ["an ECharts template", "{value}%"],
    // eslint-disable-next-line no-template-curly-in-string -- An ECharts template.
    ["a template with a dollar sign", "${value}K"],
    ["a time template", "{yyyy}"],
    ["a template next to a printf placeholder", "{value} %d"],
    ["an empty string", ""],
    ["a malformed printf string", "%q"],
    ["a trailing percent sign", "100%"],
    ["literal text", "km"],
    ["a non-string value", 42],
  ])("leaves %s alone without warning", (_case, formatter) => {
    const warnSpy = vi.spyOn(LOG, "warn")
    const option = {
      xAxis: { axisLabel: { formatter } },
      yAxis: { axisPointer: { label: { formatter } } },
      series: [{ type: "bar", label: { show: true, formatter } }],
    }

    expect(applyLabelNumberFormats(option)).toBe(option)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it("formats the axis pointer value of an axis", () => {
    const result = applyLabelNumberFormats({
      xAxis: { axisPointer: { label: { formatter: "percent", show: true } } },
    })

    expect(
      labelFormatterAt(
        result,
        "xAxis.axisPointer.label.formatter"
      )({
        value: 0.05,
        axisDimension: "x",
      })
    ).toBe("5%")
    expect(get(result, "xAxis.axisPointer.label.show")).toBe(true)
  })

  it("keeps an axis pointer number format on a time axis", () => {
    const result = applyTimeLabelFormatters(
      applyLabelNumberFormats({
        xAxis: { type: "time", axisPointer: { label: { formatter: "%,d" } } },
      }),
      "streamlit"
    )

    expect(
      labelFormatterAt(
        result,
        "xAxis.axisPointer.label.formatter"
      )({
        value: 1234,
      })
    ).toBe("1,234")
  })

  it.each([
    ["a single value", { value: 1234.5 }, "$1,234.50"],
    [
      "a vertical bar row",
      {
        value: ["Mon", 1234.5],
        encode: { x: [0], y: [1] },
        dimensionNames: ["day", "sales"],
      },
      "$1,234.50",
    ],
    [
      "a horizontal bar row",
      { value: ["Mon", 1234.5], encode: { y: [0], x: [1] } },
      "$1,234.50",
    ],
    [
      "a row whose value comes first",
      { value: [1234.5, "Mon", 7], encode: { y: [0], x: [1] } },
      "$1,234.50",
    ],
    [
      "an object row",
      {
        value: { day: "Mon", sales: 1234.5 },
        encode: { x: [0], y: [1] },
        dimensionNames: ["day", "sales"],
      },
      "$1,234.50",
    ],
    [
      "a heatmap cell",
      { value: [0, 1, 5.5], encode: { x: [0], y: [1], value: [2] } },
      "$5.50",
    ],
    [
      "a row with a numeric string",
      { value: ["Mon", "1234.5"], encode: { x: [0], y: [1] } },
      "$1,234.50",
    ],
    ["a row without encode", { value: [1.5, 2000.25] }, "$2,000.25"],
    ["a text value", { value: "N/A" }, "N/A"],
    [
      "a row without numbers",
      { value: ["Mon", "Tue"], encode: { x: [0], y: [1] } },
      "Tue",
    ],
  ])("formats the series label value of %s", (_case, params, expected) => {
    const result = applyLabelNumberFormats({
      series: { type: "bar", label: { show: true, formatter: "dollar" } },
    })

    expect(labelFormatterAt(result, "series.label.formatter")(params)).toBe(
      expected
    )
    expect(get(result, "series.label.show")).toBe(true)
  })

  it.each([
    ["the chart's category axis in a timeline tick", undefined, "$1,500"],
    // Non-cartesian series keep the last-number heuristic.
    ["a polar series", "polar", "$2,024"],
  ])(
    "picks the label dimension from the series axes for %s",
    (_case, coordinateSystem, expected) => {
      const result = applyLabelNumberFormats({
        baseOption: { xAxis: { type: "category" }, yAxis: {} },
        options: [
          {
            series: [
              {
                type: "bar",
                coordinateSystem,
                label: { show: true, formatter: "dollar" },
              },
            ],
          },
        ],
      })

      expect(
        labelFormatterAt(
          result,
          "options[0].series[0].label.formatter"
        )({
          value: [1500, 2024],
          encode: { x: [1], y: [0] },
        })
      ).toBe(expected)
    }
  )

  it("finds an axis ID in the chart option when a timeline tick restates the axes", () => {
    const result = applyLabelNumberFormats({
      baseOption: {
        xAxis: [{ type: "value" }, { type: "category", id: 7 }],
        yAxis: {},
      },
      options: [
        {
          xAxis: [{ type: "value" }],
          series: [
            {
              type: "bar",
              xAxisId: "7",
              label: { show: true, formatter: "dollar" },
            },
          ],
        },
      ],
    })

    expect(
      labelFormatterAt(
        result,
        "options[0].series[0].label.formatter"
      )({ value: [1500, 2024], encode: { x: [1], y: [0] } })
    ).toBe("$1,500")
  })

  it("converts end labels but not per-data-item labels", () => {
    const dataItem = { value: 5, label: { formatter: "dollar" } }
    const result = applyLabelNumberFormats({
      series: [
        {
          type: "line",
          endLabel: { show: true, formatter: "compact" },
          data: [dataItem],
        },
      ],
    })

    expect(
      labelFormatterAt(result, "series[0].endLabel.formatter")({ value: 1500 })
    ).toBe("1.5K")
    expect(get(result, "series[0].data[0]")).toBe(dataItem)
    expect(dataItem.label.formatter).toBe("dollar")
  })

  it("converts timeline and media variants", () => {
    const untouchedTick = { yAxis: { axisLabel: { formatter: "{value}" } } }
    const option = {
      baseOption: {
        yAxis: { axisLabel: { formatter: "percent" } },
        media: [{ option: { series: { label: { formatter: "dollar" } } } }],
      },
      options: [
        untouchedTick,
        { xAxis: { axisLabel: { formatter: "compact" } } },
      ],
      media: [
        { query: {}, option: { yAxis: { axisLabel: { formatter: "%d" } } } },
      ],
    }

    const result = applyLabelNumberFormats(option)

    expect(
      labelFormatterAt(result, "baseOption.yAxis.axisLabel.formatter")(0.5)
    ).toBe("50%")
    expect(
      labelFormatterAt(
        result,
        "baseOption.media[0].option.series.label.formatter"
      )({ value: 5 })
    ).toBe("$5")
    expect(get(result, "options[0]")).toBe(untouchedTick)
    expect(
      labelFormatterAt(result, "options[1].xAxis.axisLabel.formatter")(1500)
    ).toBe("1.5K")
    expect(
      labelFormatterAt(result, "media[0].option.yAxis.axisLabel.formatter")(7)
    ).toBe("7")
    // The input spec is not mutated.
    expect(option.baseOption.yAxis.axisLabel.formatter).toBe("percent")
  })

  // These tests intentionally read ECharts' internal series model
  // (``getModel().getSeriesByIndex().getFormattedLabel`` and
  // ``mapDimensionsAll("defaultedLabel")``) as a parity check against ECharts'
  // default label. If they fail after an ECharts upgrade, the internal API may
  // have changed.
  describe("in a rendered chart", () => {
    const charts: echarts.ECharts[] = []

    afterEach(() => {
      charts.splice(0).forEach(chart => chart.dispose())
    })

    function render(option: EChartsOptionObject): echarts.ECharts {
      const chart = echarts.init(null, null, {
        renderer: "svg",
        ssr: true,
        width: 400,
        height: 300,
      })
      charts.push(chart)
      chart.setOption(applyLabelNumberFormats(option) as EChartsOption)
      return chart
    }

    /** The parts of ECharts' internal series model the tests read. */
    interface SeriesModel {
      getFormattedLabel: (dataIndex: number, status: string) => string
      getData: () => {
        mapDimensionsAll: (coordDim: string) => string[]
        get: (dim: string, dataIndex: number) => unknown
      }
    }

    function firstSeries(chart: echarts.ECharts): SeriesModel {
      return (
        chart as unknown as {
          getModel: () => { getSeriesByIndex: (index: number) => SeriesModel }
        }
      )
        .getModel()
        .getSeriesByIndex(0)
    }

    /** Read the label text the first series shows for one data item. */
    function formattedLabel(
      chart: echarts.ECharts,
      dataIndex: number
    ): string {
      return firstSeries(chart).getFormattedLabel(dataIndex, "normal")
    }

    /**
     * Read the value ECharts' default label (no ``formatter``) shows for one
     * data item of the first series: the value of its ``defaultedLabel``
     * dimension.
     */
    function defaultLabelValue(
      chart: echarts.ECharts,
      dataIndex: number
    ): unknown {
      const data = firstSeries(chart).getData()
      const labelDimensions = data.mapDimensionsAll("defaultedLabel")
      expect(labelDimensions).toHaveLength(1)
      return data.get(labelDimensions[0], dataIndex)
    }

    it.each([
      ["vertical", { x: "day", y: "sales" }, "category", "value"],
      ["horizontal", { x: "sales", y: "day" }, "value", "category"],
    ])(
      "formats the value a %s bar label shows by default",
      (_case, encode, xType, yType) => {
        const chart = render({
          dataset: {
            source: [
              ["Mon", 1234.5],
              ["Tue", 98765.4],
            ],
            dimensions: ["day", "sales"],
          },
          xAxis: { type: xType },
          yAxis: { type: yType },
          series: [
            { type: "bar", encode, label: { show: true, formatter: "%.2f" } },
          ],
        })

        expect(formattedLabel(chart, 1)).toBe("98765.40")
      }
    )

    const salesByYear = {
      source: [
        [1500, 2024],
        [2500, 2025],
      ],
      dimensions: ["sales", "year"],
    }

    it.each([
      [
        "a numeric category column after the value column",
        {
          dataset: salesByYear,
          xAxis: { type: "category" },
          yAxis: { type: "value" },
          series: [{ type: "bar", encode: { x: "year", y: "sales" } }],
        },
      ],
      [
        "a horizontal bar on a numeric category axis",
        {
          // An axis without a type or data is a value axis.
          xAxis: {},
          yAxis: { type: "category" },
          series: [
            {
              type: "bar",
              data: [
                [1500, 2024],
                [2500, 2025],
              ],
            },
          ],
        },
      ],
      [
        "a category axis picked by xAxisIndex",
        {
          dataset: salesByYear,
          xAxis: [{ type: "value" }, { type: "category" }],
          yAxis: [{ type: "value" }],
          series: [
            { type: "bar", xAxisIndex: 1, encode: { x: "year", y: "sales" } },
          ],
        },
      ],
      [
        "a category axis picked by xAxisId",
        {
          dataset: salesByYear,
          xAxis: [{ type: "value" }, { type: "category", id: "years" }],
          yAxis: [{ type: "value" }],
          series: [
            {
              type: "bar",
              xAxisId: "years",
              encode: { x: "year", y: "sales" },
            },
          ],
        },
      ],
      [
        "a numeric string after a number on two value axes",
        {
          xAxis: { type: "value" },
          yAxis: { type: "value" },
          series: [
            {
              type: "scatter",
              data: [
                [1, "1500"],
                [2, "2500"],
              ],
            },
          ],
        },
      ],
      [
        "a horizontal line on a time axis",
        {
          xAxis: { type: "value" },
          yAxis: { type: "time" },
          series: [
            {
              type: "line",
              data: [
                [1500, Date.UTC(2024, 0, 1)],
                [2500, Date.UTC(2025, 0, 1)],
              ],
            },
          ],
        },
      ],
    ])(
      "formats the value ECharts' default label shows for %s",
      (_case, option) => {
        const chart = render({
          ...option,
          series: option.series.map(series => ({
            ...series,
            label: { show: true, formatter: "%.2f" },
          })),
        })

        expect(defaultLabelValue(chart, 1)).toBe(2500)
        expect(formattedLabel(chart, 1)).toBe("2500.00")
      }
    )

    it("draws formatted axis ticks", () => {
      const svg = render({
        xAxis: { type: "category", data: ["A", "B"] },
        yAxis: { type: "value", max: 1, axisLabel: { formatter: "percent" } },
        series: [{ type: "bar", data: [0.25, 0.5] }],
      }).renderToSVGString()

      expect(svg).toContain(">20%<")
      expect(svg).toContain(">100%<")
      expect(svg).not.toContain(">percent<")
    })
  })
})
