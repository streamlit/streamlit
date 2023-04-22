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

import { GridCell, GridCellKind, NumberCell } from "@glideapps/glide-data-grid"
import { sprintf } from "sprintf-js"

import { Quiver } from "src/lib/Quiver"
import { notNullOrUndefined, isNullOrUndefined } from "src/lib/utils"

import {
  BaseColumn,
  BaseColumnProps,
  getErrorCell,
  toSafeString,
  mergeColumnParameters,
  toSafeNumber,
  formatNumber,
  countDecimals,
  truncateDecimals,
} from "./utils"

export interface NumberColumnParams {
  // The minimum allowed value for editing. Is set to 0 for unsigned values.
  readonly min_value?: number
  // The maximum allowed value for editing.
  readonly max_value?: number
  // A formatting syntax (e.g. sprintf) to format the display value.
  // This can be used for adding prefix or suffix, or changing the number of decimals of the display value.
  readonly format?: string
  // Specifies the granularity that the value must adhere.
  // This is set to 1 for integer types.
  readonly step?: number
}

/**
 * A column types that supports optimized rendering and editing for numbers.
 * This supports float, integer, and unsigned integer types.
 */
function NumberColumn(props: BaseColumnProps): BaseColumn {
  const arrowTypeName = Quiver.getTypeName(props.arrowType)

  const parameters = mergeColumnParameters(
    // Default parameters:
    {
      // Set step to 1 for integer types
      step:
        arrowTypeName.startsWith("int") ||
        arrowTypeName === "range" ||
        arrowTypeName.startsWith("uint")
          ? 1
          : undefined,
      // if uint (unsigned int), only positive numbers are allowed
      min_value: arrowTypeName.startsWith("uint") ? 0 : undefined,
    } as NumberColumnParams,
    // User parameters:
    props.columnTypeOptions
  ) as NumberColumnParams

  const allowNegative =
    isNullOrUndefined(parameters.min_value) || parameters.min_value < 0

  const fixedDecimals =
    notNullOrUndefined(parameters.step) && !Number.isNaN(parameters.step)
      ? countDecimals(parameters.step)
      : undefined

  const cellTemplate = {
    kind: GridCellKind.Number,
    data: undefined,
    displayData: "",
    readonly: !props.isEditable,
    allowOverlay: true,
    contentAlign: props.contentAlignment || "right",
    style: props.isIndex ? "faded" : "normal",
    allowNegative,
    fixedDecimals,
  } as NumberCell

  const validateInput = (data?: any): boolean | number => {
    const cellData: number | null = toSafeNumber(data)

    if (isNullOrUndefined(cellData)) {
      if (props.isRequired) {
        return false
      }
      return true
    }

    if (Number.isNaN(cellData)) {
      return false
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

    // Apply min_value configuration option:
    if (
      notNullOrUndefined(parameters.max_value) &&
      cellData > parameters.max_value
    ) {
      return parameters.max_value
    }

    // TODO: validate step size
    // if (notNullOrUndefined(parameters.step) && parameters.step !== 1)

    return true
  }

  return {
    ...props,
    kind: "number",
    sortMode: "smart",
    validateInput,
    getCell(data?: any, validate?: boolean): GridCell {
      if (validate === true) {
        const validationResult = validateInput(data)
        if (validationResult === false) {
          // The input is invalid, we return an error cell which will
          // prevent this cell to be inserted into the table.
          return getErrorCell(toSafeString(data), "Invalid input.")
        } else if (typeof validationResult === "number") {
          // Apply corrections:
          data = validationResult
        }
      }

      let cellData: number | null = toSafeNumber(data)
      let displayData: string | undefined

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

        if (Number.isInteger(cellData) && !Number.isSafeInteger(cellData)) {
          return getErrorCell(
            toSafeString(data),
            "The value is larger than the maximum supported integer in number columns (2^53)."
          )
        }

        // Apply format configuration option:
        if (notNullOrUndefined(parameters.format)) {
          try {
            displayData = sprintf(parameters.format, cellData)
          } catch (error) {
            return getErrorCell(
              toSafeString(cellData),
              `Format configuration (${parameters.format}) is not sprintf compatible. Error: ${error}`
            )
          }
        }
      }

      if (displayData === undefined) {
        if (isNullOrUndefined(cellData)) {
          displayData = ""
        } else if (notNullOrUndefined(fixedDecimals)) {
          displayData = formatNumber(cellData, fixedDecimals, true)
        } else {
          displayData = formatNumber(cellData)
        }
      }

      return {
        ...cellTemplate,
        data: cellData,
        displayData,
        isMissingValue: isNullOrUndefined(cellData),
      } as NumberCell
    },
    getCellValue(cell: NumberCell): number | null {
      return cell.data === undefined ? null : cell.data
    },
  }
}

NumberColumn.isEditableType = true

export default NumberColumn
