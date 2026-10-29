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

import { transparentize } from "color2k"
import { isPlainObject, omit } from "lodash-es"

import {
  getDecreasingRed,
  getGray30,
  getGray70,
  getIncreasingGreen,
  hasLightBackgroundColor,
} from "~lib/theme/getColors"
import type { EmotionTheme } from "~lib/theme/types"
import { convertRemToPx } from "~lib/theme/utils"

/** The ECharts theme string that activates Streamlit theming. */
export const STREAMLIT_THEME = "streamlit"

/**
 * A parsed ECharts option object. ECharts accepts arbitrary user options, so we
 * intentionally treat it as an open record rather than the strict
 * ``EChartsOption`` type.
 */
export type EChartsOptionObject = Record<string, unknown>

const TOOLTIP_FRACTION_DIGITS = 4

const TOOLTIP_SIGNIFICANT_DIGITS = 6

// Reused across tooltip updates. The digit options are a fixed set, so a
// hover should not construct a new formatter for every series value.
const scientificTooltipFormat = new Intl.NumberFormat("en-US", {
  notation: "scientific",
  maximumSignificantDigits: TOOLTIP_SIGNIFICANT_DIGITS,
})

const significantTooltipFormat = new Intl.NumberFormat("en-US", {
  maximumSignificantDigits: TOOLTIP_SIGNIFICANT_DIGITS,
  useGrouping: true,
})

const shortTooltipFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: TOOLTIP_FRACTION_DIGITS,
  useGrouping: true,
})

const paddedTooltipFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: TOOLTIP_FRACTION_DIGITS,
  maximumFractionDigits: TOOLTIP_FRACTION_DIGITS,
  useGrouping: true,
})

function formatTooltipItem(value: unknown): string {
  if (typeof value === "number") {
    return Number.isFinite(value) ? formatTooltipNumber(value) : "-"
  }
  if (typeof value === "string") {
    // Blank text is missing. Other strings, including numeric ones, pass
    // through so an id or year is not grouped.
    return value.trim() === "" ? "-" : value
  }
  // Chart specs are JSON, so booleans are the only other expected type.
  // Anything else (null, Date, bigint) renders as a dash.
  if (typeof value === "boolean") {
    return String(value)
  }
  return "-"
}

/**
 * Choose the formatter for tooltip numbers of magnitude 1 or greater.
 *
 * Pad to four fraction digits only when rounding changed the value, so
 * readers can tell it was rounded (``76.2380``). Exact shorter values stay
 * short (``12.5``, integers). Binary float noise such as ``1.1 + 2.2`` also
 * fails that equality check, so those values pad (``3.3000``).
 */
function selectOrdinaryTooltipFormat(value: number): Intl.NumberFormat {
  const rounded = Number(value.toFixed(TOOLTIP_FRACTION_DIGITS))
  return rounded === value ? shortTooltipFormat : paddedTooltipFormat
}

function formatTooltipNumber(value: number): string {
  if (Object.is(value, -0)) {
    return "0"
  }
  const absolute = Math.abs(value)
  // Values below 0.0001 use scientific notation instead of rounding to zero.
  if (absolute !== 0 && absolute < 10 ** -TOOLTIP_FRACTION_DIGITS) {
    return scientificTooltipFormat.format(value)
  }
  // Four decimal places would clip a small fraction (0.000123456 → 0.0001).
  const format =
    absolute >= 1
      ? selectOrdinaryTooltipFormat(value)
      : significantTooltipFormat
  return format.format(value)
}

/**
 * Tooltip ``valueFormatter`` for the Streamlit theme.
 *
 * Returns plain text that ECharts escapes: one string, or one string per
 * entry for multi-value points such as candlesticks. An option
 * ``tooltip.formatter`` replaces this. ``tooltip.valueFormatter`` would too,
 * but the chart spec is JSON and cannot carry that callback.
 */
export function formatEChartsTooltipValue(value: unknown): string | string[] {
  if (Array.isArray(value)) {
    return value.map(item => formatTooltipItem(item))
  }
  return formatTooltipItem(value)
}

/**
 * Build the per-axis theming defaults shared by all axis types
 * (``categoryAxis``/``valueAxis``/``logAxis``/``timeAxis`` as well as the
 * non-cartesian axes ``angleAxis``/``radiusAxis``/``parallelAxis``/
 * ``singleAxis``).
 */
function buildAxisDefaults(
  theme: EmotionTheme,
  fontSize: number
): Record<string, unknown> {
  const axisLineColor = getGray30(theme)
  const labelColor = getGray70(theme)

  return {
    axisLine: {
      lineStyle: {
        color: axisLineColor,
      },
    },
    axisTick: {
      lineStyle: {
        color: axisLineColor,
      },
    },
    axisLabel: {
      color: labelColor,
      fontFamily: theme.genericFonts.bodyFont,
      fontSize,
      // ECharts' default margin is a fixed 8px. Scale the gap with the base font.
      margin: convertRemToPx(theme.spacing.sm),
      // Paint a page-colored stroke around the glyphs so a series or gridline
      // that crosses a label stays readable.
      textBorderColor: theme.colors.bgColor,
      textBorderWidth: 2,
    },
    nameTextStyle: {
      color: labelColor,
      fontFamily: theme.genericFonts.bodyFont,
      fontSize,
    },
    splitLine: {
      lineStyle: {
        color: axisLineColor,
      },
    },
    // Opt-in alternating bands (`splitArea.show`). ECharts' defaults are opaque
    // light gray, which covers the plot on a dark background.
    splitArea: {
      areaStyle: {
        color: [
          transparentize(labelColor, 0.97),
          transparentize(labelColor, 0.93),
        ],
      },
    },
  }
}

/**
 * In-chart title styles shared by the init theme and option-level fill.
 *
 * ECharts' title default is 18px / ``fontWeight: "bold"``. In-plot titles
 * should sit below Streamlit's own headings, so this uses the small body size
 * and a normal weight, with bottom padding so a top legend does not crowd the
 * text.
 */
function buildChartTitleDefaults(theme: EmotionTheme): {
  padding: [number, number, number, number]
  textStyle: {
    fontFamily: string
    color: string
    fontSize: number
    fontWeight: "normal"
  }
  subtextStyle: {
    fontFamily: string
    color: string
    fontSize: number
  }
} {
  const { colors, genericFonts, fontSizes, spacing } = theme
  return {
    padding: [0, 0, convertRemToPx(spacing.lg), 0],
    textStyle: {
      fontFamily: genericFonts.headingFont,
      color: colors.headingColor,
      fontSize: convertRemToPx(fontSizes.sm),
      fontWeight: "normal",
    },
    subtextStyle: {
      fontFamily: genericFonts.bodyFont,
      color: colors.bodyText,
      fontSize: convertRemToPx(fontSizes.twoSm),
    },
  }
}

