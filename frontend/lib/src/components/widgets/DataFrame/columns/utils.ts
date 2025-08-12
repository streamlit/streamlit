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

import {
  BaseGridCell,
  Theme as GlideTheme,
  GridCell,
  GridCellKind,
  GridColumn,
  LoadingCell,
  TextCell,
} from "@glideapps/glide-data-grid"
import merge from "lodash/merge"
import toString from "lodash/toString"
import moment, { Moment } from "moment"
import "moment-duration-format"
import "moment-timezone"
import numbro from "numbro"
import { sprintf } from "sprintf-js"

import { ArrowType } from "~lib/dataframes/arrowTypeUtils"
import { EmotionTheme } from "~lib/theme"
import { isNullOrUndefined, notNullOrUndefined } from "~lib/util/utils"

/**
 * Interface used for defining the properties (configuration options) of a column.
 * These options can also be used to overwrite from user-defined column config.
 */
export interface BaseColumnProps {
  /** The id of the column. */
  readonly id: string
  /** The name of the column from the original data. */
  readonly name: string
  /** The display title of the column. */
  readonly title: string
  /** The index number of the column. */
  readonly indexNumber: number
  /** The arrow data type of the column. */
  readonly arrowType: ArrowType
  /** If `True`, the column can be edited. */
  readonly isEditable: boolean
  /** If `True`, the column is hidden (will not be shown). */
  readonly isHidden: boolean
  /** If `True`, the column is a table index. */
  readonly isIndex: boolean
  /** If `True`, the column is pinned/frozen. */
  readonly isPinned: boolean
  /** If `True`, the column is a stretched. */
  readonly isStretched: boolean
  /** If `True`, a value is required before the cell or row can be submitted. */
  readonly isRequired?: boolean
  /**
   * If `True`, the content of the cell is allowed to be wrapped to fill the
   * available height of the cell.
   */
  readonly isWrappingAllowed?: boolean
  /** The initial width of the column. */
  readonly width?: number
  /** A help text that is displayed on hovering the column header. */
  readonly help?: string
  /**
   * Configuration options related to the column type.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  readonly columnTypeOptions?: Record<string, any>
  /** The content alignment of the column. */
  readonly contentAlignment?: "left" | "center" | "right"
  /** The default value of the column used when adding a new row. */
  readonly defaultValue?: string | number | boolean
  /** Theme overrides for this column. */
  readonly themeOverride?: Partial<GlideTheme>
  /** A custom icon to be displayed in the column header. */
  readonly icon?: string
  /** The group that this column belongs to. */
  readonly group?: string
}

/**
 * The interface that is implemented by any column type.
 */
export interface BaseColumn extends BaseColumnProps {
  readonly kind: string
  // Defines the sort mode that should be used for this column type:
  // default: Sorts by interpreting all values as strings.
  // smart: Detects if value is a number or a string and sorts accordingly.
  // raw: Sorts based on the actual type of the cell data value.
  readonly sortMode: "default" | "raw" | "smart"
  // An material icon identifier (":material/...") that is used
  // as type icon in the column menu.
  readonly typeIcon: string
  // Validate the input data for compatibility with the column type:
  // Either returns a boolean indicating if the data is valid or not, or
  // returns the corrected value.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-redundant-type-constituents -- TODO: Replace 'any' with a more specific type.
  validateInput?(data?: any): boolean | any
  // Get a cell with the provided data for the column type:
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  getCell(data?: any, validate?: boolean): GridCell
  // Get the raw value of the given cell:
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-redundant-type-constituents -- TODO: Replace 'any' with a more specific type.
  getCellValue(cell: GridCell): any | null
}

/**
 * A type that describes the function signature used to create a column based on
 * some column properties.
 */
export type ColumnCreator = {
  (props: BaseColumnProps, theme: EmotionTheme): BaseColumn
  readonly isEditableType: boolean
}

// See pydantic for inspiration: https://pydantic-docs.helpmanual.io/usage/types/#booleans
const BOOLEAN_TRUE_VALUES = ["true", "t", "yes", "y", "on", "1"]
const BOOLEAN_FALSE_VALUES = ["false", "f", "no", "n", "off", "0"]

/**
 * Interface used for indicating if a cell contains an error.
 */
export interface ErrorCell extends TextCell {
  readonly isError: true
  readonly errorDetails: string
}

