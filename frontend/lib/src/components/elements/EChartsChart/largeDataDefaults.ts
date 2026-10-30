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

import { type EChartsOptionObject, toComponentList } from "./CustomTheme"

type SeriesOption = Record<string, unknown>

/**
 * Item counts above which a series gets ``large: true``.
 *
 * Large mode never animates, so bars wait for ECharts' default
 * ``animationThreshold`` (2,000 items), above which ECharts skips animations
 * anyway. Scatter waits longer: large mode fills up to 10,000 points into one
 * path, so overlapping semi-transparent points stop darkening each other.
 * Above 20,000 points the series spans several paths again, and dense areas
 * look nearly the same as without large mode.
 */
export const LARGE_MODE_THRESHOLDS: ReadonlyMap<string, number> = new Map([
  ["scatter", 20_000],
  ["bar", 2000],
])

/**
 * Line series with more points than this hide their symbols, which overlap
 * into a solid band at typical chart widths.
 */
export const LINE_SYMBOL_THRESHOLD = 2000

/** The series' data items or dataset rows, or ``undefined`` if unknown. */
function getSeriesRows(
  series: SeriesOption,
  option: EChartsOptionObject
): unknown[] | undefined {
  if (series.data !== undefined) {
    return Array.isArray(series.data) ? series.data : undefined
  }
  // A series that names its dataset by id isn't counted.
  if (series.datasetId !== undefined) {
    return undefined
  }
  const index =
    typeof series.datasetIndex === "number" ? series.datasetIndex : 0
  const { source } = toComponentList(option.dataset).at(index) ?? {}
  return Array.isArray(source) ? source : undefined
}

/** Whether a data item or row has a value that ECharts treats as empty. */
function hasEmptyValue(row: unknown): boolean {
  const cells = Array.isArray(row)
    ? row
    : isPlainObject(row)
      ? Object.values(row as SeriesOption)
      : [row]
  return cells.some(cell => cell === null || cell === "-")
}

/** Whether ``data`` has object items, which can set their own style or symbol. */
function hasItemSettings(series: SeriesOption): boolean {
  return Array.isArray(series.data) && series.data.some(isPlainObject)
}

function hasToolboxBrush(option: EChartsOptionObject): boolean {
  return toComponentList(option.toolbox).some(
    ({ feature }) => isPlainObject(feature) && "brush" in (feature as object)
  )
}

/** Whether a chart-level tooltip triggers on items, ECharts' default. */
function hasItemTooltip(option: EChartsOptionObject): boolean {
  return toComponentList(option.tooltip).some(
    ({ show, trigger }) =>
      show !== false && (trigger === undefined || trigger === "item")
  )
}

/** Whether the series' x-axis is a value or time axis, not a category one. */
function hasContinuousXAxis(
  series: SeriesOption,
  option: EChartsOptionObject
): boolean {
  const index = typeof series.xAxisIndex === "number" ? series.xAxisIndex : 0
  const axis = toComponentList(option.xAxis).at(index)
  if (axis === undefined) {
    return false
  }
  // ECharts makes an axis without ``type`` a category axis if it has ``data``.
  return axis.type === undefined
    ? axis.data === undefined
    : axis.type !== "category"
}

/**
 * The series with its large-data default, or the same object if it gets none.
 *
 * Large mode draws a series as a few paths with the series style, so it skips
 * per-item settings, ``visualMap`` colors, and selections, which need one
 * shape per item. Line symbols stay for category axes (ECharts already thins
 * them there), a chart-level item tooltip (it needs a symbol to hover;
 * series-level ``tooltip.trigger`` isn't read), and lines with empty values
 * (a point between two gaps is drawn only as a symbol).
 */
function withLargeDataDefault(
  series: unknown,
  option: EChartsOptionObject,
  hasSelection: boolean
): unknown {
  if (!isPlainObject(series)) {
    return series
  }
  const seriesOption = series as SeriesOption
  const rows = getSeriesRows(seriesOption, option)
  if (
    rows === undefined ||
    hasSelection ||
    Boolean(seriesOption.selectedMode)
  ) {
    return series
  }

  if (seriesOption.type === "line") {
    const keepsSymbols =
      "showSymbol" in seriesOption ||
      rows.length <= LINE_SYMBOL_THRESHOLD ||
      !hasContinuousXAxis(seriesOption, option) ||
      hasItemTooltip(option) ||
      hasItemSettings(seriesOption) ||
      (seriesOption.connectNulls !== true && rows.some(hasEmptyValue))
    return keepsSymbols ? series : { ...seriesOption, showSymbol: false }
  }

  const threshold =
    typeof seriesOption.type === "string"
      ? LARGE_MODE_THRESHOLDS.get(seriesOption.type)
      : undefined
  const keepsDefaultMode =
    threshold === undefined ||
    "large" in seriesOption ||
    rows.length <= threshold ||
    option.visualMap !== undefined ||
    (seriesOption.coordinateSystem ?? "cartesian2d") !== "cartesian2d" ||
    hasItemSettings(seriesOption)
  return keepsDefaultMode ? series : { ...seriesOption, large: true }
}

/**
 * Fill rendering settings that keep large ECharts series responsive, where
 * the author left them unset and the chart looks the same at that size:
 *
 * - ``large: true`` on scatter series with more than 20,000 points and bar
 *   series with more than 2,000 bars. ECharts then draws each series as a few
 *   paths instead of one element per item.
 * - ``showSymbol: false`` on line series with more than 2,000 points on a
 *   value or time axis, where the symbols merge into a solid band.
 *
 * Only top-level ``series`` are changed; timeline and media variants keep
 * ECharts' defaults.
 *
 * @param option The parsed ECharts option object.
 * @param selectionActivated Whether ``on_select`` is active for the chart.
 * @returns The option with defaults filled, or the same object if no series
 * changed.
 */
export function applyLargeDataDefaults(
  option: EChartsOptionObject,
  selectionActivated: boolean
): EChartsOptionObject {
  const { series } = option
  if (!Array.isArray(series)) {
    return option
  }
  const hasSelection =
    selectionActivated || "brush" in option || hasToolboxBrush(option)
  const updated = series.map(entry =>
    withLargeDataDefault(entry, option, hasSelection)
  )
  return updated.every((entry, index) => entry === series[index])
    ? option
    : { ...option, series: updated }
}