/**
 * Label style for text drawn on palette fills of varying lightness. Dark text
 * with a light halo stays readable on every palette color, whereas any single
 * fixed color disappears on part of the palette.
 *
 * Both colors must stay the same in light and dark mode:
 * ``withInsideFunnelLabelStyle`` writes them into the option, and
 * EChartsChart doesn't rebuild the option on a color-only theme change.
 */
function buildOnFillLabelStyle(theme: EmotionTheme): {
  color: string
  textBorderColor: string
  textBorderWidth: number
} {
  return {
    color: theme.colors.gray100,
    textBorderColor: theme.colors.white,
    textBorderWidth: 2,
  }
}

/**
 * Vertical offset for a legend lifted under a top title.
 *
 * Legend ``top`` is measured from the container, not the title box, so this
 * covers ECharts' title inset (~``spacing.lg``), the title font, and the
 * title's bottom padding.
 */
function liftedLegendTopPx(theme: EmotionTheme): number {
  return (
    convertRemToPx(theme.spacing.lg) +
    convertRemToPx(theme.fontSizes.sm) +
    convertRemToPx(theme.spacing.lg)
  )
}

/**
 * Build an ECharts theme object derived from the active Emotion theme.
 *
 * The result is passed directly to ``echarts.init(dom, themeObject)`` (ECharts
 * accepts a theme object, not just a registered theme name). The theme sits
 * *underneath* the user's option, so any explicit value the user sets always
 * wins.
 *
 * @param theme The active Emotion theme from ``useEmotionTheme()``.
 * @returns An ECharts theme object.
 */
