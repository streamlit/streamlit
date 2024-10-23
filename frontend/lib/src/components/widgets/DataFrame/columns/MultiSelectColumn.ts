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
import { unique } from "vega-lite"

import { EmotionTheme } from "@streamlit/lib/src/theme"
import { isNullOrUndefined } from "@streamlit/lib/src/util/utils"

import {
  arrayToCopyValue,
  BaseColumn,
  BaseColumnProps,
  getErrorCell,
  mergeColumnParameters,
  toSafeArray,
  toSafeString,
} from "./utils"

type SelectOption = { value: string; label?: string; color?: string }

/**
 * Unifies the options into the format required by the multi-select cell.
 *
 * @param options The options to prepare.
 * @returns The prepared options in the format required by the multi-select cell.
 */
export const prepareOptions = (
  options: readonly (string | SelectOption)[]
): { value: string; label?: string; color?: string }[] => {
  if (isNullOrUndefined(options)) {
    return []
  }

  return options
    .filter(opt => opt !== null && opt !== "")
    .map(option => {
      if (typeof option === "string") {
        return {
          value: toSafeString(option).trim(),
          label: undefined,
          color: undefined,
        }
      }

      return {
        value: toSafeString(option.value).trim(),
        label: option.label ?? undefined,
        color: option.color ?? undefined,
      }
    })
}

export interface MultiSelectColumnParams {
  readonly options: (string | SelectOption)[]
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

  const preparedOptions = prepareOptions(parameters.options)
  const uniqueOptions = unique(
    preparedOptions.map(opt => opt.value),
    x => x
  )

  const cellTemplate = {
    kind: GridCellKind.Custom,
    readonly: !props.isEditable,
    allowOverlay: true,
    contentAlign: props.contentAlignment,
    style: props.isIndex ? "faded" : "normal",
    data: {
      kind: "multi-select-cell",
      values: [],
      options: preparedOptions,
      allowCreation: false,
      allowDuplicates: false,
    },
    copyData: "",
  } as MultiSelectCellType

  return {
    ...props,
    kind: "multiselect",
    sortMode: "default",
    themeOverride: {
      roundingRadius: 4,
      bgBubble: theme.colors.primary,
      bgBubbleSelected: theme.colors.primary,
      textBubble: theme.colors.white,
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
        } as MultiSelectCellType
      }

      let cellData = toSafeArray(data)

      cellData = cellData.map((x: any) => toSafeString(x).trim())

      if (validate && cellData.length > 0) {
        // Filter out values that are not in the options list:
        cellData = cellData.filter((x: string) => uniqueOptions.includes(x))
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

MultiSelectColumn.isEditableType = true

export default MultiSelectColumn
