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

import {
  Type as ArrowType,
  Quiver,
} from "@streamlit/lib/src/dataframes/Quiver"
import { EmotionTheme } from "@streamlit/lib/src/theme"
import {
  isNullOrUndefined,
  notNullOrUndefined,
} from "@streamlit/lib/src/util/utils"

/**
 * Interface used for defining the properties (configuration options) of a column.
 * These options can also be used to overwrite from user-defined column config.
 */
export interface BaseColumnProps {
  // The id of the column:
  readonly id: string
  // The name of the column from the original data:
  readonly name: string
  // The display title of the column:
  readonly title: string
  // The index number of the column:
  readonly indexNumber: number
  // The arrow data type of the column:
  readonly arrowType: ArrowType
  // If `True`, the column can be edited:
  readonly isEditable: boolean
  // If `True`, the column is hidden (will not be shown):
  readonly isHidden: boolean
  // If `True`, the column is a table index:
  readonly isIndex: boolean
  // If `True`, the column is a stretched:
  readonly isStretched: boolean
  // If `True`, a value is required before the cell or row can be submitted:
  readonly isRequired?: boolean
  // The initial width of the column:
  readonly width?: number
  // A help text that is displayed on hovering the column header.
  readonly help?: string
  // Configuration options related to the column type:
  readonly columnTypeOptions?: Record<string, any>
  // The content alignment of the column:
  readonly contentAlignment?: "left" | "center" | "right"
  // The default value of the column used when adding a new row:
  readonly defaultValue?: string | number | boolean
  // Theme overrides for this column:
  readonly themeOverride?: Partial<GlideTheme>
  // A custom icon to be displayed in the column header:
  readonly icon?: string
  // The group that this column belongs to.
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
  // Validate the input data for compatibility with the column type:
  // Either returns a boolean indicating if the data is valid or not, or
  // returns the corrected value.
  validateInput?(data?: any): boolean | any
  // Get a cell with the provided data for the column type:
  getCell(data?: any, validate?: boolean): GridCell
  // Get the raw value of the given cell:
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
interface ErrorCell extends TextCell {
  readonly isError: true
}

/**
 * Returns a cell with an error message.
 *
 * @param errorMsg: A short error message to use as display value.
 * @param errorDetails: The full error message to show when the user
 *                     clicks on a cell.
 *
 * @return a read-only GridCell object that can be used by glide-data-grid.
 */
export function getErrorCell(errorMsg: string, errorDetails = ""): ErrorCell {
  errorMsg = `⚠️ ${errorMsg}`
  return {
    kind: GridCellKind.Text,
    readonly: true,
    allowOverlay: true,
    data: errorMsg + (errorDetails ? `\n\n${errorDetails}\n` : ""),
    displayData: errorMsg,
    isError: true,
  } as ErrorCell
}

/**
 * Returns `true` if the given cell contains an error.
 * This can happen if the value type is not compatible with
 * the given value type.
 */
export function isErrorCell(cell: GridCell): cell is ErrorCell {
  return cell.hasOwnProperty("isError") && (cell as ErrorCell).isError
}

interface CellWithTooltip extends BaseGridCell {
  readonly tooltip: string
}

/**
 * Returns `true` if the given cell has a tooltip
 */
export function hasTooltip(cell: BaseGridCell): cell is CellWithTooltip {
  return (
    cell.hasOwnProperty("tooltip") && (cell as CellWithTooltip).tooltip !== ""
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
    cell.hasOwnProperty("isMissingValue") &&
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
    } as LoadingCell
  }

  return {
    kind: GridCellKind.Loading,
    allowOverlay: false,
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
    themeOverride: column.themeOverride,
    icon: column.icon,
    group: column.group,
    ...(column.isStretched && {
      grow: column.isIndex ? 1 : 3,
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
  defaultParams: Record<string, any> | undefined | null,
  userParams: Record<string, any> | undefined | null
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

    return parsedData.map((value: any) =>
      ["string", "number", "boolean", "null"].includes(typeof value)
        ? value
        : toSafeString(value)
    )
  } catch (error) {
    return [toSafeString(data)]
  }
}

/**
 * Converts the given value of unknown type to a string without
 * the risks of any exceptions.
 *
 * @param data - The value to convert to a string.
 *
 * @return The converted string or a string showing the type of the object as fallback.
 */
export function toSafeString(data: any): string {
  try {
    try {
      return toString(data)
    } catch (error) {
      return JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? Number(value) : value
      )
    }
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
    } catch (error) {
      // Do nothing here
    }
  } else if (value instanceof Int32Array) {
    // int values need to be extracted this way:
    // eslint-disable-next-line prefer-destructuring
    return Number(value[0])
  }

  return Number(value)
}

/**
 * Formats the given number to a string based on a provided format or the default format.
 *
 * @param value - The number to format.
 * @param format - The format to use. If not provided, the default format is used.
 * @param maxPrecision - The maximum number of decimals to show. This is only used by the default format.
 *                     If not provided, the default is 4 decimals and trailing zeros are hidden.
 *
 * @returns The formatted number as a string.
 */
export function formatNumber(
  value: number,
  format?: string | undefined,
  maxPrecision?: number | undefined
): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return ""
  }

  if (isNullOrUndefined(format) || format === "") {
    if (maxPrecision === 0) {
      // Numbro is unable to format the number with 0 decimals.
      value = Math.round(value)
    }
    return numbro(value).format(
      notNullOrUndefined(maxPrecision)
        ? `0,0.${"0".repeat(maxPrecision)}`
        : `0,0.[0000]` // If no precision is given, use 4 decimals and hide trailing zeros
    )
  }

  if (format === "percent") {
    return new Intl.NumberFormat(undefined, {
      style: "percent",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } else if (["compact", "scientific", "engineering"].includes(format)) {
    return new Intl.NumberFormat(undefined, {
      notation: format as any,
    }).format(value)
  } else if (format === "duration[ns]") {
    return moment.duration(value / (1000 * 1000), "milliseconds").humanize()
  } else if (format.startsWith("period[")) {
    return Quiver.formatPeriodType(BigInt(value), format as any)
  }

  return sprintf(format, value)
}

/**
 * Formats the given date to a string with the given format.
 *
 * @param momentDate The moment date to format.
 * @param format The format to use.
 *   If the format is `locale` the date will be formatted according to the user's locale.
 *   If the format is `relative` the date will be formatted as a relative time (e.g. "2 hours ago").
 *   Otherwise, it is interpreted as momentJS format string: https://momentjs.com/docs/#/displaying/format/
 * @returns The formatted date as a string.
 */
export function formatMoment(momentDate: Moment, format: string): string {
  if (format === "locale") {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(momentDate.toDate())
  } else if (format === "distance") {
    return momentDate.fromNow()
  } else if (format === "relative") {
    return momentDate.calendar()
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
  return decimals === 0
    ? Math.trunc(value)
    : Math.trunc(value * 10 ** decimals) / 10 ** decimals
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
      return decodeURI(patternMatch[1])
    }

    // if the regex doesn't find a match with the url, just use the url as display value
    return href
  } catch (error) {
    // if there was any error return the href
    return href
  }
}