export function buildStreamlitEChartsTheme(
  theme: EmotionTheme
): Record<string, unknown> {
  const { colors, genericFonts, fontSizes } = theme
  const bodyFontSize = convertRemToPx(fontSizes.twoSm)
  const labelColor = getGray70(theme)
  const axisLineColor = getGray30(theme)
  const axisDefaults = buildAxisDefaults(theme, bodyFontSize)
  const titleDefaults = buildChartTitleDefaults(theme)
  // Shared text style for component labels/names that would otherwise fall back
  // to ECharts' default (un-themed) gray.
  const bodyTextStyle = {
    color: labelColor,
    fontFamily: genericFonts.bodyFont,
    fontSize: bodyFontSize,
  }
  // ECharts outlines a selected item in a fixed dark gray that disappears on a
  // dark background. Body text stays near-black in light mode and turns light
  // in dark mode, so the outline stays visible in both.
  const selectStyle = {
    select: {
      itemStyle: {
        borderColor: colors.bodyText,
      },
    },
  }
  // Line markers default to `emptyCircle`, whose hollow center ECharts fills
  // with white. On a dark background that reads as a white dot, so use a
  // filled marker there, as ECharts' own dark theme does. Light mode keeps
  // ECharts' line defaults.
  const lineMarkerDefaults = hasLightBackgroundColor(theme)
    ? {}
    : { line: { symbol: "circle" } }

  return {
    // Series palette (shared with Plotly/Vega/Altair, honors config overrides).
    color: [...colors.chartCategoricalColors],
    // Let the app background show through the chart.
    backgroundColor: "transparent",
    // Drives ECharts' built-in dark-mode adjustments.
    darkMode: !hasLightBackgroundColor(theme),
    textStyle: {
      fontFamily: genericFonts.bodyFont,
      color: labelColor,
      fontSize: bodyFontSize,
    },
    title: titleDefaults,
    legend: {
      textStyle: {
        color: labelColor,
        fontFamily: genericFonts.bodyFont,
        fontSize: bodyFontSize,
      },
      // ECharts dims a toggled-off entry to a fixed light gray, which looks
      // almost like an active label on a dark background.
      inactiveColor: colors.fadedText20,
      inactiveBorderColor: colors.fadedText20,
      lineStyle: {
        inactiveColor: colors.fadedText20,
      },
      // A scrolling legend's page arrows are a fixed blue, and the disabled
      // arrow is near-white, which reads as the active one in dark mode.
      pageIconColor: labelColor,
      pageIconInactiveColor: colors.fadedText20,
      pageTextStyle: {
        color: labelColor,
      },
    },
    tooltip: {
      backgroundColor: colors.bgColor,
      borderColor: colors.borderColor,
      textStyle: {
        color: colors.bodyText,
        fontFamily: genericFonts.bodyFont,
        fontSize: bodyFontSize,
        // ECharts paints tooltip values at weight 900 when fontWeight is unset.
        // Use the theme's normal weight so values match the series name.
        fontWeight: theme.fontWeights.normal,
      },
      // Returns plain text, which ECharts HTML-escapes. Never set an HTML
      // formatter here (see the product spec's tooltip XSS note). This
      // replaces ECharts' time-aware default, so a time or ordinal dimension
      // that is itself the tooltip value is shortened like any other number.
      // On an ordinary time-series chart the date stays in the header.
      valueFormatter: formatEChartsTooltipValue,
    },
    // A `cross` tooltip, or an axis pointer with `label.show`, draws value
    // chips on the axes in a fixed blue with white text. Style them like the
    // tooltip, since both describe the hovered point.
    axisPointer: {
      label: {
        color: colors.bodyText,
        backgroundColor: colors.bgColor,
        borderColor: colors.borderColor,
        // ECharts takes a pixel number, and `borderWidth` is a px token.
        borderWidth: Number.parseFloat(theme.sizes.borderWidth),
      },
    },
    categoryAxis: axisDefaults,
    valueAxis: axisDefaults,
    logAxis: axisDefaults,
    timeAxis: axisDefaults,
    // Polar coordinate axes.
    angleAxis: axisDefaults,
    radiusAxis: axisDefaults,
    // Parallel coordinate axes.
    parallelAxis: axisDefaults,
    // Single axis (e.g. themeRiver, single-axis heatmaps/scatter).
    singleAxis: axisDefaults,
    // ThemeRiver draws its band names beside the stream in a fixed light/dark
    // gray that ignores the surrounding axis theming.
    themeRiver: {
      label: bodyTextStyle,
    },
    // Chord (ECharts 6): the ribbons default to `color: "source"`, which tints
    // them with the (palette-colored) source node — keep that keyword, since a
    // literal color breaks the lookup and paints them black. Only the default
    // 0.2 opacity needs lifting, as it leaves them invisible on a dark
    // background.
    chord: {
      lineStyle: {
        opacity: hasLightBackgroundColor(theme) ? 0.25 : 0.45,
      },
      label: bodyTextStyle,
    },
    // Matrix coordinate system (ECharts 6): cell dividers and header labels
    // otherwise come from ECharts' own tokens and read dimmer than every other
    // themed label.
    matrix: {
      x: { label: bodyTextStyle, itemStyle: { borderColor: axisLineColor } },
      y: { label: bodyTextStyle, itemStyle: { borderColor: axisLineColor } },
      body: { itemStyle: { borderColor: axisLineColor } },
      corner: {
        label: bodyTextStyle,
        itemStyle: { borderColor: axisLineColor },
      },
    },
    // Radar coordinate. ECharts' defaults render bright, near-opaque split
    // areas that clash with the (dark) app background, so theme the rings,
    // spokes, and indicator names explicitly.
    radar: {
      axisLine: {
        lineStyle: {
          color: axisLineColor,
        },
      },
      axisTick: {
        lineStyle: {
          color: axisLineColor,
        },
      },
      splitLine: {
        lineStyle: {
          color: axisLineColor,
        },
      },
      splitArea: {
        areaStyle: {
          // Very faint, theme-derived alternating rings that stay subtle on
          // both light and dark backgrounds.
          color: [
            transparentize(labelColor, 0.97),
            transparentize(labelColor, 0.93),
          ],
        },
      },
      axisName: bodyTextStyle,
      axisLabel: bodyTextStyle,
    },
    // Sankey diagram: nodes are colored by a value-based gradient over the
    // series ``color`` list (not the global categorical palette). Seed it with
    // the sequential (single-hue) palette so it reads as a clean gradient
    // instead of muddy interpolations between categorical hues, and theme the
    // link ribbons so they stay legible (ECharts' default gray is too faint in
    // dark mode).
    sankey: {
      color: [...colors.chartSequentialColors],
      lineStyle: {
        color: labelColor,
        opacity: hasLightBackgroundColor(theme) ? 0.2 : 0.35,
      },
      label: bodyTextStyle,
      ...selectStyle,
    },
    bar: selectStyle,
    pictorialBar: selectStyle,
    scatter: selectStyle,
    heatmap: selectStyle,
    graph: selectStyle,
    ...lineMarkerDefaults,
    // ECharts separates sunburst segments and funnel stages with a white line,
    // which glares on a dark background. The app background reads as a gap,
    // as it does for treemap tiles. Sunburst labels sit on the segments, so
    // they use the on-fill halo instead of ECharts' fixed dark default.
    sunburst: {
      label: buildOnFillLabelStyle(theme),
      itemStyle: {
        borderColor: colors.bgColor,
      },
    },
    // Funnel labels sit outside the stages by default, on the app background.
    // The theme can't branch on the label position, so inside labels get the
    // on-fill halo in the option instead (see `withInsideFunnelLabelStyle`).
    funnel: {
      label: bodyTextStyle,
      itemStyle: {
        borderColor: colors.bgColor,
      },
      ...selectStyle,
    },
    // Candlesticks use the same rising green and falling red as
    // st.plotly_chart. ECharts' fixed default paints rising candles red.
    candlestick: {
      itemStyle: {
        color: getIncreasingGreen(theme),
        color0: getDecreasingRed(theme),
        borderColor: getIncreasingGreen(theme),
        borderColor0: getDecreasingRed(theme),
      },
    },
    // Boxplot: ECharts fills the box with opaque white, which glares against a
    // dark app background. The app background keeps the box readable while
    // still reading as "hollow" against the palette-colored outline.
    boxplot: {
      itemStyle: {
        color: colors.bgColor,
      },
    },
    // Gauge: ECharts' defaults use light-mode colors for the track and dark
    // colors for the title/detail text, so the value/name become unreadable on
    // a dark background. Theme the track, ticks, labels, and text explicitly.
    gauge: {
      axisLine: {
        lineStyle: {
          color: [[1, axisLineColor]],
        },
      },
      splitLine: {
        lineStyle: {
          color: labelColor,
        },
      },
      axisTick: {
        lineStyle: {
          color: axisLineColor,
        },
      },
      axisLabel: {
        color: labelColor,
        fontFamily: genericFonts.bodyFont,
      },
      title: {
        color: labelColor,
        fontFamily: genericFonts.bodyFont,
      },
      detail: {
        color: colors.bodyText,
        fontFamily: genericFonts.bodyFont,
      },
    },
    // Treemap: theme the breadcrumb trail and the parent-node header band
    // (their default light-gray surfaces clash with the app background).
    treemap: {
      // `upperLabel` (the parent header text) is deliberately absent: ECharts
      // resolves it from its own defaults and ignores the themed value, so it
      // stays white. It is only legible on darker tiles, but fixing it would
      // mean writing a color into the user's series option.
      itemStyle: {
        borderColor: colors.bgColor,
      },
      breadcrumb: {
        itemStyle: {
          color: colors.secondaryBg,
          borderColor: colors.borderColor,
          textStyle: {
            color: labelColor,
            fontFamily: genericFonts.bodyFont,
          },
        },
        emphasis: {
          itemStyle: {
            color: colors.bgMix,
          },
        },
      },
    },
    // Calendar coordinate system (e.g. calendar heatmaps).
    calendar: {
      itemStyle: {
        color: "transparent",
        borderColor: colors.borderColor,
      },
      splitLine: {
        lineStyle: {
          color: axisLineColor,
        },
      },
      dayLabel: bodyTextStyle,
      monthLabel: bodyTextStyle,
      yearLabel: bodyTextStyle,
    },
    // Continuous color scale for visualMap-driven charts (e.g. heatmaps).
    visualMap: {
      inRange: {
        color: [...colors.chartSequentialColors],
      },
      textStyle: bodyTextStyle,
    },
    // Timeline: ECharts' defaults are a fixed light blue-gray that reads as
    // washed out in both themes, so theme the axis, labels, and controls.
    timeline: {
      lineStyle: {
        color: axisLineColor,
      },
      label: bodyTextStyle,
      itemStyle: {
        color: labelColor,
      },
      checkpointStyle: {
        color: colors.primary,
        borderColor: colors.bgColor,
      },
      controlStyle: {
        color: labelColor,
        borderColor: labelColor,
      },
    },
    dataZoom: {
      borderColor: colors.borderColor,
      fillerColor: transparentize(colors.primary, 0.85),
      // The slider's mini series preview. It sits on the app background rather
      // than inside the plot, so the faint gray used for gridlines leaves it
      // almost invisible in dark mode. Opacity is set explicitly instead of
      // baked into the color, because ECharts multiplies the two.
      dataBackground: {
        lineStyle: {
          color: labelColor,
          opacity: 0.5,
        },
        areaStyle: {
          color: labelColor,
          opacity: 0.2,
        },
      },
      handleStyle: {
        color: colors.bgColor,
        borderColor: labelColor,
      },
      textStyle: {
        color: labelColor,
      },
    },
    brush: {
      brushStyle: {
        color: transparentize(colors.primary, 0.85),
        borderColor: colors.primary,
      },
    },
    toolbox: {
      iconStyle: {
        borderColor: labelColor,
      },
      // ECharts' hover state is a fixed light blue for both the icon and the
      // feature title it reveals underneath, which is hard to read on a dark
      // background. Brighten the icon relative to its resting color and give
      // the title a themed chip so it stays legible over the plot.
      emphasis: {
        iconStyle: {
          borderColor: colors.bodyText,
          textFill: colors.bodyText,
          textBackgroundColor: colors.secondaryBg,
          textPadding: convertRemToPx(theme.spacing.twoXS),
          textBorderRadius: convertRemToPx(theme.radii.sm),
        },
      },
      // The data view panel is a light surface with blue buttons by default.
      // ECharts merges a theme feature only into features the spec enables, so
      // this styles the panel without adding a data view button.
      feature: {
        dataView: {
          backgroundColor: colors.bgColor,
          textColor: colors.bodyText,
          textareaColor: colors.secondaryBg,
          textareaBorderColor: colors.borderColor,
          // Matches Streamlit's primary button.
          buttonColor: colors.primary,
          buttonTextColor: colors.white,
        },
      },
    },
  }
}

