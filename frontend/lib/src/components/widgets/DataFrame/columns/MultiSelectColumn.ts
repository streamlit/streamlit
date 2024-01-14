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

import { isNullOrUndefined } from "@streamlit/lib/src/util/utils"

import {
  BaseColumn,
  BaseColumnProps,
  toSafeString,
  isMissingValueCell,
  ColumnCreator,
  toSafeArray,
} from "./utils"
import { MultiSelectCell } from "./cells/MultiSelectCell"

export interface MultiSelectColumnParams {
  readonly options?: string[]
}

function MultiSelectColumn(props: BaseColumnProps): BaseColumn {
  const parameters = (props.columnTypeOptions as MultiSelectColumnParams) || {}

  const cellTemplate = {
    kind: GridCellKind.Custom,
    readonly: !props.isEditable,
    allowOverlay: true,
    contentAlign: props.contentAlignment,
    style: props.isIndex ? "faded" : "normal",
    data: {
      kind: "multi-select-cell",
      values: [],
      options: parameters.options || [],
    },
    copyData: "",
    themeOverride: {
      roundingRadius: 4,
      // bgBubble:
    },
  } as MultiSelectCell

  return {
    ...props,
    kind: "link",
    sortMode: "default",
    getCell(data?: any, validate?: boolean): GridCell {
      const cellData = isNullOrUndefined(data) ? [] : toSafeArray(data)

      return {
        ...cellTemplate,
        data: {
          ...cellTemplate.data,
          values: cellData,
        },
        isMissingValue: isNullOrUndefined(data),
        copyData: isNullOrUndefined(data)
          ? ""
          : toSafeString(
              cellData.map((x: any) =>
                // Replace commas with spaces since commas are used to
                // separate the list items.
                typeof x === "string" && x.includes(",")
                  ? x.replace(/,/g, " ")
                  : x
              )
            ),
      } as MultiSelectCell
    },
    getCellValue(cell: MultiSelectCell): string[] | null {
      if (isNullOrUndefined(cell.data?.values) || isMissingValueCell(cell)) {
        return null
      }

      return cell.data.values
    },
  }
}

MultiSelectColumn.isEditableType = true

export default MultiSelectColumn as ColumnCreator
