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

import { GridCell, BubbleCell, GridCellKind } from "@glideapps/glide-data-grid"

import { DataType } from "src/lib/Quiver"
import { notNullOrUndefined } from "src/lib/utils"

import { BaseColumn, BaseColumnProps, ColumnCreator } from "./BaseColumn"

function ListColumn(props: BaseColumnProps): BaseColumn {
  const cellTemplate = {
    kind: GridCellKind.Bubble,
    data: [],
    allowOverlay: true,
    contentAlign: props.contentAlignment,
    style: props.isIndex ? "faded" : "normal",
  } as BubbleCell

  return {
    ...props,
    kind: "list",
    sortMode: "default",
    isEditable: false, // List column is always readonly
    getCell(data?: DataType): GridCell {
      let cellData = []
      //TODO(lukasmasuch): Only support arrays since we don't offer editing right now?
      // TODO(lukasmasuch): Use Array.from()
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from

      if (notNullOrUndefined(data)) {
        if (typeof data === "string") {
          // TODO: Should we really do this?
          //TODO(lukasmasuch): Catch error?
          cellData = JSON.parse(data)
        } else {
          cellData = JSON.parse(
            JSON.stringify(data, (_key, value) =>
              typeof value === "bigint" ? Number(value) : value
            )
          )
        }

        if (!Array.isArray(cellData)) {
          // Transform into list
          cellData = [String(cellData)]
          // TODO: Or return error?
          // return getErrorCell(
          //   `Incompatible list value: ${quiverCell.content}`,
          //   "The provided value is not an array."
          // )
        }
      }

      return {
        ...cellTemplate,
        data: cellData,
      } as BubbleCell
    },
    getCellValue(cell: BubbleCell): string[] | null {
      return cell.data === undefined ? null : cell.data
    },
  }
}

ListColumn.isEditableType = false

export default ListColumn as ColumnCreator