/** Read ``option[key]`` as a list of component configs, ignoring other shapes. */
function toComponentList(value: unknown): Array<Record<string, unknown>> {
  if (isPlainObject(value)) {
    return [value as Record<string, unknown>]
  }
  if (Array.isArray(value)) {
    return value.filter(isPlainObject) as Array<Record<string, unknown>>
  }
  return []
}

/**
 * Write title size, weight, and padding onto the option so they beat ECharts'
 * component defaults (18px / bold / padding 5). Color and font family stay on
 * the init theme so a light/dark ``setTheme`` can still retint them.
 *
 * User-set ``padding`` / ``textStyle`` keys are preserved.
 */
function withTitleStyleDefaults(
  option: EChartsOptionObject,
  theme: EmotionTheme
): EChartsOptionObject {
  const titles = toComponentList(option.title)
  if (titles.length === 0) {
    return option
  }

  const { padding, textStyle: titleTextStyle } = buildChartTitleDefaults(theme)
  const sizeAndWeight = {
    fontSize: titleTextStyle.fontSize,
    fontWeight: titleTextStyle.fontWeight,
  }

  const next = titles.map(title => {
    if (title.show === false) {
      return title
    }
    const userTextStyle = isPlainObject(title.textStyle)
      ? (title.textStyle as Record<string, unknown>)
      : {}
    const extra: Record<string, unknown> = {
      textStyle: { ...sizeAndWeight, ...userTextStyle },
    }
    if (title.padding === undefined) {
      extra.padding = padding
    }
    return { ...title, ...extra }
  })
  // Return the original option when no title was replaced.
  if (next.every((title, i) => title === titles[i])) {
    return option
  }
  return {
    ...option,
    title: Array.isArray(option.title) ? next : next[0],
  }
}

/**
 * True when a component is visible, horizontal, and not anchored to the top.
 * ECharts positions these relative to the chart container's bottom edge.
 */
function isBottomAnchored(component: Record<string, unknown>): boolean {
  return (
    component.show !== false &&
    component.orient !== "vertical" &&
    component.top === undefined
  )
}

/**
 * True when a bottom-anchored component is using ECharts' default bottom
 * placement. ``bottom: 0`` is that default for ``visualMap``/``timeline`` (and
 * the value ECharts' slider layout resolves to), so it is treated as unpinned.
 * Any other ``bottom`` is an explicit offset we must not rewrite.
 */
function usesDefaultBottom(component: Record<string, unknown>): boolean {
  return (
    isBottomAnchored(component) &&
    (component.bottom === undefined || component.bottom === 0)
  )
}

/** Slider ``dataZoom`` entries (``type: "inside"`` draws nothing). */
function sliderDataZooms(
  option: EChartsOptionObject
): Array<Record<string, unknown>> {
  return toComponentList(option.dataZoom).filter(
    zoom => zoom.type !== "inside"
  )
}

/**
 * A ``visualMap`` only lies flat along the bottom when explicitly horizontal;
 * its default vertical layout sits beside the plot.
 */
function horizontalVisualMaps(
  option: EChartsOptionObject
): Array<Record<string, unknown>> {
  return toComponentList(option.visualMap).filter(
    visualMap => visualMap.orient === "horizontal"
  )
}

/**
 * True if any ``dataZoom``/``visualMap``/``timeline`` component occupies the
 * strip below the plot, where it would otherwise be drawn over the x-axis
 * labels.
 *
 * All three default to a horizontal layout along the bottom edge, so a
 * component only escapes the strip by opting into a vertical orientation or by
 * anchoring itself to the top.
 */
function hasBottomAnchoredComponent(option: EChartsOptionObject): boolean {
  return [
    ...sliderDataZooms(option),
    ...horizontalVisualMaps(option),
    ...toComponentList(option.timeline),
  ].some(isBottomAnchored)
}

type WheelModifierEvent = Pick<WheelEvent, "shiftKey" | "ctrlKey" | "altKey">

/**
 * ECharts ``zoomOnMouseWheel`` / ``moveOnMouseWheel``: ``true``, ``false``, or
 * a modifier name. Matches RoamController's ``isAvailableBehavior``.
 */
function isEChartsWheelSettingActive(
  setting: unknown,
  event: WheelModifierEvent
): boolean {
  if (setting === true) {
    return true
  }
  if (setting === "shift") {
    return event.shiftKey
  }
  if (setting === "ctrl") {
    return event.ctrlKey
  }
  if (setting === "alt") {
    return event.altKey
  }
  return false
}

/**
 * True when an enabled inside ``dataZoom`` on the option, or on a timeline
 * ``baseOption``, matches ``predicate``.
 */
function someEnabledInsideDataZoom(
  option: EChartsOptionObject | null,
  predicate: (zoom: Record<string, unknown>) => boolean
): boolean {
  if (option === null) {
    return false
  }
  const targets: EChartsOptionObject[] = [option]
  if (isPlainObject(option.baseOption)) {
    targets.push(option.baseOption as EChartsOptionObject)
  }
  for (const target of targets) {
    for (const zoom of toComponentList(target.dataZoom)) {
      if (
        zoom.type === "inside" &&
        zoom.disabled !== true &&
        predicate(zoom)
      ) {
        return true
      }
    }
  }
  return false
}

