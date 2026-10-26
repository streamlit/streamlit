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

/**
 * Turns the Arrow datasets that `st.echarts_chart` sends next to its JSON
 * option back into ECharts `dataset.source` rows.
 *
 * Python replaces each dataframe-like `dataset.source` with
 * `{"name": "<content hash>"}` and ships the frame as Arrow IPC on
 * `EChartsChart.datasets`. ECharts does not understand that placeholder, so
 * every one of them must be replaced before `setOption`.
 */

import {
  DataType as ArrowDataType,
  Field,
  RecordBatchReader,
  type Schema,
} from "apache-arrow"
import { isPlainObject } from "lodash-es"

import type { ArrowNamedDataSet } from "@streamlit/protobuf"

import {
  convertDurationToMilliseconds,
  convertTimeToDate,
  format,
} from "~lib/dataframes/arrowFormatUtils"
import {
  type ArrowType,
  type DataType,
  getTimezone,
  isBytesType,
  isCategoricalType,
  isDatetimeType,
  isDateType,
  isDecimalType,
  isDurationType,
  isEmptyType,
  isFloatType,
  isIntervalType,
  isListType,
  isObjectType,
  isPeriodType,
  isTimeType,
} from "~lib/dataframes/arrowTypeUtils"
import { Quiver } from "~lib/dataframes/Quiver"
import { ensureError } from "~lib/util/ErrorHandling"
import { isNullOrUndefined } from "~lib/util/utils"

import type { EChartsOptionObject } from "./CustomTheme"

/** A JSON-like value that ECharts can read from a `dataset.source` row. */
type EChartsSourceValue =
  | null
  | boolean
  | number
  | string
  | EChartsSourceValue[]

/** One `dataset.source` row, keyed by Arrow field name. */
type EChartsSourceRow = Record<string, EChartsSourceValue>

/** Converts one decoded Arrow cell of a known column type. */
type CellConverter = (content: DataType) => EChartsSourceValue

/** A parsed dataset and its rows, cached by name while hydrating one option. */
interface HydratedDataset {
  quiver: Quiver
  rows: EChartsSourceRow[]
}

/**
 * The largest absolute epoch-millisecond value a `Date` can represent.
 * Larger values would make `toISOString` throw a `RangeError`.
 */
const MAX_DATE_MS = 8.64e15

/** Returns finite numbers as-is and maps `NaN` / `±Infinity` to `null`. */
function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null
}

/**
 * Reads a decoded date/datetime cell as epoch milliseconds. Arrow JS already
 * converts these to milliseconds regardless of the column unit. Returns `null`
 * for values a `Date` cannot represent.
 */
function toEpochMs(content: DataType): number | null {
  const ms = content instanceof Date ? content.valueOf() : Number(content)
  return Number.isFinite(ms) && Math.abs(ms) <= MAX_DATE_MS ? ms : null
}

/**
 * Fallback for cells without a more specific mapping: plain JSON primitives
 * pass through, bigints become numbers, and any other Arrow object is
 * formatted to the string `st.dataframe` shows so it cannot reach ECharts.
 */
function getFallbackConverter(type: ArrowType): CellConverter {
  return content => {
    if (typeof content === "bigint") {
      return Number(content)
    }
    if (typeof content === "number") {
      return finiteOrNull(content)
    }
    if (typeof content === "string" || typeof content === "boolean") {
      return content
    }
    return format(content, type)
  }
}

/**
 * Converter for the values of a dictionary (categorical) column, classified by
 * the dictionary value type. A `Date` or `StructRow` label would otherwise slip
 * through as an Arrow object.
 */
function getCategoricalConverter(type: ArrowType): CellConverter {
  const field = type.arrowField
  if (!ArrowDataType.isDictionary(field.type)) {
    return getFallbackConverter(type)
  }
  // Copy the field metadata so extension tags (for example
  // `pandas.interval` on `pd.cut` categories) survive. The pandas type is
  // dropped because it still says "categorical", which would recurse forever.
  const valueField = new Field(
    field.name,
    field.type.dictionary,
    field.nullable,
    field.metadata
  )
  return getCellConverter({
    ...type,
    arrowField: valueField,
    pandasType: undefined,
  })
}

/** Converter for list cells: plain JS arrays with converted children. */
function getListConverter(type: ArrowType): CellConverter {
  const fieldType: unknown = type.arrowField.type
  const childField =
    ArrowDataType.isList(fieldType) || ArrowDataType.isFixedSizeList(fieldType)
      ? fieldType.children[0]
      : undefined
  const convertChild = childField
    ? getCellConverter({
        ...type,
        arrowField: childField,
        pandasType: undefined,
      })
    : getFallbackConverter(type)

  return content => {
    const candidate = content as { length?: unknown; get?: unknown }
    if (
      typeof candidate.length !== "number" ||
      typeof candidate.get !== "function"
    ) {
      return format(content, type)
    }
    const vector = content as unknown as {
      length: number
      get: (index: number) => DataType
    }
    // `get` keeps null slots as null. `toArray()` would not: for primitive
    // children it returns the raw values buffer and ignores the validity
    // bitmap, so nulls would become 0.
    return Array.from({ length: vector.length }, (_, index) =>
      convertChild(vector.get(index))
    )
  }
}

