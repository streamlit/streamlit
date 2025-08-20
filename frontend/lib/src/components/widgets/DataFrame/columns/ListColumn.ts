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
import { MultiSelectCellType } from "@glideapps/glide-data-grid-cells"

import { isNullOrUndefined } from "~lib/util/utils"

import {
  arrayToCopyValue,
  BaseColumn,
  BaseColumnProps,
  isEditableArrayValue,
  toSafeArray,
} from "./utils"

/**
 * A column type that supports optimized rendering and editing of
 *  values of array/list types.
 */
function ListColumn(props: BaseColumnProps): BaseColumn {
  const cellTemplate: MultiSelectCellType = {
    kind: GridCellKind.Custom,
    readonly: !props.isEditable,
    allowOverlay: true,
    contentAlign: props.contentAlignment,
    style: "normal",
    copyData: "",
    data: {
      // We are reusing the multi-select cell type for list columns:
      kind: "multi-select-cell",
      values: [],
      // List column don't have options, and allow creation & duplication.
      options: undefined,
      allowCreation: true,
      allowDuplicates: true,
    },
  }

  return {
    ...props,
    kind: "list",
    sortMode: "default",
    typeIcon: ":material/list:",
    getCell(data?: unknown): GridCell {
      if (isNullOrUndefined(data)) {
        return {
          ...cellTemplate,
          data: {
            ...cellTemplate.data,
            values: null,
          },
          // @ts-expect-error - isMissingValue is not a valid property of MultiSelectCellType
          // but needed to activate the missing cell handling.
          isMissingValue: true,
          copyData: "",
        } satisfies MultiSelectCellType
      }

      const cellData = toSafeArray(data)

      return {
        ...cellTemplate,
        data: {
          ...cellTemplate.data,
          values: cellData,
        },
        copyData: arrayToCopyValue(cellData),
        ...(props.isEditable &&
          !isEditableArrayValue(data) && {
            readonly: true,
            isError: true,
            errorDetails:
              "Editing of arrays with non-string values is not supported. " +
              "Please disable editing or convert all values to strings.",
          }),
      } satisfies MultiSelectCellType
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