/** Inside ``dataZoom`` defaults: zoom on wheel, do not pan on wheel. */
function insideWheelActions(zoom: Record<string, unknown>): {
  zoomOnWheel: unknown
  moveOnWheel: unknown
} {
  return {
    zoomOnWheel:
      zoom.zoomOnMouseWheel === undefined ? true : zoom.zoomOnMouseWheel,
    moveOnWheel:
      zoom.moveOnMouseWheel === undefined ? false : zoom.moveOnMouseWheel,
  }
}

function insideDataZoomConsumesEvent(
  zoom: Record<string, unknown>,
  event: WheelModifierEvent
): boolean {
  const { zoomOnWheel, moveOnWheel } = insideWheelActions(zoom)
  return (
    isEChartsWheelSettingActive(zoomOnWheel, event) ||
    isEChartsWheelSettingActive(moveOnWheel, event)
  )
}

/**
 * True when an enabled inside ``dataZoom`` installs ECharts' wheel handler.
 *
 * ECharts 6 calls ``preventDefault`` for every wheel over the plot once that
 * handler is installed — including wheels that ``zoomOnMouseWheel: false``
 * or a modifier would not zoom. ``zoomLock`` only pans on drag, so those
 * charts still scroll.
 */
export function insideDataZoomCapturesWheel(
  option: EChartsOptionObject | null
): boolean {
  return someEnabledInsideDataZoom(option, zoom => zoom.zoomLock !== true)
}

/**
 * True when this wheel event would zoom or pan an inside ``dataZoom``.
 *
 * ``zoomOnMouseWheel`` / ``moveOnMouseWheel`` may be ``true`` or a modifier
 * (``"shift"`` / ``"ctrl"`` / ``"alt"``).
 */
export function insideDataZoomConsumesWheelEvent(
  option: EChartsOptionObject | null,
  event: WheelModifierEvent
): boolean {
  return someEnabledInsideDataZoom(option, zoom =>
    insideDataZoomConsumesEvent(zoom, event)
  )
}

/** Roam values that install ECharts' mousewheel listener. */
function roamInstallsWheelListener(roam: unknown): boolean {
  return roam === true || roam === "scale" || roam === "zoom"
}

function targetHasWheelRoam(option: EChartsOptionObject): boolean {
  if (
    toComponentList(option.geo).some(geo =>
      roamInstallsWheelListener(geo.roam)
    )
  ) {
    return true
  }
  return toComponentList(option.series).some(
    series =>
      (series.type === "map" || series.type === "graph") &&
      roamInstallsWheelListener(series.roam)
  )
}

/**
 * True when ``geo``, a map series, or a graph series turns on wheel roam.
 *
 * ``RoamController`` registers a mousewheel listener for ``roam: true``,
 * ``"scale"``, and ``"zoom"``. ``"move"`` and ``"pan"`` are drag-only.
 * That listener is separate from inside ``dataZoom``, so a wheel the zoom
 * would ignore must still count as consumed and reach ECharts after the
 * pointer rests.
 */
export function optionHasWheelRoam(
  option: EChartsOptionObject | null
): boolean {
  if (option === null) {
    return false
  }
  if (targetHasWheelRoam(option)) {
    return true
  }
  return (
    isPlainObject(option.baseOption) &&
    targetHasWheelRoam(option.baseOption as EChartsOptionObject)
  )
}

/**
 * True when a pinch should roam immediately.
 *
 * Wheel roam defaults ``zoomOnMouseWheel`` to ``true``, so a pinch
 * (``ctrlKey``) skips the rest timer. An ordinary wheel still waits.
 */
export function wheelRoamSkipsSettle(
  option: EChartsOptionObject | null,
  event: WheelModifierEvent
): boolean {
  return optionHasWheelRoam(option) && event.ctrlKey
}

/**
 * True when the user is pinching or holding the configured modifier, so the
 * chart zooms or pans without waiting for the pointer to rest.
 *
 * Trackpad pinch is a wheel with ``ctrlKey`` set. It counts when unmodified
 * wheel zoom or pan is on. A ``"shift"`` / ``"ctrl"`` / ``"alt"`` setting
 * counts when that key is held.
 */
export function insideDataZoomWheelSkipsSettle(
  option: EChartsOptionObject | null,
  event: WheelModifierEvent
): boolean {
  return someEnabledInsideDataZoom(option, zoom => {
    const { zoomOnWheel, moveOnWheel } = insideWheelActions(zoom)
    return (
      wheelSettingSkipsSettle(zoomOnWheel, event) ||
      wheelSettingSkipsSettle(moveOnWheel, event)
    )
  })
}

function wheelSettingSkipsSettle(
  setting: unknown,
  event: WheelModifierEvent
): boolean {
  // Unmodified zoom or pan: only pinch (ctrlKey) is a deliberate gesture.
  if (setting === true) {
    return event.ctrlKey
  }
  return isEChartsWheelSettingActive(setting, event)
}

function isTitleAtBottom(title: Record<string, unknown>): boolean {
  if (title.bottom !== undefined) {
    return true
  }
  return title.top === "bottom"
}

function isLegendAtTop(legend: Record<string, unknown>): boolean {
  // ECharts places the legend at the bottom-center by default; it only sits at
  // the top when the user gives it a (non-"bottom") `top`.
  return legend.top !== undefined && legend.top !== "bottom"
}

function legendPlacement(option: EChartsOptionObject): {
  occupiesTop: boolean
  occupiesBottom: boolean
} {
  const legends = toComponentList(option.legend)
  if (legends.length === 0) {
    // Boolean ``false`` hides the legend. Any other non-object value still
    // occupies the default bottom strip.
    const hasLegend = option.legend !== undefined && option.legend !== false
    return { occupiesTop: false, occupiesBottom: hasLegend }
  }

  let occupiesTop = false
  let occupiesBottom = false
  for (const legend of legends) {
    if (legend.show === false) {
      continue
    }
    if (isLegendAtTop(legend)) {
      occupiesTop = true
    } else {
      occupiesBottom = true
    }
  }
  return { occupiesTop, occupiesBottom }
}

function titlePlacement(option: EChartsOptionObject): {
  occupiesTop: boolean
  occupiesBottom: boolean
} {
  const titles = toComponentList(option.title)
  if (titles.length === 0) {
    // A non-object title (for example a string) still occupies the default
    // top strip.
    const hasTitle = option.title !== undefined
    return { occupiesTop: hasTitle, occupiesBottom: false }
  }

  let occupiesTop = false
  let occupiesBottom = false
  for (const title of titles) {
    if (title.show === false) {
      continue
    }
    if (isTitleAtBottom(title)) {
      occupiesBottom = true
    } else {
      occupiesTop = true
    }
  }
  return { occupiesTop, occupiesBottom }
}

/**
 * True when a legend is using ECharts' default bottom placement (no ``top``
 * and no ``bottom``). Any explicit vertical anchor is treated as a user pin
 * we must not rewrite.
 */
