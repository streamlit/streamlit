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

import { GridCell, GridCellKind, NumberCell } from "@glideapps/glide-data-grid"
import { TimeUnit } from "apache-arrow"

import {
  format as formatArrowCell,
  formatDurationClockFromSeconds,
  formatDurationFromSeconds,
  formatLocalizedDurationFromSeconds,
} from "~lib/dataframes/arrowFormatUtils"
import {
  isDurationType,
  isIntegerType,
  isPeriodType,
  isUnsignedIntegerType,
} from "~lib/dataframes/arrowTypeUtils"
import { formatNumber } from "~lib/util/formatNumber"
import { isNullOrUndefined, notNullOrUndefined } from "~lib/util/utils"

import {
  BaseColumn,
  BaseColumnProps,
  countDecimals,
  getErrorCell,
  mergeColumnParameters,
  toSafeNumber,
  toSafeString,
  truncateDecimals,
} from "./utils"

// Pandas Timedelta is stored as int64 nanoseconds (~±292 years).
const PANDAS_TIMEDELTA_MAX_SECONDS = 2 ** 63 / 1e9

/** Number of decimal second places represented by an Arrow duration unit. */
function getDurationFractionalSecondDigits(unit?: TimeUnit): number {
  switch (unit) {
    case TimeUnit.SECOND:
      return 0
    case TimeUnit.MILLISECOND:
      return 3
    case TimeUnit.MICROSECOND:
      return 6
    case TimeUnit.NANOSECOND:
    default:
      return 9
  }
}

/** True when a second count can be represented by the Arrow duration unit. */
function hasDurationPrecision(
  seconds: number,
  fractionalSecondDigits: number
): boolean {
  const scale = 10 ** fractionalSecondDigits
  const scaledSeconds = seconds * scale
  if (!Number.isFinite(scaledSeconds)) {
    return false
  }
  // A second count is representable only if scaling it to integer ticks and
  // back is lossless, so a value finer than the column's unit is rejected.
  return Math.round(scaledSeconds) / scale === seconds
}

export interface NumberColumnParams {
  /**
   * The minimum allowed value for editing. Is set to 0 for unsigned values.
   */
  readonly min_value?: number
  /**
   * The maximum allowed value for editing.
   */
  readonly max_value?: number
  /**
   * A formatting syntax (e.g. sprintf) to format the display value.
   * This can be used for adding prefix or suffix, or changing the number of
   * decimals of the display value.
   *
   * Duration formats treat values as seconds:
   * - `duration`: approximate human-readable duration (for example,
   *   `a few seconds` or `a day`) on any number column
   * - `compact` on a timedelta column: elapsed-time clock (e.g. `00:00:01`)
   * - `localized` on a timedelta column: locale-aware duration
   *
   * `compact` and `localized` include sub-second parts when present. Timedelta
   * columns default to `duration`. Other named and printf formats apply to the
   * value in seconds.
   */
  readonly format?: string
  /**
   * Specifies the granularity that the value must adhere.
   * This will also influence the maximum precision. This will impact the
   * number of decimals allowed to be entered as well as the number of
   * decimals displayed (if format is not specified).
   * This is set to 1 for integer types.
   */
  readonly step?: number
}

/**
 * A column type that supports optimized rendering and editing for numbers.
 * This supports float, integer, unsigned integer, and duration types.
 *
 * Duration values must already be in seconds (converted in getCellFromArrow)
 * so they stay within JavaScript's safe integer range.
 */
