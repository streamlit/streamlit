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
    splitLine: {
      lineStyle: {
        color: axisLineColor,
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
    parallelAxis: {
      ...axisDefaults,
      nameTextStyle: bodyTextStyle,
    },
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
    // Sunburst: inside labels keep ECharts' (dark) default color, but slices
    // are drawn from the categorical palette and can be dark, so add a light
    // halo to keep labels readable regardless of the underlying slice color.
    sunburst: {
      label: {
        color: colors.gray100,
        textBorderColor: colors.white,
        textBorderWidth: 2,
      },
    },
    // Treemap: theme the breadcrumb trail (its default light-gray surface
    // clashes with the app background).
    treemap: {
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
    // Continuous color scale for visualMap-driven charts (e.g. heatmaps).
    visualMap: {
      inRange: {
        color: [...colors.chartSequentialColors],
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

/**
 * Non-destructively fill a small number of option-level gaps that the init
 * theme cannot cover (``aria.enabled`` and ``grid.containLabel``).
 *
 * This only runs under ``theme="streamlit"`` and only writes keys the user has
 * not set, so explicit user values (e.g. ``series[0].itemStyle.color`` or a
 * top-level ``color``) always survive. For security, it never injects a
 * tooltip/label ``formatter`` and never changes ``tooltip.renderMode`` — ECharts'
 * default escaping of tooltip/label values is relied upon.
 *
 * @param option The parsed ECharts option object.
 * @param _theme The active Emotion theme (reserved for future gap-fills).
 * @param themeStr The chart's theme string (``"streamlit"`` or ``""``).
 * @returns The option with defaults filled (a new object) or the untouched
 *   option when ``themeStr`` is not ``"streamlit"``.
 */
export function applyStreamlitOptionDefaults(
  option: EChartsOptionObject,
  _theme: EmotionTheme,
  themeStr: string
): EChartsOptionObject {
  if (themeStr !== STREAMLIT_THEME) {
    // theme=None: leave the user's options completely untouched.
    return option
  }

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

  // For cartesian charts, keep long axis labels inside the grid by default.
  const hasCartesianAxis = "xAxis" in result || "yAxis" in result
  if (hasCartesianAxis) {
    const grid = result.grid
    if (grid === undefined) {
      result.grid = { containLabel: true }
    } else if (isPlainObject(grid)) {
      const gridObject = grid as Record<string, unknown>
      if (!("containLabel" in gridObject)) {
        result.grid = { ...gridObject, containLabel: true }
      }
    }
  }

  return result
}