/**
 * Picks the conversion for non-null cells of one column. The classification
 * runs once per column; the returned function runs once per cell.
 *
 * Period, time, duration, and decimal columns are checked before the generic
 * fallback because their raw Arrow values (bigint ordinals, unit counts,
 * `Uint32Array`-like decimals) are not meaningful as plain numbers.
 */
function getNonNullCellConverter(type: ArrowType): CellConverter {
  if (isEmptyType(type)) {
    return () => null
  }
  if (isCategoricalType(type)) {
    return getCategoricalConverter(type)
  }

  const field = type.arrowField
  if (isFloatType(type)) {
    return content =>
      typeof content === "number"
        ? finiteOrNull(content)
        : format(content, type)
  }
  if (isDecimalType(type)) {
    // Arrow JS cannot apply the decimal scale, so reuse the dataframe's
    // decimal formatting and parse the result back into a number.
    return content => finiteOrNull(Number(format(content, type)))
  }
  if (isTimeType(type)) {
    // Return the `HH:mm:ss` text `st.dataframe` shows (with milliseconds when
    // set). Epoch milliseconds on 1970-01-01 would shift into the browser
    // timezone on a time axis and are unreadable on a category axis.
    return content => {
      if (typeof content !== "number" && typeof content !== "bigint") {
        return format(content, type)
      }
      const time = convertTimeToDate(content, field)
        .toISOString()
        .slice(11, 23)
      return time.endsWith(".000") ? time.slice(0, 8) : time
    }
  }
  if (isDateType(type)) {
    return content => {
      const ms = toEpochMs(content)
      if (ms === null) {
        return null
      }
      const iso = new Date(ms).toISOString()
      // `YYYY-MM-DD` without a time or timezone, like `st.dataframe` shows.
      return iso.slice(0, iso.indexOf("T"))
    }
  }
  if (isDatetimeType(type)) {
    // ECharts reads a timezone-less ISO string as local time, so naive values
    // keep their wall-clock time. Timezone-aware values are absolute instants
    // and keep the trailing `Z`.
    const isTimezoneAware = getTimezone(type) !== undefined
    return content => {
      const ms = toEpochMs(content)
      if (ms === null) {
        return null
      }
      const iso = new Date(ms).toISOString()
      return isTimezoneAware ? iso : iso.slice(0, -1)
    }
  }
  if (isDurationType(type)) {
    return content =>
      typeof content === "number" || typeof content === "bigint"
        ? convertDurationToMilliseconds(content, field)
        : format(content, type)
  }
  if (isListType(type)) {
    return getListConverter(type)
  }
  if (
    isPeriodType(type) ||
    isIntervalType(type) ||
    isObjectType(type) ||
    isBytesType(type)
  ) {
    // Not plottable as numbers or dates: use the label `st.dataframe` shows.
    return content => format(content, type)
  }
  return getFallbackConverter(type)
}

/** Picks the conversion for every cell (including nulls) of one column. */
function getCellConverter(type: ArrowType): CellConverter {
  const convert = getNonNullCellConverter(type)
  return content => (isNullOrUndefined(content) ? null : convert(content))
}

/**
 * Converts the data columns of a Quiver into ECharts `dataset.source` rows.
 *
 * Index columns are never emitted, matching how Python sends dataframes
 * without their index. Row keys are the Arrow field names, which are the same
 * strings Python puts in `dataset.dimensions`.
 *
 * @param quiver The parsed Arrow table.
 * @returns One plain object of JSON-like values per data row.
 */
export function quiverToEChartsRows(quiver: Quiver): EChartsSourceRow[] {
  const { numIndexColumns, numDataRows, numDataColumns } = quiver.dimensions
  const columns = Array.from({ length: numDataColumns }, (_, index) => {
    // Column types list the index columns first.
    const type = quiver.columnTypes[numIndexColumns + index]
    const key = type.arrowField.name
    return {
      key,
      // Assigning `row.__proto__` would replace the row's prototype instead
      // of adding a key, so that column is defined as an own property.
      isProtoKey: key === "__proto__",
      read: quiver.getDataColumnReader(index),
      convert: getCellConverter(type),
    }
  })

  const rows: EChartsSourceRow[] = []
  for (let rowIndex = 0; rowIndex < numDataRows; rowIndex++) {
    const row: EChartsSourceRow = {}
    for (const { key, isProtoKey, read, convert } of columns) {
      const value = convert(read(rowIndex))
      if (isProtoKey) {
        Object.defineProperty(row, key, {
          value,
          enumerable: true,
          writable: true,
          configurable: true,
        })
      } else {
        row[key] = value
      }
    }
    rows.push(row)
  }
  return rows
}