function isDefaultBottomLegend(legend: Record<string, unknown>): boolean {
  return (
    legend.show !== false &&
    legend.top === undefined &&
    legend.bottom === undefined
  )
}

/**
 * Copy ``legend`` with ``top`` filled in for default-bottom entries. Legend,
 * dataZoom, visualMap, and timeline are positioned against the chart
 * container, not the grid, so extra ``grid.bottom`` cannot unstack them.
 */
function withLegendLiftedToTop(
  option: EChartsOptionObject,
  legendTop: number
): EChartsOptionObject {
  const legends = toComponentList(option.legend)
  if (legends.length === 0) {
    if (option.legend !== undefined && option.legend !== false) {
      return { ...option, legend: { top: legendTop } }
    }
    return option
  }

  const next = legends.map(legend =>
    isDefaultBottomLegend(legend) ? { ...legend, top: legendTop } : legend
  )
  // Return the original option when no legend was replaced.
  if (next.every((legend, i) => legend === legends[i])) {
    return option
  }
  return {
    ...option,
    legend: Array.isArray(option.legend) ? next : next[0],
  }
}

interface BottomBand {
  components: Array<Record<string, unknown>>
  heightPx: number
}

function componentBandHeight(
  components: Array<Record<string, unknown>>,
  fallbackPx: number
): number {
  let heightPx = fallbackPx
  for (const component of components) {
    if (typeof component.height === "number") {
      heightPx = Math.max(heightPx, component.height)
    }
  }
  return heightPx
}

/**
 * Rewrite ``dataZoom``/``visualMap``/``timeline`` list entries that we are
 * offsetting, preserving object identity for entries we leave alone.
 */
function withBottoms(
  value: unknown,
  bottoms: Map<Record<string, unknown>, number>
): unknown {
  if (isPlainObject(value)) {
    const bottom = bottoms.get(value as Record<string, unknown>)
    return bottom === undefined
      ? value
      : { ...(value as Record<string, unknown>), bottom }
  }
  if (Array.isArray(value)) {
    return (value as unknown[]).map((item: unknown) => {
      if (!isPlainObject(item)) {
        return item
      }
      const record = item as Record<string, unknown>
      const bottom = bottoms.get(record)
      return bottom === undefined ? item : { ...record, bottom }
    })
  }
  return value
}

/**
 * Stack unpinned bottom-anchored controls so they do not share one strip.
 *
 * Order from the container edge: timeline, then slider dataZoom, then a
 * horizontal visualMap (closest to the plot). A single bottom control is left
 * to ECharts. Returns the pixel height the stacked chrome occupies, used as
 * ``grid.bottom``.
 */
function stackBottomAnchoredControls(
  option: EChartsOptionObject,
  theme: EmotionTheme
): { option: EChartsOptionObject; stackedBottom?: number } {
  const sliders = sliderDataZooms(option).filter(usesDefaultBottom)
  const visualMaps = horizontalVisualMaps(option).filter(usesDefaultBottom)
  const timelines = toComponentList(option.timeline).filter(usesDefaultBottom)

  const bandPx = convertRemToPx(theme.spacing.threeXL)
  const bands: BottomBand[] = []
  if (timelines.length > 0) {
    bands.push({
      components: timelines,
      heightPx:
        componentBandHeight(timelines, bandPx) +
        convertRemToPx(theme.spacing.md),
    })
  }
  if (sliders.length > 0) {
    bands.push({
      components: sliders,
      heightPx: componentBandHeight(sliders, bandPx),
    })
  }
  if (visualMaps.length > 0) {
    bands.push({
      components: visualMaps,
      heightPx: componentBandHeight(visualMaps, bandPx),
    })
  }
  if (bands.length < 2) {
    return { option }
  }

  const gapPx = convertRemToPx(theme.spacing.xs)
  let offset = convertRemToPx(theme.spacing.sm)
  const bottoms = new Map<Record<string, unknown>, number>()
  for (const band of bands) {
    for (const component of band.components) {
      bottoms.set(component, offset)
    }
    offset += band.heightPx + gapPx
  }

  return {
    option: {
      ...option,
      ...(sliders.length > 0
        ? { dataZoom: withBottoms(option.dataZoom, bottoms) }
        : {}),
      ...(visualMaps.length > 0
        ? { visualMap: withBottoms(option.visualMap, bottoms) }
        : {}),
      ...(timelines.length > 0
        ? { timeline: withBottoms(option.timeline, bottoms) }
        : {}),
    },
    stackedBottom: offset,
  }
}

/**
 * Move a default-bottom legend off the footer when bottom-anchored controls
 * are present, then stack those controls if more than one shares the strip.
 */
function applyControlLayout(
  option: EChartsOptionObject,
  theme: EmotionTheme
): { option: EChartsOptionObject; stackedBottom?: number } {
  let next = option
  if (
    hasBottomAnchoredComponent(next) &&
    legendPlacement(next).occupiesBottom
  ) {
    const legendTop = titlePlacement(next).occupiesTop
      ? liftedLegendTopPx(theme)
      : 0
    next = withLegendLiftedToTop(next, legendTop)
  }
  return stackBottomAnchoredControls(next, theme)
}

/**
 * Build the default cartesian ``grid`` layout so charts fill their container.
 *
 * ECharts' built-in grid reserves large margins (``left: '15%'``,
 * ``right: '10%'``, ``top: 65``, ``bottom: 80``), which leaves charts heavily
 * inset compared to other Streamlit charts. We tighten the side margins to fill
 * the width, and tighten the top/bottom only on a side that carries nothing but
 * the plot. On a side that *does* carry a title, legend, or bottom-anchored
 * control we leave the margin unset so ECharts' generous default reserves room
 * for it (guessing a fixed pixel value risks clipping a title+subtitle, a
 * multi-item legend, or a dataZoom slider). When Streamlit has stacked more
 * than one bottom-anchored control, ``stackedBottom`` is that stack's height
 * and is written as ``grid.bottom`` so the plot sits above the stack.
 *
 * Insets are rem spacing tokens converted to pixels so they track the
 * configured base font size like axis labels. ECharts only accepts pixel
 * numbers (or percent strings) for ``grid``, not CSS rem.
 *
 * ``outerBoundsMode: "same"`` keeps axis labels *and* axis names inside those
 * margins. It replaces the deprecated ``containLabel``, which ECharts 6 treats
 * as ``outerBoundsContain: "axisLabel"`` and which therefore clipped axis names.
 */
