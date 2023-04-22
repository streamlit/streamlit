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

import {
  GridCell,
  GridCellKind,
  LoadingCell,
} from "@glideapps/glide-data-grid"
import { RangeCellType } from "@glideapps/glide-data-grid-cells"
import { sprintf } from "sprintf-js"

import { isNullOrUndefined, notNullOrUndefined } from "src/lib/utils"

import {
  BaseColumn,
  BaseColumnProps,
  getErrorCell,
  getEmptyCell,
  toSafeString,
  mergeColumnParameters,
  formatNumber,
  toSafeNumber,
  countDecimals,
} from "./utils"

export interface RangeColumnParams {
  // The minimum permitted value. Defaults to 0.
  readonly min_value?: number
  // The maximum permitted value. Defaults to 1.
  readonly max_value?: number
  // A formatting syntax (e.g. sprintf) to format the display value.
  // This can be used for adding prefix or suffix, or changing the number of decimals of the display value.
  readonly format?: string
  // The stepping interval. Defaults to 0.01.
  // Mainly useful once we provide editing capabilities.
  readonly step?: number
}

/**
 * A read-only column type to support rendering values that have a defined
 * range. This is rendered via a progress-bar-like visualization.
 */
function RangeColumn(props: BaseColumnProps): BaseColumn {
  const parameters = mergeColumnParameters(
    // Default parameters:
    {
      min_value: 0,
      max_value: 1,
      step: 0.01,
    } as RangeColumnParams,
    // User parameters:
    props.columnTypeOptions
  ) as RangeColumnParams

  const fixedDecimals =
    isNullOrUndefined(parameters.step) || Number.isNaN(parameters.step)
      ? undefined
      : countDecimals(parameters.step)

  const cellTemplate = {
    kind: GridCellKind.Custom,
    allowOverlay: false,
    copyData: "",
    contentAlign: props.contentAlignment,
    data: {
      kind: "range-cell",
      min: parameters.min_value,
      max: parameters.max_value,
      step: parameters.step,
      value: parameters.min_value,
      label: String(parameters.min_value),
      measureLabel: String(parameters.step),
      readonly: true,
    },
  } as RangeCellType

  return {
    ...props,
    kind: "range",
    sortMode: "smart",
    isEditable: false, // Range column is always readonly
    getCell(data?: any): GridCell {
      if (isNullOrUndefined(data)) {
        // TODO(lukasmasuch): Use a missing cell?
        return getEmptyCell()
      }

      if (
        isNullOrUndefined(parameters.min_value) ||
        isNullOrUndefined(parameters.max_value) ||
        Number.isNaN(parameters.min_value) ||
        Number.isNaN(parameters.max_value) ||
        parameters.min_value >= parameters.max_value
      ) {
        return getErrorCell(
          "Invalid min/max parameters",
          `The min_value (${parameters.min_value}) and max_value (${parameters.max_value}) parameters must be valid numbers.`
        )
      }

      if (
        isNullOrUndefined(parameters.step) ||
        Number.isNaN(parameters.step)
      ) {
        return getErrorCell(
          "Invalid step parameter",
          `The step parameter (${parameters.step}) must be a valid number.`
        )
      }

      const cellData = toSafeNumber(data)

      if (Number.isNaN(cellData) || isNullOrUndefined(cellData)) {
        return getErrorCell(
          toSafeString(data),
          "The value cannot be interpreted as a number."
        )
      }

      if (Number.isInteger(cellData) && !Number.isSafeInteger(cellData)) {
        return getErrorCell(
          toSafeString(data),
          "The value is larger than the maximum supported integer value (2^53)."
        )
      }

      let displayValue

      if (notNullOrUndefined(parameters.format)) {
        // Apply format configuration option:
        try {
          displayValue = sprintf(parameters.format, cellData)
        } catch (error) {
          return getErrorCell(
            toSafeString(cellData),
            `Format configuration (${parameters.format}) is not sprintf compatible. Error: ${error}`
          )
        }
      } else if (notNullOrUndefined(fixedDecimals)) {
        // TODO (lukasmasuch): Adapt number to step size?
        displayValue = formatNumber(cellData, fixedDecimals, true)
      } else {
        displayValue = formatNumber(cellData)
      }

      // If the value is outside the range, we scale it to the min/max
      // for the visualization.
      const normalizeCellValue = Math.min(
        parameters.max_value,
        Math.max(parameters.min_value, cellData)
      )

      return {
        ...cellTemplate,
        isMissingValue: isNullOrUndefined(data),
        copyData: String(cellData), // Column sorting is done via the copyData value
        data: {
          ...cellTemplate.data,
          value: normalizeCellValue,
          label: displayValue, // TODO(lukasmasuch): add empty prefix to align with other cells based on min/max
          measureLabel: displayValue,
        },
      } as RangeCellType
    },
    getCellValue(cell: RangeCellType | LoadingCell): number | null {
      if (cell.kind === GridCellKind.Loading) {
        return null
      }
      return cell.data?.value === undefined ? null : cell.data?.value
    },
  }
}

RangeColumn.isEditableType = false

export default RangeColumn