/**
 * Returns a cell with an error message.
 *
 * @param errorMsg: A short error message or the wrong value to use as display value.
 * @param errorDetails: The full error message to show when the user
 *                     hovers on a cell.
 *
 * @return a read-only GridCell object that can be used by glide-data-grid.
 */
export function getErrorCell(errorMsg: string, errorDetails = ""): ErrorCell {
  return {
    kind: GridCellKind.Text,
    readonly: true,
    allowOverlay: true,
    data: errorMsg,
    displayData: errorMsg,
    errorDetails: errorDetails,
    isError: true,
    style: "faded",
  }
}

/**
 * Returns `true` if the given cell contains an error.
 * This can happen if the value type is not compatible with
 * the given value type.
 */
export function isErrorCell(cell: GridCell): cell is ErrorCell {
  return Object.hasOwn(cell, "isError") && (cell as ErrorCell).isError
}

interface CellWithTooltip extends BaseGridCell {
  readonly tooltip: string
}

/**
 * Returns `true` if the given cell has a tooltip
 */
export function hasTooltip(cell: BaseGridCell): cell is CellWithTooltip {
  return (
    Object.hasOwn(cell, "tooltip") && (cell as CellWithTooltip).tooltip !== ""
  )
}
/**
 * Interface used for indicating if a cell contains no value.
 */
interface MissingValueCell extends BaseGridCell {
  readonly isMissingValue: true
}

/**
 * Returns `true` if the given cell contains no value (-> missing value).
 * For example, a number cell that contains null is interpreted as a missing value.
 */
export function isMissingValueCell(
  cell: BaseGridCell
): cell is MissingValueCell {
  return (
    Object.hasOwn(cell, "isMissingValue") &&
    (cell as MissingValueCell).isMissingValue
  )
}

/**
 * Returns an empty cell.
 */
export function getEmptyCell(missingCell = false): LoadingCell {
  if (missingCell) {
    return {
      kind: GridCellKind.Loading,
      allowOverlay: false,
      isMissingValue: true,
      copyData: "",
    } as LoadingCell
  }

  return {
    kind: GridCellKind.Loading,
    allowOverlay: false,
    copyData: "",
  } as LoadingCell
}

/**
 * Returns an empty text cell.
 *
 * @param readonly: If true, returns a read-only version of the cell.
 * @param faded: If true, returns a faded version of the cell.
 *
 * @return a GridCell object that can be used by glide-data-grid.
 */
export function getTextCell(readonly: boolean, faded: boolean): TextCell {
  const style = faded ? "faded" : "normal"
  return {
    kind: GridCellKind.Text,
    data: "",
    displayData: "",
    allowOverlay: true,
    readonly,
    style,
  } as TextCell
}

/**
 * Converts from our BaseColumn format to the glide-data-grid compatible GridColumn.
 */
export function toGlideColumn(column: BaseColumn): GridColumn {
  return {
    id: column.id,
    title: column.title,
    hasMenu: false,
    menuIcon: "dots",
    themeOverride: column.themeOverride,
    icon: column.icon,
    group: column.group,
    // Only grow non pinned columns, it looks a bit broken otherwise:
    ...(column.isStretched &&
      !column.isPinned && {
        grow: 1,
      }),
    ...(column.width && {
      width: column.width,
    }),
  } as GridColumn
}

/**
 * Merges the default column parameters with the user-defined column parameters.
 *
 * @param defaultParams - The default column parameters.
 * @param userParams - The user-defined column parameters.
 *
 * @returns The merged column parameters.
 */
export function mergeColumnParameters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  defaultParams: Record<string, any> | undefined | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  userParams: Record<string, any> | undefined | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
): Record<string, any> {
  if (isNullOrUndefined(defaultParams)) {
    return userParams || {}
  }

  if (isNullOrUndefined(userParams)) {
    return defaultParams || {}
  }

  return merge(defaultParams, userParams)
}

