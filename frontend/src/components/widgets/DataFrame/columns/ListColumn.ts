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

import { notNullOrUndefined } from "src/lib/utils"

import {
  BaseColumn,
  BaseColumnProps,
  ColumnCreator,
  toSafeArray,
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
    style: props.isIndex ? "faded" : "normal",
  } as BubbleCell

  return {
    ...props,
    kind: "list",
    sortMode: "default",
    isEditable: false, // List column is always readonly
    getCell(data?: any): GridCell {
      // TODO(lukasmasuch): if notNullOrUndefined -> use empty cell to return null value
      return {
        ...cellTemplate,
        data: toSafeArray(data),
        isMissingValue: !notNullOrUndefined(data),
      } as BubbleCell
    },
    getCellValue(cell: BubbleCell): string[] | null {
      return cell.data === undefined ? null : cell.data
    },
  }
}

ListColumn.isEditableType = false

export default ListColumn as ColumnCreator
