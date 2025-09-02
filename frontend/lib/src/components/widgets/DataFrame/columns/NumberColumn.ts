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

import { GridCell, GridCellKind, NumberCell } from "@glideapps/glide-data-grid"

import { format as formatArrowCell } from "~lib/dataframes/arrowFormatUtils"
import {
  isDurationType,
  isIntegerType,
  isPeriodType,
  isUnsignedIntegerType,
} from "~lib/dataframes/arrowTypeUtils"
import { isNullOrUndefined, notNullOrUndefined } from "~lib/util/utils"

import {
  BaseColumn,
  BaseColumnProps,
  countDecimals,
  formatNumber,
  getErrorCell,
  mergeColumnParameters,
  toSafeNumber,
  toSafeString,
  truncateDecimals,
} from "./utils"

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
 * A column types that supports optimized rendering and editing for numbers.
 * This supports float, integer, and unsigned integer types.
 */
function NumberColumn(props: BaseColumnProps): BaseColumn {
  const parameters = mergeColumnParameters(
    // Default parameters:
    {
      // Set step to 1 for integer types
      step: isIntegerType(props.arrowType) ? 1 : undefined,
      // if uint (unsigned int), only positive numbers are allowed
      min_value: isUnsignedIntegerType(props.arrowType) ? 0 : undefined,
    } as NumberColumnParams,
    // User parameters:
    props.columnTypeOptions
  ) as NumberColumnParams

  // If no custom format is provided & the column type is duration or period,
  // instruct the column to use the arrow formatting for the display value.
  const useArrowFormatting =
    !parameters.format &&
    (isDurationType(props.arrowType) || isPeriodType(props.arrowType))

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
      props.contentAlignment || useArrowFormatting ? "left" : "right",
    // The text in pinned columns should be faded.
    style: props.isPinned ? "faded" : "normal",
    allowNegative,
    fixedDecimals,
    // We don't want to show any thousand separators
    // in the cell overlay/editor:
    thousandSeparator: "",
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  const validateInput = (data?: any): boolean | number => {
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

    // TODO(lukasmasuch): validate step size?
    // if (notNullOrUndefined(parameters.step) && parameters.step !== 1)

    return corrected ? cellData : true
  }

  return {
    ...props,
    kind: "number",
    sortMode: "smart",
    typeIcon: ":material/tag:",
    validateInput,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    getCell(data?: any, validate?: boolean): GridCell {
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
          if (useArrowFormatting) {
            // Use arrow formatting for some selected types (see above)
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

      return {
        ...cellTemplate,
        data: cellData,
        displayData,
        isMissingValue: isNullOrUndefined(cellData),
        // We want to enforce the raw number without formatting when its copied:
        copyData: isNullOrUndefined(cellData) ? "" : toSafeString(cellData),
      } as NumberCell
    },
    getCellValue(cell: NumberCell): number | null {
      return cell.data === undefined ? null : cell.data
    },
  }
}

NumberColumn.isEditableType = true

export default NumberColumn
