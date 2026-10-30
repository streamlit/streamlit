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
  transform: (entry: unknown, index: number) => unknown
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

/**
 * Apply ``convert`` to every option variant: the option, its timeline
 * ``baseOption`` and ``options[*]``, and the ``media[*].option`` overrides of
 * each. Returns the input when no variant changed.
 *
 * This visits the same variants as Python's ``_iter_option_variants``, so both
 * sides agree. That includes the root and ``baseOption.media``, which ECharts
 * ignores when ``baseOption`` is set; converting them is harmless.
 */
function mapOptionVariants(
  option: EChartsOptionObject,
  convert: (variant: EChartsOptionObject) => EChartsOptionObject
): EChartsOptionObject {
  const convertMediaEntry = (entry: unknown): unknown => {
    if (!isPlainObject(entry)) {
      return entry
    }
    const mediaEntry = entry as Record<string, unknown>
    return isPlainObject(mediaEntry.option)
      ? withProperty(
          mediaEntry,
          "option",
          convert(mediaEntry.option as EChartsOptionObject)
        )
      : mediaEntry
  }
  const convertWithMedia = (
    target: EChartsOptionObject
  ): EChartsOptionObject => {
    const result = convert(target)
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
  const { baseOption } = result
  if (isPlainObject(baseOption)) {
    result = withProperty(
      result,
      "baseOption",
      convertWithMedia(baseOption as EChartsOptionObject)
    )
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
 * Read ``useUTC`` as ECharts does. A declared ``baseOption`` holds the chart,
 * so ECharts reads ``useUTC`` only from there and ignores the root.
 */
function readUseUTC(option: EChartsOptionObject): boolean {
  const chartOption = isPlainObject(option.baseOption)
    ? (option.baseOption as EChartsOptionObject)
    : option
  return chartOption.useUTC === true
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
  const useUTC = readUseUTC(option)
  return mapOptionVariants(option, variant =>
    convertOptionTooltips(variant, useUTC)
  )
}

/** The cartesian axis keys whose ``type: "time"`` axes get date labels. */
const CARTESIAN_AXIS_KEYS = ["xAxis", "yAxis"] as const

/**
 * The time label templates ECharts uses for its tooltip header and slider
 * labels (``fullLeveledFormatter`` in its ``util/time``).
 */
const DATE_LABEL_TEMPLATE = "{yyyy}-{MM}-{dd}"
const SECOND_LABEL_TEMPLATE = `${DATE_LABEL_TEMPLATE} {HH}:{mm}:{ss}`
const MILLISECOND_LABEL_TEMPLATE = `${SECOND_LABEL_TEMPLATE} {SSS}`
/** The label templates above that include a time of day. */
const TIME_OF_DAY_LABEL_TEMPLATES = [
  SECOND_LABEL_TEMPLATE,
  MILLISECOND_LABEL_TEMPLATE,
] as const

/**
 * Whether ``date`` is exactly midnight: in UTC when ``useUTC`` is set, and in
 * local time otherwise.
 */
function isMidnight(date: Date, useUTC: boolean): boolean {
  return echarts.time.format(date, "{HH}{mm}{ss}{SSS}", useUTC) === "000000000"
}

/**
 * Format a time axis value for the axis tooltip header and axis pointer
 * labels.
 *
 * ECharts picks one precision per axis from its tick interval, so daily data
 * spanning less than about five months reads "2026-08-18 00:00:00". This
 * decides per value instead:
 *
 * - A midnight value shows only its date.
 * - Any other value shows its date and time to the second, ECharts' format for
 *   all but sub-second axes. That keeps an axis pointer that doesn't snap to
 *   data from printing a changing millisecond, and it shows the time even
 *   where ECharts would show only the date.
 *
 * Deciding per value needs no scan of the axis data, but an hourly series
 * shows its midnight points without a time.
 */
function formatTimeAxisValue(value: unknown, useUTC: boolean): string {
  const date = echarts.time.parse(value)
  return echarts.time.format(
    date,
    isMidnight(date, useUTC) ? DATE_LABEL_TEMPLATE : SECOND_LABEL_TEMPLATE,
    useUTC
  )
}

/**
 * Drop the time from a slider ``dataZoom`` handle label that ECharts printed
 * for a midnight value. A slider can control a value or category axis, so any
 * label other than ECharts' time label for that value stays unchanged.
 */
function trimMidnightSliderLabel(
  value: number,
  valueStr: string,
  useUTC: boolean
): string {
  // ECharts builds ``valueStr`` from the rounded value, so format the same
  // instant.
  const date = echarts.time.parse(Math.round(value))
  const isMidnightTimeLabel =
    isMidnight(date, useUTC) &&
    TIME_OF_DAY_LABEL_TEMPLATES.some(
      template => echarts.time.format(date, template, useUTC) === valueStr
    )
  return isMidnightTimeLabel
    ? echarts.time.format(date, DATE_LABEL_TEMPLATE, useUTC)
    : valueStr
}

/**
 * List the configs of a component option (one config or a list of them) with
 * their indexes, skipping entries that aren't objects.
 */
function indexedComponents(
  value: unknown
): Array<[Record<string, unknown>, number]> {
  const entries: unknown[] = Array.isArray(value) ? value : [value]
  const components: Array<[Record<string, unknown>, number]> = []
  entries.forEach((entry, index) => {
    if (isPlainObject(entry)) {
      components.push([entry as Record<string, unknown>, index])
    }
  })
  return components
}

/**
 * Map the configs of a component option (one config or a list of them),
 * leaving entries that aren't objects unchanged. Returns the input when no
 * config changed.
 */
function mapComponents(
  value: unknown,
  transform: (
    entry: Record<string, unknown>,
    index: number
  ) => Record<string, unknown>
): unknown {
  if (Array.isArray(value)) {
    return mapPreservingIdentity(value, (entry, index) =>
      isPlainObject(entry)
        ? transform(entry as Record<string, unknown>, index)
        : entry
    )
  }
  return isPlainObject(value)
    ? transform(value as Record<string, unknown>, 0)
    : value
}

/** Whether ``target`` has a non-null value at the lodash ``path``. */
function hasValueAt(target: unknown, path: string): boolean {
  return !isNullOrUndefined(get(target, path))
}

/**
 * Where one axis pointer label formatter covers every axis, as
 * ``[option key, path]``. An axis-level formatter would override it.
 */
const SHARED_AXIS_POINTER_FORMATTERS = [
  ["tooltip", "axisPointer.label.formatter"],
  ["grid", "tooltip.axisPointer.label.formatter"],
  ["axisPointer", "label.formatter"],
] as const

/**
 * The axes and sliders that keep ECharts' own time labels, collected across
 * every option variant.
 *
 * Timeline and ``media`` variants merge into the chart by component index, so
 * a slot such as ``xAxis:0`` is skipped in every variant when any variant sets
 * its formatter, or declares it as a non-time axis that would inherit a time
 * formatter.
 */
interface TimeLabelExclusions {
  /**
   * Whether a ``tooltip``, ``grid.tooltip``, or top-level ``axisPointer``
   * label formatter applies to every axis.
   */
  hasSharedAxisPointerFormatter: boolean
  /**
   * Whether any variant has a ``type: "time"`` axis. Sliders keep ECharts'
   * labels on charts without one.
   */
  hasTimeAxis: boolean
  /** Slots such as ``xAxis:0`` or ``dataZoom:1`` that keep ECharts' labels. */
  skippedSlots: Set<string>
}

/**
 * Collect, across every option variant, the axes and sliders whose labels the
 * author already controls.
 */
function findTimeLabelExclusions(
  option: EChartsOptionObject
): TimeLabelExclusions {
  const exclusions: TimeLabelExclusions = {
    hasSharedAxisPointerFormatter: false,
    hasTimeAxis: false,
    skippedSlots: new Set(),
  }
  // ``mapOptionVariants`` only visits each variant here: ``collect`` returns
  // it unchanged, and the mapped result is discarded.
  const collect = (variant: EChartsOptionObject): EChartsOptionObject => {
    for (const [key, path] of SHARED_AXIS_POINTER_FORMATTERS) {
      if (
        indexedComponents(variant[key]).some(([entry]) =>
          hasValueAt(entry, path)
        )
      ) {
        exclusions.hasSharedAxisPointerFormatter = true
      }
    }
    for (const key of CARTESIAN_AXIS_KEYS) {
      for (const [axis, index] of indexedComponents(variant[key])) {
        if (axis.type === "time") {
          exclusions.hasTimeAxis = true
        }
        if (
          (axis.type !== undefined && axis.type !== "time") ||
          hasValueAt(axis, "axisPointer.label.formatter")
        ) {
          exclusions.skippedSlots.add(`${key}:${index}`)
        }
      }
    }
    for (const [zoom, index] of indexedComponents(variant.dataZoom)) {
      if (hasValueAt(zoom, "labelFormatter")) {
        exclusions.skippedSlots.add(`dataZoom:${index}`)
      }
    }
    return variant
  }
  mapOptionVariants(option, collect)
  return exclusions
}

/**
 * Show midnight time values as dates in the Streamlit theme's axis labels.
 *
 * ECharts picks one label precision per time axis, so daily data spanning
 * less than about five months reads "2026-08-18 00:00:00". This sets
 * plain-text formatters, which ECharts escapes:
 *
 * - ``axisPointer.label.formatter`` on each ``type: "time"`` ``xAxis`` and
 *   ``yAxis`` (the axis tooltip header and axis pointer labels).
 * - ``labelFormatter`` on each slider ``dataZoom`` of a chart with a time
 *   axis.
 *
 * Author formatters always win, including a shared one on ``tooltip``,
 * ``grid.tooltip``, or the top-level ``axisPointer`` (an axis formatter would
 * override it). Values use UTC when the chart sets ``useUTC: true``, as ECharts
 * does; naive datetimes arrive as local ISO strings. This changes ECharts'
 * default formatting rather than reading the spec, so ``theme=None`` keeps
 * ECharts' labels.
 *
 * @param option The option object to convert.
 * @param themeStr The chart's theme string (``"streamlit"`` or ``""``).
 * @returns The option with time label formatters, or the input when no axis
 * or slider needs one.
 */
export function applyTimeLabelFormatters(
  option: EChartsOptionObject,
  themeStr: string
): EChartsOptionObject {
  if (themeStr !== STREAMLIT_THEME) {
    return option
  }
  const { hasSharedAxisPointerFormatter, hasTimeAxis, skippedSlots } =
    findTimeLabelExclusions(option)
  if (!hasTimeAxis) {
    return option
  }
  const useUTC = readUseUTC(option)
  const axisPointerFormatter = (params: unknown): string =>
    formatTimeAxisValue(get(params, "value"), useUTC)
  const sliderLabelFormatter = (value: number, valueStr: string): string =>
    trimMidnightSliderLabel(value, valueStr, useUTC)

  const withAxisPointerFormatter = (
    axis: Record<string, unknown>
  ): Record<string, unknown> => {
    const axisPointer = isPlainObject(axis.axisPointer)
      ? (axis.axisPointer as Record<string, unknown>)
      : {}
    const label = isPlainObject(axisPointer.label)
      ? (axisPointer.label as Record<string, unknown>)
      : {}
    return {
      ...axis,
      axisPointer: {
        ...axisPointer,
        label: { ...label, formatter: axisPointerFormatter },
      },
    }
  }

  const convertVariant = (
    variant: EChartsOptionObject
  ): EChartsOptionObject => {
    let result = variant
    if (!hasSharedAxisPointerFormatter) {
      for (const key of CARTESIAN_AXIS_KEYS) {
        const convertAxis = (
          axis: Record<string, unknown>,
          index: number
        ): Record<string, unknown> =>
          axis.type === "time" && !skippedSlots.has(`${key}:${index}`)
            ? withAxisPointerFormatter(axis)
            : axis
        result = withProperty(
          result,
          key,
          mapComponents(result[key], convertAxis)
        )
      }
    }
    // ECharts defaults a ``dataZoom`` without a ``type`` to a slider.
    const convertZoom = (
      zoom: Record<string, unknown>,
      index: number
    ): Record<string, unknown> =>
      (zoom.type ?? "slider") === "slider" &&
      !skippedSlots.has(`dataZoom:${index}`)
        ? { ...zoom, labelFormatter: sliderLabelFormatter }
        : zoom
    return withProperty(
      result,
      "dataZoom",
      mapComponents(result.dataZoom, convertZoom)
    )
  }
  return mapOptionVariants(option, convertVariant)
}
