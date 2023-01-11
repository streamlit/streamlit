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

import { DataType, Quiver } from "src/lib/Quiver"
import { notNullOrUndefined } from "src/lib/utils"

import {
  BaseColumn,
  BaseColumnProps,
  getErrorCell,
  ColumnCreator,
  toSafeString,
  mergeColumnParameters,
  toSafeNumber,
  formatNumber,
} from "./utils"

export interface NumberColumnParams {
  /** Floating point precision to limit the number of digits after the decimal point.
  This is set to 0 for integer columns. */
  readonly precision?: number
  // The minimum allowed value for editing. Is set to 0 for unsigned values.
  readonly min?: number
  // The maximum allowed value for editing.
  readonly max?: number
  /** A formatting syntax (e.g. sprintf) to format the display value.
  This can be used for adding prefix or suffix, or changing the number of decimals of the display value. */
  readonly format?: string
}

/**
 * A column types that supports optimized rendering and editing support for numbers.
 * This supports float, integer, and unsigned integer types.
 */
function NumberColumn(props: BaseColumnProps): BaseColumn {
  const quiverTypeName = Quiver.getTypeName(props.quiverType)

  const parameters = mergeColumnParameters(
    // Default parameters:
    {
      precision:
        quiverTypeName.startsWith("int") ||
        quiverTypeName === "range" ||
        quiverTypeName.startsWith("uint")
          ? 0
          : undefined,
      // if uint (unsigned int), only positive numbers are allowed
      min: quiverTypeName.startsWith("uint") ? 0 : undefined,
    },
    // User parameters:
    props.columnTypeMetadata
  ) as NumberColumnParams

  const cellTemplate = {
    kind: GridCellKind.Number,
    data: undefined,
    displayData: "",
    readonly: !props.isEditable,
    allowOverlay: true,
    contentAlign: props.contentAlignment || "right",
    style: props.isIndex ? "faded" : "normal",
  } as NumberCell

  return {
    ...props,
    kind: "number",
    sortMode: "smart",
    getCell(data?: DataType): GridCell {
      let cellData: number | null = toSafeNumber(data)
      let displayData: string | undefined

      if (notNullOrUndefined(cellData)) {
        if (Number.isNaN(cellData)) {
          return getErrorCell(toSafeString(data), "Incompatible number value.")
        }

        // Apply precision parameter
        if (notNullOrUndefined(parameters.precision)) {
          // TODO(lukasmasuch): Instead of applying precision here,
          // it would be better to update the cell implementation to support precision
          // directly in the input field.
          cellData =
            parameters.precision === 0
              ? Math.trunc(cellData)
              : Math.trunc(cellData * 10 ** parameters.precision) /
                10 ** parameters.precision
        }

        // Apply min parameter
        if (notNullOrUndefined(parameters.min)) {
          cellData = Math.max(cellData, parameters.min)
        }

        // Apply max parameter
        if (notNullOrUndefined(parameters.max)) {
          cellData = Math.min(cellData, parameters.max)
        }

        // If user has specified a format pattern in type metadata
        if (notNullOrUndefined(parameters.format)) {
          try {
            displayData = sprintf(parameters.format, cellData)
          } catch (error) {
            return getErrorCell(
              toSafeString(cellData),
              `Format value (${parameters.format}) not sprintf compatible. Error: ${error}`
            )
          }
        }
      }
      if (displayData === undefined) {
        displayData = notNullOrUndefined(cellData)
          ? formatNumber(cellData)
          : ""
      }

      return {
        ...cellTemplate,
        data: cellData,
        displayData,
        isMissingValue: !notNullOrUndefined(cellData),
      } as NumberCell
    },
    getCellValue(cell: NumberCell): number | null {
      return cell.data === undefined ? null : cell.data
    },
  }
}

NumberColumn.isEditableType = true

export default NumberColumn as ColumnCreator
