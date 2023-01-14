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

import { GridCell, GridCellKind } from "@glideapps/glide-data-grid"
import { RangeCellType } from "@glideapps/glide-data-grid-cells"

import { notNullOrUndefined } from "src/lib/utils"

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

interface RangeColumnParams {
  // The minimum permitted value. Defaults to 0.
  readonly min: number
  // The maximum permitted value. Defaults to 1.
  readonly max: number
  // The stepping interval. Defaults to 0.01.
  // Mainly useful once we provide editing capabilities.
  readonly step: number
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
      if (!notNullOrUndefined(data)) {
        return getEmptyCell()
      }

      const cellData = toSafeNumber(data)

      if (Number.isNaN(cellData) || !notNullOrUndefined(cellData)) {
        return getErrorCell(toSafeString(data), "The value is not a number.")
      }

      // TODO(lukasmasuch): count decimals of step and use it for formatting?
      // so that all labels have the same length
      const displayValue = formatNumber(
        Math.ceil(cellData / parameters.step) * parameters.step
      )

      return {
        ...cellTemplate,
        isMissingValue: !notNullOrUndefined(data),
        copyData: String(data),
        data: {
          ...cellTemplate.data,
          value: cellData,
          label: displayValue,
          measureLabel: displayValue,
        },
      } as RangeCellType
    },
    getCellValue(cell: RangeCellType): number | null {
      return cell.data?.value === undefined ? null : cell.data?.value
    },
  }
}

RangeColumn.isEditableType = false

export default RangeColumn as ColumnCreator
