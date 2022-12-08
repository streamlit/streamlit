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

import { DataType } from "src/lib/Quiver"
import { notNullOrUndefined } from "src/lib/utils"

import {
  BaseColumn,
  BaseColumnProps,
  getErrorCell,
  getEmptyCell,
} from "./BaseColumn"

function RangeColumn(props: BaseColumnProps): BaseColumn {
  const cellTemplate = {
    kind: GridCellKind.Custom,
    allowOverlay: false,
    copyData: "",
    contentAlign: props.contentAlignment,
    data: {
      kind: "range-cell",
      min: 0,
      max: 1,
      value: 0,
      step: 0.1,
      label: `0%`,
      measureLabel: "100%",
      readonly: true,
    },
  } as RangeCellType

  return {
    ...props,
    kind: "range",
    sortMode: "smart",
    isEditable: false, // Range column is always readonly
    getCell(data?: DataType): GridCell {
      if (!notNullOrUndefined(data)) {
        return getEmptyCell()
      }

      const cellData = Number(data)

      if (Number.isNaN(cellData) || cellData < 0 || cellData > 1) {
        return getErrorCell(
          `Incompatible progress value: ${data}`,
          "The value has to be between 0 and 1."
        )
      }

      return {
        ...cellTemplate,
        copyData: String(data),
        data: {
          ...cellTemplate.data,
          value: cellData,
          label: `${Math.round(cellData * 100).toString()}%`,
        },
      } as RangeCellType
    },
    getCellValue(cell: RangeCellType): number | null {
      return cell.data?.value === undefined ? null : cell.data?.value
    },
  }
}

export default RangeColumn
