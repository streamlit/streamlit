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
import { getGray30, getGray70 } from "~lib/theme/getColors"
import { darkTheme, lightTheme } from "~lib/theme/themeConfigs"

import {
  applyStreamlitOptionDefaults,
  buildStreamlitEChartsTheme,
  STREAMLIT_THEME,
  withDefaultSeriesCursor,
} from "./CustomTheme"

const theme = mockTheme.emotion

describe("buildStreamlitEChartsTheme", () => {
  it("maps the Emotion palette, fonts, and dark mode", () => {
    const echartsTheme = buildStreamlitEChartsTheme(theme)

    expect(echartsTheme.color).toEqual([
      ...theme.colors.chartCategoricalColors,
    ])
    expect(echartsTheme.backgroundColor).toBe("transparent")
    expect(echartsTheme.darkMode).toBe(false)

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
    expect(lineStyle.opacity).toBe(0.2)
  })

  it.each([
    ["Light", lightTheme.emotion, false, 0.2],
    ["Dark", darkTheme.emotion, true, 0.35],
  ] as const)(
    "sets darkMode and sankey opacity for the %s theme",
    (_name, emotionTheme, darkMode, sankeyOpacity) => {
      const echartsTheme = buildStreamlitEChartsTheme(emotionTheme)
      expect(echartsTheme.darkMode).toBe(darkMode)
      const sankey = echartsTheme.sankey as {
        lineStyle: { opacity: number }
      }
      expect(sankey.lineStyle.opacity).toBe(sankeyOpacity)
    }
  )

  it("themes the treemap breadcrumb surface, text, and parent label band", () => {
    const echartsTheme = buildStreamlitEChartsTheme(theme)

    const treemap = echartsTheme.treemap as {
      breadcrumb: {
        itemStyle: { color: string; textStyle: { color: string } }
      }
      itemStyle: { borderColor: string }
    }
    expect(treemap.breadcrumb.itemStyle.color).toBe(theme.colors.secondaryBg)
    expect(treemap.breadcrumb.itemStyle.textStyle.color).toBe(getGray70(theme))
    // The parent-node header band otherwise renders as an opaque white slab.
    expect(treemap.itemStyle.borderColor).toBe(theme.colors.bgColor)
  })

  it("themes axis names and opt-in split areas", () => {
    const echartsTheme = buildStreamlitEChartsTheme(theme)

    const valueAxis = echartsTheme.valueAxis as {
      nameTextStyle: { color: string }
      splitArea: { areaStyle: { color: unknown[] } }
    }
    expect(valueAxis.nameTextStyle.color).toBe(getGray70(theme))
    // ECharts' default split areas are opaque light gray, which covers the plot
    // on a dark background, so they are replaced by a faint themed pair.
    expect(valueAxis.splitArea.areaStyle.color).toHaveLength(2)
  })

  it("themes components that keep fixed light-mode defaults", () => {
    const echartsTheme = buildStreamlitEChartsTheme(theme)

    const timeline = echartsTheme.timeline as {
      label: { color: string }
      checkpointStyle: { color: string }
    }
    expect(timeline.label.color).toBe(getGray70(theme))
    expect(timeline.checkpointStyle.color).toBe(theme.colors.primary)

    // The visualMap's range labels should match the themed axis labels.
    const visualMap = echartsTheme.visualMap as {
      textStyle: { color: string }
    }
    expect(visualMap.textStyle.color).toBe(getGray70(theme))

    const calendar = echartsTheme.calendar as {
      dayLabel: { color: string }
    }
    expect(calendar.dayLabel.color).toBe(getGray70(theme))

    // A boxplot's box is filled opaque white by default, which glares against a
    // dark app background.
    const boxplot = echartsTheme.boxplot as {
      itemStyle: { color: string }
    }
    expect(boxplot.itemStyle.color).toBe(theme.colors.bgColor)

    // Funnel labels sit on palette colors of varying lightness, so they get the
    // same dark-text-plus-halo treatment as sunburst labels.
    const funnel = echartsTheme.funnel as {
      label: { textBorderWidth: number }
    }
    expect(funnel.label.textBorderWidth).toBeGreaterThan(0)
  })

  it("themes components that ECharts renders with its own fixed tokens", () => {
    const echartsTheme = buildStreamlitEChartsTheme(theme)

    // Band names beside a themeRiver ignore the surrounding axis theming.
    const themeRiver = echartsTheme.themeRiver as { label: { color: string } }
    expect(themeRiver.label.color).toBe(getGray70(theme))

    // Chord ribbons are too faint on a dark background at ECharts' default 0.2.
    const chord = echartsTheme.chord as {
      lineStyle: { color?: string; opacity: number }
    }
    expect(chord.lineStyle.opacity).toBeGreaterThan(0.2)
    // The color must stay unset so ECharts' `"source"` keyword keeps tinting
    // each ribbon with its palette-colored source node; a literal paints black.
    expect(chord.lineStyle.color).toBeUndefined()

    // Matrix cell dividers and headers otherwise read dimmer than everything else.
    const matrix = echartsTheme.matrix as {
      x: { label: { color: string }; itemStyle: { borderColor: string } }
      body: { itemStyle: { borderColor: string } }
    }
    expect(matrix.x.label.color).toBe(getGray70(theme))
    expect(matrix.body.itemStyle.borderColor).toBe(getGray30(theme))
  })

  it("keeps the dataZoom preview visible against the app background", () => {
    const echartsTheme = buildStreamlitEChartsTheme(theme)

    // The gridline gray is too faint here, since the slider sits outside the plot.
    const dataZoom = echartsTheme.dataZoom as {
      dataBackground: { lineStyle: { color: string } }
    }
    expect(dataZoom.dataBackground.lineStyle.color).toBe(getGray70(theme))
    expect(dataZoom.dataBackground.lineStyle.color).not.toBe(getGray30(theme))
  })

  it("themes the toolbox hover state, not just its resting icons", () => {
    const echartsTheme = buildStreamlitEChartsTheme(theme)

    const toolbox = echartsTheme.toolbox as {
      iconStyle: { borderColor: string }
      emphasis: {
        iconStyle: {
          borderColor: string
          textFill: string
          textBackgroundColor: string
        }
      }
    }
    expect(toolbox.iconStyle.borderColor).toBe(getGray70(theme))
    // ECharts' hover state is a fixed light blue that is hard to read on a dark
    // background, for both the icon and the feature title it reveals.
    const hovered = toolbox.emphasis.iconStyle
    expect(hovered.textFill).toBe(theme.colors.bodyText)
    expect(hovered.textBackgroundColor).toBe(theme.colors.secondaryBg)
    // A hovered icon must be distinguishable from a resting one.
    expect(hovered.borderColor).not.toBe(toolbox.iconStyle.borderColor)
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
  it("skips visual defaults but still enables ARIA when theme is not 'streamlit'", () => {
    const option = {
      xAxis: {},
      yAxis: {},
      series: [{ type: "bar", data: [1] }],
    }
    const result = applyStreamlitOptionDefaults(option, "")

    // theme=None opts out of visual styling only; the screen-reader
    // description must not disappear along with it.
    expect(result.aria).toEqual({ enabled: true })
    expect(result.grid).toBeUndefined()
    expect(result.series).toBe(option.series)
  })

  it("does not enable ARIA when the user explicitly disabled it and theme is None", () => {
    const result = applyStreamlitOptionDefaults(
      { aria: { enabled: false }, series: [] },
      ""
    )

    expect(result.aria).toEqual({ enabled: false })
  })

  it("enables ARIA by default when the user hasn't set it", () => {
    const result = applyStreamlitOptionDefaults(
      { series: [] },
      STREAMLIT_THEME
    )

    expect(result.aria).toEqual({ enabled: true })
  })

  it("preserves an explicit aria configuration", () => {
    const result = applyStreamlitOptionDefaults(
      { aria: { enabled: false }, series: [] },
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
    const result = applyStreamlitOptionDefaults(option, STREAMLIT_THEME)

    expect(result.color).toEqual(["#123456"])
    const series = result.series as Array<Record<string, unknown>>
    expect(series[0].itemStyle).toEqual({ color: "#abcdef" })
  })

  it("defaults a container-filling grid for cartesian charts only", () => {
    const cartesian = applyStreamlitOptionDefaults(
      { xAxis: { type: "category" }, yAxis: { type: "value" }, series: [] },
      STREAMLIT_THEME
    )
    // Tight margins so the plot fills the container, with `outerBoundsMode`
    // keeping axis labels and names inside them. With no title/legend, minimal
    // top/bottom room is reserved.
    expect(cartesian.grid).toEqual({
      left: 8,
      right: 24,
      top: 16,
      bottom: 8,
      outerBoundsMode: "same",
    })

    // A pie chart has no cartesian axes, so no grid should be injected.
    const nonCartesian = applyStreamlitOptionDefaults(
      { series: [{ type: "pie", data: [] }] },
      STREAMLIT_THEME
    )
    expect(nonCartesian.grid).toBeUndefined()
  })

  it("defers to ECharts' default margin on the side with a title or legend", () => {
    // ECharts places the legend at the bottom by default: leave `bottom` unset
    // (its generous default reserves room) and keep the top tight.
    const withLegend = applyStreamlitOptionDefaults(
      { xAxis: {}, yAxis: {}, legend: { data: ["a"] }, series: [] },
      STREAMLIT_THEME
    )
    const legendGrid = withLegend.grid as Record<string, unknown>
    expect(legendGrid.bottom).toBeUndefined()
    expect(legendGrid.top).toBe(16)

    // A title sits at the top: leave `top` unset, keep the bottom tight.
    const withTitle = applyStreamlitOptionDefaults(
      { xAxis: {}, yAxis: {}, title: { text: "Sales" }, series: [] },
      STREAMLIT_THEME
    )
    const titleGrid = withTitle.grid as Record<string, unknown>
    expect(titleGrid.top).toBeUndefined()
    expect(titleGrid.bottom).toBe(8)

    // A legend explicitly positioned at the top leaves `top` unset.
    const topLegend = applyStreamlitOptionDefaults(
      { xAxis: {}, yAxis: {}, legend: { top: 0 }, series: [] },
      STREAMLIT_THEME
    )
    const topLegendGrid = topLegend.grid as Record<string, unknown>
    expect(topLegendGrid.top).toBeUndefined()
    expect(topLegendGrid.bottom).toBe(8)

    // A hidden legend with `top` set must not reserve the default top margin.
    const hiddenLegend = applyStreamlitOptionDefaults(
      { xAxis: {}, yAxis: {}, legend: { show: false, top: 10 }, series: [] },
      STREAMLIT_THEME
    )
    const hiddenLegendGrid = hiddenLegend.grid as Record<string, unknown>
    expect(hiddenLegendGrid.top).toBe(16)
    expect(hiddenLegendGrid.bottom).toBe(8)

    // A hidden title is the same: don't treat it as occupying the top strip.
    const hiddenTitle = applyStreamlitOptionDefaults(
      { xAxis: {}, yAxis: {}, title: { show: false }, series: [] },
      STREAMLIT_THEME
    )
    const hiddenTitleGrid = hiddenTitle.grid as Record<string, unknown>
    expect(hiddenTitleGrid.top).toBe(16)
    expect(hiddenTitleGrid.bottom).toBe(8)
  })

  it("fills only the grid gaps the user left unset (user values win)", () => {
    const result = applyStreamlitOptionDefaults(
      { xAxis: {}, grid: { containLabel: false, left: 40 }, series: [] },
      STREAMLIT_THEME
    )
    // User keys win; the rest are filled from the container-filling defaults.
    expect(result.grid).toEqual({
      left: 40,
      right: 24,
      top: 16,
      bottom: 8,
      containLabel: false,
      outerBoundsMode: "same",
    })
  })

  it.each([
    ["a dataZoom slider", { dataZoom: [{ type: "slider" }] }],
    ["an untyped dataZoom (slider by default)", { dataZoom: {} }],
    ["a horizontal visualMap", { visualMap: { orient: "horizontal" } }],
    ["a timeline", { timeline: { data: ["2015"] } }],
  ])(
    "defers to ECharts' default bottom margin for %s",
    (_name, bottomComponent) => {
      const result = applyStreamlitOptionDefaults(
        { xAxis: {}, yAxis: {}, series: [], ...bottomComponent },
        STREAMLIT_THEME
      )

      // A tight `bottom` would let the component overlap the x-axis labels.
      const grid = result.grid as Record<string, unknown>
      expect(grid.bottom).toBeUndefined()
      expect(grid.top).toBe(16)
    }
  )

  it.each([
    ["an inside dataZoom draws nothing", { dataZoom: [{ type: "inside" }] }],
    [
      "a vertical dataZoom sits beside the plot",
      { dataZoom: { orient: "vertical" } },
    ],
    ["a top-anchored slider is out of the way", { dataZoom: { top: 0 } }],
    ["a hidden slider is not rendered", { dataZoom: { show: false } }],
    ["a visualMap defaults to vertical", { visualMap: { min: 0, max: 1 } }],
  ])("keeps the tight bottom margin when %s", (_name, component) => {
    const result = applyStreamlitOptionDefaults(
      { xAxis: {}, yAxis: {}, series: [], ...component },
      STREAMLIT_THEME
    )

    expect((result.grid as Record<string, unknown>).bottom).toBe(8)
  })

  it("fills defaults inside baseOption for timeline specs", () => {
    const result = applyStreamlitOptionDefaults(
      {
        baseOption: { xAxis: {}, yAxis: {}, series: [] },
        options: [{ series: [{ data: [1] }] }],
      },
      STREAMLIT_THEME
    )

    // ECharts reads `aria`/`grid` from `baseOption`, so writing them at the top
    // level of a timeline spec would have no effect.
    const baseOption = result.baseOption as Record<string, unknown>
    expect(baseOption.aria).toEqual({ enabled: true })
    expect((baseOption.grid as Record<string, unknown>).left).toBe(8)
    expect(result.aria).toBeUndefined()
    expect(result.grid).toBeUndefined()
  })

  it("leaves an array of grids untouched", () => {
    const grids = [{ left: 1 }, { left: 2 }]
    const result = applyStreamlitOptionDefaults(
      { xAxis: [{}, {}], grid: grids, series: [] },
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
    const result = applyStreamlitOptionDefaults(option, STREAMLIT_THEME)

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

describe("withDefaultSeriesCursor", () => {
  it("uses a default cursor only for series without one", () => {
    const configured = withDefaultSeriesCursor({
      series: [
        { type: "bar", data: [1] },
        { type: "line", data: [2], cursor: "crosshair" },
      ],
    })
    const series = configured.series as Array<Record<string, unknown>>
    expect(series[0].cursor).toBe("default")
    expect(series[1].cursor).toBe("crosshair")

    const single = withDefaultSeriesCursor({
      series: { type: "pie", data: [] },
    })
    expect((single.series as Record<string, unknown>).cursor).toBe("default")

    const noSeries = {}
    expect(withDefaultSeriesCursor(noSeries)).toBe(noSeries)
  })

  it("applies the default cursor inside timeline baseOption and options", () => {
    const configured = withDefaultSeriesCursor({
      baseOption: { series: [{ type: "bar", data: [1] }] },
      options: [{ series: [{ type: "line", data: [2] }] }],
    })

    expect(
      (
        (configured.baseOption as Record<string, unknown>).series as Array<
          Record<string, unknown>
        >
      )[0].cursor
    ).toBe("default")
    expect(
      (
        (configured.options as Array<Record<string, unknown>>)[0]
          .series as Array<Record<string, unknown>>
      )[0].cursor
    ).toBe("default")
  })
})
