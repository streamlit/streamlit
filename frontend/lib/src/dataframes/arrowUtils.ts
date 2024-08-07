/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
 * Adjusts a time value to seconds based on the unit information in the field.
 *
 * The unit numbers are specified here:
 * https://github.com/apache/arrow/blob/3ab246f374c17a216d86edcfff7ff416b3cff803/js/src/enum.ts#L95
 */

import { Field, util, Vector } from "apache-arrow"
import trimEnd from "lodash/trimEnd"
import moment from "moment-timezone"
import numbro from "numbro"

import { logWarning } from "@streamlit/lib/src/util/log"
import { isNullOrUndefined } from "@streamlit/lib/src/util/utils"

// The frequency strings defined in pandas.
// See: https://pandas.pydata.org/docs/user_guide/timeseries.html#period-aliases
// Not supported: "N" (nanoseconds), "U" & "us" (microseconds), and "B" (business days).
// Reason is that these types are not supported by moment.js, but also they are not
// very commonly used in practice.
type SupportedPandasOffsetType =
  // yearly frequency:
  | "A" // deprecated alias
  | "Y"
  // quarterly frequency:
  | "Q"
  // monthly frequency:
  | "M"
  // weekly frequency:
  | "W"
  // calendar day frequency:
  | "D"
  // hourly frequency:
  | "H" // deprecated alias
  | "h"
  // minutely frequency
  | "T" // deprecated alias
  | "min"
  // secondly frequency:
  | "S" // deprecated alias
  | "s"
  // milliseconds frequency:
  | "L" // deprecated alias
  | "ms"

type PeriodFrequency =
  | SupportedPandasOffsetType
  | `${SupportedPandasOffsetType}-${string}`

const WEEKDAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
const formatMs = (duration: number): string =>
  moment("19700101", "YYYYMMDD")
    .add(duration, "ms")
    .format("YYYY-MM-DD HH:mm:ss.SSS")

const formatSec = (duration: number): string =>
  moment("19700101", "YYYYMMDD")
    .add(duration, "s")
    .format("YYYY-MM-DD HH:mm:ss")

const formatMin = (duration: number): string =>
  moment("19700101", "YYYYMMDD").add(duration, "m").format("YYYY-MM-DD HH:mm")

const formatHours = (duration: number): string =>
  moment("19700101", "YYYYMMDD").add(duration, "h").format("YYYY-MM-DD HH:mm")

const formatDay = (duration: number): string =>
  moment("19700101", "YYYYMMDD").add(duration, "d").format("YYYY-MM-DD")

const formatMonth = (duration: number): string =>
  moment("19700101", "YYYYMMDD").add(duration, "M").format("YYYY-MM")

const formatYear = (duration: number): string =>
  moment("19700101", "YYYYMMDD").add(duration, "y").format("YYYY")

const formatWeeks = (duration: number, freqParam?: string): string => {
  if (!freqParam) {
    throw new Error('Frequency "W" requires parameter')
  }
  const dayIndex = WEEKDAY_SHORT.indexOf(freqParam)
  if (dayIndex < 0) {
    throw new Error(
      `Invalid value: ${freqParam}. Supported values: ${JSON.stringify(
        WEEKDAY_SHORT
      )}`
    )
  }
  const startDate = moment("19700101", "YYYYMMDD")
    .add(duration, "w")
    .day(dayIndex - 6)
    .format("YYYY-MM-DD")
  const endDate = moment("19700101", "YYYYMMDD")
    .add(duration, "w")
    .day(dayIndex)
    .format("YYYY-MM-DD")

  return `${startDate}/${endDate}`
}

const formatQuarter = (duration: number): string =>
  moment("19700101", "YYYYMMDD")
    .add(duration, "Q")
    .endOf("quarter")
    .format("YYYY[Q]Q")

const PERIOD_TYPE_FORMATTERS: Record<
  SupportedPandasOffsetType,
  (duration: number, freqParam?: string) => string
