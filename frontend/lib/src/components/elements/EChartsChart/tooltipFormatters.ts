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
import { isPlainObject } from "lodash-es"
import { getLogger } from "loglevel"

import { formatNumber, isNumericString } from "~lib/util/formatNumber"
import { isNullOrUndefined } from "~lib/util/utils"

import { type EChartsOptionObject, formatTooltipItem } from "./CustomTheme"

const LOG = getLogger("EChartsChart")

/**
 * ECharts' label placeholder for one dimension of a data item: ``{@name}``
 * or ``{@[2]}``. ECharts uses the same pattern for labels.
 */
const DIMENSION_PLACEHOLDER = /\{@(.+?)\}/g

/** The named formats of ``formatNumber``, the same set ``st.metric`` accepts. */
const NAMED_NUMBER_FORMATS = new Set([
  "plain",
  "localized",
  "dollar",
  "euro",
  "yen",
  "percent",
  "compact",
  "scientific",
  "engineering",
  "accounting",
  "bytes",
])

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
 * ``[2]`` (``[]`` means index 0, as in ECharts).
 */
function readDimensionValue(
  item: TooltipItemParams,
  dimension: string
): unknown {
  const { value } = item
  const dimensionNames = Array.isArray(item.dimensionNames)
    ? (item.dimensionNames as unknown[])
    : []
  const isIndex = dimension.startsWith("[") && dimension.endsWith("]")
  const index = isIndex ? Number(dimension.slice(1, -1)) : undefined

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
 * Build a tooltip formatter for a string template that uses ``{@dim}`` or
 * ``{@[n]}`` placeholders.
 *
 * ECharts expands these placeholders only in labels. This runs the same steps
 * as ECharts' own string-template tooltip (time tokens on time axes, then
 * ``{a}``/``{b}``/``{c}``/``{d}``), then expands the placeholders from the first
 * item, just as ``{c}`` means the first series in an axis tooltip. Tooltips are
 * HTML, so expanded values are escaped.
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
        // Missing values and nested objects or arrays print nothing.
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
 * Returns ``null`` for a string that is not a number format. Without a
 * placeholder, printf would print the same text for every value.
 */
function buildValueFormatter(format: string): TooltipValueFormatter | null {
  if (!NAMED_NUMBER_FORMATS.has(format) && !format.includes("%")) {
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
    const numericItem =
      typeof item === "string" && isNumericString(item) ? Number(item) : item
    if (typeof numericItem === "number" && Number.isFinite(numericItem)) {
      return formatNumber(numericItem, format)
    }
    return formatTooltipItem(numericItem)
  }
  return (value: unknown): string | string[] =>
    Array.isArray(value) ? value.map(formatItem) : formatItem(value)
}

/** Convert the string formatters of one tooltip config, if it has any. */
function withTooltipFormatters(tooltip: unknown, useUTC: boolean): unknown {
  if (Array.isArray(tooltip)) {
    return mapChanged(tooltip, entry => withTooltipFormatters(entry, useUTC))
  }
  if (!isPlainObject(tooltip)) {
    return tooltip
  }
  const tooltipObject = tooltip as Record<string, unknown>
  const { formatter, valueFormatter } = tooltipObject
  let result = tooltipObject

  if (typeof formatter === "string" && formatter.includes("{@")) {
    result = {
      ...result,
      formatter: buildTemplateFormatter(formatter, useUTC),
    }
  }

  if (!isNullOrUndefined(valueFormatter)) {
    const built =
      typeof valueFormatter === "string"
        ? buildValueFormatter(valueFormatter)
        : null
    if (built) {
      result = { ...result, valueFormatter: built }
    } else {
      // ECharts calls ``valueFormatter`` as a function, so leaving this in
      // place would throw on every hover. Fall back to the default formatting.
      LOG.warn(
        `Ignoring the ECharts tooltip valueFormatter ${JSON.stringify(valueFormatter)}: ` +
          'use a number format such as "dollar", "compact", or "%.2f".'
      )
      const { valueFormatter: _ignored, ...rest } = result
      result = rest
    }
  }
  return result
}

/** Map an array, returning the input array when no entry changed. */
function mapChanged(
  entries: unknown[],
  transform: (entry: unknown) => unknown
): unknown[] {
  const mapped = entries.map(transform)
  return mapped.some((entry, index) => entry !== entries[index])
    ? mapped
    : entries
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
  const tooltip = withTooltipFormatters(seriesObject.tooltip, useUTC)
  return tooltip === seriesObject.tooltip
    ? series
    : { ...seriesObject, tooltip }
}

/** Convert the top-level and series tooltip formatters of one option node. */
function withOptionNodeTooltipFormatters(
  target: EChartsOptionObject,
  useUTC: boolean
): EChartsOptionObject {
  let result = target
  if ("tooltip" in target) {
    const tooltip = withTooltipFormatters(target.tooltip, useUTC)
    if (tooltip !== target.tooltip) {
      result = { ...result, tooltip }
    }
  }
  const { series } = target
  const mappedSeries = Array.isArray(series)
    ? mapChanged(series, entry => withSeriesTooltipFormatters(entry, useUTC))
    : withSeriesTooltipFormatters(series, useUTC)
  if (mappedSeries !== series) {
    result = { ...result, series: mappedSeries }
  }
  return result
}

/** Convert an option node plus its responsive ``media[*].option`` overrides. */
function withNodeAndMediaTooltipFormatters(
  target: EChartsOptionObject,
  useUTC: boolean
): EChartsOptionObject {
  const result = withOptionNodeTooltipFormatters(target, useUTC)
  if (!Array.isArray(result.media)) {
    return result
  }
  const media = mapChanged(result.media as unknown[], entry => {
    if (!isPlainObject(entry)) {
      return entry
    }
    const mediaEntry = entry as Record<string, unknown>
    if (!isPlainObject(mediaEntry.option)) {
      return entry
    }
    const option = withOptionNodeTooltipFormatters(
      mediaEntry.option as EChartsOptionObject,
      useUTC
    )
    return option === mediaEntry.option ? entry : { ...mediaEntry, option }
  })
  return media === result.media ? result : { ...result, media }
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
  // ECharts reads ``useUTC`` from the root, or from ``baseOption`` on a
  // timeline.
  const useUTC = (baseOption?.useUTC ?? option.useUTC) === true

  let result = withNodeAndMediaTooltipFormatters(option, useUTC)
  if (baseOption) {
    const convertedBase = withNodeAndMediaTooltipFormatters(baseOption, useUTC)
    if (convertedBase !== baseOption) {
      result = { ...result, baseOption: convertedBase }
    }
  }
  if (Array.isArray(result.options)) {
    const options = mapChanged(result.options as unknown[], tick =>
      isPlainObject(tick)
        ? withNodeAndMediaTooltipFormatters(
            tick as EChartsOptionObject,
            useUTC
          )
        : tick
    )
    if (options !== result.options) {
      result = { ...result, options }
    }
  }
  return result
}
