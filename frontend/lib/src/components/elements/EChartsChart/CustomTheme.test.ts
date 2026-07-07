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
import {
  getGray30,
  getGray70,
  hasLightBackgroundColor,
} from "~lib/theme/getColors"

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

  it("themes the non-cartesian axes (polar, parallel, single)", () => {
    const echartsTheme = buildStreamlitEChartsTheme(theme)

    // Polar and single axes reuse the shared cartesian axis defaults.
    expect(echartsTheme.angleAxis).toBe(echartsTheme.categoryAxis)
    expect(echartsTheme.radiusAxis).toBe(echartsTheme.categoryAxis)
    expect(echartsTheme.singleAxis).toBe(echartsTheme.categoryAxis)

    // Parallel axes also theme the axis name text.
    const parallelAxis = echartsTheme.parallelAxis as Record<
      string,
      Record<string, unknown>
    >
    expect(parallelAxis.axisLabel.color).toBe(getGray70(theme))
    expect(parallelAxis.nameTextStyle.color).toBe(getGray70(theme))
  })

  it("themes the radar coordinate (rings, spokes, and names)", () => {
    const echartsTheme = buildStreamlitEChartsTheme(theme)

    const radar = echartsTheme.radar as {
      splitLine: { lineStyle: { color: string } }
      axisLine: { lineStyle: { color: string } }
      splitArea: { areaStyle: { color: string[] } }
      axisName: { color: string }
    }
    expect(radar.splitLine.lineStyle.color).toBe(getGray30(theme))
    expect(radar.axisLine.lineStyle.color).toBe(getGray30(theme))
    // Split-area rings are a themed pair (subtle in both light and dark).
    expect(radar.splitArea.areaStyle.color).toHaveLength(2)
    // Indicator names use the themed body text color.
    expect(radar.axisName.color).toBe(getGray70(theme))
  })

  it("themes sankey links and seeds nodes from the sequential palette", () => {
    const echartsTheme = buildStreamlitEChartsTheme(theme)

    const sankey = echartsTheme.sankey as Record<string, unknown>
    expect(sankey.color).toEqual([...theme.colors.chartSequentialColors])
    const lineStyle = sankey.lineStyle as Record<string, unknown>
    expect(lineStyle.color).toBe(getGray70(theme))
    expect(lineStyle.opacity).toBeGreaterThan(0)
  })

  it("themes the treemap breadcrumb surface and text", () => {
    const echartsTheme = buildStreamlitEChartsTheme(theme)

    const treemap = echartsTheme.treemap as Record<
      string,
      Record<string, Record<string, Record<string, unknown>>>
    >
    expect(treemap.breadcrumb.itemStyle.color).toBe(theme.colors.secondaryBg)
    expect(treemap.breadcrumb.itemStyle.textStyle.color).toBe(getGray70(theme))
  })

  it("adds a readable halo to sunburst labels", () => {
    const echartsTheme = buildStreamlitEChartsTheme(theme)

    const sunburst = echartsTheme.sunburst as Record<
      string,
      Record<string, unknown>
    >
    expect(sunburst.label.textBorderColor).toBe(theme.colors.white)
    expect(sunburst.label.textBorderWidth).toBeGreaterThan(0)
  })

  it("themes gauge text and track (readable in dark mode)", () => {
    const echartsTheme = buildStreamlitEChartsTheme(theme)

    const gauge = echartsTheme.gauge as Record<string, Record<string, unknown>>
    // Name and value text use themed (theme-adapting) colors instead of the
    // fixed dark defaults that vanish on a dark background.
    expect(gauge.title.color).toBe(getGray70(theme))
    expect(gauge.detail.color).toBe(theme.colors.bodyText)
    // The background track is a themed gray, as an array of [stop, color]
    // segments (so an explicit user color array replaces it wholesale).
    const axisLine = gauge.axisLine as Record<string, Record<string, unknown>>
    expect(axisLine.lineStyle.color).toEqual([[1, getGray30(theme)]])
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

  it("defaults a container-filling grid for cartesian charts only", () => {
    const cartesian = applyStreamlitOptionDefaults(
      { xAxis: { type: "category" }, yAxis: { type: "value" }, series: [] },
      theme,
      STREAMLIT_THEME
    )
    // Tight margins + containLabel so the plot fills the container. With no
    // title/legend, minimal top/bottom room is reserved.
    expect(cartesian.grid).toEqual({
      left: 8,
      right: 24,
      top: 16,
      bottom: 8,
      containLabel: true,
    })

    // A pie chart has no cartesian axes, so no grid should be injected.
    const nonCartesian = applyStreamlitOptionDefaults(
      { series: [{ type: "pie", data: [] }] },
      theme,
      STREAMLIT_THEME
    )
    expect(nonCartesian.grid).toBeUndefined()
  })

  it("defers to ECharts' default margin on the side with a title or legend", () => {
    // ECharts places the legend at the bottom by default: leave `bottom` unset
    // (its generous default reserves room) and keep the top tight.
    const withLegend = applyStreamlitOptionDefaults(
      { xAxis: {}, yAxis: {}, legend: { data: ["a"] }, series: [] },
      theme,
      STREAMLIT_THEME
    )
    const legendGrid = withLegend.grid as Record<string, unknown>
    expect(legendGrid.bottom).toBeUndefined()
    expect(legendGrid.top).toBe(16)

    // A title sits at the top: leave `top` unset, keep the bottom tight.
    const withTitle = applyStreamlitOptionDefaults(
      { xAxis: {}, yAxis: {}, title: { text: "Sales" }, series: [] },
      theme,
      STREAMLIT_THEME
    )
    const titleGrid = withTitle.grid as Record<string, unknown>
    expect(titleGrid.top).toBeUndefined()
    expect(titleGrid.bottom).toBe(8)

    // A legend explicitly positioned at the top leaves `top` unset.
    const topLegend = applyStreamlitOptionDefaults(
      { xAxis: {}, yAxis: {}, legend: { top: 0 }, series: [] },
      theme,
      STREAMLIT_THEME
    )
    const topLegendGrid = topLegend.grid as Record<string, unknown>
    expect(topLegendGrid.top).toBeUndefined()
    expect(topLegendGrid.bottom).toBe(8)
  })

  it("fills only the grid gaps the user left unset (user values win)", () => {
    const result = applyStreamlitOptionDefaults(
      { xAxis: {}, grid: { containLabel: false, left: 40 }, series: [] },
      theme,
      STREAMLIT_THEME
    )
    // User keys win; the rest are filled from the container-filling defaults.
    expect(result.grid).toEqual({
      left: 40,
      right: 24,
      top: 16,
      bottom: 8,
      containLabel: false,
    })
  })

  it("leaves an array of grids untouched", () => {
    const grids = [{ left: 1 }, { left: 2 }]
    const result = applyStreamlitOptionDefaults(
      { xAxis: [{}, {}], grid: grids, series: [] },
      theme,
      STREAMLIT_THEME
    )
    expect(result.grid).toBe(grids)
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
