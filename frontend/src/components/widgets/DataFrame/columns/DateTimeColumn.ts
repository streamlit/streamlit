/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import { GridCell, GridCellKind, TextCell } from "@glideapps/glide-data-grid"
import moment, { Moment } from "moment"

import {
  BaseColumn,
  BaseColumnProps,
  mergeColumnParameters,
  toSafeDate,
  getErrorCell,
  toSafeString,
} from "src/components/widgets/DataFrame/columns/utils"
import { notNullOrUndefined, isNullOrUndefined } from "src/lib/utils"

import { DateTimeCell } from "./cells/DateTimeCell"

/**
 * Apply a timezone to a MomentJS date.
 *
 * @param momentDate The date to apply the timezone to
 * @param timezone The timezone to apply. This can be a timezone name
 * (e.g. "America/New_York" or "UTC") or a UTC offset (e.g. "+05:00" or "-08:00")
 * @returns The date with the timezone applied
 */
function applyTimezone(momentDate: Moment, timezone: string): Moment {
  if (timezone.startsWith("+") || timezone.startsWith("-")) {
    // Timezone is a UTC offset (e.g. "+05:00" or "-08:00")
    momentDate = momentDate.utcOffset(timezone, false)
  } else {
    // Timezone is a timezone name (e.g. "America/New_York" or "UTC")
    momentDate = momentDate.tz(timezone)
  }
  return momentDate
}

export interface DateTimeColumnParams {
  // A MomentJS formatting syntax to format the display value.
  readonly format?: string
  // Specifies the granularity that the value must adhere.
  // For time and datetime, this is the number of seconds between each allowed value.
  // For date, this is the number of days between each allowed value.
  readonly step?: number
  // A timezone identifier, e.g. "America/New_York", "+05:00", or "UTC"
  readonly timezone?: string
  // The minimum allowed value for editing. This needs to be an ISO formatted datetime/date/time string (UTC).
  readonly min_value?: string
  // The maximum allowed value for editing. This needs to be an ISO formatted datetime/date/time string (UTC).
  readonly max_value?: string
}

/**
 * Base class for datetime columns. This class is not meant to be used directly.
 * Instead, use the DateColumn, TimeColumn, or DateTimeColumn classes.
 *
 * @param kind The kind of column. This should be one of "date", "time", or "datetime".
 * @param props The column properties
 * @param defaultFormat The default format to use for rendering and copy data
 * @param defaultStep The default step to use, can be overridden by the user
 * @param inputType The type of input to use for editing. This should be one of "datetime-local", "time", or "date".
 * @param toISOString A function that converts a Date object to an ISO formatted string
 * @param timezone The timezone to use to make the datetime values timezone aware.
 *
 * @returns A BaseColumn object
 */
