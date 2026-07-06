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

import { mockTheme } from "~lib/mocks/mockTheme"
import { getGray70, hasLightBackgroundColor } from "~lib/theme/getColors"

import {
  applyStreamlitOptionDefaults,
  buildStreamlitEChartsTheme,
  STREAMLIT_THEME,
} from "./CustomTheme"

const theme = mockTheme.emotion

describe("buildStreamlitEChartsTheme", () => {
  it("maps the Emotion palette, fonts, and dark mode", () => {
    const echartsTheme = buildStreamlitEChartsTheme(theme)

    expect(echartsTheme.color).toEqual([
      ...theme.colors.chartCategoricalColors,
    ])
    expect(echartsTheme.backgroundColor).toBe("transparent")
    expect(echartsTheme.darkMode).toBe(!hasLightBackgroundColor(theme))

    const textStyle = echartsTheme.textStyle as Record<string, unknown>
    expect(textStyle.fontFamily).toBe(theme.genericFonts.bodyFont)
    expect(textStyle.color).toBe(getGray70(theme))
  })

  it("themes title, tooltip, legend, and axes", () => {
    const echartsTheme = buildStreamlitEChartsTheme(theme)

    const title = echartsTheme.title as Record<string, Record<string, unknown>>
    expect(title.textStyle.fontFamily).toBe(theme.genericFonts.headingFont)
    expect(title.textStyle.color).toBe(theme.colors.headingColor)

    const tooltip = echartsTheme.tooltip as Record<string, unknown>
    expect(tooltip.backgroundColor).toBe(theme.colors.bgColor)
    expect(tooltip.borderColor).toBe(theme.colors.borderColor)

    const categoryAxis = echartsTheme.categoryAxis as Record<
      string,
      Record<string, unknown>
    >
    expect(categoryAxis.axisLabel.color).toBe(getGray70(theme))
  })

  it("seeds the continuous color scale from the sequential palette", () => {
    const echartsTheme = buildStreamlitEChartsTheme(theme)

    const visualMap = echartsTheme.visualMap as Record<
      string,
      Record<string, unknown>
    >
    expect(visualMap.inRange.color).toEqual([
      ...theme.colors.chartSequentialColors,
    ])
  })
})

describe("applyStreamlitOptionDefaults", () => {
  it("returns the option untouched when theme is not 'streamlit'", () => {
    const option = { series: [{ type: "bar", data: [1] }] }
    const result = applyStreamlitOptionDefaults(option, theme, "")

    expect(result).toBe(option)
    expect(result.aria).toBeUndefined()
  })

  it("enables ARIA by default when the user hasn't set it", () => {
    const result = applyStreamlitOptionDefaults(
      { series: [] },
      theme,
      STREAMLIT_THEME
    )

    expect(result.aria).toEqual({ enabled: true })
  })

  it("preserves an explicit aria configuration", () => {
    const result = applyStreamlitOptionDefaults(
      { aria: { enabled: false }, series: [] },
      theme,
      STREAMLIT_THEME
    )

    expect(result.aria).toEqual({ enabled: false })
  })

  it("preserves user colors (top-level and per-series)", () => {
    const option = {
      color: ["#123456"],
      xAxis: { type: "category" },
      yAxis: { type: "value" },
      series: [{ type: "bar", itemStyle: { color: "#abcdef" }, data: [1] }],
    }
    const result = applyStreamlitOptionDefaults(option, theme, STREAMLIT_THEME)

    expect(result.color).toEqual(["#123456"])
    const series = result.series as Array<Record<string, unknown>>
    expect(series[0].itemStyle).toEqual({ color: "#abcdef" })
  })

  it("defaults grid.containLabel for cartesian charts only", () => {
    const cartesian = applyStreamlitOptionDefaults(
      { xAxis: { type: "category" }, yAxis: { type: "value" }, series: [] },
      theme,
      STREAMLIT_THEME
    )
    expect(cartesian.grid).toEqual({ containLabel: true })

    // A pie chart has no cartesian axes, so no grid should be injected.
    const nonCartesian = applyStreamlitOptionDefaults(
      { series: [{ type: "pie", data: [] }] },
      theme,
      STREAMLIT_THEME
    )
    expect(nonCartesian.grid).toBeUndefined()
  })

  it("does not override an existing grid.containLabel", () => {
    const result = applyStreamlitOptionDefaults(
      { xAxis: {}, grid: { containLabel: false, left: 10 }, series: [] },
      theme,
      STREAMLIT_THEME
    )
    expect(result.grid).toEqual({ containLabel: false, left: 10 })
  })

  it("never injects a tooltip formatter or changes renderMode (XSS-safe)", () => {
    const option = {
      xAxis: { type: "category", data: ["A"] },
      yAxis: { type: "value" },
      tooltip: { trigger: "axis" },
      series: [
        {
          type: "bar",
          data: [{ value: 1, name: "<img src=x onerror=alert(1)>" }],
        },
      ],
    }
    const result = applyStreamlitOptionDefaults(option, theme, STREAMLIT_THEME)

    // The tooltip is left entirely untouched: no formatter, no renderMode.
    expect(result.tooltip).toBe(option.tooltip)
    expect(result.tooltip).toEqual({ trigger: "axis" })
    const tooltip = result.tooltip as Record<string, unknown>
    expect(tooltip.formatter).toBeUndefined()
    expect(tooltip.renderMode).toBeUndefined()

    // The malicious payload survives verbatim (ECharts escapes it at render).
    const series = result.series as Array<Record<string, unknown>>
    const data = series[0].data as Array<Record<string, unknown>>
    expect(data[0].name).toBe("<img src=x onerror=alert(1)>")
  })
})