/**
 * Converts the given value of unknown type to an array without
 * the risks of any exceptions.
 *
 * @param data - The value to convert to an array.
 *
 * @returns The converted array or an empty array if the value cannot be interpreted as an array.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
export function toSafeArray(data: any): any[] {
  if (isNullOrUndefined(data)) {
    return []
  }

  if (typeof data === "number" || typeof data === "boolean") {
    // Single number or boolean
    return [data]
  }

  if (typeof data === "string") {
    if (data === "") {
      // Empty string
      return []
    }

    // Try to parse string to an array
    if (data.trim().startsWith("[") && data.trim().endsWith("]")) {
      // Support for JSON arrays: ["foo", 1, null, "test"]
      try {
        return JSON.parse(data)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        return [data]
      }
    } else {
      // Support for comma-separated values: "foo,1,,test"
      return data.split(",")
    }
  }

  try {
    const parsedData = JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? Number(value) : value
      )
    )
    if (!Array.isArray(parsedData)) {
      return [toSafeString(parsedData)]
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    return parsedData.map((value: any) =>
      ["string", "number", "boolean", "null"].includes(typeof value)
        ? value
        : toSafeString(value)
    )
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return [toSafeString(data)]
  }
}

/**
 * Efficient check to determine if a string is looks like a JSON string.
 *
 * This is only a heuristic check and does not guarantee that the string is a
 * valid JSON string.
 *
 * @param data - The data to check.
 *
 * @returns `true` if the data might be a JSON string.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
export function isMaybeJson(data: any): boolean {
  return data && data.startsWith("{") && data.endsWith("}")
}

/**
 * Converts the given value of unknown type to a string without
 * the risks of any exceptions.
 *
 * @param data - The value to convert to a string.
 *
 * @return The converted string or a string showing the type of the object as fallback.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
export function toSafeString(data: any): string {
  try {
    try {
      return toString(data)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? Number(value) : value
      )
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // This is most likely an object that cannot be converted to a string
    // console.log converts this to `[object Object]` which we are doing here as well:
    return `[${typeof data}]`
  }
}

/**
 * Converts the given value of unknown type to a boolean without
 * the risks of any exceptions.
 *
 * @param value - The value to convert to a boolean.
 *
 * @return The converted boolean, null if the value is empty or undefined if the
 *         value cannot be interpreted as a boolean.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
export function toSafeBoolean(value: any): boolean | null | undefined {
  if (isNullOrUndefined(value)) {
    return null
  }

  if (typeof value === "boolean") {
    return value
  }

  const cleanedValue = toSafeString(value).toLowerCase().trim()
  if (cleanedValue === "") {
    return null
  } else if (BOOLEAN_TRUE_VALUES.includes(cleanedValue)) {
    return true
  } else if (BOOLEAN_FALSE_VALUES.includes(cleanedValue)) {
    return false
  }
  // The value cannot be interpreted as boolean
  return undefined
}

/**
 * Converts the given value of unknown type to a number without
 * the risks of any exceptions.
 *
 * @param value - The value to convert to a number.
 *
 * @returns The converted number or null if the value is empty or undefined or NaN if the
 *          value cannot be interpreted as a number.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
export function toSafeNumber(value: any): number | null {
  // TODO(lukasmasuch): Should this return null as replacement for NaN?

  if (isNullOrUndefined(value)) {
    return null
  }

  if (Array.isArray(value)) {
    return NaN
  }

  if (typeof value === "string") {
    if (value.trim().length === 0) {
      // Empty string should return null
      return null
    }

    try {
      // Try to convert string to number via numbro:
      // https://numbrojs.com/old-format.html#unformat
      const unformattedValue = numbro.unformat(value.trim())
      if (notNullOrUndefined(unformattedValue)) {
        return unformattedValue
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Do nothing here
    }
  } else if (value instanceof Int32Array) {
    // int values need to be extracted this way:
    return Number(value[0])
  }

  return Number(value)
}

/**
 * Tries to convert a given value of unknown type to a JSON string without
 * the risks of any exceptions.
 *
 * @param value - The value to convert to a JSON string.
 *
 * @returns The converted JSON string or a string showing the type of the object as fallback.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
export function toJsonString(value: any): string {
  if (isNullOrUndefined(value)) {
    return ""
  }

  if (typeof value === "string") {
    // If the value is already a string, return it as-is
    return value
  }

  try {
    // Try to convert the value to a JSON string
    return JSON.stringify(value, (_key, val) =>
      // BigInt are not supported by JSON.stringify
      // so we convert them to a number as fallback
      typeof val === "bigint" ? Number(val) : val
    )
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // If the value cannot be converted to a JSON string, return the stringified value
    return toSafeString(value)
  }
}

/**
 * Determines the default mantissa to use for the given number.
 *
 * @param value - The number to determine the mantissa for.
 *
 * @returns The mantissa to use.
 */
