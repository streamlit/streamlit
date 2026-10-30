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
 * Item counts from which a series gets ``large: true``.
 *
 * Bars use ECharts' default ``largeThreshold``. Scatter waits longer than
 * ECharts' 2,000: large mode fills up to 10,000 points into one path, so
 * overlapping semi-transparent points stop darkening each other. From 20,000
 * points the series spans several paths again, and dense areas look nearly
 * the same as without large mode.
 */
export const LARGE_MODE_THRESHOLDS: ReadonlyMap<string, number> = new Map([
  ["scatter", 20_000],
  ["bar", 400],
])

/**
 * ECharts' default ``animationThreshold``: series with more items than this
 * don't animate. Large mode never animates, so it waits until ECharts would
 * skip the animations anyway.
 */
export const DEFAULT_ANIMATION_THRESHOLD = 2000

/**
 * Line series with more points than this hide their symbols. It matches
 * ECharts' default ``animationThreshold``, above which ECharts already treats
 * a series as too dense to animate.
 */
export const LINE_SYMBOL_THRESHOLD = 2000

/**
 * Below this size, large scatter mode draws each symbol as a square.
 * Mirrors ``BOOST_SIZE_THRESHOLD`` in ECharts' ``LargeSymbolDraw``.
 */
const LARGE_SYMBOL_MIN_SIZE = 4

/** ECharts' built-in filled symbols. */
const LARGE_MODE_SYMBOLS: ReadonlySet<string> = new Set([
  "circle",
  "rect",
  "roundRect",
  "triangle",
  "diamond",
  "pin",
  "arrow",
])

/** Data item keys that neither style the item nor give it a symbol. */
const UNSTYLED_ITEM_KEYS: ReadonlySet<string> = new Set([
  "value",
  "name",
  "id",
  "groupId",
  "childGroupId",
  "tooltip",
])

/** Option-level facts that decide whether a series can use the defaults. */
interface ChartContext {
  /** The option level that holds the series, datasets, and axes. */
  target: EChartsOptionObject
  /** A brush, a toolbox brush, or ``on_select`` can select data items. */
  hasSelection: boolean
  /** A ``visualMap`` maps values to colors or sizes per item. */
  hasVisualMap: boolean
  /** A tooltip triggers on items, so hovering needs a drawn symbol. */
  hasItemTooltip: boolean
  /** Zooming in can thin a dense line until its symbols are readable. */
  hasDataZoom: boolean
  /** ARIA decal patterns fill each item. */
  hasDecal: boolean
}

function isShownLabel(label: unknown): boolean {
  return isPlainObject(label) && (label as SeriesOption).show === true
}

function isPositiveNumber(value: unknown): boolean {
  return typeof value === "number" && value > 0
}

function hasBorderRadius(style: unknown): boolean {
  if (!isPlainObject(style)) {
    return false
  }
  const { borderRadius } = style as SeriesOption
  return Array.isArray(borderRadius)
    ? borderRadius.some(isPositiveNumber)
    : isPositiveNumber(borderRadius)
}

/**
 * Whether large scatter mode draws the symbol like a regular scatter series.
 * It traces every point with one path, so image symbols can't be drawn, and
 * the hollow ``empty*`` shapes are filled differently.
 */
function isLargeModeSymbol(symbol: unknown): boolean {
  return (
    symbol === undefined ||
    (typeof symbol === "string" &&
      (LARGE_MODE_SYMBOLS.has(symbol) || symbol.startsWith("path://")))
  )
}

function hasSmallSymbol(symbolSize: unknown): boolean {
  const sizes = Array.isArray(symbolSize) ? symbolSize : [symbolSize]
  return sizes.some(
    size => typeof size === "number" && size < LARGE_SYMBOL_MIN_SIZE
  )
}

/** Whether some data item sets its own style, label, state, or symbol. */
function hasStyledItems(data: unknown): boolean {
  return (
    Array.isArray(data) &&
    data.some(
      item =>
        isPlainObject(item) &&
        Object.keys(item as SeriesOption).some(
          key => !UNSTYLED_ITEM_KEYS.has(key)
        )
    )
  )
}

function configuresSelection(target: EChartsOptionObject): boolean {
  if ("brush" in target) {
    return true
  }
  return toComponentList(target.toolbox).some(toolbox => {
    const { feature } = toolbox
    return isPlainObject(feature) && "brush" in (feature as SeriesOption)
  })
}

