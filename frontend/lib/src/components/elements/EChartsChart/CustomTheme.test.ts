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
import type { EChartsOption, EChartsType } from "echarts"

import { mockTheme } from "~lib/mocks/mockTheme"
import {
  getDecreasingRed,
  getGray30,
  getGray70,
  getIncreasingGreen,
} from "~lib/theme/getColors"
import { darkTheme, lightTheme } from "~lib/theme/themeConfigs"
import { convertRemToPx } from "~lib/theme/utils"

import {
  applyAltToOption,
  applyStreamlitOptionDefaults,
  buildStreamlitEChartsTheme,
  type EChartsOptionObject,
  formatEChartsTooltipValue,
  insideDataZoomCapturesWheel,
  insideDataZoomConsumesWheelEvent,
  insideDataZoomWheelSkipsSettle,
  optionHasWheelRoam,
  STREAMLIT_THEME,
  wheelRoamSkipsSettle,
  withDefaultSeriesCursor,
} from "./CustomTheme"

const theme = mockTheme.emotion
const gridLeft = convertRemToPx(theme.spacing.sm)
const gridRight = convertRemToPx(theme.spacing.twoXL)
const gridTop = convertRemToPx(theme.spacing.lg)
const gridBottom = convertRemToPx(theme.spacing.sm)
const controlBand = convertRemToPx(theme.spacing.threeXL)
const controlGap = convertRemToPx(theme.spacing.xs)
const controlEdge = convertRemToPx(theme.spacing.sm)

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

    const title = echartsTheme.title as Record<string, unknown>
    const titleText = title.textStyle as Record<string, unknown>
    expect(titleText.fontFamily).toBe(theme.genericFonts.headingFont)
    expect(titleText.color).toBe(theme.colors.headingColor)
    expect(titleText.fontSize).toBe(convertRemToPx(theme.fontSizes.sm))
    expect(titleText.fontWeight).toBe("normal")
    expect(title.padding).toEqual([0, 0, convertRemToPx(theme.spacing.lg), 0])

    const tooltip = echartsTheme.tooltip as Record<string, unknown>
    expect(tooltip.backgroundColor).toBe(theme.colors.bgColor)
    expect(tooltip.borderColor).toBe(theme.colors.borderColor)
    const tooltipText = tooltip.textStyle as Record<string, unknown>
    expect(tooltipText.fontFamily).toBe(theme.genericFonts.bodyFont)
    expect(tooltipText.fontSize).toBe(convertRemToPx(theme.fontSizes.twoSm))
    // ECharts paints tooltip values at weight 900 when fontWeight is unset.
    expect(tooltipText.fontWeight).toBe(theme.fontWeights.normal)
    expect(tooltip.valueFormatter).toBe(formatEChartsTooltipValue)
    expect(tooltip.formatter).toBeUndefined()

    const categoryAxis = echartsTheme.categoryAxis as Record<
      string,
      Record<string, unknown>
    >
    const axisLabel = categoryAxis.axisLabel
    expect(axisLabel.color).toBe(getGray70(theme))
    expect(axisLabel.margin).toBe(convertRemToPx(theme.spacing.sm))
    expect(axisLabel.textBorderColor).toBe(theme.colors.bgColor)
    expect(axisLabel.textBorderWidth).toBe(2)
  })

  it("dims toggled-off legend entries and the inactive page arrow", () => {
    const { colors } = darkTheme.emotion
    const legend = buildStreamlitEChartsTheme(darkTheme.emotion).legend as {
      textStyle: { color: string }
      inactiveColor: string
      lineStyle: { inactiveColor: string }
      pageIconColor: string
      pageIconInactiveColor: string
    }

    // ECharts' fixed light gray barely differs from an active dark-mode label.
    expect(legend.inactiveColor).toBe(colors.fadedText20)
    expect(legend.inactiveColor).not.toBe(legend.textStyle.color)
    expect(legend.lineStyle.inactiveColor).toBe(colors.fadedText20)
    // The active page arrow must stand out from the disabled one.
    expect(legend.pageIconColor).toBe(legend.textStyle.color)
    expect(legend.pageIconInactiveColor).toBe(colors.fadedText20)
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
  })

  it("separates funnel stages and sunburst segments with the app background", () => {
    const { colors } = darkTheme.emotion
    const echartsTheme = buildStreamlitEChartsTheme(darkTheme.emotion)

    for (const seriesType of ["funnel", "sunburst"]) {
      const series = echartsTheme[seriesType] as {
        itemStyle: { borderColor: string }
      }
      expect(series.itemStyle.borderColor).toBe(colors.bgColor)
      // ECharts' white separators glare on a dark background.
      expect(series.itemStyle.borderColor).not.toBe(colors.white)
    }
  })

  it.each([
    "bar",
    "pictorialBar",
    "scatter",
    "heatmap",
    "funnel",
    "sankey",
    "graph",
  ])("outlines a selected %s item in the body text color", seriesType => {
    // ECharts' fixed near-black outline barely shows in dark mode.
    for (const emotionTheme of [lightTheme.emotion, darkTheme.emotion]) {
      const series = buildStreamlitEChartsTheme(emotionTheme)[seriesType] as {
        select: { itemStyle: { borderColor: string } }
      }
      expect(series.select.itemStyle.borderColor).toBe(
        emotionTheme.colors.bodyText
      )
    }
  })

  it("styles funnel labels for the default outside position", () => {
    const echartsTheme = buildStreamlitEChartsTheme(darkTheme.emotion)

    const funnel = echartsTheme.funnel as { label: Record<string, unknown> }
    // Outside labels sit on the app background like other component labels,
    expect(funnel.label.color).toBe(getGray70(darkTheme.emotion))
    // so they skip the on-fill halo, which smears on a dark background.
    expect(funnel.label.textBorderWidth).toBeUndefined()
  })

  it("styles axis pointer labels like the tooltip", () => {
    const echartsTheme = buildStreamlitEChartsTheme(theme)

    const axisPointer = echartsTheme.axisPointer as {
      label: Record<string, unknown>
    }
    const tooltip = echartsTheme.tooltip as Record<string, unknown>
    expect(axisPointer.label.backgroundColor).toBe(tooltip.backgroundColor)
    expect(axisPointer.label.borderColor).toBe(tooltip.borderColor)
    expect(axisPointer.label.color).toBe(theme.colors.bodyText)
  })

  it.each([
    ["light", lightTheme.emotion],
    ["dark", darkTheme.emotion],
  ] as const)(
    "colors rising candles green and falling ones red (%s)",
    (_name, emotionTheme) => {
      const candlestick = buildStreamlitEChartsTheme(emotionTheme)
        .candlestick as { itemStyle: Record<string, unknown> }

      // ECharts names the rising candle `color` and the falling one `color0`.
      expect(candlestick.itemStyle).toEqual({
        color: getIncreasingGreen(emotionTheme),
        borderColor: getIncreasingGreen(emotionTheme),
        color0: getDecreasingRed(emotionTheme),
        borderColor0: getDecreasingRed(emotionTheme),
      })
    }
  )

  it("fills line markers on a dark background only", () => {
    // ECharts fills its hollow default marker with white, which reads as a
    // white dot in dark mode but as hollow on a light background.
    expect(buildStreamlitEChartsTheme(darkTheme.emotion).line).toEqual({
      symbol: "circle",
    })
    expect(buildStreamlitEChartsTheme(lightTheme.emotion).line).toBeUndefined()
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

  it("themes the toolbox data view panel", () => {
    const { colors } = darkTheme.emotion
    const toolbox = buildStreamlitEChartsTheme(darkTheme.emotion).toolbox as {
      feature: { dataView: Record<string, unknown> }
    }

    const { dataView } = toolbox.feature
    expect(dataView.backgroundColor).toBe(colors.bgColor)
    expect(dataView.textColor).toBe(colors.bodyText)
    expect(dataView.textareaColor).toBe(colors.secondaryBg)
    expect(dataView.buttonColor).toBe(colors.primary)
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

/**
 * These render through real ECharts to pin how its theme merge applies the
 * Streamlit theme: which keys reach which model, and which beat ECharts' own
 * series defaults.
 */
describe("Streamlit theme resolved by ECharts", () => {
  interface ResolvedModel {
    get: (path: string | string[]) => unknown
  }

  const charts: EChartsType[] = []

  afterEach(() => {
    charts.splice(0).forEach(chart => chart.dispose())
  })

  /** Render ``option`` with the dark Streamlit theme and option defaults. */
  function renderThemed(option: EChartsOptionObject): {
    component: (mainType: string) => ResolvedModel
    series: (index: number) => ResolvedModel
  } {
    const emotionTheme = darkTheme.emotion
    const chart = echarts.init(
      null,
      buildStreamlitEChartsTheme(emotionTheme),
      { renderer: "svg", ssr: true, width: 400, height: 300 }
    )
    charts.push(chart)
    chart.setOption(
      applyStreamlitOptionDefaults(
        option,
        STREAMLIT_THEME,
        emotionTheme
      ) as EChartsOption
    )
    const model = (
      chart as unknown as {
        getModel: () => {
          getComponent: (mainType: string) => ResolvedModel
          getSeriesByIndex: (index: number) => ResolvedModel
        }
      }
    ).getModel()
    return {
      component: mainType => model.getComponent(mainType),
      series: index => model.getSeriesByIndex(index),
    }
  }

  it("styles the data view panel without enabling a data view button", () => {
    const withDataView = renderThemed({
      toolbox: { feature: { dataView: {} } },
      series: [],
    })
    expect(
      withDataView
        .component("toolbox")
        .get(["feature", "dataView", "backgroundColor"])
    ).toBe(darkTheme.emotion.colors.bgColor)

    // Must NOT happen: the themed feature adds a button the spec didn't enable.
    const withoutDataView = renderThemed({
      toolbox: { feature: { saveAsImage: {} } },
      series: [],
    })
    expect(
      Object.keys(
        withoutDataView.component("toolbox").get("feature") as object
      )
    ).toEqual(["saveAsImage"])
  })

  it("outlines a selected bar in the body text color over ECharts' default", () => {
    const { series } = renderThemed({
      xAxis: { type: "category", data: ["A"] },
      yAxis: { type: "value" },
      series: [{ type: "bar", selectedMode: "single", data: [1] }],
    })

    expect(series(0).get(["select", "itemStyle", "borderColor"])).toBe(
      darkTheme.emotion.colors.bodyText
    )
    // ECharts' own 2px outline width is kept.
    expect(series(0).get(["select", "itemStyle", "borderWidth"])).toBe(2)
  })

  it("labels outside funnels plainly and inside funnels with the halo", () => {
    const emotionTheme = darkTheme.emotion
    const data = [{ name: "A", value: 1 }]
    const { series } = renderThemed({
      series: [
        { type: "funnel", data },
        { type: "funnel", label: { position: "inside" }, data },
      ],
    })

    expect(series(0).get(["label", "color"])).toBe(getGray70(emotionTheme))
    expect(series(0).get(["label", "textBorderWidth"])).toBeUndefined()
    expect(series(1).get(["label", "color"])).toBe(emotionTheme.colors.gray100)
    expect(series(1).get(["label", "textBorderColor"])).toBe(
      emotionTheme.colors.white
    )
  })

  it("themes a scrolling legend over its own page arrow defaults", () => {
    const { component } = renderThemed({
      legend: { type: "scroll" },
      series: [],
    })

    expect(component("legend").get("pageIconInactiveColor")).toBe(
      darkTheme.emotion.colors.fadedText20
    )
    expect(component("legend").get("inactiveColor")).toBe(
      darkTheme.emotion.colors.fadedText20
    )
  })

  it("themes the global axis pointer label that cross tooltips inherit", () => {
    const { component } = renderThemed({
      tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
      xAxis: { type: "category", data: ["A"] },
      yAxis: { type: "value" },
      series: [{ type: "line", data: [1] }],
    })

    expect(component("axisPointer").get(["label", "backgroundColor"])).toBe(
      darkTheme.emotion.colors.bgColor
    )
  })
})

describe("formatEChartsTooltipValue", () => {
  it.each([
    [76.23801738559538, "76.2380"],
    [49.19783483864203, "49.1978"],
    [9999999, "9,999,999"],
    [-12.5, "-12.5"],
    [-0, "0"],
  ])("formats %s as %s", (value, expected) => {
    expect(formatEChartsTooltipValue(value)).toBe(expected)
  })

  it.each([
    [0.123456789, "0.123457"],
    [0.000123456, "0.000123456"],
    [0.0001, "0.0001"],
    [9.999e-5, "9.999E-5"],
    [1e-8, "1E-8"],
  ])("formats small %s as %s", (value, expected) => {
    expect(formatEChartsTooltipValue(value)).toBe(expected)
  })

  it.each([
    [1e15, "1,000,000,000,000,000"],
    [12345678901.12345, "12,345,678,901.1235"],
    [1e27, "1,000,000,000,000,000,000,000,000,000"],
    [-1e27, "-1,000,000,000,000,000,000,000,000,000"],
  ])("formats large %s as %s", (value, expected) => {
    expect(formatEChartsTooltipValue(value)).toBe(expected)
  })

  it.each([
    ["2026", "2026"],
    ["76.23801738559538", "76.23801738559538"],
  ])("leaves the string %s unchanged", (value, expected) => {
    expect(formatEChartsTooltipValue(value)).toBe(expected)
  })

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an empty string", ""],
    ["blank text", "  "],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["a non-JSON Date", new Date(2026, 9, 1, 3, 4, 5)],
  ])("renders %s as a dash", (_label, value) => {
    expect(formatEChartsTooltipValue(value)).toBe("-")
  })

  it("formats each entry of a multi-value point", () => {
    expect(formatEChartsTooltipValue([10, 76.23801738559538])).toEqual([
      "10",
      "76.2380",
    ])
  })
})

describe("applyStreamlitOptionDefaults", () => {
  const applyDefaults = (
    option: EChartsOptionObject,
    themeStr: string = STREAMLIT_THEME
  ): EChartsOptionObject =>
    applyStreamlitOptionDefaults(option, themeStr, theme)

  it("skips visual defaults but still enables ARIA when theme is not 'streamlit'", () => {
    const option = {
      xAxis: {},
      yAxis: {},
      series: [{ type: "bar", data: [1] }],
    }
    const result = applyDefaults(option, "")

    // theme=None opts out of visual styling only; the screen-reader
    // description must not disappear along with it.
    expect(result.aria).toEqual({ enabled: true })
    expect(result.grid).toBeUndefined()
    expect(result.series).toBe(option.series)
  })

  it("does not enable ARIA when the user explicitly disabled it and theme is None", () => {
    const result = applyDefaults({ aria: { enabled: false }, series: [] }, "")

    expect(result.aria).toEqual({ enabled: false })
  })

  it("enables ARIA by default when the user hasn't set it", () => {
    const result = applyDefaults({ series: [] }, STREAMLIT_THEME)

    expect(result.aria).toEqual({ enabled: true })
  })

  it("preserves an explicit aria configuration", () => {
    const result = applyDefaults(
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
    const result = applyDefaults(option, STREAMLIT_THEME)

    expect(result.color).toEqual(["#123456"])
    const series = result.series as Array<Record<string, unknown>>
    expect(series[0].itemStyle).toEqual({ color: "#abcdef" })
  })

  it("fills in-chart title size, weight, and padding without mutating the spec", () => {
    const title = { text: "Sales" }
    const result = applyDefaults({
      xAxis: {},
      yAxis: {},
      title,
      series: [],
    })

    expect(title).toEqual({ text: "Sales" })
    expect(result.title).toEqual({
      text: "Sales",
      padding: [0, 0, convertRemToPx(theme.spacing.lg), 0],
      textStyle: {
        fontSize: convertRemToPx(theme.fontSizes.sm),
        fontWeight: "normal",
      },
    })
  })

  it("fills missing title textStyle keys around user values", () => {
    const result = applyDefaults({
      title: { text: "Sales", textStyle: { color: "red" } },
      series: [],
    })

    expect(result.title).toEqual({
      text: "Sales",
      padding: [0, 0, convertRemToPx(theme.spacing.lg), 0],
      textStyle: {
        fontSize: convertRemToPx(theme.fontSizes.sm),
        fontWeight: "normal",
        color: "red",
      },
    })
  })

  it("preserves an explicit title padding and textStyle", () => {
    const result = applyDefaults({
      title: {
        text: "Sales",
        padding: 10,
        textStyle: { fontSize: 24, fontWeight: "bold" },
      },
      series: [],
    })

    expect(result.title).toEqual({
      text: "Sales",
      padding: 10,
      textStyle: { fontSize: 24, fontWeight: "bold" },
    })
  })

  it("does not restyle a hidden title or when theme is None", () => {
    const hidden = applyDefaults({
      title: { text: "Sales", show: false },
      series: [],
    })
    expect(hidden.title).toEqual({ text: "Sales", show: false })

    const unthemed = applyDefaults(
      { title: { text: "Sales" }, series: [] },
      ""
    )
    expect(unthemed.title).toEqual({ text: "Sales" })
  })

  it("defaults a container-filling grid for cartesian charts only", () => {
    const cartesian = applyDefaults(
      { xAxis: { type: "category" }, yAxis: { type: "value" }, series: [] },
      STREAMLIT_THEME
    )
    // Tight rem-derived margins so the plot fills the container, with
    // `outerBoundsMode` keeping axis labels and names inside them. With no
    // title/legend, minimal top/bottom room is reserved.
    expect(cartesian.grid).toEqual({
      left: gridLeft,
      right: gridRight,
      top: gridTop,
      bottom: gridBottom,
      outerBoundsMode: "same",
    })

    // A pie chart has no cartesian axes, so no grid should be injected.
    const nonCartesian = applyDefaults(
      { series: [{ type: "pie", data: [] }] },
      STREAMLIT_THEME
    )
    expect(nonCartesian.grid).toBeUndefined()
  })

  it("derives grid insets from rem spacing tokens", () => {
    const scaledTheme = {
      ...theme,
      spacing: {
        ...theme.spacing,
        sm: "1rem",
        lg: "2rem",
        twoXL: "3rem",
      },
    }
    const result = applyStreamlitOptionDefaults(
      { xAxis: {}, yAxis: {}, series: [] },
      STREAMLIT_THEME,
      scaledTheme
    )

    expect(result.grid).toEqual({
      left: convertRemToPx(scaledTheme.spacing.sm),
      right: convertRemToPx(scaledTheme.spacing.twoXL),
      top: convertRemToPx(scaledTheme.spacing.lg),
      bottom: convertRemToPx(scaledTheme.spacing.sm),
      outerBoundsMode: "same",
    })
  })

  it("defers to ECharts' default margin on the side with a title or legend", () => {
    // ECharts places the legend at the bottom by default: leave `bottom` unset
    // (its generous default reserves room) and keep the top tight.
    const withLegend = applyDefaults(
      { xAxis: {}, yAxis: {}, legend: { data: ["a"] }, series: [] },
      STREAMLIT_THEME
    )
    const legendGrid = withLegend.grid as Record<string, unknown>
    expect(legendGrid.bottom).toBeUndefined()
    expect(legendGrid.top).toBe(gridTop)

    // A title sits at the top: leave `top` unset, keep the bottom tight.
    const withTitle = applyDefaults(
      { xAxis: {}, yAxis: {}, title: { text: "Sales" }, series: [] },
      STREAMLIT_THEME
    )
    const titleGrid = withTitle.grid as Record<string, unknown>
    expect(titleGrid.top).toBeUndefined()
    expect(titleGrid.bottom).toBe(gridBottom)

    // A legend explicitly positioned at the top leaves `top` unset.
    const topLegend = applyDefaults(
      { xAxis: {}, yAxis: {}, legend: { top: 0 }, series: [] },
      STREAMLIT_THEME
    )
    const topLegendGrid = topLegend.grid as Record<string, unknown>
    expect(topLegendGrid.top).toBeUndefined()
    expect(topLegendGrid.bottom).toBe(gridBottom)

    // A hidden legend with `top` set must not reserve the default top margin.
    const hiddenLegend = applyDefaults(
      { xAxis: {}, yAxis: {}, legend: { show: false, top: 10 }, series: [] },
      STREAMLIT_THEME
    )
    const hiddenLegendGrid = hiddenLegend.grid as Record<string, unknown>
    expect(hiddenLegendGrid.top).toBe(gridTop)
    expect(hiddenLegendGrid.bottom).toBe(gridBottom)

    // A hidden title is the same: don't treat it as occupying the top strip.
    const hiddenTitle = applyDefaults(
      { xAxis: {}, yAxis: {}, title: { show: false }, series: [] },
      STREAMLIT_THEME
    )
    const hiddenTitleGrid = hiddenTitle.grid as Record<string, unknown>
    expect(hiddenTitleGrid.top).toBe(gridTop)
    expect(hiddenTitleGrid.bottom).toBe(gridBottom)

    // A bottom-placed title occupies the bottom strip, not the top.
    const bottomTitle = applyDefaults(
      {
        xAxis: {},
        yAxis: {},
        title: { text: "Sales", bottom: 0 },
        series: [],
      },
      STREAMLIT_THEME
    )
    const bottomTitleGrid = bottomTitle.grid as Record<string, unknown>
    expect(bottomTitleGrid.top).toBe(gridTop)
    expect(bottomTitleGrid.bottom).toBeUndefined()

    // Title arrays can occupy both strips independently.
    const titleArray = applyDefaults(
      {
        xAxis: {},
        yAxis: {},
        title: [{ text: "Top" }, { text: "Bottom", bottom: 0 }],
        series: [],
      },
      STREAMLIT_THEME
    )
    const titleArrayGrid = titleArray.grid as Record<string, unknown>
    expect(titleArrayGrid.top).toBeUndefined()
    expect(titleArrayGrid.bottom).toBeUndefined()

    // Legend arrays are walked the same way: a top-anchored entry must not
    // fall through to the default bottom slot (which would keep a tight `top`).
    const topLegendArray = applyDefaults(
      {
        xAxis: {},
        yAxis: {},
        legend: [{ data: ["a"], top: 0 }],
        series: [],
      },
      STREAMLIT_THEME
    )
    const topLegendArrayGrid = topLegendArray.grid as Record<string, unknown>
    expect(topLegendArrayGrid.top).toBeUndefined()
    expect(topLegendArrayGrid.bottom).toBe(gridBottom)

    const mixedLegendArray = applyDefaults(
      {
        xAxis: {},
        yAxis: {},
        legend: [{ data: ["a"] }, { data: ["b"], top: 0 }],
        series: [],
      },
      STREAMLIT_THEME
    )
    const mixedLegendArrayGrid = mixedLegendArray.grid as Record<
      string,
      unknown
    >
    expect(mixedLegendArrayGrid.top).toBeUndefined()
    expect(mixedLegendArrayGrid.bottom).toBeUndefined()

    const hiddenLegendArray = applyDefaults(
      {
        xAxis: {},
        yAxis: {},
        legend: [{ show: false, top: 10 }],
        series: [],
      },
      STREAMLIT_THEME
    )
    const hiddenLegendArrayGrid = hiddenLegendArray.grid as Record<
      string,
      unknown
    >
    expect(hiddenLegendArrayGrid.top).toBe(gridTop)
    expect(hiddenLegendArrayGrid.bottom).toBe(gridBottom)

    // Boolean ``false`` hides the legend; do not reserve the default bottom.
    const legendFalse = applyDefaults(
      { xAxis: {}, yAxis: {}, legend: false, series: [] },
      STREAMLIT_THEME
    )
    const legendFalseGrid = legendFalse.grid as Record<string, unknown>
    expect(legendFalseGrid.top).toBe(gridTop)
    expect(legendFalseGrid.bottom).toBe(gridBottom)
  })

  it("fills only the grid gaps the user left unset (user values win)", () => {
    const result = applyDefaults(
      { xAxis: {}, grid: { containLabel: false, left: 40 }, series: [] },
      STREAMLIT_THEME
    )
    // User keys win; the rest are filled from the container-filling defaults.
    expect(result.grid).toEqual({
      left: 40,
      right: gridRight,
      top: gridTop,
      bottom: gridBottom,
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
      const result = applyDefaults(
        { xAxis: {}, yAxis: {}, series: [], ...bottomComponent },
        STREAMLIT_THEME
      )

      // A tight `bottom` would let the component overlap the x-axis labels.
      const grid = result.grid as Record<string, unknown>
      expect(grid.bottom).toBeUndefined()
      expect(grid.top).toBe(gridTop)
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
    const result = applyDefaults(
      { xAxis: {}, yAxis: {}, series: [], ...component },
      STREAMLIT_THEME
    )

    expect((result.grid as Record<string, unknown>).bottom).toBe(gridBottom)
  })

  it("lifts a default-bottom legend off a dataZoom slider", () => {
    const legend = { data: ["a"] }
    const option = {
      xAxis: {},
      yAxis: {},
      legend,
      dataZoom: [{ type: "slider" }],
      series: [],
    }
    const result = applyDefaults(option)

    expect(result.legend).toEqual({ data: ["a"], top: 0 })
    // The input spec is not rewritten in place.
    expect(legend).toEqual({ data: ["a"] })
    const grid = result.grid as Record<string, unknown>
    // Legend now occupies the top; the slider still owns the bottom.
    expect(grid.top).toBeUndefined()
    expect(grid.bottom).toBeUndefined()
  })

  it("clears a title when lifting the legend off bottom controls", () => {
    const result = applyDefaults({
      xAxis: {},
      yAxis: {},
      title: { text: "Sales" },
      legend: { data: ["a"] },
      dataZoom: [{ type: "slider" }],
      series: [],
    })

    expect(result.legend).toEqual({
      data: ["a"],
      top:
        convertRemToPx(theme.spacing.lg) +
        convertRemToPx(theme.fontSizes.sm) +
        convertRemToPx(theme.spacing.lg),
    })
  })

  it("does not lift a legend the user pinned to the bottom", () => {
    const pinned = applyDefaults({
      xAxis: {},
      yAxis: {},
      legend: { data: ["a"], bottom: 0 },
      dataZoom: [{ type: "slider" }],
      series: [],
    })
    expect(pinned.legend).toEqual({ data: ["a"], bottom: 0 })

    const explicitBottom = applyDefaults({
      xAxis: {},
      yAxis: {},
      legend: { top: "bottom" },
      dataZoom: [{ type: "slider" }],
      series: [],
    })
    expect(explicitBottom.legend).toEqual({ top: "bottom" })
  })

  it("does not lift a legend when there is no bottom-anchored control", () => {
    const result = applyDefaults({
      xAxis: {},
      yAxis: {},
      legend: { data: ["a"] },
      series: [],
    })
    expect(result.legend).toEqual({ data: ["a"] })
    expect((result.grid as Record<string, unknown>).bottom).toBeUndefined()
    expect((result.grid as Record<string, unknown>).top).toBe(gridTop)
  })

  it("does not lift a legend when theme is not streamlit", () => {
    const result = applyDefaults(
      {
        xAxis: {},
        yAxis: {},
        legend: { data: ["a"] },
        dataZoom: [{ type: "slider" }],
        series: [],
      },
      ""
    )
    expect(result.legend).toEqual({ data: ["a"] })
    expect(result.grid).toBeUndefined()
  })

  it("stacks a slider dataZoom and a horizontal visualMap", () => {
    const visualMap = { orient: "horizontal", bottom: 0 }
    const result = applyDefaults({
      xAxis: {},
      yAxis: {},
      dataZoom: [{ type: "slider" }],
      visualMap,
      series: [],
    })

    const dataZoom = result.dataZoom as Array<Record<string, unknown>>
    expect(dataZoom[0].bottom).toBe(controlEdge)
    expect(result.visualMap).toEqual({
      orient: "horizontal",
      bottom: controlEdge + controlBand + controlGap,
    })
    expect(visualMap).toEqual({ orient: "horizontal", bottom: 0 })
    expect((result.grid as Record<string, unknown>).bottom).toBe(
      controlEdge + controlBand + controlGap + controlBand + controlGap
    )
  })

  it("leaves a user-offset visualMap unstacked", () => {
    const result = applyDefaults({
      xAxis: {},
      yAxis: {},
      dataZoom: [{ type: "slider" }],
      visualMap: { orient: "horizontal", bottom: 50 },
      series: [],
    })

    expect(result.visualMap).toEqual({ orient: "horizontal", bottom: 50 })
    expect((result.dataZoom as Array<Record<string, unknown>>)[0].bottom).toBe(
      undefined
    )
    expect((result.grid as Record<string, unknown>).bottom).toBeUndefined()
  })

  it("preserves a user grid.bottom over the stacked default", () => {
    const result = applyDefaults({
      xAxis: {},
      yAxis: {},
      dataZoom: [{ type: "slider" }],
      visualMap: { orient: "horizontal" },
      grid: { bottom: 12 },
      series: [],
    })
    expect((result.grid as Record<string, unknown>).bottom).toBe(12)
  })

  it("lifts the legend and stacks remaining bottom controls together", () => {
    const result = applyDefaults({
      xAxis: {},
      yAxis: {},
      legend: { data: ["a"] },
      dataZoom: [{ type: "slider" }],
      visualMap: { orient: "horizontal" },
      series: [],
    })

    expect(result.legend).toEqual({ data: ["a"], top: 0 })
    expect((result.dataZoom as Array<Record<string, unknown>>)[0].bottom).toBe(
      controlEdge
    )
    expect((result.visualMap as Record<string, unknown>).bottom).toBe(
      controlEdge + controlBand + controlGap
    )
    expect((result.grid as Record<string, unknown>).top).toBeUndefined()
    expect((result.grid as Record<string, unknown>).bottom).toBe(
      controlEdge + controlBand + controlGap + controlBand + controlGap
    )
  })

  it("stacks timeline below a slider dataZoom", () => {
    const result = applyDefaults({
      xAxis: {},
      yAxis: {},
      dataZoom: [{ type: "slider" }],
      timeline: { data: ["2015"] },
      series: [],
    })

    const timelineHeight = controlBand + convertRemToPx(theme.spacing.md)
    expect((result.timeline as Record<string, unknown>).bottom).toBe(
      controlEdge
    )
    expect((result.dataZoom as Array<Record<string, unknown>>)[0].bottom).toBe(
      controlEdge + timelineHeight + controlGap
    )
  })

  it("fills defaults inside baseOption for timeline specs", () => {
    const result = applyDefaults(
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
    expect((baseOption.grid as Record<string, unknown>).left).toBe(gridLeft)
    expect(result.aria).toBeUndefined()
    expect(result.grid).toBeUndefined()
  })

  it("gives inside funnel labels the on-fill halo without overriding user label keys", () => {
    const insideLabel = { position: "inside", color: "#123456" }
    const result = applyDefaults({
      series: [
        { type: "funnel", data: [] },
        { type: "funnel", label: { position: "outer" }, data: [] },
        { type: "funnel", label: insideLabel, data: [] },
      ],
    })

    const series = result.series as Array<{ label?: Record<string, unknown> }>
    // Outside labels keep the theme's plain body label style.
    expect(series[0].label).toBeUndefined()
    expect(series[1].label).toEqual({ position: "outer" })
    // The user's label color wins, and the halo fills the remaining keys.
    expect(series[2].label).toEqual({
      position: "inside",
      color: "#123456",
      textBorderColor: theme.colors.white,
      textBorderWidth: 2,
    })
    expect(insideLabel).toEqual({ position: "inside", color: "#123456" })
  })

  it("styles inside funnel labels in timeline variants, not when theme is None", () => {
    const funnel = { type: "funnel", label: { position: "center" }, data: [] }
    const result = applyDefaults({
      baseOption: { series: [funnel] },
      options: [{ series: [funnel] }],
    })

    const labelOf = (target: unknown): Record<string, unknown> =>
      (target as { series: Array<{ label: Record<string, unknown> }> })
        .series[0].label
    expect(labelOf(result.baseOption).textBorderWidth).toBe(2)
    expect(labelOf((result.options as unknown[])[0]).textBorderColor).toBe(
      theme.colors.white
    )

    const unthemed = applyDefaults({ series: [funnel] }, "")
    expect((unthemed.series as unknown[])[0]).toBe(funnel)
  })

  it("leaves an array of grids untouched", () => {
    const grids = [{ left: 1 }, { left: 2 }]
    const result = applyDefaults(
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
    const result = applyDefaults(option, STREAMLIT_THEME)

    // Leave the option tooltip untouched. Shortening is a theme valueFormatter
    // that returns plain text (ECharts escapes it), not an HTML formatter here.
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

describe("applyAltToOption", () => {
  it("forces aria.enabled and sets label.description", () => {
    const result = applyAltToOption(
      { aria: { enabled: false }, series: [] },
      "Accessible chart name"
    )

    expect(result.aria).toEqual({
      enabled: true,
      label: { enabled: true, description: "Accessible chart name" },
    })
  })

  it("forces label.enabled when an author disables it", () => {
    const result = applyAltToOption(
      {
        series: [],
        aria: { label: { enabled: false, description: "Author silenced" } },
      },
      "Streamlit alt"
    )

    expect(result.aria).toEqual({
      enabled: true,
      label: { enabled: true, description: "Streamlit alt" },
    })
  })

  it("writes aria onto baseOption for timeline specs", () => {
    const result = applyAltToOption(
      {
        baseOption: { series: [] },
        options: [{ series: [] }],
      },
      "Timeline chart name"
    )

    expect(result.baseOption).toEqual({
      series: [],
      aria: {
        enabled: true,
        label: { enabled: true, description: "Timeline chart name" },
      },
    })
    expect(result.aria).toBeUndefined()
    expect(result.options).toEqual([
      {
        series: [],
        aria: {
          enabled: true,
          label: { enabled: true, description: "Timeline chart name" },
        },
      },
    ])
  })

  it("overrides aria on timeline option ticks", () => {
    const result = applyAltToOption(
      {
        baseOption: {
          series: [],
          aria: { enabled: false, label: { description: "Base author" } },
        },
        options: [
          {
            series: [],
            aria: {
              enabled: false,
              label: { description: "Tick author" },
            },
          },
        ],
      },
      "Streamlit alt"
    )

    expect((result.baseOption as Record<string, unknown>).aria).toEqual({
      enabled: true,
      label: { enabled: true, description: "Streamlit alt" },
    })
    expect((result.options as Array<Record<string, unknown>>)[0].aria).toEqual(
      {
        enabled: true,
        label: { enabled: true, description: "Streamlit alt" },
      }
    )
  })

  it("overrides aria on media option overlays", () => {
    const result = applyAltToOption(
      {
        series: [],
        media: [
          {
            query: { maxWidth: 500 },
            option: {
              series: [],
              aria: {
                enabled: false,
                label: { description: "Narrow author" },
              },
            },
          },
        ],
      },
      "Streamlit alt"
    )

    expect(result.aria).toEqual({
      enabled: true,
      label: { enabled: true, description: "Streamlit alt" },
    })
    expect(
      (
        (result.media as Array<Record<string, unknown>>)[0].option as Record<
          string,
          unknown
        >
      ).aria
    ).toEqual({
      enabled: true,
      label: { enabled: true, description: "Streamlit alt" },
    })
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

  it("applies the default cursor inside media option overrides", () => {
    const configured = withDefaultSeriesCursor({
      series: [{ type: "bar", data: [1] }],
      media: [
        { query: { maxWidth: 500 }, option: { series: [{ type: "line" }] } },
      ],
    })

    expect(
      (
        (
          (configured.media as Array<Record<string, unknown>>)[0]
            .option as Record<string, unknown>
        ).series as Array<Record<string, unknown>>
      )[0].cursor
    ).toBe("default")
  })
})

describe("optionHasWheelRoam", () => {
  it("detects wheel roam on geo, map, and graph", () => {
    expect(optionHasWheelRoam({ geo: { roam: true } })).toBe(true)
    expect(optionHasWheelRoam({ geo: [{ roam: "scale" }] })).toBe(true)
    expect(
      optionHasWheelRoam({
        series: [{ type: "map", roam: "zoom" }],
      })
    ).toBe(true)
    expect(
      optionHasWheelRoam({
        series: { type: "graph", roam: true },
      })
    ).toBe(true)
    expect(
      optionHasWheelRoam({
        baseOption: { geo: { roam: true } },
      })
    ).toBe(true)
  })

  it("ignores drag-only roam and charts without it", () => {
    expect(optionHasWheelRoam(null)).toBe(false)
    expect(optionHasWheelRoam({ geo: { roam: false } })).toBe(false)
    expect(optionHasWheelRoam({ geo: { roam: "move" } })).toBe(false)
    expect(optionHasWheelRoam({ geo: { roam: "pan" } })).toBe(false)
    expect(
      optionHasWheelRoam({
        series: [{ type: "map", roam: "move" }],
      })
    ).toBe(false)
    expect(
      optionHasWheelRoam({
        series: [{ type: "line", roam: true }],
      })
    ).toBe(false)
    expect(optionHasWheelRoam({ dataZoom: [{ type: "inside" }] })).toBe(false)
  })

  it("skips settle only for a pinch", () => {
    const roam = { geo: { roam: true } }
    const pinch = { shiftKey: false, ctrlKey: true, altKey: false }
    const plain = { shiftKey: false, ctrlKey: false, altKey: false }
    expect(wheelRoamSkipsSettle(roam, pinch)).toBe(true)
    expect(wheelRoamSkipsSettle(roam, plain)).toBe(false)
    expect(wheelRoamSkipsSettle({ geo: { roam: "move" } }, pinch)).toBe(false)
    expect(wheelRoamSkipsSettle(null, pinch)).toBe(false)
  })
})

describe("insideDataZoomConsumesWheelEvent", () => {
  const noModifiers = { shiftKey: false, ctrlKey: false, altKey: false }
  const shift = { shiftKey: true, ctrlKey: false, altKey: false }
  const ctrl = { shiftKey: false, ctrlKey: true, altKey: false }
  const alt = { shiftKey: false, ctrlKey: false, altKey: true }

  it("consumes unmodified wheel when zoomOnMouseWheel defaults to true", () => {
    const option = { dataZoom: [{ type: "inside" }] }
    expect(insideDataZoomConsumesWheelEvent(option, noModifiers)).toBe(true)
    expect(insideDataZoomConsumesWheelEvent(option, shift)).toBe(true)
  })

  it("consumes wheel only with the configured modifier", () => {
    const option = {
      dataZoom: [{ type: "inside", zoomOnMouseWheel: "shift" as const }],
    }
    expect(insideDataZoomConsumesWheelEvent(option, noModifiers)).toBe(false)
    expect(insideDataZoomConsumesWheelEvent(option, shift)).toBe(true)
    expect(insideDataZoomConsumesWheelEvent(option, ctrl)).toBe(false)

    expect(
      insideDataZoomConsumesWheelEvent(
        { dataZoom: [{ type: "inside", zoomOnMouseWheel: "ctrl" }] },
        ctrl
      )
    ).toBe(true)
    expect(
      insideDataZoomConsumesWheelEvent(
        { dataZoom: [{ type: "inside", zoomOnMouseWheel: "alt" }] },
        alt
      )
    ).toBe(true)
  })

  it("consumes wheel for moveOnMouseWheel when zoom is off", () => {
    const option = {
      dataZoom: [
        { type: "inside", zoomOnMouseWheel: false, moveOnMouseWheel: true },
      ],
    }
    expect(insideDataZoomConsumesWheelEvent(option, noModifiers)).toBe(true)
  })
})

describe("insideDataZoomCapturesWheel", () => {
  it("is true when ECharts will register a wheel handler", () => {
    expect(
      insideDataZoomCapturesWheel({ dataZoom: [{ type: "inside" }] })
    ).toBe(true)
    // ECharts 6 still calls preventDefault when zoomOnMouseWheel is false.
    expect(
      insideDataZoomCapturesWheel({
        dataZoom: [{ type: "inside", zoomOnMouseWheel: false }],
      })
    ).toBe(true)
    expect(
      insideDataZoomCapturesWheel({
        dataZoom: [{ type: "inside", zoomOnMouseWheel: "shift" }],
      })
    ).toBe(true)
  })

  it("is false when ECharts does not install a wheel handler", () => {
    expect(insideDataZoomCapturesWheel(null)).toBe(false)
    expect(
      insideDataZoomCapturesWheel({ dataZoom: [{ type: "slider" }] })
    ).toBe(false)
    expect(
      insideDataZoomCapturesWheel({
        dataZoom: [{ type: "inside", disabled: true }],
      })
    ).toBe(false)
    expect(
      insideDataZoomCapturesWheel({
        dataZoom: [{ type: "inside", zoomLock: true }],
      })
    ).toBe(false)
  })
})

describe("insideDataZoomWheelSkipsSettle", () => {
  const noModifiers = { shiftKey: false, ctrlKey: false, altKey: false }
  const shift = { shiftKey: true, ctrlKey: false, altKey: false }
  const ctrl = { shiftKey: false, ctrlKey: true, altKey: false }
  const alt = { shiftKey: false, ctrlKey: false, altKey: true }

  it("treats pinch as immediate zoom when the wheel is not modifier-gated", () => {
    const option = { dataZoom: [{ type: "inside" }] }
    expect(insideDataZoomWheelSkipsSettle(option, noModifiers)).toBe(false)
    expect(insideDataZoomWheelSkipsSettle(option, ctrl)).toBe(true)
    expect(insideDataZoomWheelSkipsSettle(option, shift)).toBe(false)
  })

  it("skips settle only for the configured modifier", () => {
    expect(
      insideDataZoomWheelSkipsSettle(
        { dataZoom: [{ type: "inside", zoomOnMouseWheel: "shift" }] },
        shift
      )
    ).toBe(true)
    expect(
      insideDataZoomWheelSkipsSettle(
        { dataZoom: [{ type: "inside", zoomOnMouseWheel: "shift" }] },
        ctrl
      )
    ).toBe(false)
    expect(
      insideDataZoomWheelSkipsSettle(
        { dataZoom: [{ type: "inside", zoomOnMouseWheel: "alt" }] },
        alt
      )
    ).toBe(true)
  })

  it("treats pinch as immediate when pan is on and zoom is off", () => {
    expect(
      insideDataZoomWheelSkipsSettle(
        {
          dataZoom: [
            {
              type: "inside",
              zoomOnMouseWheel: false,
              moveOnMouseWheel: true,
            },
          ],
        },
        ctrl
      )
    ).toBe(true)
  })
})
