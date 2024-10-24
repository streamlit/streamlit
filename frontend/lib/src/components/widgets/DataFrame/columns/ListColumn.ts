/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { BubbleCell, GridCell, GridCellKind } from "@glideapps/glide-data-grid"

import { isNullOrUndefined } from "@streamlit/lib/src/util/utils"

import {
  BaseColumn,
  BaseColumnProps,
  isMissingValueCell,
  toSafeArray,
  toSafeString,
} from "./utils"

/**
 * A column type that supports optimized rendering values of array/list types.
 */
function ListColumn(props: BaseColumnProps): BaseColumn {
  const cellTemplate = {
    kind: GridCellKind.Bubble,
    data: [],
    allowOverlay: true,
    contentAlign: props.contentAlignment,
    style: props.isPinned ? "faded" : "normal",
  } as BubbleCell

  return {
    ...props,
    kind: "list",
    sortMode: "default",
    isEditable: false, // List column is always readonly
    getCell(data?: any): GridCell {
      const cellData = isNullOrUndefined(data) ? [] : toSafeArray(data)

      return {
        ...cellTemplate,
        data: cellData,
        isMissingValue: isNullOrUndefined(data),
        copyData: isNullOrUndefined(data)
          ? ""
          : toSafeString(
              cellData.map((x: any) =>
                // Replace commas with spaces since commas are used to
                // separate the list items.
                typeof x === "string" && x.includes(",")
                  ? x.replace(/,/g, " ")
                  : x
              )
            ),
      } as BubbleCell
    },
    getCellValue(cell: BubbleCell): string[] | null {
      if (isNullOrUndefined(cell.data) || isMissingValueCell(cell)) {
        return null
      }

      return cell.data
    },
  }
}

ListColumn.isEditableType = false

export default ListColumn