function hasItemTooltip(target: EChartsOptionObject): boolean {
  return toComponentList(target.tooltip).some(
    tooltip =>
      tooltip.show !== false &&
      (tooltip.trigger === undefined || tooltip.trigger === "item")
  )
}

function hasDecal(target: EChartsOptionObject): boolean {
  const { aria } = target
  if (!isPlainObject(aria)) {
    return false
  }
  const { decal } = aria as SeriesOption
  return isPlainObject(decal) && (decal as SeriesOption).show === true
}

/** Pick the component a series references by ``<key>Id`` or ``<key>Index``. */
function findReferencedComponent(
  components: Array<Record<string, unknown>>,
  series: SeriesOption,
  key: string
): Record<string, unknown> | undefined {
  const id = series[`${key}Id`]
  if (id !== undefined) {
    return components.find(component => component.id === id)
  }
  const index = series[`${key}Index`]
  return components[typeof index === "number" ? index : 0]
}

/**
 * The number of rows in a dataset ``source``, or ``null`` if it can't be known
 * before ECharts builds the series data.
 */
function countSourceRows(dataset: Record<string, unknown>): number | null {
  // A transformed dataset can drop rows, so its upstream size says nothing.
  if (
    dataset.transform !== undefined ||
    dataset.fromDatasetIndex !== undefined ||
    dataset.fromDatasetId !== undefined
  ) {
    return null
  }
  const { source } = dataset
  if (Array.isArray(source)) {
    // A header row adds one, which only matters at the exact threshold.
    return source.length
  }
  if (isPlainObject(source)) {
    // Column-oriented source: one array per dimension.
    return Math.max(
      0,
      ...Object.values(source as SeriesOption).map(column =>
        Array.isArray(column) ? column.length : 0
      )
    )
  }
  return null
}

/**
 * The number of data items a series draws, or ``null`` if it can't be known.
 */
function countSeriesItems(
  series: SeriesOption,
  target: EChartsOptionObject
): number | null {
  const { data } = series
  if (data !== undefined) {
    return Array.isArray(data) ? data.length : null
  }
  // Row layout turns each dataset row into its own series.
  if (series.seriesLayoutBy === "row") {
    return null
  }
  const dataset = findReferencedComponent(
    toComponentList(target.dataset),
    series,
    "dataset"
  )
  return dataset ? countSourceRows(dataset) : null
}

/** The series' ``animationThreshold``, read the way ECharts reads it. */
function getAnimationThreshold(
  series: SeriesOption,
  target: EChartsOptionObject
): number {
  for (const value of [series.animationThreshold, target.animationThreshold]) {
    if (typeof value === "number") {
      return value
    }
  }
  return DEFAULT_ANIMATION_THRESHOLD
}

function isCartesianSeries(series: SeriesOption): boolean {
  return (
    series.coordinateSystem === undefined ||
    series.coordinateSystem === "cartesian2d"
  )
}

/** ECharts makes an axis without ``type`` a category axis if it has ``data``. */
function isCategoryAxis(axis: Record<string, unknown>): boolean {
  return (
    axis.type === "category" ||
    (axis.type === undefined && axis.data !== undefined)
  )
}

/**
 * Whether large mode would draw the series as it looks today.
 *
 * Large mode draws all items of a series as one path with the series style.
 * It has no per-item styles, labels, emphasis, selection, or visual mapping,
 * and large bars have no stroke, rounded corners, or polar layout.
 */
function canUseLargeMode(
  series: SeriesOption,
  context: ChartContext
): boolean {
  if (
    context.hasSelection ||
    context.hasVisualMap ||
    context.hasDecal ||
    Boolean(series.selectedMode) ||
    series.colorBy === "data" ||
    isShownLabel(series.label) ||
    "emphasis" in series ||
    "select" in series ||
    "blur" in series ||
    hasStyledItems(series.data)
  ) {
    return false
  }
  if (series.type === "bar") {
    const itemStyle = isPlainObject(series.itemStyle)
      ? (series.itemStyle as SeriesOption)
      : {}
    return (
      isCartesianSeries(series) &&
      !isPositiveNumber(itemStyle.borderWidth) &&
      !hasBorderRadius(itemStyle) &&
      !hasBorderRadius(series.backgroundStyle)
    )
  }
  return (
    isLargeModeSymbol(series.symbol) &&
    !hasSmallSymbol(series.symbolSize) &&
    !("symbolRotate" in series) &&
    !("symbolOffset" in series)
  )
}

