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

import { isNullOrUndefined } from "src/lib/utils"

import {
  BaseColumn,
  BaseColumnProps,
  getErrorCell,
  getEmptyCell,
  ColumnCreator,
  toSafeString,
  mergeColumnParameters,
  formatNumber,
  toSafeNumber,
} from "./utils"

export interface RangeColumnParams {
  // The minimum permitted value. Defaults to 0.
  readonly min?: number
  // The maximum permitted value. Defaults to 1.
  readonly max?: number
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
      min: 0,
      max: 1,
      step: 0.01,
    },
    // User parameters:
    props.columnTypeMetadata
  ) as RangeColumnParams

  const cellTemplate = {
    kind: GridCellKind.Custom,
    allowOverlay: false,
    copyData: "",
    contentAlign: props.contentAlignment,
    data: {
      kind: "range-cell",
      min: parameters.min,
      max: parameters.max,
      step: parameters.step,
      value: 0,
      label: "0",
      measureLabel: "0.00",
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
        return getEmptyCell()
      }

      if (
        isNullOrUndefined(parameters.min) ||
        isNullOrUndefined(parameters.max) ||
        Number.isNaN(parameters.min) ||
        Number.isNaN(parameters.max) ||
        parameters.min >= parameters.max
      ) {
        return getErrorCell(
          "Invalid min/max parameters",
          `The min (${parameters.min}) and max (${parameters.max}) parameters must be valid numbers.`
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

      // TODO(lukasmasuch): count decimals of step and use it for formatting?
      // so that all labels have the same length
      const displayValue = formatNumber(
        Math.ceil(cellData / parameters.step) * parameters.step
      )

      // If the value is outside the range, we scale it to the min/max
      // for the visualization.
      const normalizeCellValue = Math.min(
        parameters.max,
        Math.max(parameters.min, cellData)
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

export default RangeColumn as ColumnCreator
