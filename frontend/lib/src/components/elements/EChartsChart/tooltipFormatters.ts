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
import { get, isPlainObject, omit } from "lodash-es"
import { getLogger } from "loglevel"

import {
  formatNumber,
  isNumericString,
  NAMED_NUMBER_FORMATS,
} from "~lib/util/formatNumber"
import { isNullOrUndefined } from "~lib/util/utils"

import { getDimensionName } from "./arrowDataset"
import {
  type EChartsOptionObject,
  formatTimeLabel,
  formatTooltipItem,
  STREAMLIT_THEME,
  toComponentList,
} from "./CustomTheme"

const LOG = getLogger("EChartsChart")

/**
 * A placeholder for one dimension of a data item, such as ``{@name}`` or
 * ``{@[2]}``. ECharts matches label placeholders with the same pattern.
 */
const DIMENSION_PLACEHOLDER = /\{@(.+?)\}/g

type TooltipFormatterCallback = (params: unknown) => string

type TooltipValueFormatter = (value: unknown) => string | string[]

/** The fields of an ECharts tooltip formatter param that this module reads. */
interface TooltipItemParams {
  value?: unknown
  dimensionNames?: unknown
  seriesIndex?: unknown
  axisType?: unknown
  axisValue?: unknown
}

type FormatTplParams = Parameters<typeof echarts.format.formatTpl>[1]

/**
 * Return the option's dimension names for the series of a tooltip item.
 * The getter built for a ``series[i].tooltip`` already knows its series, so it
 * ignores ``seriesIndex``.
 */
type SeriesDimensionNamesGetter = (seriesIndex: unknown) => unknown[]

/** The ECharts dataset transforms whose output keeps the input's dimensions. */
const DIMENSION_KEEPING_TRANSFORMS = new Set([
  "filter",
  "sort",
  "echarts:filter",
  "echarts:sort",
])

/** Whether one dataset ``transform`` entry outputs its input's dimensions. */
function keepsDimensions(transform: unknown): boolean {
  const type: unknown = get(transform, "type")
  return typeof type === "string" && DIMENSION_KEEPING_TRANSFORMS.has(type)
}

/**
 * Return the dimension names the option declares for a series' data:
 *
 * - The series' own ``dimensions``.
 * - Else the ``dimensions`` of the dataset it reads (``datasetIndex``, else
 *   ``datasetId``, else the first). A ``filter`` or ``sort`` dataset uses its
 *   upstream dataset's, since ECharts ignores a transform dataset's own
 *   ``dimensions``.
 *
 * Other transforms, and datasets that name dimensions in a header row, give no
 * names.
 */
function getSeriesDimensionNames(
  series: unknown,
  datasets: unknown
): unknown[] {
  if (!isPlainObject(series)) {
    return []
  }
  const seriesObject = series as Record<string, unknown>
  if (Array.isArray(seriesObject.dimensions)) {
    return seriesObject.dimensions.map(getDimensionName)
  }
  // A series with its own ``data`` doesn't read a dataset.
  if (!isNullOrUndefined(seriesObject.data)) {
    return []
  }
  const datasetList: unknown[] = Array.isArray(datasets)
    ? datasets
    : [datasets]
  /** Find a dataset by index, else id, else the first (ECharts' default). */
  const findDataset = (index: unknown, id: unknown): unknown => {
    if (typeof index === "number") {
      return datasetList[index]
    }
    if (typeof id !== "string" && typeof id !== "number") {
      return datasetList[0]
    }
    // ECharts matches ids as strings, so ``7`` and ``"7"`` are the same id.
    return datasetList.find(entry => {
      const entryId: unknown = get(entry, "id")
      return (
        (typeof entryId === "string" || typeof entryId === "number") &&
        String(entryId) === String(id)
      )
    })
  }

  let dataset = findDataset(seriesObject.datasetIndex, seriesObject.datasetId)
  // At most one step per dataset, so transforms that form a cycle still end.
  for (let step = 0; step < datasetList.length; step++) {
    if (!isPlainObject(dataset)) {
      break
    }
    const { dimensions, transform, fromDatasetIndex, fromDatasetId } =
      dataset as Record<string, unknown>
    if (isNullOrUndefined(transform)) {
      return Array.isArray(dimensions) ? dimensions.map(getDimensionName) : []
    }
    const transforms: unknown[] = Array.isArray(transform)
      ? transform
      : [transform]
    if (!transforms.every(keepsDimensions)) {
      break
    }
    dataset = findDataset(fromDatasetIndex, fromDatasetId)
  }
  return []
}

