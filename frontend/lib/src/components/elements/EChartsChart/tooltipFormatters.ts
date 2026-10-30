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

import {
  type EChartsOptionObject,
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
  axisType?: unknown
  axisValue?: unknown
}

type FormatTplParams = Parameters<typeof echarts.format.formatTpl>[1]

/**
 * Read one dimension of a tooltip item the way ECharts reads it for a label
 * placeholder. ``dimension`` is a dimension name or a bracketed index such as
 * ``[2]`` (``[]`` means index 0, as in ECharts). As in ECharts, a number-like
 * name such as ``1`` is an index unless a dimension has that name.
 */
function readDimensionValue(
  item: TooltipItemParams,
  dimension: string
): unknown {
  const { value } = item
  const dimensionNames = Array.isArray(item.dimensionNames)
    ? (item.dimensionNames as unknown[])
    : []
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
    // Object rows (e.g. converted dataframes) are keyed by dimension name.
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
 * Tooltips are HTML, so the formatter escapes every inserted value and keeps
 * only the author's template markup. As in labels, ``{@...}`` expands last, so
 * a series name that contains ``{@...}`` text is expanded too (and still
 * escaped).
 */
function buildTemplateFormatter(
  template: string,
  useUTC: boolean
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
    return html.replaceAll(
      DIMENSION_PLACEHOLDER,
      (_placeholder, dimension: string) => {
        const value = readDimensionValue(firstItem, dimension)
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

/**
 * Build a ``valueFormatter`` from a Streamlit number format: a named format
 * such as ``"dollar"`` or a printf-style string such as ``"%,d sessions"``.
 *
 * Returns ``null`` for a string that is not a number format: a template
 * without a ``%`` placeholder (printf would print the same text for every
 * value, and an escaped ``%%`` is not a placeholder) or a malformed printf
 * string.
 */
function buildValueFormatter(format: string): TooltipValueFormatter | null {
  if (
    !NAMED_NUMBER_FORMATS.has(format) &&
    !format.replaceAll("%%", "").includes("%")
  ) {
    return null
  }
  try {
    // sprintf throws on a malformed placeholder. Check once here instead of
    // breaking the tooltip on every hover.
    formatNumber(1, format)
  } catch {
    return null
  }

  const formatItem = (item: unknown): string => {
    const coercedItem =
      typeof item === "string" && isNumericString(item) ? Number(item) : item
    if (typeof coercedItem === "number" && Number.isFinite(coercedItem)) {
      return formatNumber(coercedItem, format)
    }
    return formatTooltipItem(coercedItem)
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
function withTooltipFormatters(tooltip: unknown, useUTC: boolean): unknown {
  if (Array.isArray(tooltip)) {
    return mapPreservingIdentity(tooltip, entry =>
      withTooltipFormatters(entry, useUTC)
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
      formatter: buildTemplateFormatter(formatter, useUTC),
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
  useUTC: boolean
): unknown {
  if (!isPlainObject(series)) {
    return series
  }
  const seriesObject = series as Record<string, unknown>
  return withProperty(
    seriesObject,
    "tooltip",
    withTooltipFormatters(seriesObject.tooltip, useUTC)
  )
}

/** Convert the top-level and series tooltip formatters of one option variant. */
function convertOptionTooltips(
  target: EChartsOptionObject,
  useUTC: boolean
): EChartsOptionObject {
  const { tooltip, series } = target
  const convertSeries = (entry: unknown): unknown =>
    withSeriesTooltipFormatters(entry, useUTC)
  const withTooltip = withProperty(
    target,
    "tooltip",
    withTooltipFormatters(tooltip, useUTC)
  )
  return withProperty(
    withTooltip,
    "series",
    Array.isArray(series)
      ? mapPreservingIdentity(series, convertSeries)
      : convertSeries(series)
  )
}

/** Convert an option variant plus its responsive ``media[*].option`` overrides. */
function convertOptionAndMediaTooltips(
  target: EChartsOptionObject,
  useUTC: boolean
): EChartsOptionObject {
  const result = convertOptionTooltips(target, useUTC)
  const { media } = result
  if (!Array.isArray(media)) {
    return result
  }
  const convertMediaEntry = (entry: unknown): unknown => {
    if (!isPlainObject(entry)) {
      return entry
    }
    const mediaEntry = entry as Record<string, unknown>
    return isPlainObject(mediaEntry.option)
      ? withProperty(
          mediaEntry,
          "option",
          convertOptionTooltips(
            mediaEntry.option as EChartsOptionObject,
            useUTC
          )
        )
      : mediaEntry
  }
  return withProperty(
    result,
    "media",
    mapPreservingIdentity(media, convertMediaEntry)
  )
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
  const baseOption = isPlainObject(option.baseOption)
    ? (option.baseOption as EChartsOptionObject)
    : undefined
  // A declared ``baseOption`` holds the chart, so ECharts reads ``useUTC``
  // only from there and ignores the root.
  const useUTC = (baseOption ? baseOption.useUTC : option.useUTC) === true
  const convertVariant = (variant: EChartsOptionObject): EChartsOptionObject =>
    convertOptionAndMediaTooltips(variant, useUTC)

  // Convert every location Python's ``_iter_option_variants`` warns about, so
  // both sides agree. That includes the root tooltips and ``baseOption.media``,
  // which ECharts ignores when ``baseOption`` is set; converting them is
  // harmless.
  let result = convertVariant(option)
  if (baseOption) {
    result = withProperty(result, "baseOption", convertVariant(baseOption))
  }
  const { options } = result
  if (Array.isArray(options)) {
    const convertTimelineOption = (tick: unknown): unknown =>
      isPlainObject(tick) ? convertVariant(tick as EChartsOptionObject) : tick
    result = withProperty(
      result,
      "options",
      mapPreservingIdentity(options, convertTimelineOption)
    )
  }
  return result
}

/** The cartesian axis keys whose ``type: "time"`` axes get date labels. */
const CARTESIAN_AXIS_KEYS = ["xAxis", "yAxis"] as const

/** Label templates at day and second precision, matching ECharts' own. */
const DATE_LABEL_TEMPLATE = "{yyyy}-{MM}-{dd}"
const DATE_TIME_LABEL_TEMPLATE = `${DATE_LABEL_TEMPLATE} {HH}:{mm}:{ss}`

/**
 * Format a time axis value as its date when it is exactly midnight, and as its
 * date and time to the second otherwise.
 */
function formatTimeAxisValue(value: unknown, useUTC: boolean): string {
  const date = echarts.time.parse(value)
  // Format through ECharts so the check uses the label's UTC or local clock.
  // Milliseconds count, so 00:00:00.250 is not midnight.
  const isMidnight =
    echarts.time.format(date, "{HH}{mm}{ss}{SSS}", useUTC) === "000000000"
  return echarts.time.format(
    date,
    isMidnight ? DATE_LABEL_TEMPLATE : DATE_TIME_LABEL_TEMPLATE,
    useUTC
  )
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
  // Timeline ticks and media overrides merge over the chart, where Streamlit's
  // axis-level formatter would beat a shared one they set. ECharts reads
  // ``media`` only on the root; ``baseOption.media`` is checked to be safe.
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
    formatTimeAxisValue(get(params, "value"), useUTC)
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
  for (const key of CARTESIAN_AXIS_KEYS) {
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