function determineDefaultMantissa(value: number): number {
  if (value === 0 || Math.abs(value) >= 0.0001) {
    return 4
  }

  const expStr = value.toExponential()
  const parts = expStr.split("e")
  return Math.abs(parseInt(parts[1], 10))
}

/**
 * Helper function to format the Intl.NumberFormat call using locales
 *
 * @param value - the number to format
 * @param options - the options to pass to the Intl.NumberFormat call
 *
 * @returns The formatted number as a string.
 */
function formatIntlNumberWithLocales(
  value: number,
  options: Intl.NumberFormatOptions = {}
): string {
  const locales = navigator.languages
  try {
    return new Intl.NumberFormat(locales, options).format(value)
  } catch (error) {
    // If the locale is not supported, the above throws a RangeError
    // In this case we use default locale as fallback
    if (error instanceof RangeError) {
      return new Intl.NumberFormat(undefined, options).format(value)
    }
    throw error
  }
}

/**
 * Formats the given number to a string based on a provided format or the default format.
 *
 * @param format - The format to use. If not provided, the default format is used.
 * @param maxPrecision - The maximum number of decimals to show. If not provided,
 *                     a reasonable default is used based on the configured format.
 *
 * @returns The formatted number as a string.
 */
export function formatNumber(
  value: number,
  format?: string,
  maxPrecision?: number
): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return ""
  }

  if (isNullOrUndefined(format) || format === "") {
    // If no format is provided, use the default format
    if (notNullOrUndefined(maxPrecision)) {
      // Use the configured precision to influence how the number is formatted
      if (maxPrecision === 0) {
        // Numbro is unable to format the number with 0 decimals.
        value = Math.round(value)
      }

      return numbro(value).format({
        thousandSeparated: false,
        mantissa: maxPrecision,
        trimMantissa: false,
      })
    }

    // Use a default format if no precision is given
    return numbro(value).format({
      thousandSeparated: false,
      mantissa: determineDefaultMantissa(value),
      trimMantissa: true,
    })
  }

  if (format === "plain") {
    return numbro(value).format({
      thousandSeparated: false,
      // Use a large mantissa to avoid cutting off decimals
      mantissa: 20,
      trimMantissa: true,
    })
  } else if (format === "localized") {
    return formatIntlNumberWithLocales(value, {
      minimumFractionDigits: maxPrecision ?? undefined,
      maximumFractionDigits: maxPrecision ?? undefined,
    })
  } else if (format === "percent") {
    return formatIntlNumberWithLocales(value, {
      style: "percent",
      minimumFractionDigits: notNullOrUndefined(maxPrecision)
        ? Math.max(maxPrecision - 2, 0)
        : 0,
      maximumFractionDigits: notNullOrUndefined(maxPrecision)
        ? // Percentage already gets multiplied by 100 by the formatter,
          // so we need to reduce the precision by 2 to get the
          // correct format based on the raw value.
          Math.max(maxPrecision - 2, 0)
        : 2,
    })
  } else if (format === "dollar") {
    return formatIntlNumberWithLocales(value, {
      style: "currency",
      currency: "USD",
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: maxPrecision ?? 2,
      maximumFractionDigits: maxPrecision ?? 2,
    })
  } else if (format === "euro") {
    return formatIntlNumberWithLocales(value, {
      style: "currency",
      currency: "EUR",
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: maxPrecision ?? 2,
      maximumFractionDigits: maxPrecision ?? 2,
    })
  } else if (format === "yen") {
    return formatIntlNumberWithLocales(value, {
      style: "currency",
      currency: "JPY",
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: maxPrecision ?? 0,
      maximumFractionDigits: maxPrecision ?? 0,
    })
  } else if (["compact", "scientific", "engineering"].includes(format)) {
    return formatIntlNumberWithLocales(value, {
      notation: format as "compact" | "scientific" | "engineering",
    })
  } else if (format === "accounting") {
    return numbro(value).format({
      thousandSeparated: true,
      negative: "parenthesis",
      mantissa: maxPrecision ?? 2,
      trimMantissa: false,
    })
  } else if (format === "bytes") {
    return (
      formatIntlNumberWithLocales(value, {
        notation: "compact",
        style: "unit",
        unit: "byte",
        unitDisplay: "narrow",
        // We don't apply maxPrecision here since
        // bytes already gets transformed to different units.
        maximumFractionDigits: 1,
      })
        // The intl number format renders gigabytes as BB
        // which would be unexpected for users.
        .replace("BB", "GB")
    )
  }

  return sprintf(format, value)
}
/**
 * Formats the given date to a string with the given format.
 *
 * @param momentDate The moment date to format.
 * @param format The format to use.
 *   If the format is `localized` the date will be formatted according to the user's locale.
 *   If the format is `distance` the date will be formatted as a relative time distance (e.g. "2 hours ago").
 *   If the format is `calendar` the date will be formatted as a calendar date (e.g. "Tomorrow 12:00").
 *   If the format is `iso8601` the date will be formatted according to ISO 8601 standard:
 *     - For date: YYYY-MM-DD
 *     - For time: HH:mm:ss.sssZ
 *     - For datetime: YYYY-MM-DDTHH:mm:ss.sssZ
 *   Otherwise, it is interpreted as momentJS format string: https://momentjs.com/docs/#/displaying/format/
 * @returns The formatted date as a string.
 */