/**
 * Read one dimension of a tooltip item's ``value`` the way ECharts reads it
 * for a label placeholder. ``dimension`` is a dimension name or a bracketed
 * index such as ``[2]`` (``[]`` means index 0, as in ECharts). As in ECharts,
 * a number-like name such as ``1`` is an index unless a dimension has that
 * name.
 */
function readDimensionValue(
  value: unknown,
  dimensionNames: unknown[],
  dimension: string
): unknown {
  let index: number | undefined
  if (dimension.startsWith("[") && dimension.endsWith("]")) {
    index = Number(dimension.slice(1, -1))
  } else if (
    !dimensionNames.includes(dimension) &&
    !Number.isNaN(Number(dimension))
  ) {
    index = Number(dimension)
  }

  if (Array.isArray(value)) {
    return value[index ?? dimensionNames.indexOf(dimension)]
  }
  if (isPlainObject(value)) {
    // Object rows (e.g. inline `dataset.source` records) are keyed by
    // dimension name.
    const key = index === undefined ? dimension : dimensionNames[index]
    return typeof key === "string"
      ? (value as Record<string, unknown>)[key]
      : undefined
  }
  // A single value answers every placeholder, as it does in labels.
  return value
}

/**
 * Build a tooltip formatter that expands ``{@dim}`` / ``{@[n]}``, which ECharts
 * supports only in labels. It runs ECharts' own string-template steps first:
 *
 * - Time tokens such as ``{yyyy}``, on time axes.
 * - ``{a}``/``{b}``/``{c}``/``{d}``, via ``echarts.format.formatTpl``.
 * - ``{@...}``, read from the first item (an axis tooltip's first series, as
 *   with ``{c}``).
 *
 * ECharts passes no ``dimensionNames`` to pie, funnel, and gauge tooltips,
 * though it still resolves names in their labels. For those series, the
 * formatter reads names from the option through ``getDimensionNames``.
 *
 * Tooltips are HTML, so the formatter escapes every inserted value and keeps
 * only the author's template markup. As in labels, ``{@...}`` expands last, so
 * a series name that contains ``{@...}`` text is expanded too (and still
 * escaped).
 */
function buildTemplateFormatter(
  template: string,
  useUTC: boolean,
  getDimensionNames: SeriesDimensionNamesGetter
): TooltipFormatterCallback {
  return (params: unknown): string => {
    const paramsList = (
      Array.isArray(params) ? params : [params]
    ) as TooltipItemParams[]
    const [firstItem] = paramsList
    if (!isPlainObject(firstItem)) {
      return ""
    }
    let html = template
    if (
      typeof firstItem.axisType === "string" &&
      firstItem.axisType.includes("time")
    ) {
      html = echarts.time.format(firstItem.axisValue, html, useUTC)
    }
    html = echarts.format.formatTpl(
      html,
      paramsList as unknown as FormatTplParams,
      true
    )
    const dimensionNames =
      Array.isArray(firstItem.dimensionNames) &&
      firstItem.dimensionNames.length > 0
        ? (firstItem.dimensionNames as unknown[])
        : getDimensionNames(firstItem.seriesIndex)
    return html.replaceAll(
      DIMENSION_PLACEHOLDER,
      (_placeholder, dimension: string) => {
        const value = readDimensionValue(
          firstItem.value,
          dimensionNames,
          dimension
        )
        // The formatter prints nothing for a missing value, a nested object,
        // or an array.
        return typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
          ? echarts.format.encodeHTML(String(value))
          : ""
      }
    )
  }
}

