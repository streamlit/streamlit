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

import {
  GridCell,
  MarkdownCell,
  GridCellKind,
} from "@glideapps/glide-data-grid"

import {
  notNullOrUndefined,
  isNullOrUndefined,
} from "@streamlit/lib/src/util/utils"

import { BaseColumn, BaseColumnProps, ColumnCreator } from "./utils"

export interface HTMLColumnParams {}

function MarkdownColumn(props: BaseColumnProps): BaseColumn {
  const cellTemplate = {
    kind: GridCellKind.Markdown,
    data: "",
    copyData: "true",
    allowOverlay: true,
  } as MarkdownCell

  return {
    ...props,
    kind: "markdown",
    sortMode: "default",
    getCell(data?: any): GridCell {
      return {
        ...cellTemplate,
        data: data,
        isMissingValue: isNullOrUndefined(data),
      } as MarkdownCell
    },
    getCellValue(cell: MarkdownCell): string | null {
      return cell.data === undefined ? null : cell.data
    },
  }
}

MarkdownColumn.isEditableType = true

export default MarkdownColumn as ColumnCreator
