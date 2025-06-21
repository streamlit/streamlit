/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
 * Utility functions to format cell data from an arrow table to
 * a human-readable format.
 */

import { Field, Struct, StructRow, TimeUnit, util } from "apache-arrow"
import trimEnd from "lodash/trimEnd"
import { getLogger } from "loglevel"
import moment from "moment-timezone"
import numbro from "numbro"

import { isNullOrUndefined, notNullOrUndefined } from "~lib/util/utils"

import {
  ArrowType,
  DataFrameCellType,
  DataType,
  isDatetimeType,
  isDateType,
  isDecimalType,
  isDurationType,
  isFloatType,
  isIntervalType,
  isListType,
  isObjectType,
  isPeriodType,
  isStringType,
  isTimeType,
} from "./arrowTypeUtils"

/**
 * The frequency strings defined in pandas.
 * See: https://pandas.pydata.org/docs/user_guide/timeseries.html#period-aliases
 * Not supported: "N" (nanoseconds), "U" & "us" (microseconds), and "B" (business days).
 * Reason is that these types are not supported by moment.js, but also they are not
 * very commonly used in practice.
 */
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

type PandasPeriodFrequency =
  | SupportedPandasOffsetType
  | `${SupportedPandasOffsetType}-${string}`

const LOG = getLogger("arrowFormatUtils")
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

/**
 * Formatters for the different pandas period frequencies.
 *
 * This is a mapping from the frequency strings to the function that formats the period.
 */
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

