/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { MarkdownCell } from "./cells/MarkdownCell"
import {
  BaseColumn,
  BaseColumnProps,
  getErrorCell,
  removeLineBreaks,
  toSafeString,
} from "./utils"

/** A column that supports rendering and editing of markdown text. */
function MarkdownColumn(props: BaseColumnProps): BaseColumn {
  const cellTemplate: MarkdownCell = {
    kind: GridCellKind.Custom,
    allowOverlay: true,
    contentAlign: props.contentAlignment,
    readonly: !props.isEditable,
    // The text in pinned columns should be faded.
    style: props.isPinned ? "faded" : "normal",
    copyData: "",
    data: {
      kind: "markdown-cell",
      value: null,
      displayValue: "",
    },
  }

  const validateInput = (data?: unknown): boolean =>
    !(isNullOrUndefined(data) && props.isRequired)

  return {
    ...props,
    kind: "markdown",
    sortMode: "default",
    typeIcon: ":material/markdown:",
    validateInput,
    getCell(data?: unknown, validate?: boolean): GridCell {
      if (validate && !validateInput(data)) {
        return getErrorCell(toSafeString(data), "Invalid input.")
      }

      const cellData = notNullOrUndefined(data) ? toSafeString(data) : null

      return {
        ...cellTemplate,
        copyData: cellData ?? "",
        isMissingValue: isNullOrUndefined(cellData),
        data: {
          ...cellTemplate.data,
          value: cellData,
          displayValue: cellData ? removeLineBreaks(cellData) : "",
        },
      } as MarkdownCell
    },
    getCellValue(cell: MarkdownCell): string | null {
      return cell.data?.value ?? null
    },
  }
}

MarkdownColumn.isEditableType = true

export default MarkdownColumn
