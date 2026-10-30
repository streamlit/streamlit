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

import { getLogger } from "loglevel"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { EChartsOptionObject } from "./CustomTheme"
import {
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
      expect(valueFormatter([1, 2.5])).toEqual(["$1.00", "$2.50"])
      expect(valueFormatter("N/A")).toBe("N/A")
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
    expect(valueFormatterOf(baseSeries as EChartsOptionObject)(5)).toBe(
      "$5.00"
    )
    expect(valueFormatterOf(baseMedia[0].option)(1500)).toBe("1.5K")
    expect(tickSeries[0]).toBe(untouchedSeries)
    expect(valueFormatterOf(tickSeries[1] as EChartsOptionObject)(5)).toBe(
      "$5.00"
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
    expect((converted.valueFormatter as ValueFormatter)(5)).toBe("$5.00")
    expect(second).toBe(untouched)
  })

  it("does not convert per-data-item tooltips", () => {
    const dataItem = { value: 5, tooltip: { valueFormatter: "dollar" } }
    const option = { series: [{ type: "bar", data: [dataItem] }] }

    const result = applyTooltipFormatters(option)

    expect(result).toBe(option)
    expect(dataItem.tooltip.valueFormatter).toBe("dollar")
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
