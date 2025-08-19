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
import { DropdownCellType } from "@glideapps/glide-data-grid-cells"

import { isBooleanType } from "~lib/dataframes/arrowTypeUtils"
import { isNullOrUndefined, notNullOrUndefined } from "~lib/util/utils"

import {
  BaseColumn,
  BaseColumnProps,
  getErrorCell,
  mergeColumnParameters,
  toSafeBoolean,
  toSafeNumber,
  toSafeString,
} from "./utils"

type SelectOption = { value: string | number | boolean; label?: string }

/**
 * Unifies the options into the format required by the selectbox cell.
 *
 * @param options The options to prepare.
 * @returns The prepared options in the format required by the selectbox cell.
 */
export const prepareOptions = (
  options: readonly (string | number | boolean | SelectOption)[]
): { value: string; label: string }[] => {
  if (isNullOrUndefined(options)) {
    return []
  }

  return options
    .filter(opt => notNullOrUndefined(opt) && opt !== "") // ignore empty option if it exists
    .map(option => {
      if (typeof option === "object" && "value" in option) {
        // Handle SelectOption type
        const optionValue = toSafeString(option.value).trim()
        return {
          value: optionValue,
          label: option.label ?? optionValue,
        }
      }

      // Handle primitive types (string, number, boolean)
      const optionValue = toSafeString(option).trim() // convert everything to string
      return {
        value: optionValue,
        label: optionValue,
      }
    })
}

export interface SelectboxColumnParams {
  /**
   * A list of options available in the selectbox.
   * Every value in the column needs to match one of the options.
   */
  readonly options: (string | number | boolean | SelectOption)[]
}

/**
 * A column type that supports optimized rendering and editing for categorical values
 * by using a selectbox. This is automatically used by categorical columns (Pandas).
 *
 */
function SelectboxColumn(props: BaseColumnProps): BaseColumn {
  // The selectbox column can be either string, number or boolean type
  // based on the options type.
  let dataType: "number" | "boolean" | "string" = "string"

  const parameters = mergeColumnParameters(
    // Default parameters:
    {
      options: isBooleanType(props.arrowType)
        ? [true, false]
        : (props.arrowType.categoricalOptions ?? []),
    },
    // User parameters:
    props.columnTypeOptions
  ) as SelectboxColumnParams

  const isSelectOption = (obj: unknown): obj is SelectOption =>
    typeof obj === "object" &&
    obj !== null &&
    "value" in (obj as Record<string, unknown>)

  const getOptionValueType = (
    x: string | number | boolean | SelectOption
  ): string => {
    if (isSelectOption(x)) {
      return typeof x.value
    }
    return typeof x
  }

  const uniqueTypes = new Set(parameters.options.map(getOptionValueType))
  if (uniqueTypes.size === 1) {
    if (uniqueTypes.has("number") || uniqueTypes.has("bigint")) {
      dataType = "number"
    } else if (uniqueTypes.has("boolean")) {
      dataType = "boolean"
    }
  }

  const preparedOptions = prepareOptions(parameters.options)

  const cellTemplate: DropdownCellType = {
    kind: GridCellKind.Custom,
    allowOverlay: true,
    copyData: "",
    contentAlign: props.contentAlignment,
    readonly: !props.isEditable,
    // The text in pinned columns should be faded.
    style: props.isPinned ? "faded" : "normal",
    data: {
      kind: "dropdown-cell",
      allowedValues: [
        // Add empty option if the column is not configured as required:
        ...(props.isRequired !== true ? [null] : []),
        ...preparedOptions,
      ],
      value: "",
    },
  }

  return {
    ...props,
    kind: "selectbox",
    sortMode: "default",
    typeIcon: ":material/arrow_drop_down_circle:",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    getCell(data?: any, validate?: boolean): GridCell {
      // Empty string refers to a missing value
      let cellData = null
      if (notNullOrUndefined(data) && data !== "") {
        cellData = toSafeString(data)
      }

      if (validate) {
        const isValidValue = cellTemplate.data.allowedValues.some(option => {
          if (option === null) {
            return cellData === null
          }
          if (typeof option === "string") {
            return option === cellData
          }
          if (typeof option === "object" && "value" in option) {
            return option.value === cellData
          }
          return false
        })

        if (!isValidValue) {
          return getErrorCell(
            toSafeString(cellData),
            `The value is not part of the allowed options.`
          )
        }
      }

      return {
        ...cellTemplate,
        isMissingValue: cellData === null,
        copyData: cellData || "", // Column sorting is done via the copyData value
        data: {
          ...cellTemplate.data,
          value: cellData,
        },
      } as DropdownCellType
    },
    getCellValue(cell: DropdownCellType): string | number | boolean | null {
      if (isNullOrUndefined(cell.data?.value) || cell.data?.value === "") {
        return null
      }
      if (dataType === "number") {
        return toSafeNumber(cell.data?.value) ?? null
      } else if (dataType === "boolean") {
        return toSafeBoolean(cell.data?.value) ?? null
      }
      return cell.data?.value
    },
  }
}

SelectboxColumn.isEditableType = true

export default SelectboxColumn
