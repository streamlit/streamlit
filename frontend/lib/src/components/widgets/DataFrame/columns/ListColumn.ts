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

import { GridCell, GridCellKind } from "@glideapps/glide-data-grid"
import { MultiSelectCellType } from "@glideapps/glide-data-grid-cells"

import { isNullOrUndefined } from "@streamlit/lib/src/util/utils"

import {
  arrayToCopyValue,
  BaseColumn,
  BaseColumnProps,
  toSafeArray,
} from "./utils"

/**
 * A column type that supports optimized rendering values of array/list types.
 */
function ListColumn(props: BaseColumnProps): BaseColumn {
  const cellTemplate = {
    kind: GridCellKind.Custom,
    readonly: !props.isEditable,
    allowOverlay: true,
    contentAlign: props.contentAlignment,
    style: props.isIndex ? "faded" : "normal",
    data: {
      kind: "multi-select-cell",
      values: [],
      options: undefined,
      allowCreation: true,
      allowDuplicates: true,
    },
    copyData: "",
  } as MultiSelectCellType

  return {
    ...props,
    kind: "list",
    sortMode: "default",
    themeOverride: {
      roundingRadius: 4,
    },
    getCell(data?: any): GridCell {
      if (isNullOrUndefined(data)) {
        return {
          ...cellTemplate,
          data: {
            ...cellTemplate.data,
            values: null,
          },
          isMissingValue: true,
          copyData: "",
        } as MultiSelectCellType
      }

      const cellData = toSafeArray(data)

      return {
        ...cellTemplate,
        data: {
          ...cellTemplate.data,
          values: cellData,
        },
        copyData: arrayToCopyValue(cellData),
      } as MultiSelectCellType
    },
    getCellValue(cell: MultiSelectCellType): string[] | null {
      if (isNullOrUndefined(cell.data?.values)) {
        return null
      }

      return cell.data.values
    },
  }
}

ListColumn.isEditableType = true

export default ListColumn
