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
  adaptToStep,
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

  return {
    ...props,
    kind: "number",
    sortMode: "smart",
    getCell(data?: any): GridCell {
      let cellData: number | null = toSafeNumber(data)
      let displayData: string | undefined

      if (notNullOrUndefined(cellData)) {
        if (Number.isNaN(cellData)) {
          return getErrorCell(
            toSafeString(data),
            "The value cannot be interpreted as a number."
          )
        }
        // Apply step configuration option:
        if (notNullOrUndefined(parameters.step) && parameters.step !== 1) {
          // TODO: Only apply this if it is actually a new submitted value?
          cellData = adaptToStep(cellData, parameters.step)
        }

        // Cut decimals:
        if (notNullOrUndefined(fixedDecimals)) {
          cellData = truncateDecimals(cellData, fixedDecimals)
        }

        // Apply min_value configuration option:
        if (notNullOrUndefined(parameters.min_value)) {
          // TODO: Only apply this if it is actually a new submitted value?
          cellData = Math.max(cellData, parameters.min_value)
        }

        // Apply max_value configuration option:
        if (notNullOrUndefined(parameters.max_value)) {
          // TODO: Only apply this if it is actually a new submitted value?
          cellData = Math.min(cellData, parameters.max_value)
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