/** Formats a number with a Streamlit number format. */
type NumberFormatter = (value: number) => string

/**
 * Build a formatter for a Streamlit number format: a named format such as
 * ``"dollar"`` or a printf-style string such as ``"%,d sessions"``. Whole
 * amounts drop their ``.00``.
 *
 * Returns ``null`` for a string that is not a number format: a template
 * without a ``%`` placeholder (printf would print the same text for every
 * value, and an escaped ``%%`` is not a placeholder) or a malformed printf
 * string.
 */
function buildNumberFormatter(format: string): NumberFormatter | null {
  if (
    !NAMED_NUMBER_FORMATS.has(format) &&
    !format.replaceAll("%%", "").includes("%")
  ) {
    return null
  }
  try {
    // sprintf throws on a malformed placeholder. Check once here instead of
    // breaking the chart on every hover or render.
    formatNumber(1, format)
  } catch {
    return null
  }
  return (value: number): string =>
    formatNumber(value, format, undefined, { stripWholeDecimals: true })
}

/** Whether ``value`` is a number other than ``NaN`` or an infinity. */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

/** Read a finite number or numeric string as a number, else ``undefined``. */
function toFiniteNumber(value: unknown): number | undefined {
  if (isFiniteNumber(value)) {
    return value
  }
  return typeof value === "string" && isNumericString(value)
    ? Number(value)
    : undefined
}

/**
 * Build a ``valueFormatter`` from a Streamlit number format. Numbers and
 * numeric strings are formatted, and other values get the default tooltip
 * formatting. Returns ``null`` when ``format`` is not a number format.
 */
function buildValueFormatter(format: string): TooltipValueFormatter | null {
  const formatValue = buildNumberFormatter(format)
  if (!formatValue) {
    return null
  }
  const formatItem = (item: unknown): string => {
    const number = toFiniteNumber(item)
    return number === undefined ? formatTooltipItem(item) : formatValue(number)
  }
  return (value: unknown): string | string[] =>
    Array.isArray(value) ? value.map(formatItem) : formatItem(value)
}

/** Map an array, returning the input array when no entry changed. */
function mapPreservingIdentity(
  entries: unknown[],
  transform: (entry: unknown) => unknown
): unknown[] {
  const mapped = entries.map(transform)
  return mapped.some((entry, index) => entry !== entries[index])
    ? mapped
    : entries
}

/**
 * Copy ``target`` with ``key`` set to ``value``. Returns ``target`` itself when
 * the value is unchanged, so callers can detect that nothing was converted.
 */
function withProperty(
  target: Record<string, unknown>,
  key: string,
  value: unknown
): Record<string, unknown> {
  return value === target[key] ? target : { ...target, [key]: value }
}

/** Convert the string formatters of a tooltip config or a list of them. */
function withTooltipFormatters(
  tooltip: unknown,
  useUTC: boolean,
  getDimensionNames: SeriesDimensionNamesGetter
): unknown {
  if (Array.isArray(tooltip)) {
    return mapPreservingIdentity(tooltip, entry =>
      withTooltipFormatters(entry, useUTC, getDimensionNames)
    )
  }
  if (!isPlainObject(tooltip)) {
    return tooltip
  }
  let result = tooltip as Record<string, unknown>
  const { formatter, valueFormatter } = result

  if (typeof formatter === "string" && formatter.includes("{@")) {
    result = {
      ...result,
      formatter: buildTemplateFormatter(formatter, useUTC, getDimensionNames),
    }
  }

  if (!isNullOrUndefined(valueFormatter)) {
    const numberFormatter =
      typeof valueFormatter === "string"
        ? buildValueFormatter(valueFormatter)
        : null
    if (numberFormatter) {
      result = { ...result, valueFormatter: numberFormatter }
    } else {
      // ECharts calls ``valueFormatter`` as a function, so leaving this in
      // place would throw on every hover. Fall back to the default formatting.
      LOG.warn(
        `Ignoring the ECharts tooltip valueFormatter ${JSON.stringify(valueFormatter)}: ` +
          'use a number format such as "dollar", "compact", or "%.2f".'
      )
      result = omit(result, "valueFormatter")
    }
  }
  return result
}

