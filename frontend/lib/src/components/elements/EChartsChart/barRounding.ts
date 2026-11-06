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
  isYBaseAxis,
  STREAMLIT_THEME,
  toComponentList,
} from "./CustomTheme"
import { getSeriesRows } from "./largeDataDefaults"

type SeriesOption = Record<string, unknown>

/**
 * The bar corner radius in pixels: the theme's small radius, which is half of
 * ``baseRadius`` and may be set in px or rem.
 */
export function getBarRadiusPx(theme: EmotionTheme): number {
  const { sm } = theme.radii
  return sm.endsWith("px") ? Number.parseFloat(sm) : convertRemToPx(sm)
}

/**
 * Whether a data item or dataset row has a negative number or numeric string
 * in any field. Checking every field avoids resolving ``encode``; a negative
 * label offset only keeps bars square.
 */
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
 * The series with the outer end of its bars rounded, or the same object if
 * its bars stay square.
 *
 * Bars grow away from the base axis (see ``isYBaseAxis``). These series keep
 * square bars:
 * - Stacked series, whose inner segments would get rounded corners too.
 * - Non-cartesian series, such as polar bars.
 * - Series without a category gap, such as histograms, whose touching bars
 *   would show notches.
 * - Series with negative values, on a log axis, or on an axis with a
 *   ``startValue``, whose bars can grow toward the base axis.
 * - Series that pick their axes by id, whose axes are missing, or whose data
 *   can't be read.
 * - Series that set their own ``borderRadius``.
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
    Number.parseFloat(String(seriesOption.barCategoryGap)) === 0 ||
    seriesOption.xAxisId !== undefined ||
    seriesOption.yAxisId !== undefined ||
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
  if (xAxis === undefined || yAxis === undefined) {
    return series
  }
  const isHorizontal = isYBaseAxis(xAxis, yAxis)
  const valueAxis = isHorizontal ? xAxis : yAxis
  const rows = getSeriesRows(seriesOption, option)
  if (
    valueAxis.type === "log" ||
    valueAxis.startValue !== undefined ||
    rows === undefined ||
    rows.some(hasNegativeValue)
  ) {
    return series
  }

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
 * Only top-level ``series`` change. Timeline charts, which nest their series
 * in ``baseOption``, keep square bars, and ``media`` overrides inherit the
 * rounding of the series they merge into.
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