> = {
  L: formatMs,
  ms: formatMs,
  S: formatSec,
  s: formatSec,
  T: formatMin,
  min: formatMin,
  H: formatHours,
  h: formatHours,
  D: formatDay,
  M: formatMonth,
  W: formatWeeks,
  Q: formatQuarter,
  Y: formatYear,
  A: formatYear,
}

/**
 * Adjusts a time value to seconds based on the unit information in the field.
 *
 * The unit numbers are specified here:
 * https://github.com/apache/arrow/blob/3ab246f374c17a216d86edcfff7ff416b3cff803/js/src/enum.ts#L95
 *
 * @param timestamp The timestamp to convert.
 * @param unit The unit of the timestamp. 0 is seconds, 1 is milliseconds, 2 is microseconds, 3 is nanoseconds.
 * @returns The timestamp in seconds.
 */
export function convertTimestampToSeconds(
  timestamp: number | bigint,
  unit: number
): number {
  let unitAdjustment

  if (unit === 1) {
    // Milliseconds
    unitAdjustment = 1000
  } else if (unit === 2) {
    // Microseconds
    unitAdjustment = 1000 * 1000
  } else if (unit === 3) {
    // Nanoseconds
    unitAdjustment = 1000 * 1000 * 1000
  } else {
    // Interpret it as seconds as a fallback
    return Number(timestamp)
  }

  // Do the calculation based on bigints, if the value
  // is a bigint and not safe for usage as number.
  // This might lose some precision since it doesn't keep
  // fractional parts.
  if (
    typeof timestamp === "bigint" &&
    !Number.isSafeInteger(Number(timestamp))
  ) {
    return Number(timestamp / BigInt(unitAdjustment))
  }

  return Number(timestamp) / unitAdjustment
}

/**
 * Formats a time value based on the unit information in the field.
 *
 * @param timestamp The time value to format.
 * @param field The field containing the unit information.
 * @returns The formatted time value.
 */
export function formatTime(timestamp: number | bigint, field?: Field): string {
  const timeInSeconds = convertTimestampToSeconds(
    timestamp,
    field?.type?.unit ?? 0
  )
  return moment
    .unix(timeInSeconds)
    .utc()
    .format(timeInSeconds % 1 === 0 ? "HH:mm:ss" : "HH:mm:ss.SSS")
}

export function formatDate(date: number | Date, field?: Field): string {
  const formatPattern = "YYYY-MM-DD"

  if (date instanceof Date) {
    return moment.utc(date).format(formatPattern)
  } else if (typeof date === "number" && Number.isFinite(date)) {
    // TODO: what is the best default?
    const unit = field?.type?.unit ?? 1
    // 0 is DAY, 1 is MILLISECOND
    // https://github.com/apache/arrow/blob/3ab246f374c17a216d86edcfff7ff416b3cff803/js/src/enum.ts#L87
    // When unit === 0, convert days to milliseconds:

    const timestamp = unit === 0 ? date * 86400000 : date
    return moment.utc(timestamp).format(formatPattern)
  }

  logWarning(`Unsupported date type: ${date}`)
  return String(date)
}

/**
 * Formats a duration value based on the unit information in the field.
 *
 * @param duration The duration value to format.
 * @param field The field containing the unit information.
 * @returns The formatted duration value.
 */
export function formatDuration(
  duration: number | bigint,
  field?: Field
): string {
  // unit: 0 is seconds, 1 is milliseconds, 2 is microseconds, 3 is nanoseconds.
  return moment
    .duration(
      convertTimestampToSeconds(duration, field?.type?.unit ?? 3),
      "seconds"
    )
    .humanize()
}

