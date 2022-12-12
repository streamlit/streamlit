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

import { GridCell, UriCell, GridCellKind } from "@glideapps/glide-data-grid"

import { DataType } from "src/lib/Quiver"
import { notNullOrUndefined } from "src/lib/utils"

import { BaseColumn, BaseColumnProps, ColumnCreator } from "./BaseColumn"

function UrlColumn(props: BaseColumnProps): BaseColumn {
  const cellTemplate = {
    kind: GridCellKind.Uri,
    data: "",
    readonly: !props.isEditable,
    allowOverlay: true,
    contentAlign: props.contentAlignment,
    style: props.isIndex ? "faded" : "normal",
  } as UriCell

  return {
    ...props,
    kind: "url",
    sortMode: "default",
    getCell(data?: DataType): GridCell {
      return {
        ...cellTemplate,
        data: notNullOrUndefined(data) ? String(data) : null,
      } as UriCell
    },
    getCellValue(cell: UriCell): string | null {
      return cell.data === undefined ? null : cell.data
    },
  }
}

UrlColumn.isEditableType = true

export default UrlColumn as ColumnCreator