/** Pandas interval extension data type. */
interface PandasInterval {
  left: number
  right: number
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
function convertTimestampToSeconds(
  timestamp: number | bigint,
  unit: TimeUnit
): number {
  let unitAdjustment

  if (unit === TimeUnit.MILLISECOND) {
    // Milliseconds
    unitAdjustment = 1000
  } else if (unit === TimeUnit.MICROSECOND) {
    // Microseconds
    unitAdjustment = 1000 * 1000
  } else if (unit === TimeUnit.NANOSECOND) {
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
 * Converts a UTC time value (timestamp) to a date object.
 *
 * @param timestamp The timestamp to convert.
 * @param field The field containing the unit information.
 * @returns The date object in UTC timezone.
 */
export function convertTimeToDate(
  timestamp: number | bigint,
  field?: Field
): Date {
  // Time values from arrow are not converted to a shared unit and
  // just return the raw arrow value. Therefore, we need to adjust
  // the value to seconds based on the unit information in the field.
  // https://github.com/apache/arrow/blob/9e08c57c0986531879aadf7942998d26a94a5d1b/js/src/visitor/get.ts#L193C7-L209
  const timeInSeconds = convertTimestampToSeconds(
    timestamp,
    // The default is SECOND because that is the default unit for time values in pandas.
    // Though we believe that actually always a unit is populated by arrow.
    field?.type?.unit ?? TimeUnit.SECOND
  )
  return moment.unix(timeInSeconds).utc().toDate()
}

/**
 * Formats a time value based on the unit information in the field.
 *
 * @param timestamp The time value to format.
 * @param field The field containing the unit information.
 * @returns The formatted time value.
 */
function formatTime(timestamp: number | bigint, field?: Field): string {
  const date = convertTimeToDate(timestamp, field)
  return moment(date)
    .utc()
    .format(date.getMilliseconds() === 0 ? "HH:mm:ss" : "HH:mm:ss.SSS")
}

function formatDate(date: number | Date): string {
  // Date values from arrow are already converted to a date object
  // or a timestamp in milliseconds even if the field unit belonging to the
  // passed date might have indicated a different unit.
  // That's why we don't need the field information here (aka its not passed to the function)
  // and we don't need to apply any unit conversion.
  // https://github.com/apache/arrow/blob/9e08c57c0986531879aadf7942998d26a94a5d1b/js/src/visitor/get.ts#L167-L171

  const formatPattern = "YYYY-MM-DD"

  if (
    !(
      date instanceof Date ||
      (typeof date === "number" && Number.isFinite(date))
    )
  ) {
    LOG.warn(`Unsupported date value: ${date}`)
    return String(date)
  }

  return moment.utc(date).format(formatPattern)
}

/**
 * Format datetime value from Arrow to string.
 */
function formatDatetime(date: number | Date, field?: Field): string {
  // Datetime values from arrow are already converted to a date object
  // or a timestamp in milliseconds even if the field unit might indicate a
  // different unit.
  // https://github.com/apache/arrow/blob/9e08c57c0986531879aadf7942998d26a94a5d1b/js/src/visitor/get.ts#L174-L190

  if (
    !(
      date instanceof Date ||
      (typeof date === "number" && Number.isFinite(date))
    )
  ) {
    LOG.warn(`Unsupported datetime value: ${date}`)
    return String(date)
  }

  let datetime = moment.utc(date)

  const timezone = field?.type?.timezone
  if (timezone) {
    if (moment.tz.zone(timezone)) {
      // If timezone is a valid timezone name (e.g., "America/New_York")
      datetime = datetime.tz(timezone)
    } else {
      // If timezone is a UTC offset (e.g., "+0500")
      datetime = datetime.utcOffset(timezone)
    }

    return datetime.format("YYYY-MM-DD HH:mm:ssZ")
  }
  // Return the timestamp without timezone information
  return datetime.format("YYYY-MM-DD HH:mm:ss")
}

/**
 * Formats a duration value based on the unit information in the field.
 *
 * @param duration The duration value to format.
 * @param field The field containing the unit information.
 * @returns The formatted duration value.
 */
function formatDuration(duration: number | bigint, field?: Field): string {
  // unit: 0 is seconds, 1 is milliseconds, 2 is microseconds, 3 is nanoseconds.
  return moment
    .duration(
      convertTimestampToSeconds(
        duration,
        // The default is NANOSECOND because that is the default unit for duration in pandas.
        // Though we believe that actually always a unit is populated by arrow.
        field?.type?.unit ?? TimeUnit.NANOSECOND
      ),
      "seconds"
    )
    .humanize()
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
function formatDecimal(value: Uint32Array, field?: Field): string {
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

export function formatPeriodFromFreq(
  duration: number | bigint,
  freq: PandasPeriodFrequency
): string {
  const [freqName, freqParam] = freq.split("-", 2)
  const momentConverter =
    PERIOD_TYPE_FORMATTERS[freqName as SupportedPandasOffsetType]
  if (!momentConverter) {
    LOG.warn(`Unsupported period frequency: ${freq}`)
    return String(duration)
  }
  const durationNumber = Number(duration)
  if (!Number.isSafeInteger(durationNumber)) {
    LOG.warn(
      `Unsupported value: ${duration}. Supported values: [${Number.MIN_SAFE_INTEGER}-${Number.MAX_SAFE_INTEGER}]`
    )
    return String(duration)
  }
  try {
    return momentConverter(durationNumber, freqParam)
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    LOG.warn(`Error while formatting period value: ${error}`)
    return String(duration)
  }
}

function formatPeriod(duration: number | bigint, field?: Field): string {
  // Serialization for pandas.Period is provided by Arrow extensions
  // https://github.com/pandas-dev/pandas/blob/70bb855cbbc75b52adcb127c84e0a35d2cd796a9/pandas/core/arrays/arrow/extension_types.py#L26
  if (isNullOrUndefined(field)) {
    LOG.warn("Field information is missing")
    return String(duration)
  }

  const extensionName = field.metadata.get("ARROW:extension:name")
  const extensionMetadata = field.metadata.get("ARROW:extension:metadata")

  if (
    isNullOrUndefined(extensionName) ||
    isNullOrUndefined(extensionMetadata)
  ) {
    LOG.warn("Arrow extension metadata is missing")
    return String(duration)
  }

  if (extensionName !== "pandas.period") {
    LOG.warn(`Unsupported extension name for period type: ${extensionName}`)
    return String(duration)
  }

  const parsedExtensionMetadata = JSON.parse(extensionMetadata)
  const { freq } = parsedExtensionMetadata
  return formatPeriodFromFreq(duration, freq)
}

/**
 * Formats nested arrays and other objects to a JSON string.
 *
 * @param object The value to format.
 * @param field The field metadata from arrow containing metadata about the column.
 * @returns The formatted JSON string.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
function formatObject(object: any, field?: Field): string {
  if (field?.type instanceof Struct) {
    // This type is used by python dictionary values

    return JSON.stringify(object, (_key, value) => {
      if (!notNullOrUndefined(value)) {
        // Workaround: Arrow JS adds all properties from all cells
        // as fields. When you convert to string, it will contain lots of fields with
        // null values. To mitigate this, we filter out null values.
        return undefined
      }
      if (typeof value === "bigint") {
        // JSON.stringify fails to serialize bigint values, therefore we have to
        // handle them manually.
        // TODO(lukasmasuch): Would it be better to serialize it to a string to
        // not lose precision?
        return Number(value)
      }
      return value
    })
  }

  // TODO(lukasmasuch): Investigate if we can unify this with the logic above.
  return JSON.stringify(object, (_key, value) =>
    typeof value === "bigint" ? Number(value) : value
  )
}

/**
 * Formats a float value to a string.
 *
 * @param num The float value to format.
 * @returns The formatted float value.
 */
function formatFloat(num: number): string {
  if (!Number.isFinite(num)) {
    return String(num)
  }

  return numbro(num).format("0,0.0000")
}

/**
 * Formats an interval value from arrow to string.
 */
function formatInterval(x: StructRow, field?: Field): string {
  // Serialization for pandas.Interval is provided by Arrow extensions
  // https://github.com/pandas-dev/pandas/blob/235d9009b571c21b353ab215e1e675b1924ae55c/
  // pandas/core/arrays/arrow/extension_types.py#L17
  const extensionName = field && field.metadata.get("ARROW:extension:name")
  if (extensionName && extensionName === "pandas.interval") {
    const extensionMetadata = JSON.parse(
      field.metadata.get("ARROW:extension:metadata") as string
    )
    const { subtype, closed } = extensionMetadata

    const interval = x.toJSON() as PandasInterval

    const leftBracket = closed === "both" || closed === "left" ? "[" : "("
    const rightBracket = closed === "both" || closed === "right" ? "]" : ")"

    const leftInterval = format(interval.left, {
      // Construct a arrow type for the left interval
      type: DataFrameCellType.DATA,
      pandasType: {
        pandas_type: subtype,
        numpy_type: subtype,
        field_name: "",
        name: "",
        metadata: null,
      },
      arrowField: (field.type as Struct)?.children?.[0],
    })
    const rightInterval = format(interval.right, {
      // Construct a arrow type for the right interval
      type: DataFrameCellType.DATA,
      pandasType: {
        pandas_type: subtype,
        numpy_type: subtype,
        field_name: "",
        name: "",
        metadata: null,
      },
      arrowField: (field.type as Struct)?.children?.[1],
    })

    return `${leftBracket + leftInterval}, ${rightInterval + rightBracket}`
  }
  return String(x)
}

/** Takes the cell data and type metadata from arrow and nicely formats it into a human-readable string.
 *
 * This is mostly a best-effort logic and should not throw exceptions in case of unknown values
 * or other issues. This makes it easier to use this method by consumers (table, dataframe) since
 * they would have to somehow deal with the exception on a cell level to not crash the full table or app.
 *
 * @param x The cell value.
 * @param pandasType The type metadata based on the pandas metadata embedded in the arrow table.
 * @param field The field metadata from arrow containing metadata about the column.
 * @returns The formatted cell value.
 */
export function format(x: DataType, type: ArrowType): string {
  try {
    if (isNullOrUndefined(x)) {
      return ""
    }

    if (isStringType(type)) {
      return String(x)
    }

    const isDate = x instanceof Date || Number.isFinite(x)
    if (isDate && isDateType(type)) {
      return formatDate(x as Date | number)
    }

    if (typeof x === "bigint" && isTimeType(type)) {
      return formatTime(Number(x), type.arrowField)
    }

    if (isDate && isDatetimeType(type)) {
      return formatDatetime(x as Date | number, type.arrowField)
    }

    if (isPeriodType(type)) {
      return formatPeriod(x as bigint, type.arrowField)
    }

    if (isIntervalType(type)) {
      return formatInterval(x as StructRow, type.arrowField)
    }

    if (isDurationType(type)) {
      return formatDuration(x as number | bigint, type.arrowField)
    }

    if (isDecimalType(type)) {
      return formatDecimal(x as Uint32Array, type.arrowField)
    }

    if (isFloatType(type) && Number.isFinite(x)) {
      return formatFloat(x as number)
    }

    if (isObjectType(type) || isListType(type)) {
      return formatObject(x, type.arrowField)
    }
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    LOG.warn(`Unexpected error occurred while formatting value: ${error}`)
    // Fallback to string conversion if any error occurs.
    // It's not expected that this happens, but we want to guard against
    // any unexpected errors.
    return String(x)
  }

  return String(x)
}
