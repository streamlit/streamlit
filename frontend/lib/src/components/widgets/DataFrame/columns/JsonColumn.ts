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

import { GridCell, GridCellKind } from "@glideapps/glide-data-grid"

import { isNullOrUndefined, notNullOrUndefined } from "@streamlit/utils"

import { JsonCell } from "./cells/JsonCell"
import {
  BaseColumn,
  BaseColumnProps,
  getErrorCell,
  removeLineBreaks,
  toJsonString,
  toSafeString,
} from "./utils"

/**
 * A column type for read-only cells that contain JSON strings or JSON-compatible objects.
 */
function JsonColumn(props: BaseColumnProps): BaseColumn {
  const cellTemplate: JsonCell = {
    kind: GridCellKind.Custom,
    allowOverlay: true,
    contentAlign: props.contentAlignment,
    readonly: true,
    // The text in pinned columns should be faded.
    style: props.isPinned ? "faded" : "normal",
    copyData: "",
    data: {
      kind: "json-cell",
      value: "",
    },
  }

  return {
    ...props,
    kind: "json",
    typeIcon: ":material/code_blocks:",
    sortMode: "default",
    isEditable: false, // Json columns are read-only.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    getCell(data?: any): GridCell {
      try {
        const displayValue = notNullOrUndefined(data)
          ? removeLineBreaks(toJsonString(data))
          : ""

        return {
          ...cellTemplate,
          copyData: displayValue,
          isMissingValue: isNullOrUndefined(data),
          data: {
            ...cellTemplate.data,
            value: data,
            displayValue,
          },
        } as JsonCell
      } catch (error) {
        return getErrorCell(
          toSafeString(data),
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `The value cannot be interpreted as a JSON string. Error: ${error}`
        )
      }
    },
    getCellValue(cell: JsonCell): string | object | null {
      return cell.data?.value ?? null
    },
  }
}

JsonColumn.isEditableType = false

export default JsonColumn
