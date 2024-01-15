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
import { EmotionTheme } from "@streamlit/lib/src/theme"

import {
  BaseColumn,
  BaseColumnProps,
  toSafeString,
  mergeColumnParameters,
  arrayToCopyValue,
  getErrorCell,
  toSafeArray,
} from "./utils"
import { MultiSelectCell } from "./cells/MultiSelectCell"

export interface MultiSelectColumnParams {
  readonly options: string[]
}

function MultiSelectColumn(
  props: BaseColumnProps,
  theme: EmotionTheme
): BaseColumn {
  const parameters = mergeColumnParameters(
    // Default parameters:
    {
      options: [],
    },
    // User parameters:
    props.columnTypeOptions
  ) as MultiSelectColumnParams

  const cellTemplate = {
    kind: GridCellKind.Custom,
    readonly: !props.isEditable,
    allowOverlay: true,
    contentAlign: props.contentAlignment,
    style: props.isIndex ? "faded" : "normal",
    data: {
      kind: "multi-select-cell",
      values: [],
      options: [
        ...parameters.options
          .filter(opt => opt !== null && opt !== "") // ignore empty option if it exists
          .map(opt => toSafeString(opt).trim()), // convert everything to string
      ],
      allowCreation: false,
      allowDuplicates: false,
    },
    copyData: "",
  } as MultiSelectCell

  return {
    ...props,
    kind: "multiselect",
    sortMode: "default",
    themeOverride: {
      roundingRadius: 4,
      bgBubble: theme.colors.primary,
      bgBubbleSelected: theme.colors.primary,
    },
    getCell(data?: any, validate?: boolean): GridCell {
      if (isNullOrUndefined(data)) {
        return {
          ...cellTemplate,
          data: {
            ...cellTemplate.data,
            values: null,
          },
          isMissingValue: true,
          copyData: "",
        } as MultiSelectCell
      }

      let cellData = toSafeArray(data)

      cellData = cellData.map((x: any) => toSafeString(x).trim())

      if (validate && cellData.length > 0) {
        // Filter out values that are not in the options list:
        cellData = cellData.filter((x: string) =>
          cellTemplate.data.options?.includes(x)
        )
        if (cellData.length === 0) {
          return getErrorCell(
            toSafeString(data),
            "The values could not be matched with the configured options."
          )
        }
      }

      return {
        ...cellTemplate,
        data: {
          ...cellTemplate.data,
          values: cellData,
        },
        copyData: arrayToCopyValue(cellData),
      } as MultiSelectCell
    },
    getCellValue(cell: MultiSelectCell): string[] | null {
      if (isNullOrUndefined(cell.data?.values)) {
        return null
      }

      return cell.data.values
    },
  }
}

MultiSelectColumn.isEditableType = true

export default MultiSelectColumn
