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

import { isPlainObject } from "lodash-es"

import type { EmotionTheme } from "~lib/theme/types"
import { convertRemToPx } from "~lib/theme/utils"

import {
  type EChartsOptionObject,
  STREAMLIT_THEME,
  toComponentList,
} from "./CustomTheme"
import { getSeriesRows } from "./largeDataDefaults"

type SeriesOption = Record<string, unknown>

/** The bar corner radius in pixels, derived from the theme's base radius. */
export function getBarRadiusPx(theme: EmotionTheme): number {
  const { sm } = theme.radii
  return sm.endsWith("px") ? Number.parseFloat(sm) : convertRemToPx(sm)
}

/** ECharts makes an axis without ``type`` a category axis if it has ``data``. */
function getAxisType(axis: Record<string, unknown>): unknown {
  return axis.type ?? (axis.data === undefined ? "value" : "category")
}

/** Whether a data item or dataset row contains a negative number. */
function hasNegativeValue(value: unknown): boolean {
  if (typeof value === "number" || typeof value === "string") {
    return Number(value) < 0
  }
  if (Array.isArray(value)) {
    return value.some(hasNegativeValue)
  }
  return (
    isPlainObject(value) &&
    Object.values(value as Record<string, unknown>).some(hasNegativeValue)
  )
}

/**
 * The series with its outer bar corners rounded, or the same object if it
 * keeps square bars.
 *
 * A bar grows from its category (or time) axis along the value axis, which
 * ECharts picks the same way: the first category axis, then the first time
 * axis, else the x-axis. Only the end away from that axis is rounded.
 * Stacked series, series without a category gap, series with negative
 * values, series whose data can't be read, and series that set their own
 * ``borderRadius`` keep square bars.
 */
function withRoundedBarEnds(
  series: unknown,
  option: EChartsOptionObject,
  radius: number
): unknown {
  if (!isPlainObject(series)) {
    return series
  }
  const seriesOption = series as SeriesOption
  const itemStyle = isPlainObject(seriesOption.itemStyle)
    ? (seriesOption.itemStyle as Record<string, unknown>)
    : {}
  if (
    seriesOption.type !== "bar" ||
    seriesOption.stack !== undefined ||
    (seriesOption.coordinateSystem ?? "cartesian2d") !== "cartesian2d" ||
    // Touching bars, as in a histogram, would show notches between them.
    Number.parseFloat(String(seriesOption.barCategoryGap)) === 0 ||
    "borderRadius" in itemStyle
  ) {
    return series
  }

  const xAxis = toComponentList(option.xAxis).at(
    typeof seriesOption.xAxisIndex === "number" ? seriesOption.xAxisIndex : 0
  )
  const yAxis = toComponentList(option.yAxis).at(
    typeof seriesOption.yAxisIndex === "number" ? seriesOption.yAxisIndex : 0
  )
  const rows = getSeriesRows(seriesOption, option)
  if (
    xAxis === undefined ||
    yAxis === undefined ||
    rows === undefined ||
    rows.some(hasNegativeValue)
  ) {
    return series
  }

  const xType = getAxisType(xAxis)
  const yType = getAxisType(yAxis)
  const isHorizontal =
    xType !== "category" &&
    (yType === "category" || (xType !== "time" && yType === "time"))
  const valueAxis = isHorizontal ? xAxis : yAxis
  const growsBackward = valueAxis.inverse === true
  // Corners in ECharts order: top-left, top-right, bottom-right, bottom-left.
  let borderRadius: number[]
  if (isHorizontal) {
    borderRadius = growsBackward
      ? [radius, 0, 0, radius]
      : [0, radius, radius, 0]
  } else {
    borderRadius = growsBackward
      ? [0, 0, radius, radius]
      : [radius, radius, 0, 0]
  }
  return { ...seriesOption, itemStyle: { ...itemStyle, borderRadius } }
}

/**
 * Round the outer end of bars under the Streamlit theme, scaled with the
 * theme's base radius (``baseRadius="none"`` keeps square bars).
 *
 * Only top-level ``series`` are changed; timeline and media variants keep
 * square bars.
 *
 * @param option The parsed ECharts option object.
 * @param themeStr The chart's theme string (``"streamlit"`` or ``""``).
 * @param theme The Emotion theme, used for the corner radius.
 * @returns The option with rounded bars, or the same object if no series
 * changed.
 */
export function applyBarRounding(
  option: EChartsOptionObject,
  themeStr: string,
  theme: EmotionTheme
): EChartsOptionObject {
  const { series } = option
  const radius = getBarRadiusPx(theme)
  if (themeStr !== STREAMLIT_THEME || radius <= 0 || !Array.isArray(series)) {
    return option
  }
  const updated = series.map(entry =>
    withRoundedBarEnds(entry, option, radius)
  )
  return updated.every((entry, index) => entry === series[index])
    ? option
    : { ...option, series: updated }
}
