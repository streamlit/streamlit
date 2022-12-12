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

import { GridCell, GridCellKind, ImageCell } from "@glideapps/glide-data-grid"

import { DataType } from "src/lib/Quiver"
import { notNullOrUndefined } from "src/lib/utils"

import { BaseColumn, BaseColumnProps } from "./BaseColumn"

function ImageColumn(props: BaseColumnProps): BaseColumn {
  const cellTemplate = {
    kind: GridCellKind.Image,
    data: [],
    displayData: [],
    allowAdd: false,
    allowOverlay: true,
    contentAlign: props.contentAlignment,
    style: props.isIndex ? "faded" : "normal",
  } as ImageCell

  return {
    ...props,
    kind: "image",
    sortMode: "default",
    isEditable: false, // Image columns are read-only
    getCell(data?: DataType): GridCell {
      const imageUrls = notNullOrUndefined(data) ? [String(data)] : []

      return {
        ...cellTemplate,
        data: imageUrls,
        displayData: imageUrls,
      } as ImageCell
    },
    getCellValue(cell: ImageCell): string | null {
      if (cell.data === undefined || cell.data.length === 0) {
        return null
      }

      // We use the image cell only for single images,
      // so we can safely return just the first element
      return cell.data[0]
    },
  }
}

ImageColumn.isEditableType = false

export default ImageColumn