function NumberColumn(props: BaseColumnProps): BaseColumn {
  const isDuration = isDurationType(props.arrowType)
  const durationFractionalSecondDigits = getDurationFractionalSecondDigits(
    props.arrowType.arrowField.type.unit
  )
  const parameters = mergeColumnParameters<NumberColumnParams>(
    // Default parameters:
    {
      // Set step to 1 for integer types
      step: isIntegerType(props.arrowType) ? 1 : undefined,
      // if uint (unsigned int), only positive numbers are allowed
      min_value: isUnsignedIntegerType(props.arrowType) ? 0 : undefined,
    },
    // User parameters:
    props.columnTypeOptions
  )

  const useDurationClock = isDuration && parameters.format === "compact"
  const useDurationLocalized = isDuration && parameters.format === "localized"
  // The "Automatic" menu entry sends an empty format string, so a duration
  // column with no explicit format falls back to the humanized display.
  const useDurationHumanize =
    parameters.format === "duration" || (isDuration && !parameters.format)

  // Period columns without a custom format use Arrow's period formatter.
  const useArrowFormatting =
    !parameters.format && isPeriodType(props.arrowType)

  const allowNegative =
    isNullOrUndefined(parameters.min_value) || parameters.min_value < 0

  const fixedDecimals =
    notNullOrUndefined(parameters.step) && !Number.isNaN(parameters.step)
      ? countDecimals(parameters.step)
      : undefined

  const cellTemplate: NumberCell = {
    kind: GridCellKind.Number,
    data: undefined,
    displayData: "",
    readonly: !props.isEditable,
    allowOverlay: true,
    contentAlign:
      props.contentAlignment ??
      (useArrowFormatting || useDurationHumanize ? "left" : "right"),
    // The text in pinned columns should be faded.
    style: props.isPinned ? "faded" : "normal",
    allowNegative,
    fixedDecimals,
    // We don't want to show any thousand separators
    // in the cell overlay/editor:
    thousandSeparator: "",
  }

  const validateInput = (data?: unknown): boolean | number => {
    let cellData: number | null = toSafeNumber(data)

    if (isNullOrUndefined(cellData)) {
      if (props.isRequired) {
        return false
      }
      return true
    }

    if (Number.isNaN(cellData)) {
      return false
    }

    // A flag to indicate whether the value has been auto-corrected.
    // This is used to decide if we should return the corrected value or true.
    // But we still run all other validations on the corrected value below.
    let corrected = false

    // Apply max_value configuration option:
    if (
      notNullOrUndefined(parameters.max_value) &&
      cellData > parameters.max_value
    ) {
      cellData = parameters.max_value
      corrected = true
    }

    // Apply min_value configuration option:
    if (
      notNullOrUndefined(parameters.min_value) &&
      cellData < parameters.min_value
    ) {
      // Only return false, since correcting it negatively impacts
      // the user experience.
      return false
    }

    // Duration checks run after clamping so a corrected max_value that is
    // finer than the column unit (e.g. 90.5s on timedelta64[s]) is rejected.
    if (isDuration && Math.abs(cellData) >= PANDAS_TIMEDELTA_MAX_SECONDS) {
      return false
    }

    if (
      isDuration &&
      !hasDurationPrecision(cellData, durationFractionalSecondDigits)
    ) {
      return false
    }

    // TODO(lukasmasuch): validate step size?
    // if (notNullOrUndefined(parameters.step) && parameters.step !== 1)

    return corrected ? cellData : true
  }

  return {
    ...props,
    kind: "number",
    sortMode: "smart",
    typeIcon: isDuration ? ":material/timelapse:" : ":material/tag:",
    validateInput,
    getCell(data?: unknown, validate?: boolean): GridCell {
      if (validate === true) {
        const validationResult = validateInput(data)
        if (validationResult === false) {
          // The input is invalid, we return an error cell which will
          // prevent this cell to be inserted into the table.
          // This cell should never be actually displayed to the user.
          // It's mostly used internally to prevent invalid input to be
          // inserted into the table.
          return getErrorCell(toSafeString(data), "Invalid input.")
        } else if (typeof validationResult === "number") {
          // Apply corrections:
          data = validationResult
        }
      }

      let cellData: number | null = toSafeNumber(data)
      let displayData = ""

      if (notNullOrUndefined(cellData)) {
        if (Number.isNaN(cellData)) {
          return getErrorCell(
            toSafeString(data),
            "The value cannot be interpreted as a number."
          )
        }

        // Cut decimals:
        if (notNullOrUndefined(fixedDecimals)) {
          cellData = truncateDecimals(cellData, fixedDecimals)
        }

        // Check if the value is larger than the maximum supported value:
        if (Number.isInteger(cellData) && !Number.isSafeInteger(cellData)) {
          return getErrorCell(
            toSafeString(data),
            "The value is larger than the maximum supported integer values in number columns (2^53)."
          )
        }

        try {
          if (useDurationClock) {
            displayData = formatDurationClockFromSeconds(
              cellData,
              durationFractionalSecondDigits
            )
          } else if (useDurationLocalized) {
            displayData = formatLocalizedDurationFromSeconds(
              cellData,
              durationFractionalSecondDigits
            )
          } else if (useDurationHumanize) {
            displayData = formatDurationFromSeconds(cellData)
          } else if (useArrowFormatting) {
            displayData = formatArrowCell(cellData, props.arrowType)
          } else {
            displayData = formatNumber(
              cellData,
              parameters.format,
              fixedDecimals
            )
          }
        } catch (error) {
          return getErrorCell(
            toSafeString(cellData),
            notNullOrUndefined(parameters.format)
              ? // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                `Failed to format the number based on the provided format configuration: (${parameters.format}). Error: ${error}`
              : // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                `Failed to format the number. Error: ${error}`
          )
        }
      }

      let copyData = ""
      if (notNullOrUndefined(cellData)) {
        // Copy the raw number, not the formatted display, so paste
        // round-trips through toSafeNumber.
        copyData = toSafeString(cellData)
      }

      return {
        ...cellTemplate,
        data: cellData,
        displayData,
        isMissingValue: isNullOrUndefined(cellData),
        copyData,
      } as NumberCell
    },
    getCellValue(cell: NumberCell): number | null {
      return cell.data === undefined ? null : cell.data
    },
    valuesEqual(a: unknown, b: unknown): boolean {
      // Compare numerically so a string like "5" and the number 5 match.
      const numberA = typeof a === "number" ? a : Number(a)
      const numberB = typeof b === "number" ? b : Number(b)

      return Object.is(numberA, numberB)
    },
  }
}

NumberColumn.isEditableType = true

export default NumberColumn