/** Convert the tooltip formatters of one series config. */
function withSeriesTooltipFormatters(
  series: unknown,
  useUTC: boolean,
  datasets: unknown
): unknown {
  if (!isPlainObject(series)) {
    return series
  }
  const seriesObject = series as Record<string, unknown>
  return withProperty(
    seriesObject,
    "tooltip",
    withTooltipFormatters(seriesObject.tooltip, useUTC, () =>
      getSeriesDimensionNames(seriesObject, datasets)
    )
  )
}

/**
 * Convert the top-level and series tooltip formatters of one option variant.
 * Series and datasets the variant doesn't declare, such as in a timeline tick
 * or ``media`` override, are read from ``chartOption``.
 */
function convertOptionTooltips(
  target: EChartsOptionObject,
  useUTC: boolean,
  chartOption: EChartsOptionObject
): EChartsOptionObject {
  const { tooltip, series } = target
  const datasets = target.dataset ?? chartOption.dataset
  const seriesList = series ?? chartOption.series
  const getDimensionNames = (seriesIndex: unknown): unknown[] => {
    if (!Array.isArray(seriesList)) {
      return getSeriesDimensionNames(seriesList, datasets)
    }
    return typeof seriesIndex === "number"
      ? getSeriesDimensionNames(seriesList[seriesIndex], datasets)
      : []
  }
  const convertSeries = (entry: unknown): unknown =>
    withSeriesTooltipFormatters(entry, useUTC, datasets)
  const withTooltip = withProperty(
    target,
    "tooltip",
    withTooltipFormatters(tooltip, useUTC, getDimensionNames)
  )
  return withProperty(
    withTooltip,
    "series",
    Array.isArray(series)
      ? mapPreservingIdentity(series, convertSeries)
      : convertSeries(series)
  )
}

/**
 * A function that converts one option variant.
 *
 * @param variant The option variant to convert.
 * @param chartOption The option that holds the chart: the timeline
 * ``baseOption`` when declared, else the option itself. A timeline tick or
 * ``media`` override that doesn't declare series or datasets reads them from
 * there.
 */
type OptionVariantConverter = (
  variant: EChartsOptionObject,
  chartOption: EChartsOptionObject
) => EChartsOptionObject

/**
 * Apply ``convert`` to every option variant: the option, its timeline
 * ``baseOption`` and ``options[*]``, and the ``media[*].option`` overrides of
 * each. These are the locations Python's ``_iter_option_variants`` walks, so
 * both sides agree. That includes the root and ``baseOption.media``, which
 * ECharts ignores when ``baseOption`` is set; converting them is harmless.
 *
 * Returns the input when no variant changed.
 */
function mapOptionVariants(
  option: EChartsOptionObject,
  convert: OptionVariantConverter
): EChartsOptionObject {
  const baseOption = isPlainObject(option.baseOption)
    ? (option.baseOption as EChartsOptionObject)
    : undefined
  const chartOption = baseOption ?? option

  const convertMediaEntry = (entry: unknown): unknown => {
    if (!isPlainObject(entry)) {
      return entry
    }
    const mediaEntry = entry as Record<string, unknown>
    return isPlainObject(mediaEntry.option)
      ? withProperty(
          mediaEntry,
          "option",
          convert(mediaEntry.option as EChartsOptionObject, chartOption)
        )
      : mediaEntry
  }
  const convertWithMedia = (
    target: EChartsOptionObject
  ): EChartsOptionObject => {
    const result = convert(target, chartOption)
    const { media } = result
    return Array.isArray(media)
      ? withProperty(
          result,
          "media",
          mapPreservingIdentity(media, convertMediaEntry)
        )
      : result
  }

  let result = convertWithMedia(option)
  if (baseOption) {
    result = withProperty(result, "baseOption", convertWithMedia(baseOption))
  }
  const { options } = result
  if (Array.isArray(options)) {
    const convertTimelineOption = (tick: unknown): unknown =>
      isPlainObject(tick)
        ? convertWithMedia(tick as EChartsOptionObject)
        : tick
    result = withProperty(
      result,
      "options",
      mapPreservingIdentity(options, convertTimelineOption)
    )
  }
  return result
}