function buildDefaultGrid(
  option: EChartsOptionObject,
  theme: EmotionTheme,
  stackedBottom?: number
): Record<string, unknown> {
  const { occupiesTop: titleAtTop, occupiesBottom: titleAtBottom } =
    titlePlacement(option)
  const { occupiesTop: legendAtTop, occupiesBottom: legendAtBottom } =
    legendPlacement(option)

  const grid: Record<string, unknown> = {
    left: convertRemToPx(theme.spacing.sm),
    right: convertRemToPx(theme.spacing.twoXL),
    outerBoundsMode: "same",
  }
  if (!titleAtTop && !legendAtTop) {
    grid.top = convertRemToPx(theme.spacing.lg)
  }
  if (
    !titleAtBottom &&
    !legendAtBottom &&
    !hasBottomAnchoredComponent(option)
  ) {
    grid.bottom = convertRemToPx(theme.spacing.sm)
  } else if (stackedBottom !== undefined) {
    grid.bottom = stackedBottom
  }
  return grid
}

/**
 * Non-destructively fill a small number of option-level gaps that the init
 * theme cannot cover (``aria.enabled``, title size/weight/padding, the
 * ``grid`` layout, stacking of bottom-anchored chart controls, and the style
 * of inside funnel labels).
 *
 * ``aria.enabled`` is filled regardless of the theme: ``theme=None`` opts out of
 * Streamlit's *visual* styling, and dropping the screen-reader description along
 * with it would make an accessibility regression a side effect of a styling
 * choice. Title size, ``grid``, control stacking, and funnel labels are purely
 * visual, so they only run under ``theme="streamlit"``.
 *
 * Only keys the user has not set are written, so explicit user values (e.g.
 * ``series[0].itemStyle.color`` or a top-level ``color``) always survive. For
 * security, this function never injects a tooltip or label formatter and never
 * changes ``tooltip.renderMode``. ECharts escapes tooltip and label text by
 * default. The theme ``valueFormatter`` shortens tooltip numbers and returns
 * plain text that ECharts escapes.
 *
 * Timeline specs nest the chart under ``baseOption``, which is where ECharts
 * reads ``aria`` and ``grid`` from, so the defaults are filled in there instead.
 * Inside funnel labels are styled in every series variant that declares
 * ``type: "funnel"`` (see ``mapOptionSeries``). A per-tick or media override
 * without a ``type`` is skipped, since it only merges into a series by index.
 *
 * @param option The parsed ECharts option object.
 * @param themeStr The chart's theme string (``"streamlit"`` or ``""``).
 * @param theme The Emotion theme, used to derive rem-based grid insets.
 * @returns The option with defaults filled (a new object).
 */
export function applyStreamlitOptionDefaults(
  option: EChartsOptionObject,
  themeStr: string,
  theme: EmotionTheme
): EChartsOptionObject {
  const applyVisualDefaults = themeStr === STREAMLIT_THEME

  const baseOption = option.baseOption
  const filled = isPlainObject(baseOption)
    ? {
        ...option,
        baseOption: fillOptionDefaults(
          baseOption as EChartsOptionObject,
          applyVisualDefaults,
          theme
        ),
      }
    : fillOptionDefaults(option, applyVisualDefaults, theme)
  return applyVisualDefaults
    ? withInsideFunnelLabelStyle(filled, theme)
    : filled
}

/**
 * Funnel label positions that draw the text on the stage itself. Mirrors
 * ``isLabelInside`` in ECharts' ``funnelLayout``.
 */
const INSIDE_FUNNEL_LABEL_POSITIONS: ReadonlySet<string> = new Set([
  "inner",
  "inside",
  "center",
  "insideLeft",
  "insideRight",
])

/** The ``label`` of a series or data item, or an empty object if it has none. */
function getLabelObject(entry: unknown): Record<string, unknown> {
  if (!isPlainObject(entry)) {
    return {}
  }
  const { label } = entry as Record<string, unknown>
  return isPlainObject(label) ? (label as Record<string, unknown>) : {}
}

/** Whether a funnel series or data item draws its label on the stage. */
function hasInsideFunnelLabel(entry: unknown): boolean {
  const { position } = getLabelObject(entry)
  return (
    typeof position === "string" && INSIDE_FUNNEL_LABEL_POSITIONS.has(position)
  )
}

/**
 * Give inside funnel labels the on-fill label style.
 *
 * The theme styles funnel labels for ECharts' default outside position, on
 * the app background. The init theme can't branch on a label's position, so
 * this option-level pass adds the on-fill halo when a series places its
 * labels inside, or when a data item moves its own label inside. Label keys
 * the user set on the series or the item win. A data item that moves its
 * label outside a series with inside labels keeps the series' halo.
 *
 * Each series entry is styled on its own. A data item's halo keys skip only
 * label keys set on the same entry, so a timeline or ``media`` override that
 * restyles that series' label doesn't reach the item, whose keys win.
 */
function withInsideFunnelLabelStyle(
  option: EChartsOptionObject,
  theme: EmotionTheme
): EChartsOptionObject {
  const onFillLabel = buildOnFillLabelStyle(theme)
  return mapOptionSeries(option, series => {
    if (series.type !== "funnel") {
      return series
    }
    const seriesLabel = getLabelObject(series)
    if (hasInsideFunnelLabel(series)) {
      // Data items inherit the series label, halo included.
      return { ...series, label: { ...onFillLabel, ...seriesLabel } }
    }
    const { data } = series
    if (!Array.isArray(data) || !data.some(hasInsideFunnelLabel)) {
      return series
    }
    // Items inherit the series label, so a key the user set there still wins.
    const itemDefaults = omit(onFillLabel, Object.keys(seriesLabel))
    return {
      ...series,
      data: data.map((item: unknown) =>
        hasInsideFunnelLabel(item)
          ? {
              ...(item as Record<string, unknown>),
              label: { ...itemDefaults, ...getLabelObject(item) },
            }
          : item
      ),
    }
  })
}

/** Fill the ``aria`` and ``grid`` defaults on a single (non-timeline) option. */
function fillOptionDefaults(
  option: EChartsOptionObject,
  applyVisualDefaults: boolean,
  theme: EmotionTheme
): EChartsOptionObject {
  const result: EChartsOptionObject = { ...option }

  // Enable ARIA descriptions for screen readers when the user hasn't opted out.
  const aria = result.aria
  if (aria === undefined) {
    result.aria = { enabled: true }
  } else if (isPlainObject(aria)) {
    const ariaObject = aria as Record<string, unknown>
    if (!("enabled" in ariaObject)) {
      result.aria = { ...ariaObject, enabled: true }
    }
  }

  if (!applyVisualDefaults) {
    return result
  }

  const titled = withTitleStyleDefaults(result, theme)
  const { option: laidOut, stackedBottom } = applyControlLayout(titled, theme)

  // For cartesian charts, default the grid so the plot fills its container and
  // axis labels and names stay inside it. Any grid key the user set wins; we
  // only fill the gaps. Arrays (multiple grids) are left untouched.
  const hasCartesianAxis = "xAxis" in laidOut || "yAxis" in laidOut
  const grid = laidOut.grid
  if (hasCartesianAxis && !Array.isArray(grid)) {
    const defaults = buildDefaultGrid(laidOut, theme, stackedBottom)
    if (grid === undefined) {
      laidOut.grid = defaults
    } else if (isPlainObject(grid)) {
      laidOut.grid = { ...defaults, ...(grid as Record<string, unknown>) }
    }
  }

  return laidOut
}

