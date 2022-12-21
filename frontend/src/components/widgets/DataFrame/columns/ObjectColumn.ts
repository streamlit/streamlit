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

import { GridCell, TextCell, GridCellKind } from "@glideapps/glide-data-grid"

import { DataType } from "src/lib/Quiver"
import { notNullOrUndefined } from "src/lib/utils"

import { BaseColumn, BaseColumnProps, getErrorCell } from "./BaseColumn"

function ObjectColumn(props: BaseColumnProps): BaseColumn {
  const cellTemplate = {
    kind: GridCellKind.Text,
    data: "",
    displayData: "",
    allowOverlay: true,
    contentAlignment: props.contentAlignment,
    readonly: true,
    style: props.isIndex ? "faded" : "normal",
  } as TextCell

  return {
    ...props,
    kind: "object",
    sortMode: "default",
    isEditable: false, // Object columns are read-only.
    getCell(data?: DataType): GridCell {
      try {
        const cellData = notNullOrUndefined(data) ? data.toString() : null
        const displayData = notNullOrUndefined(cellData) ? cellData : ""
        return {
          ...cellTemplate,
          data: cellData,
          displayData,
        } as TextCell
      } catch (error) {
        return getErrorCell(
          `Incompatible text value: ${typeof data}`,
          `Error: ${error}`
        )
      }
    },
    getCellValue(cell: TextCell): string | null {
      return cell.data === undefined ? null : cell.data
    },
  }
}

export default ObjectColumn