function BaseDateTimeColumn(
  kind: string,
  props: BaseColumnProps,
  defaultFormat: string, // used for rendering and copy data
  defaultStep: number,
  inputType: "datetime-local" | "time" | "date",
  toISOString: (date: Date) => string,
  timezone?: string
): BaseColumn {
  const parameters = mergeColumnParameters(
    // Default parameters:
    {
      format: defaultFormat,
      step: defaultStep,
      timezone,
    },
    // User parameters:
    props.columnTypeOptions
  ) as DateTimeColumnParams

  let defaultTimezoneOffset: number | undefined = undefined
  if (notNullOrUndefined(parameters.timezone)) {
    // We try to determine the timezone offset based on today's date
    // This is needed for the date picker to work correctly when the value is null
    // But this might not be correct for dates in the past or future
    // since the timezone offset might have changed based on a timezone name.
    try {
      defaultTimezoneOffset =
        applyTimezone(moment(), parameters.timezone)?.utcOffset() || undefined
    } catch (error) {
      // Do nothing
    }
  }

  let minDate: Date | undefined = undefined
  if (notNullOrUndefined(parameters.min_value)) {
    minDate = toSafeDate(parameters.min_value) || undefined
  }

  let maxDate: Date | undefined = undefined
  if (notNullOrUndefined(parameters.max_value)) {
    maxDate = toSafeDate(parameters.max_value) || undefined
  }

  const cellTemplate = {
    kind: GridCellKind.Custom,
    allowOverlay: true,
    copyData: "",
    readonly: !props.isEditable,
    contentAlign: props.contentAlignment,
    style: props.isIndex ? "faded" : "normal",
    data: {
      kind: "date-time-cell",
      date: undefined,
      displayDate: "",
      step: parameters.step?.toString() || "1",
      format: inputType,
      min: minDate,
      max: maxDate,
    },
  } as DateTimeCell

  const validateInput = (data?: any): boolean | Date => {
    const cellData: Date | null | undefined = toSafeDate(data)
    if (cellData === null) {
      if (props.isRequired) {
        return false
      }
      return true
    }

    if (cellData === undefined) {
      // Input cannot be interpreted as a date
      return false
    }

    // TODO: should we auto correct min/max values?

    // Apply min_value configuration option:
    if (
      notNullOrUndefined(minDate) &&
      // We compare on a string level so that it also works correctly for time and date values
      toISOString(cellData) < toISOString(minDate)
    ) {
      return false
    }

    // Apply min_value configuration option:
    if (
      notNullOrUndefined(maxDate) &&
      toISOString(cellData) > toISOString(maxDate)
    ) {
      return false
    }

    // TODO: validate step size

    return true
  }

  return {
    ...props,
    kind,
    sortMode: "default",
    validateInput,
    getCell(data?: any, validate?: boolean): GridCell {
      if (validate === true) {
        const validationResult = validateInput(data)
        if (validationResult === false) {
          // The input is invalid, we return an error cell which will
          // prevent this cell to be inserted into the table.
          return getErrorCell(toSafeString(data), "Invalid input.")
        } else if (validationResult instanceof Date) {
          // Apply corrections:
          data = validationResult
        }
      }

      const cellData = toSafeDate(data)

      let copyData = ""
      let displayDate = ""
      // Initialize with default offset base on today's date
      let timezoneOffset = defaultTimezoneOffset

      if (cellData === undefined) {
        return getErrorCell(
          toSafeString(data),
          "The value cannot be interpreted as a datetime object."
        )
      }

      if (cellData !== null) {
        // Convert to moment object
        let momentDate = moment.utc(cellData)

        if (!momentDate.isValid()) {
          // The moment date should never be invalid here.
          return getErrorCell(
            toSafeString(cellData),
            `This should never happen. Please report this bug. \nError: ${momentDate.toString()}`
          )
        }

        if (parameters.timezone) {
          try {
            momentDate = applyTimezone(momentDate, parameters.timezone)
          } catch (error) {
            return getErrorCell(
              momentDate.toISOString(),
              `Failed to adjust to the provided timezone: ${parameters.timezone}. \nError: ${error}`
            )
          }

          timezoneOffset = momentDate.utcOffset()
        }

        try {
          displayDate = momentDate.format(parameters.format)
        } catch (error) {
          return getErrorCell(
            momentDate.toISOString(),
            `Failed to format the date for rendering with: ${parameters.format}. \nError: ${error}`
          )
        }
        // Copy data should always use the default format
        copyData = momentDate.format(defaultFormat)
      }

      if (!props.isEditable) {
        // TODO (lukasmasuch): This is a temporary workaround until the following PR is merged:
        // https://github.com/glideapps/glide-data-grid/pull/656
        // The issue is that measuring custom cells is not supported yet.
        // This results in datetime columns not correctly adapting the width to the content.
        // Therefore, we use a text cell here so that we are not affecting the current
        // behavior for read-only cells.

        return {
          kind: GridCellKind.Text,
          data: copyData !== "" ? copyData : null,
          displayData: displayDate,
          allowOverlay: true,
          contentAlignment: props.contentAlignment,
          readonly: true,
          style: props.isIndex ? "faded" : "normal",
        } as TextCell
      }

      return {
        ...cellTemplate,
        copyData,
        isMissingValue: isNullOrUndefined(cellData),
        data: {
          ...cellTemplate.data,
          date: cellData,
          displayDate,
          timezoneOffset,
        },
      } as DateTimeCell
    },
    getCellValue(cell: DateTimeCell | TextCell): string | null {
      if (cell.kind === GridCellKind.Text) {
        return cell.data === undefined ? null : cell.data
      }
      return isNullOrUndefined(cell?.data?.date)
        ? null
        : toISOString(cell.data.date)
    },
  }
}

/**
 * Creates a new datetime column.
 * A datetime column supports optimized rendering and editing for datetime values.
 *
 * @param props The column properties.
 * @returns The new column.
 */
export default function DateTimeColumn(props: BaseColumnProps): BaseColumn {
  const timezone: string | undefined = props.arrowType?.meta?.timezone
  const hasTimezone: boolean =
    notNullOrUndefined(timezone) ||
    // Timezone can also be configure by the user:
    notNullOrUndefined(props?.columnTypeOptions?.timezone)

  return BaseDateTimeColumn(
    "datetime",
    props,
    hasTimezone ? "YYYY-MM-DD HH:mm:ssZ" : "YYYY-MM-DD HH:mm:ss",
    1,
    "datetime-local",
    (date: Date): string => {
      if (hasTimezone) {
        return date.toISOString()
      }
      return date.toISOString().replace("Z", "")
    },
    timezone
  )
}

DateTimeColumn.isEditableType = true

/**
 * Creates a new time column.
 * A time column supports optimized rendering and editing for time values.
 *
 * @param props The column properties.
 * @returns The new column.
 */
export function TimeColumn(props: BaseColumnProps): BaseColumn {
  return BaseDateTimeColumn(
    "time",
    props,
    "HH:mm:ss.SSS",
    0.1,
    "time",
    (date: Date): string => {
      // Only return the time part of the ISO string:
      return date.toISOString().split("T")[1].replace("Z", "")
    }
  )
}

TimeColumn.isEditableType = true

/**
 * Creates a new date column.
 * A date column supports optimized rendering and editing for date values.
 *
 * @param props The column properties.
 * @returns The new column.
 */
export function DateColumn(props: BaseColumnProps): BaseColumn {
  return BaseDateTimeColumn(
    "date",
    props,
    "YYYY-MM-DD",
    1,
    "date",
    (date: Date): string => {
      // Only return the date part of the ISO string:
      return date.toISOString().split("T")[0]
    }
  )
}

DateColumn.isEditableType = true