/**
 * Apply ``mapSeries`` to every series entry an option can define.
 *
 * Besides the root ``series``, timeline specs nest series under
 * ``baseOption`` and per-tick ``options[*]``, and responsive specs nest them
 * under ``media[*].option`` at either level. Non-object entries are returned
 * unchanged.
 */
function mapOptionSeries(
  option: EChartsOptionObject,
  mapSeries: (series: Record<string, unknown>) => Record<string, unknown>
): EChartsOptionObject {
  const mapEntry = (entry: unknown): unknown =>
    isPlainObject(entry) ? mapSeries(entry as Record<string, unknown>) : entry
  const applyToSeries = (target: EChartsOptionObject): EChartsOptionObject => {
    const { series } = target
    if (Array.isArray(series)) {
      return { ...target, series: series.map(mapEntry) }
    }
    if (isPlainObject(series)) {
      return { ...target, series: mapEntry(series) }
    }
    return target
  }
  const applyToMedia = (target: EChartsOptionObject): EChartsOptionObject => {
    const withSeries = applyToSeries(target)
    const media = withSeries.media
    if (!Array.isArray(media)) {
      return withSeries
    }
    return {
      ...withSeries,
      media: (media as unknown[]).map((entry: unknown) => {
        if (!isPlainObject(entry)) {
          return entry
        }
        const mediaEntry = entry as Record<string, unknown>
        if (!isPlainObject(mediaEntry.option)) {
          return entry
        }
        return {
          ...mediaEntry,
          option: applyToSeries(mediaEntry.option as EChartsOptionObject),
        }
      }),
    }
  }

  let result = applyToMedia(option)
  const baseOption = result.baseOption
  if (isPlainObject(baseOption)) {
    result = {
      ...result,
      baseOption: applyToMedia(baseOption as EChartsOptionObject),
    }
  }
  if (Array.isArray(result.options)) {
    result = {
      ...result,
      options: (result.options as unknown[]).map((tick: unknown) =>
        isPlainObject(tick) ? applyToMedia(tick as EChartsOptionObject) : tick
      ),
    }
  }
  return result
}

/**
 * Reset each series' cursor to the normal arrow for display-only charts.
 *
 * ECharts defaults series data items to a ``"pointer"`` cursor (and a hover
 * emphasis), which implies the chart is clickable. That's misleading when no
 * click/selection handler is wired, and inconsistent with other non-interactive
 * Streamlit charts. We only reset the cursor (the hover emphasis is left intact,
 * as it's useful alongside tooltips) and leave any series where the user set an
 * explicit ``cursor`` untouched. Legend/dataZoom/toolbox cursors are unaffected.
 *
 * This reaches data items only. ECharts applies ``series.cursor`` when it draws
 * symbols, bars, and candlesticks, but never to a line's polyline or an area's
 * polygon, which therefore keep zrender's ``"pointer"`` default — so hovering
 * the line itself (or anywhere in an area fill) still shows a click cursor.
 * There is no option-level fix: ``silent`` would remove it but also disables
 * hover emphasis and item tooltips.
 *
 * Series in timeline and responsive variants get the same default (see
 * ``mapOptionSeries``).
 */
export function withDefaultSeriesCursor(
  option: EChartsOptionObject
): EChartsOptionObject {
  return mapOptionSeries(option, series =>
    "cursor" in series ? series : { ...series, cursor: "default" }
  )
}

/**
 * Apply Streamlit ``alt`` as ECharts ``aria.label.description``.
 *
 * Forces ``aria.enabled`` and ``aria.label.enabled`` so an authored name
 * cannot be silenced by ``aria: {enabled: false}`` or
 * ``aria: {label: {enabled: false}}``. Timeline specs nest chart ``aria``
 * under ``baseOption`` (matching Streamlit's ``aria.enabled`` fill);
 * per-tick ``options[*]`` and responsive ``media[*].option`` overlays can
 * still redefine ``aria``, so those variants are stamped too.
 */
export function applyAltToOption(
  option: EChartsOptionObject,
  alt: string
): EChartsOptionObject {
  const withDescription = (
    target: EChartsOptionObject
  ): EChartsOptionObject => {
    const aria = isPlainObject(target.aria)
      ? { ...(target.aria as Record<string, unknown>) }
      : {}
    const label = isPlainObject(aria.label)
      ? { ...(aria.label as Record<string, unknown>) }
      : {}
    return {
      ...target,
      aria: {
        ...aria,
        enabled: true,
        label: {
          ...label,
          // ECharts setLabel returns early when label.enabled is false,
          // before writing role / aria-label — force it on with alt.
          enabled: true,
          description: alt,
        },
      },
    }
  }

  // Stamp ``media[*].option`` overlays without naming the parent node itself.
  const applyToMediaEntries = (
    target: EChartsOptionObject
  ): EChartsOptionObject => {
    const media = target.media
    if (!Array.isArray(media)) {
      return target
    }
    return {
      ...target,
      media: (media as unknown[]).map((entry: unknown) => {
        if (!isPlainObject(entry)) {
          return entry
        }
        const mediaEntry = entry as Record<string, unknown>
        if (!isPlainObject(mediaEntry.option)) {
          return entry
        }
        return {
          ...mediaEntry,
          option: withDescription(mediaEntry.option as EChartsOptionObject),
        }
      }),
    }
  }

  // Name a chart option node and any nested media overrides under it.
  const applyToVariant = (target: EChartsOptionObject): EChartsOptionObject =>
    applyToMediaEntries(withDescription(target))

  let result: EChartsOptionObject
  if (isPlainObject(option.baseOption)) {
    // Timeline wrapper: ECharts reads chart aria from baseOption, not the root.
    result = {
      ...option,
      baseOption: applyToVariant(option.baseOption as EChartsOptionObject),
    }
    // Responsive media can sit beside baseOption on the timeline root.
    result = applyToMediaEntries(result)
  } else {
    result = applyToVariant(option)
  }

  if (Array.isArray(result.options)) {
    result = {
      ...result,
      options: (result.options as unknown[]).map((tick: unknown) =>
        isPlainObject(tick)
          ? applyToVariant(tick as EChartsOptionObject)
          : tick
      ),
    }
  }

  return result
}