/**
 * Turn the JSON-only tooltip formatters Streamlit supports into the functions
 * ECharts expects.
 *
 * - A string ``formatter`` that uses ``{@dim}`` or ``{@[n]}`` placeholders
 *   becomes a function that expands them, as ECharts already does for labels.
 *   Other string templates stay strings, so ECharts handles them unchanged.
 * - A string ``valueFormatter`` with a Streamlit number format (the formats of
 *   ``st.metric``) becomes a function that formats each value in the default
 *   tooltip. Any other ``valueFormatter`` is dropped with a warning, since a
 *   JSON spec cannot carry the function ECharts would call.
 *
 * Applies to ``tooltip`` and ``series[*].tooltip`` on the option, its timeline
 * ``baseOption`` and ``options[*]``, and their ``media[*].option`` overrides.
 * Per-data-item tooltips are left alone so large ``data`` arrays aren't walked.
 * This runs for both themes because it reads the spec rather than styling it.
 *
 * @param option The option object to convert.
 * @returns The option with converted formatters, or the input when nothing
 * needed converting.
 */
export function applyTooltipFormatters(
  option: EChartsOptionObject
): EChartsOptionObject {
  return mapOptionVariants(option, (variant, chartOption) =>
    // ECharts reads ``useUTC`` only from the option that holds the chart.
    convertOptionTooltips(variant, chartOption.useUTC === true, chartOption)
  )
}

/** The axis components whose labels can take a number format. */
const NUMBER_FORMAT_AXIS_KEYS = [
  "xAxis",
  "yAxis",
  "radiusAxis",
  "angleAxis",
  "singleAxis",
  "parallelAxis",
] as const

/** Apply ``transform`` to one config object or to each one in a list. */
function mapConfigs(
  value: unknown,
  transform: (config: Record<string, unknown>) => Record<string, unknown>
): unknown {
  const transformEntry = (entry: unknown): unknown =>
    isPlainObject(entry) ? transform(entry as Record<string, unknown>) : entry
  return Array.isArray(value)
    ? mapPreservingIdentity(value, transformEntry)
    : transformEntry(value)
}

/**
 * Format the value of a label with a number format.
 *
 * - Numbers and numeric strings are formatted.
 * - Other strings (such as category names), booleans, and non-finite numbers
 *   show as they are.
 * - Anything else shows as an empty string.
 */
function formatLabelValue(
  formatValue: NumberFormatter,
  value: unknown
): string {
  const number = toFiniteNumber(value)
  if (number !== undefined) {
    return formatValue(number)
  }
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? String(value)
    : ""
}

/**
 * Per cartesian dimension: its ``encode`` key, axis component, and axis index
 * key.
 */
const CARTESIAN_AXES = [
  { encodeKey: "x", axisKey: "xAxis", indexKey: "xAxisIndex" },
  { encodeKey: "y", axisKey: "yAxis", indexKey: "yAxisIndex" },
] as const

/**
 * Read the type ECharts gives the axis at ``index`` of ``axisKey``: its
 * ``type``, else ``"category"`` when it declares ``data``, else ``"value"``.
 * Each source is checked in order, so a timeline tick or ``media`` override
 * that doesn't set the type inherits it from the option that holds the chart.
 */
function readAxisType(
  sources: readonly EChartsOptionObject[],
  axisKey: string,
  index: number
): unknown {
  for (const source of sources) {
    const axes = source[axisKey]
    const axisList: unknown[] = Array.isArray(axes) ? axes : [axes]
    const axis = axisList[index]
    if (isPlainObject(axis)) {
      const { type, data } = axis as Record<string, unknown>
      if (type !== undefined) {
        return type
      }
      if (data !== undefined) {
        return "category"
      }
    }
  }
  return "value"
}

