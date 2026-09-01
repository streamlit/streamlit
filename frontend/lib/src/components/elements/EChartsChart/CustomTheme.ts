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
import { isPlainObject } from "lodash-es"

import {
  getGray30,
  getGray70,
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
  // Shared text style for component labels/names that would otherwise fall back
  // to ECharts' default (un-themed) gray.
  const bodyTextStyle = {
    color: labelColor,
    fontFamily: genericFonts.bodyFont,
    fontSize: bodyFontSize,
  }

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
    title: {
      textStyle: {
        fontFamily: genericFonts.headingFont,
        color: colors.headingColor,
        fontSize: convertRemToPx(fontSizes.md),
      },
      subtextStyle: {
        fontFamily: genericFonts.bodyFont,
        color: colors.bodyText,
        fontSize: convertRemToPx(fontSizes.sm),
      },
    },
    legend: {
      textStyle: {
        color: labelColor,
        fontFamily: genericFonts.bodyFont,
        fontSize: bodyFontSize,
      },
    },
    tooltip: {
      backgroundColor: colors.bgColor,
      borderColor: colors.borderColor,
      textStyle: {
        color: colors.bodyText,
        fontFamily: genericFonts.bodyFont,
        fontSize: bodyFontSize,
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
    },
    // Sunburst and funnel draw labels on top of palette-colored shapes whose
    // lightness varies, so pin a dark label with a light halo instead of
    // ECharts' fixed default (dark for sunburst, white for funnel) — either one
    // disappears on part of the palette.
    sunburst: {
      label: {
        color: colors.gray100,
        textBorderColor: colors.white,
        textBorderWidth: 2,
      },
    },
    funnel: {
      label: {
        color: colors.gray100,
        textBorderColor: colors.white,
        textBorderWidth: 2,
        fontFamily: genericFonts.bodyFont,
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
      upperLabel: {
        color: colors.bodyText,
        fontFamily: genericFonts.bodyFont,
      },
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
      dataBackground: {
        lineStyle: {
          color: getGray30(theme),
        },
        areaStyle: {
          color: getGray30(theme),
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
 * True if any ``dataZoom``/``visualMap``/``timeline`` component occupies the
 * strip below the plot, where it would otherwise be drawn over the x-axis
 * labels.
 *
 * All three default to a horizontal layout along the bottom edge, so a
 * component only escapes the strip by opting into a vertical orientation or by
 * anchoring itself to the top.
 */
function hasBottomAnchoredComponent(option: EChartsOptionObject): boolean {
  const isAtBottom = (component: Record<string, unknown>): boolean =>
    component.show !== false &&
    component.orient !== "vertical" &&
    component.top === undefined

  // `type: "inside"` zooms via scroll/drag on the plot itself and draws nothing.
  const sliders = toComponentList(option.dataZoom).filter(
    zoom => zoom.type !== "inside"
  )
  // A visualMap only lies flat along the bottom when explicitly horizontal;
  // its default vertical layout sits beside the plot.
  const flatVisualMaps = toComponentList(option.visualMap).filter(
    visualMap => visualMap.orient === "horizontal"
  )

  return [
    ...sliders,
    ...flatVisualMaps,
    ...toComponentList(option.timeline),
  ].some(isAtBottom)
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
 * multi-item legend, or a dataZoom slider).
 *
 * ``outerBoundsMode: "same"`` keeps axis labels *and* axis names inside those
 * margins. It replaces the deprecated ``containLabel``, which ECharts 6 treats
 * as ``outerBoundsContain: "axisLabel"`` and which therefore clipped axis names.
 */
function buildDefaultGrid(
  option: EChartsOptionObject
): Record<string, unknown> {
  const hasTitle = option.title !== undefined
  const legend = option.legend
  const legendObject = isPlainObject(legend)
    ? (legend as Record<string, unknown>)
    : {}
  const hasLegend = legend !== undefined && legendObject.show !== false
  // ECharts places the legend at the bottom-center by default; it only sits at
  // the top when the user gives it a (non-"bottom") `top`.
  const legendAtTop =
    hasLegend &&
    legendObject.top !== undefined &&
    legendObject.top !== "bottom"
  const legendAtBottom = hasLegend && !legendAtTop

  const grid: Record<string, unknown> = {
    left: 8,
    right: 24,
    outerBoundsMode: "same",
  }
  if (!hasTitle && !legendAtTop) {
    grid.top = 16
  }
  if (!legendAtBottom && !hasBottomAnchoredComponent(option)) {
    grid.bottom = 8
  }
  return grid
}

/**
 * Non-destructively fill a small number of option-level gaps that the init
 * theme cannot cover (``aria.enabled`` and the ``grid`` layout).
 *
 * This only runs under ``theme="streamlit"`` and only writes keys the user has
 * not set, so explicit user values (e.g. ``series[0].itemStyle.color`` or a
 * top-level ``color``) always survive. For security, it never injects a
 * tooltip/label ``formatter`` and never changes ``tooltip.renderMode`` — ECharts'
 * default escaping of tooltip/label values is relied upon.
 *
 * Timeline specs nest the chart under ``baseOption``, which is where ECharts
 * reads ``aria`` and ``grid`` from, so the defaults are filled in there instead.
 *
 * @param option The parsed ECharts option object.
 * @param themeStr The chart's theme string (``"streamlit"`` or ``""``).
 * @returns The option with defaults filled (a new object) or the untouched
 *   option when ``themeStr`` is not ``"streamlit"``.
 */
export function applyStreamlitOptionDefaults(
  option: EChartsOptionObject,
  themeStr: string
): EChartsOptionObject {
  if (themeStr !== STREAMLIT_THEME) {
    // theme=None: leave the user's options completely untouched.
    return option
  }

  const baseOption = option.baseOption
  if (isPlainObject(baseOption)) {
    return {
      ...option,
      baseOption: fillOptionDefaults(baseOption as EChartsOptionObject),
    }
  }
  return fillOptionDefaults(option)
}

/** Fill the ``aria`` and ``grid`` defaults on a single (non-timeline) option. */
function fillOptionDefaults(option: EChartsOptionObject): EChartsOptionObject {
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

  // For cartesian charts, default the grid so the plot fills its container and
  // axis labels and names stay inside it. Any grid key the user set wins; we
  // only fill the gaps. Arrays (multiple grids) are left untouched.
  const hasCartesianAxis = "xAxis" in result || "yAxis" in result
  const grid = result.grid
  if (hasCartesianAxis && !Array.isArray(grid)) {
    const defaults = buildDefaultGrid(result)
    if (grid === undefined) {
      result.grid = defaults
    } else if (isPlainObject(grid)) {
      result.grid = { ...defaults, ...(grid as Record<string, unknown>) }
    }
  }

  return result
}