export function formatMoment(
  momentDate: Moment,
  format: string,
  momentKind: "date" | "time" | "datetime" = "datetime"
): string {
  if (format === "localized") {
    const locales = navigator.languages
    const dateStyle = momentKind === "time" ? undefined : "medium"
    const timeStyle = momentKind === "date" ? undefined : "medium"
    try {
      return new Intl.DateTimeFormat(locales, {
        dateStyle,
        timeStyle,
      }).format(momentDate.toDate())
    } catch (error) {
      // If the locale is not supported, the above throws a RangeError
      // In this case we use default locale as fallback
      if (error instanceof RangeError) {
        return new Intl.DateTimeFormat(undefined, {
          dateStyle,
          timeStyle,
        }).format(momentDate.toDate())
      }
      throw error
    }
  } else if (format === "distance") {
    return momentDate.fromNow()
  } else if (format === "calendar") {
    return momentDate.calendar()
  } else if (format === "iso8601") {
    if (momentKind === "date") {
      return momentDate.format("YYYY-MM-DD")
    } else if (momentKind === "time") {
      return momentDate.format("HH:mm:ss.SSS[Z]")
    }
    return momentDate.toISOString()
  }
  return momentDate.format(format)
}

/**
 * Converts the given value of unknown type to a date without
 * the risks of any exceptions.
 *
 * Note: Unix timestamps are only supported in seconds.
 *
 * @param value - The value to convert to a date.
 *
 * @returns The converted date or null if the value cannot be interpreted as a date.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
export function toSafeDate(value: any): Date | null | undefined {
  if (isNullOrUndefined(value)) {
    return null
  }

  // Return the value as-is if it is already a date
  if (value instanceof Date) {
    if (!isNaN(value.getTime())) {
      return value
    }
    return undefined
  }

  if (typeof value === "string" && value.trim().length === 0) {
    // Empty string should return null
    return null
  }

  try {
    const parsedTimestamp = Number(value)
    if (!isNaN(parsedTimestamp)) {
      // Unix timestamps can be have different units.
      // As default, we handle the unit as second, but
      // if it larger than a certain threshold, we assume
      // a different unit. This is not 100% accurate, but
      // should be good enough since it is unlikely that
      // users are actually referring to years >= 5138.
      let timestampInSeconds = parsedTimestamp
      if (parsedTimestamp >= 10 ** 18) {
        // Assume that the timestamp is in nanoseconds
        // and adjust to seconds
        timestampInSeconds = parsedTimestamp / 1000 ** 3
      } else if (parsedTimestamp >= 10 ** 15) {
        // Assume that the timestamp is in microseconds
        // and adjust to seconds
        timestampInSeconds = parsedTimestamp / 1000 ** 2
      } else if (parsedTimestamp >= 10 ** 12) {
        // Assume that the timestamp is in milliseconds
        // and adjust to seconds
        timestampInSeconds = parsedTimestamp / 1000
      }

      // Parse it as a unix timestamp in seconds
      const parsedMomentDate = moment.unix(timestampInSeconds).utc()
      if (parsedMomentDate.isValid()) {
        return parsedMomentDate.toDate()
      }
    }

    if (typeof value === "string") {
      // Try to parse string via momentJS:
      const parsedMomentDate = moment.utc(value)
      if (parsedMomentDate.isValid()) {
        return parsedMomentDate.toDate()
      }
      // The pasted value was not a valid date string
      // Try to interpret value as time string instead (HH:mm:ss)
      const parsedMomentTime = moment.utc(value, [
        moment.HTML5_FMT.TIME_MS, // HH:mm:ss.SSS
        moment.HTML5_FMT.TIME_SECONDS, // HH:mm:ss
        moment.HTML5_FMT.TIME, // HH:mm
      ])
      if (parsedMomentTime.isValid()) {
        return parsedMomentTime.toDate()
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return undefined
  }

  // Unable to interpret this value as a date:
  return undefined
}

/**
 * Count the number of decimals in a number.
 *
 * @param {number} value - The number to count the decimals for.
 *
 * @returns {number} The number of decimals.
 */