/**
 * Return the ``encode`` keys whose dimensions ECharts' default label skips:
 * ``"x"`` or ``"y"`` when a cartesian series sits on a category or time axis
 * there. ECharts skips ordinal and time dimensions, which include numeric
 * category values such as years and numeric timestamps.
 */
function readCategoryOrTimeEncodeKeys(
  series: Record<string, unknown>,
  sources: readonly EChartsOptionObject[]
): ReadonlySet<string> {
  const { coordinateSystem = "cartesian2d" } = series
  const keys = new Set<string>()
  if (coordinateSystem !== "cartesian2d") {
    return keys
  }
  for (const { encodeKey, axisKey, indexKey } of CARTESIAN_AXES) {
    const index = series[indexKey]
    const axisType = readAxisType(
      sources,
      axisKey,
      isFiniteNumber(index) ? index : 0
    )
    if (axisType === "category" || axisType === "time") {
      keys.add(encodeKey)
    }
  }
  return keys
}

/** Read the sorted dimension indices of ``encode`` entries, e.g. ``{x: [0], y: [1]}``. */
function readEncodeIndices(entries: [string, unknown][]): number[] {
  return entries
    .flatMap(([, indices]) => indices)
    .filter(isFiniteNumber)
    .toSorted((first, second) => first - second)
}

/**
 * Return the value ECharts' default label shows for the ``params`` of a series
 * label.
 *
 * - A single ``value`` is that value.
 * - For a row (an array or object ``value``), it is the last coordinate
 *   dimension in data order, such as the y value of a vertical bar or the x
 *   value of a horizontal one. The dimensions of ``categoryOrTimeEncodeKeys``
 *   (see ``readCategoryOrTimeEncodeKeys``) are left out.
 * - Among those, the last finite number wins. Category names and datetimes
 *   arrive as strings, so this also skips them on series without cartesian
 *   axes. If none is a finite number, the last numeric string wins, then the
 *   last value.
 */
function readSeriesLabelValue(
  params: unknown,
  categoryOrTimeEncodeKeys: ReadonlySet<string>
): unknown {
  const value: unknown = get(params, "value")
  if (!Array.isArray(value) && !isPlainObject(value)) {
    return value
  }
  const dimensionNames: unknown = get(params, "dimensionNames")
  const names = Array.isArray(dimensionNames) ? dimensionNames : []
  // ECharts passes the coordinate dimensions as indices, e.g. {x: [0], y: [1]},
  // whether or not the series sets ``encode``.
  const encode: unknown = get(params, "encode")
  const encodeEntries = isPlainObject(encode)
    ? Object.entries(encode as Record<string, unknown>)
    : []
  const labelIndices = readEncodeIndices(
    encodeEntries.filter(([key]) => !categoryOrTimeEncodeKeys.has(key))
  )
  // When every dimension is skipped, fall back to all of them.
  const indices =
    labelIndices.length > 0 ? labelIndices : readEncodeIndices(encodeEntries)
  const candidates =
    indices.length > 0
      ? indices.map(index => readDimensionValue(value, names, `[${index}]`))
      : Object.values(value as Record<string, unknown>)
  return (
    candidates.findLast(isFiniteNumber) ??
    candidates.findLast(
      candidate => typeof candidate === "string" && isNumericString(candidate)
    ) ??
    candidates.at(-1)
  )
}

/**
 * Copy ``container`` with the string ``formatter`` of ``container[key]``
 * turned into a function, when that string is a Streamlit number format. The
 * function formats the value ``readValue`` reads from ECharts' formatter
 * argument. Returns ``container`` itself when nothing is converted.
 *
 * Strings with a ``{`` are ECharts templates (``"{value}%"``, ``"{b}: {c}"``,
 * time tokens, rich text), so they stay strings. So do other strings that
 * aren't number formats, which ECharts prints as literal text.
 */