function withLargeMode(
  series: SeriesOption,
  context: ChartContext
): SeriesOption {
  const defaultThreshold =
    typeof series.type === "string"
      ? LARGE_MODE_THRESHOLDS.get(series.type)
      : undefined
  if (defaultThreshold === undefined || "large" in series) {
    return series
  }
  // A higher ``largeThreshold`` from the author would keep ECharts out of
  // large mode anyway.
  const threshold =
    typeof series.largeThreshold === "number"
      ? Math.max(series.largeThreshold, defaultThreshold)
      : defaultThreshold
  const count = countSeriesItems(series, context.target)
  if (
    count === null ||
    count < threshold ||
    count <= getAnimationThreshold(series, context.target)
  ) {
    return series
  }
  return canUseLargeMode(series, context) ? { ...series, large: true } : series
}

/**
 * Whether to hide the symbols of a line series: they are too dense to read,
 * and nothing in the chart needs them.
 *
 * ECharts already thins symbols on category axes (``showAllSymbol``). Without
 * drawn symbols, an axis tooltip still highlights the hovered point, but item
 * tooltips, point selection, and brush highlights have nothing to target. A
 * zoomed-in ``dataZoom`` window could make the symbols readable again.
 */
function shouldHideLineSymbols(
  series: SeriesOption,
  context: ChartContext
): boolean {
  if (
    "showSymbol" in series ||
    // Sampling already reduces the drawn points to about the axis width.
    !(series.sampling === undefined || series.sampling === null) ||
    context.hasSelection ||
    context.hasItemTooltip ||
    context.hasDataZoom ||
    Boolean(series.selectedMode) ||
    isShownLabel(series.label) ||
    !isCartesianSeries(series)
  ) {
    return false
  }
  const { target } = context
  const xAxis = findReferencedComponent(
    toComponentList(target.xAxis),
    series,
    "xAxis"
  )
  const yAxis = findReferencedComponent(
    toComponentList(target.yAxis),
    series,
    "yAxis"
  )
  if (!xAxis || !yAxis || isCategoryAxis(xAxis) || isCategoryAxis(yAxis)) {
    return false
  }
  const count = countSeriesItems(series, target)
  return (
    count !== null &&
    count > LINE_SYMBOL_THRESHOLD &&
    !hasStyledItems(series.data)
  )
}

function withLargeDataDefaults(
  series: unknown,
  context: ChartContext
): unknown {
  if (!isPlainObject(series)) {
    return series
  }
  const seriesOption = series as SeriesOption
  if (seriesOption.type === "line") {
    return shouldHideLineSymbols(seriesOption, context)
      ? { ...seriesOption, showSymbol: false }
      : seriesOption
  }
  return withLargeMode(seriesOption, context)
}

/**
 * Fill rendering settings that keep large ECharts series responsive.
 *
 * Applied only to options the author left unset, and only where the chart
 * looks the same at that size:
 *
 * - ``large: true`` on scatter series with at least 20,000 points and bar
 *   series with more than 2,000 bars. ECharts then draws each series as a few
 *   paths instead of one element per item. Large mode doesn't animate, so it
 *   waits for the series to pass ``animationThreshold``, where ECharts stops
 *   animating anyway.
 * - ``showSymbol: false`` on line series with more than 2,000 points on value
 *   or time axes, where the symbols merge into a solid band.
 *
 * Series that large mode or hidden symbols would draw differently keep
 * ECharts' defaults: per-item styles or labels, selections, visual maps,
 * item tooltips on lines, and similar (see ``canUseLargeMode`` and
 * ``shouldHideLineSymbols``). Timeline options are handled on
 * ``baseOption``; per-tick and media overrides are left as they are.
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
  const isTimeline = isPlainObject(option.baseOption)
  const target = isTimeline
    ? (option.baseOption as EChartsOptionObject)
    : option
  const { series } = target
  if (!Array.isArray(series) && !isPlainObject(series)) {
    return option
  }

  const context: ChartContext = {
    target,
    hasSelection: selectionActivated || configuresSelection(target),
    hasVisualMap: target.visualMap !== undefined,
    hasItemTooltip: hasItemTooltip(target),
    hasDataZoom: target.dataZoom !== undefined,
    hasDecal: hasDecal(target),
  }
  const seriesList: unknown[] = Array.isArray(series) ? series : [series]
  const updated = seriesList.map(entry =>
    withLargeDataDefaults(entry, context)
  )
  if (updated.every((entry, index) => entry === seriesList[index])) {
    return option
  }

  const updatedTarget = {
    ...target,
    series: Array.isArray(series) ? updated : updated[0],
  }
  return isTimeline ? { ...option, baseOption: updatedTarget } : updatedTarget
}