export function countDecimals(value: number): number {
  if (value % 1 === 0) {
    return 0
  }

  let numberStr = value.toString()

  if (numberStr.indexOf("e") !== -1) {
    // Handle scientific notation
    numberStr = value.toLocaleString("fullwide", {
      useGrouping: false,
      maximumFractionDigits: 20,
    })
  }

  if (numberStr.indexOf(".") === -1) {
    // Fallback to 0 decimals, this can happen with
    // extremely large or small numbers
    return 0
  }

  return numberStr.split(".")[1].length
}

/**
 * Truncates a number to a specified number of decimal places without rounding.
 *
 * @param {number} value - The number to be truncated.
 * @param {number} decimals - The number of decimal places to preserve after truncation.
 *
 * @returns {number} The truncated number.
 *
 * @example
 * truncateDecimals(3.14159265, 2); // returns 3.14
 * truncateDecimals(123.456, 0); // returns 123
 */
export function truncateDecimals(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value // keep NaN/±∞ untouched
  if (decimals <= 0) return Math.trunc(value)

  const factor = 10 ** decimals
  const shifted = value * factor

  // Add/subtract a relative ε that is just large enough to push
  // 451.999… → 452 (or −452.000… → −451.999…) before we truncate.
  const epsilon = Number.EPSILON * Math.abs(shifted) * 10

  return Math.trunc(shifted + Math.sign(shifted) * epsilon) / factor
}

const LINE_BREAK_REGEX = new RegExp(/(\r\n|\n|\r)/gm)

/**
 * Removes all line breaks from the given text.
 * @param text - The text to remove line breaks from.
 * @returns The text without line breaks.
 */
export function removeLineBreaks(text: string): string {
  if (text.indexOf("\n") !== -1) {
    return text.replace(LINE_BREAK_REGEX, " ")
  }
  return text
}

/**
 * Determines the correct value to display in a link cell based on the `href` and `regexPattern` parameters.
 *
 * @param href - The raw url value.
 * @param displayTextRegex - The regex pattern which will be applied to the `href`. If no match is found, then we return the `href`.
 * @returns - The string value to be displayed in the cell.
 *
 * * @example
 * const regex = new RegExp("https:\/\/(.*?)\.streamlit\.app")
 * const regex2 = new RegExp("https:\/\/roadmap\.(.*?)\.app")
 * getLinkDisplayValueFromRegex(regex, "https://roadmap.streamlit.app"); // returns "roadmap"
 * getLinkDisplayValueFromRegex(regex, "https://roadmap.streamlit.app"); // returns "streamlit"
 */
export function getLinkDisplayValueFromRegex(
  displayTextRegex: RegExp,
  href?: string | null
): string {
  if (isNullOrUndefined(href)) {
    return ""
  }

  try {
    // apply the regex pattern to display the value
    const patternMatch = href.match(displayTextRegex)
    if (patternMatch && patternMatch[1] !== undefined) {
      // return the first matching group
      // Since this might be a URI encoded value, we decode it.
      // Note: we replace + with %20 to correctly convert + to whitespaces.
      return decodeURIComponent(patternMatch[1].replace(/\+/g, "%20"))
    }

    // if the regex doesn't find a match with the url, just use the url as display value
    return href
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // if there was any error return the href
    return href
  }
}
