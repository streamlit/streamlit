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

import { notNullOrUndefined, isNullOrUndefined } from "src/lib/util/utils"

import {
  BaseColumn,
  BaseColumnProps,
  getErrorCell,
  ColumnCreator,
  toSafeString,
} from "./utils"

/**
 * A column that supports rendering & editing of text values.
 */
function TextColumn(props: BaseColumnProps): BaseColumn {
  const cellTemplate = {
    kind: GridCellKind.Text,
    data: "",
    displayData: "",
    allowOverlay: true,
    contentAlignment: props.contentAlignment,
    readonly: !props.isEditable,
    style: props.isIndex ? "faded" : "normal",
  } as TextCell

  return {
    ...props,
    kind: "text",
    sortMode: "default",
    getCell(data?: any): GridCell {
      try {
        const cellData = notNullOrUndefined(data) ? toSafeString(data) : null
        const displayData = notNullOrUndefined(cellData) ? cellData : ""
        return {
          ...cellTemplate,
          isMissingValue: isNullOrUndefined(cellData),
          data: cellData,
          displayData,
        } as TextCell
      } catch (error) {
        // This should never happen, but if it does, we want to show an error
        return getErrorCell(
          "Incompatible value",
          `The value cannot be interpreted as string. Error: ${error}`
        )
      }
    },
    getCellValue(cell: TextCell): string | null {
      return cell.data === undefined ? null : cell.data
    },
  }
}

TextColumn.isEditableType = true

export default TextColumn as ColumnCreator
