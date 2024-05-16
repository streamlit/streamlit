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

import { GridCell, GridCellKind, MarkdownCell } from "@glideapps/glide-data-grid"

import { isNullOrUndefined } from "@streamlit/lib/src/util/utils"

import {
  BaseColumn,
  BaseColumnProps,
  toSafeString,
} from "./utils"

export interface MarkdownColumnParams {
  // The maximum number of characters the user can enter into the text input.
  readonly max_chars?: number
  // a value to display in the link cell. Can be a regex to parse out a specific substring of the url to be displayed
  readonly markdown?: string
}

/**
 * The link column is a special column that interprets the cell content as
 * an hyperlink / url and allows the user to click on it.
 */
function LinkColumn(props: BaseColumnProps): BaseColumn {
  const parameters = (props.columnTypeOptions as MarkdownColumnParams) || {}

  const cellTemplate = {
    kind: GridCellKind.Markdown,
    readonly: !props.isEditable,
    allowOverlay: true,
    contentAlign: props.contentAlignment,
    style: props.isIndex ? "faded" : "normal",
    hoverEffect: true,
    data: "",
    copyData: "",
  } as MarkdownCell

  const validateInput = (markdown?: string): boolean => {
    if (isNullOrUndefined(markdown)) {
      if (props.isRequired) {
        return false
      }
      return true
    }

    const cellMarkdown = toSafeString(markdown)

    if (parameters.max_chars && cellMarkdown.length > parameters.max_chars) {
      // value is too long
      return false
    }

    return true
  }

  return {
    ...props,
    kind: "markdown",
    sortMode: "default",
    validateInput,
    getCell(data?: any): GridCell {
      if (!data) {
        return {
          ...cellTemplate,
          data: null as any,
          isMissingValue: true,
        } as MarkdownCell
      }

      const markdown: string = toSafeString(data)

      return {
        ...cellTemplate,
        data: markdown,
        isMissingValue: false,
        copyData: markdown,
      } as MarkdownCell
    },
    getCellValue(cell: MarkdownCell): string | null {
      return isNullOrUndefined(cell.data) ? null : cell.data
    },
  }
}

LinkColumn.isEditableType = true

export default LinkColumn
