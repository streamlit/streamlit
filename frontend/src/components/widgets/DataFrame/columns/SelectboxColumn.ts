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

import { GridCell, GridCellKind } from "@glideapps/glide-data-grid"
import { DropdownCellType } from "@glideapps/glide-data-grid-cells"

import { Quiver } from "src/lib/Quiver"
import { notNullOrUndefined } from "src/lib/utils"

import {
  BaseColumn,
  BaseColumnProps,
  ColumnCreator,
  getErrorCell,
  toSafeString,
  mergeColumnParameters,
  toSafeNumber,
  toSafeBoolean,
} from "./utils"

export interface SelectboxColumnParams {
  /** A list of options available in the selectbox.
   * Every value in the column needs to match one of the options.
   */
  readonly options: (string | number | boolean)[]
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
      options:
        Quiver.getTypeName(props.arrowType) === "bool" ? [true, false] : [],
    },
    // User parameters:
    props.columnTypeOptions
  ) as SelectboxColumnParams

  const uniqueTypes = new Set(parameters.options.map(x => typeof x))
  if (uniqueTypes.size === 1) {
    if (uniqueTypes.has("number") || uniqueTypes.has("bigint")) {
      dataType = "number"
    } else if (uniqueTypes.has("boolean")) {
      dataType = "boolean"
    }
  }

  const cellTemplate = {
    kind: GridCellKind.Custom,
    allowOverlay: props.isEditable,
    copyData: "",
    contentAlign: props.contentAlignment,
    readonly: !props.isEditable,
    data: {
      kind: "dropdown-cell",
      allowedValues: [
        // Add empty option if the column is not configured as required:
        ...(props.isRequired !== true ? [""] : []),
        ...parameters.options
          .filter(opt => opt !== "") // ignore empty option if it exists
          .map(opt => toSafeString(opt)), // convert everything to string
      ],
      value: "",
      readonly: !props.isEditable,
    },
  } as DropdownCellType

  return {
    ...props,
    kind: "selectbox",
    sortMode: "default",
    getCell(data?: any, validate?: boolean): GridCell {
      // Empty string refers to a missing value
      let cellData = ""
      if (notNullOrUndefined(data)) {
        cellData = toSafeString(data)
      }

      if (validate && !cellTemplate.data.allowedValues.includes(cellData)) {
        return getErrorCell(
          toSafeString(cellData),
          `The value is not part of the allowed options.`
        )
      }
      return {
        ...cellTemplate,
        isMissingValue: cellData === "",
        copyData: cellData, // Column sorting is done via the copyData value
        data: {
          ...cellTemplate.data,
          value: cellData,
        },
      } as DropdownCellType
    },
    getCellValue(cell: DropdownCellType): string | number | boolean | null {
      if (cell.data?.value === undefined || cell.data?.value === "") {
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

export default SelectboxColumn as ColumnCreator