/** Parses the Arrow bytes of a dataset that a placeholder points to. */
function parseDataset(dataset: ArrowNamedDataSet.$Properties): Quiver {
  const bytes = dataset.data?.data
  if (isNullOrUndefined(bytes) || bytes.length === 0) {
    throw new Error("The data for an ECharts dataset.source is missing.")
  }
  try {
    // Arrow JS reads bytes without a schema message as an empty table instead
    // of throwing, so check for the schema first.
    const reader = RecordBatchReader.from(bytes).open()
    if ((reader.schema as Schema | undefined) === undefined) {
      throw new Error("The Arrow stream has no schema.")
    }
    return new Quiver({ data: bytes })
  } catch (error) {
    throw new Error(
      `The data for an ECharts dataset.source could not be read: ${
        ensureError(error).message
      }`,
      { cause: error }
    )
  }
}

/** Returns the `media[*].option` overrides of an option. */
function getMediaOptions(option: EChartsOptionObject): EChartsOptionObject[] {
  if (!Array.isArray(option.media)) {
    return []
  }
  const mediaOptions: EChartsOptionObject[] = []
  for (const entry of option.media as unknown[]) {
    const mediaOption = isPlainObject(entry)
      ? (entry as EChartsOptionObject).option
      : undefined
    if (isPlainObject(mediaOption)) {
      mediaOptions.push(mediaOption as EChartsOptionObject)
    }
  }
  return mediaOptions
}

/**
 * Returns the option plus its timeline and media variants (the same set as
 * the Python `_iter_option_variants` walker). The order puts the chart that
 * renders by default first: the option, the `baseOption`, each `options[i]`
 * timeline tick, and then all `media[*].option` overrides.
 */
function getOptionVariants(
  option: EChartsOptionObject
): EChartsOptionObject[] {
  const variants = [option]
  const { baseOption } = option
  if (isPlainObject(baseOption)) {
    variants.push(baseOption as EChartsOptionObject)
  }
  if (Array.isArray(option.options)) {
    for (const entry of option.options as unknown[]) {
      if (isPlainObject(entry)) {
        variants.push(entry as EChartsOptionObject)
      }
    }
  }
  return [...variants, ...variants.flatMap(getMediaOptions)]
}

/**
 * Returns the name of a `source` shaped like a dataset placeholder: an object
 * with exactly one key, `name`, holding a string. Returns `null` otherwise.
 */
function getPlaceholderName(source: unknown): string | null {
  if (!isPlainObject(source)) {
    return null
  }
  const keys = Object.keys(source as object)
  if (keys.length !== 1 || keys[0] !== "name") {
    return null
  }
  const { name } = source as { name: unknown }
  return typeof name === "string" ? name : null
}

/**
 * Replaces the `dataset.source` placeholders of a freshly parsed option with
 * rows from the matching Arrow datasets.
 *
 * The option is mutated in place, so pass an object nobody else holds (for
 * example, the result of `JSON.parse`). Each dataset is parsed once, and
 * placeholders that share a name share one rows array.
 *
 * @param option The parsed ECharts option.
 * @param datasets The Arrow datasets sent with the option.
 * @returns The parsed dataset for the data viewer: the first one the option
 * uses, preferring the chart that renders by default over timeline ticks and
 * `media` overrides. `null` when the option uses none.
 * @throws When a placeholder points to a dataset whose bytes are missing or
 * cannot be read, so the chart never renders the placeholder as a row.
 */
export function hydrateArrowDatasetSources(
  option: EChartsOptionObject,
  datasets: readonly ArrowNamedDataSet.$Properties[] | null | undefined
): Quiver | null {
  if (isNullOrUndefined(datasets) || datasets.length === 0) {
    return null
  }

  const datasetsByName = new Map<string, ArrowNamedDataSet.$Properties>()
  for (const dataset of datasets) {
    const { name } = dataset
    if (typeof name === "string" && name !== "" && !datasetsByName.has(name)) {
      datasetsByName.set(name, dataset)
    }
  }

  const hydratedByName = new Map<string, HydratedDataset>()
  /** Parses a sent dataset on first use; `undefined` if none has `name`. */
  const hydrate = (name: string): HydratedDataset | undefined => {
    const cached = hydratedByName.get(name)
    if (cached !== undefined) {
      return cached
    }
    const dataset = datasetsByName.get(name)
    if (dataset === undefined) {
      return undefined
    }
    const quiver = parseDataset(dataset)
    const entry = { quiver, rows: quiverToEChartsRows(quiver) }
    hydratedByName.set(name, entry)
    return entry
  }

  let dataViewData: Quiver | null = null
  for (const variant of getOptionVariants(option)) {
    const { dataset } = variant
    const entries: unknown[] = Array.isArray(dataset) ? dataset : [dataset]
    for (const entry of entries) {
      if (!isPlainObject(entry)) {
        continue
      }
      const datasetOption = entry as EChartsOptionObject
      const name = getPlaceholderName(datasetOption.source)
      // Only names that were sent count. A user-authored one-row source such
      // as `{"name": "Matcha"}` stays untouched.
      const hydrated = name === null ? undefined : hydrate(name)
      if (hydrated !== undefined) {
        datasetOption.source = hydrated.rows
        dataViewData ??= hydrated.quiver
      }
    }
  }
  return dataViewData
}