function withLabelNumberFormat(
  container: Record<string, unknown>,
  key: string,
  readValue: (formatterArgument: unknown) => unknown
): Record<string, unknown> {
  const label = container[key]
  const formatter: unknown = get(label, "formatter")
  const formatValue =
    typeof formatter === "string" && !formatter.includes("{")
      ? buildNumberFormatter(formatter)
      : null
  if (!formatValue) {
    return container
  }
  return {
    ...container,
    [key]: {
      ...(label as Record<string, unknown>),
      formatter: (formatterArgument: unknown): string =>
        formatLabelValue(formatValue, readValue(formatterArgument)),
    },
  }
}

/** Convert the ``axisLabel`` and ``axisPointer.label`` formatters of an axis. */
function withAxisNumberFormats(
  axis: Record<string, unknown>
): Record<string, unknown> {
  // ECharts passes the tick value as the first argument.
  const result = withLabelNumberFormat(axis, "axisLabel", value => value)
  const { axisPointer } = result
  return isPlainObject(axisPointer)
    ? withProperty(
        result,
        "axisPointer",
        withLabelNumberFormat(
          axisPointer as Record<string, unknown>,
          "label",
          params => get(params, "value")
        )
      )
    : result
}

/**
 * Convert the ``label`` and ``endLabel`` formatters of a series.
 *
 * @param series The series to convert.
 * @param sources The options to read the series' axes from, in order.
 */
function withSeriesNumberFormats(
  series: Record<string, unknown>,
  sources: readonly EChartsOptionObject[]
): Record<string, unknown> {
  const categoryOrTimeEncodeKeys = readCategoryOrTimeEncodeKeys(
    series,
    sources
  )
  const readValue = (params: unknown): unknown =>
    readSeriesLabelValue(params, categoryOrTimeEncodeKeys)
  return withLabelNumberFormat(
    withLabelNumberFormat(series, "label", readValue),
    "endLabel",
    readValue
  )
}

/** Convert the axis and series label formatters of one option variant. */
function convertOptionLabels(
  variant: EChartsOptionObject,
  chartOption: EChartsOptionObject
): EChartsOptionObject {
  let result = variant
  for (const key of NUMBER_FORMAT_AXIS_KEYS) {
    result = withProperty(
      result,
      key,
      mapConfigs(result[key], withAxisNumberFormats)
    )
  }
  const axisSources = [variant, chartOption]
  return withProperty(
    result,
    "series",
    mapConfigs(result.series, series =>
      withSeriesNumberFormats(series, axisSources)
    )
  )
}

/**
 * Turn label formatters that are Streamlit number formats (the formats a
 * tooltip ``valueFormatter`` accepts, such as ``"percent"`` or ``"%,.0f"``)
 * into the functions ECharts expects. ECharts would print such a string
 * literally on every tick or label, so converting it breaks no working spec.
 *
 * - ``axisLabel.formatter`` and ``axisPointer.label.formatter`` of each axis
 *   format the tick or pointer value. Non-numeric category names show as they
 *   are.
 * - ``label.formatter`` and ``endLabel.formatter`` of each series format the
 *   value ECharts' default label shows (see ``readSeriesLabelValue``).
 *
 * Applies to the option, its timeline ``baseOption`` and ``options[*]``, and
 * their ``media[*].option`` overrides. Per-data-item and mark labels are left
 * alone. The formatters return plain text. This runs for both themes because
 * it reads the spec rather than styling it.
 *
 * @param option The option object to convert.
 * @returns The option with converted formatters, or the input when nothing
 * needed converting.
 */
export function applyLabelNumberFormats(
  option: EChartsOptionObject
): EChartsOptionObject {
  return mapOptionVariants(option, convertOptionLabels)
}

/** Whether ``target`` has a non-null ``label.formatter``. */
function hasLabelFormatter(target: unknown): boolean {
  return !isNullOrUndefined(get(target, "label.formatter"))
}

