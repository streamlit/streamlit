/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { GridCell, GridCellKind, TextCell } from "@glideapps/glide-data-grid"

import { isNullOrUndefined, notNullOrUndefined } from "~lib/util/utils"

import {
  BaseColumn,
  BaseColumnProps,
  getErrorCell,
  removeLineBreaks,
  toSafeString,
} from "./utils"

/**
 * A column type for read-only cells used as a fallback
 * for data types that are currently not supported for editing.
 */
function ObjectColumn(props: BaseColumnProps): BaseColumn {
  const cellTemplate: TextCell = {
    kind: GridCellKind.Text,
    data: "",
    displayData: "",
    allowOverlay: true,
    contentAlign: props.contentAlignment,
    allowWrapping: props.isWrappingAllowed,
    readonly: true,
    // The text in pinned columns should be faded.
    style: props.isPinned ? "faded" : "normal",
  }
  return {
    ...props,
    kind: "object",
    sortMode: "default",
    typeIcon: ":material/data_object:",
    isEditable: false, // Object columns are read-only.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    getCell(data?: any): GridCell {
      try {
        const cellData = notNullOrUndefined(data) ? toSafeString(data) : null
        const displayData = notNullOrUndefined(cellData)
          ? removeLineBreaks(cellData) // Remove line breaks to show all content in the cell
          : ""
        return {
          ...cellTemplate,
          data: cellData,
          displayData,
          isMissingValue: isNullOrUndefined(data),
        } as TextCell
      } catch (error) {
        return getErrorCell(
          toSafeString(data),
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `The value cannot be interpreted as a string. Error: ${error}`
        )
      }
    },
    getCellValue(cell: TextCell): string | null {
      return cell.data === undefined ? null : cell.data
    },
  }
}

ObjectColumn.isEditableType = false

export default ObjectColumn