export function formatPeriod(
  duration: number | bigint,
  freq: PeriodFrequency
): string {
  const [freqName, freqParam] = freq.split("-", 2)
  const momentConverter =
    PERIOD_TYPE_FORMATTERS[freqName as SupportedPandasOffsetType]
  if (!momentConverter) {
    logWarning(`Unsupported period frequency: ${freq}`)
    return String(duration)
  }
  const durationNumber = Number(duration)
  if (!Number.isSafeInteger(durationNumber)) {
    logWarning(
      `Unsupported value: ${duration}. Supported values: [${Number.MIN_SAFE_INTEGER}-${Number.MAX_SAFE_INTEGER}]`
    )
    return String(duration)
  }
  return momentConverter(durationNumber, freqParam)
}

export function formatPeriodField(
  duration: number | bigint,
  field?: Field
): string {
  // Serialization for pandas.Period is provided by Arrow extensions
  // https://github.com/pandas-dev/pandas/blob/70bb855cbbc75b52adcb127c84e0a35d2cd796a9/pandas/core/arrays/arrow/extension_types.py#L26
  if (isNullOrUndefined(field)) {
    logWarning("Field information is missing")
    return String(duration)
  }

  const extensionName = field.metadata.get("ARROW:extension:name")
  const extensionMetadata = field.metadata.get("ARROW:extension:metadata")

  if (
    isNullOrUndefined(extensionName) ||
    isNullOrUndefined(extensionMetadata)
  ) {
    logWarning("Arrow extension metadata is missing")
    return String(duration)
  }

  if (extensionName !== "pandas.period") {
    logWarning(`Unsupported extension name for period type: ${extensionName}`)
    return String(duration)
  }

  const parsedExtensionMetadata = JSON.parse(extensionMetadata as string)
  const { freq } = parsedExtensionMetadata
  return formatPeriod(duration, freq)
}

/**
 * Formats a float value to a string.
 *
 * @param num The float value to format.
 * @returns The formatted float value.
 */
export function formatFloat(num: number): string {
  if (!Number.isFinite(num)) {
    return String(num)
  }

  return numbro(num).format("0,0.0000")
}

/**
 * Formats a decimal value with a given scale to a string.
 *
 * This code is partly based on: https://github.com/apache/arrow/issues/35745
 *
 * TODO: This is only a temporary workaround until ArrowJS can format decimals correctly.
 * This is tracked here:
 * https://github.com/apache/arrow/issues/37920
 * https://github.com/apache/arrow/issues/28804
 * https://github.com/apache/arrow/issues/35745
 */
export function formatDecimal(value: Uint32Array, field?: Field): string {
  const scale = field?.type?.scale || 0

  // Format Uint32Array to a numerical string and pad it with zeros
  // So that it is exactly the length of the scale.
  let numString = util.bigNumToString(new util.BN(value)).padStart(scale, "0")

  // ArrowJS 13 correctly adds a minus sign for negative numbers.
  // but it doesn't handle th fractional part yet. So we can just return
  // the value if scale === 0, but we need to do some additional processing
  // for the fractional part if scale > 0.

  if (scale === 0) {
    return numString
  }

  let sign = ""
  if (numString.startsWith("-")) {
    // Check if number is negative, and if so remember the sign and remove it.
    // We will add it back later.
    sign = "-"
    numString = numString.slice(1)
  }
  // Extract the whole number part. If the number is < 1, it doesn't
  // have a whole number part, so we'll use "0" instead.
  // E.g for 123450 with scale 3, we'll get "123" as the whole part.
  const wholePart = numString.slice(0, -scale) || "0"
  // Extract the fractional part and remove trailing zeros.
  // E.g. for 123450 with scale 3, we'll get "45" as the fractional part.
  const decimalPart = trimEnd(numString.slice(-scale), "0") || ""
  // Combine the parts and add the sign.
  return `${sign}${wholePart}` + (decimalPart ? `.${decimalPart}` : "")
}

/**
 * Converts an Arrow vector to a list of strings.
 *
 * @param vector The Arrow vector to convert.
 * @returns The list of strings.
 */
export function convertVectorToList(vector: Vector<any>): string[] {
  const values = []

  for (let i = 0; i < vector.length; i++) {
    values.push(vector.get(i))
  }
  return values
}