/**
 * Show midnight values on time axes as dates under the Streamlit theme.
 *
 * ECharts picks one label precision per time axis, so the axis tooltip header
 * of daily data spanning less than about five months reads
 * "2026-08-18 00:00:00". This sets a plain-text ``axisPointer.label.formatter``
 * (ECharts escapes it), which drives the tooltip header and axis pointer
 * labels, on each ``type: "time"`` ``xAxis`` and ``yAxis``.
 *
 * - The midnight check runs per value, so it needs no scan of the axis data.
 *   An hourly series shows its midnight points without a time, and other
 *   values show their time to the second, without milliseconds.
 * - A label formatter on the axis, ``tooltip.axisPointer``,
 *   ``grid.tooltip.axisPointer``, or the top-level ``axisPointer`` wins,
 *   including one set in a timeline tick or ``media`` override. If any shared
 *   one is set, no axis gets Streamlit's formatter, because an axis-level
 *   formatter would override it.
 * - On a timeline, only ``baseOption`` is converted, and ``useUTC`` comes from
 *   there too. Timeline ticks and ``media`` overrides stay as given; they
 *   merge over the base axis, so an axis formatter set in one still wins.
 * - Only the Streamlit theme adds these formatters, so ``theme=None`` keeps
 *   ECharts' labels.
 *
 * @param option The option object to convert.
 * @param themeStr The chart's theme string (``"streamlit"`` or ``""``).
 * @returns The option with time axis formatters, or the input when no axis
 * needs one.
 */
export function applyTimeLabelFormatters(
  option: EChartsOptionObject,
  themeStr: string
): EChartsOptionObject {
  if (themeStr !== STREAMLIT_THEME) {
    return option
  }
  const hasBaseOption = isPlainObject(option.baseOption)
  const chartOption = hasBaseOption
    ? (option.baseOption as EChartsOptionObject)
    : option
  // Look for shared formatters in every variant. Ticks and media overrides
  // merge over the chart, so Streamlit's axis-level formatter would beat a
  // shared one they set. ECharts reads ``media`` only on the root;
  // ``baseOption.media`` is included so a formatter written there still opts
  // the chart out.
  const mediaLists = hasBaseOption
    ? [option.media, chartOption.media]
    : [option.media]
  const variants = [
    chartOption,
    ...toComponentList(option.options),
    ...mediaLists.flatMap(media =>
      toComponentList(media).map(entry => entry.option)
    ),
  ]
  const sharedAxisPointers = variants.flatMap(variant => [
    ...toComponentList(get(variant, "tooltip")).map(
      ({ axisPointer }) => axisPointer
    ),
    ...toComponentList(get(variant, "grid")).map(grid =>
      get(grid, "tooltip.axisPointer")
    ),
    ...toComponentList(get(variant, "axisPointer")),
  ])
  if (sharedAxisPointers.some(hasLabelFormatter)) {
    return option
  }

  const useUTC = chartOption.useUTC === true
  const formatter = (params: unknown): string =>
    formatTimeLabel(get(params, "value"), useUTC)
  const withTimeLabelFormatter = (axis: unknown): unknown => {
    if (!isPlainObject(axis)) {
      return axis
    }
    const axisObject = axis as Record<string, unknown>
    const axisPointer = isPlainObject(axisObject.axisPointer)
      ? (axisObject.axisPointer as Record<string, unknown>)
      : {}
    if (axisObject.type !== "time" || hasLabelFormatter(axisPointer)) {
      return axis
    }
    const label = isPlainObject(axisPointer.label)
      ? (axisPointer.label as Record<string, unknown>)
      : {}
    return {
      ...axisObject,
      axisPointer: { ...axisPointer, label: { ...label, formatter } },
    }
  }

  let result = chartOption
  for (const { axisKey: key } of CARTESIAN_AXES) {
    const axes = result[key]
    result = withProperty(
      result,
      key,
      Array.isArray(axes)
        ? mapPreservingIdentity(axes, withTimeLabelFormatter)
        : withTimeLabelFormatter(axes)
    )
  }
  return hasBaseOption ? withProperty(option, "baseOption", result) : result
}
