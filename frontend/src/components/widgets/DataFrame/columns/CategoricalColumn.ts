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
} from "./utils"

export interface CategoricalColumnParams {
  /** A list of options available in the dropdown.
   * Every value in the column needs to match one of the options.
   */
  readonly options: string[]
}

/**
 * A column type that provides a dropdown on editing.
 * This is automatically used by categorical columns (Pandas).
 */
function CategoricalColumn(props: BaseColumnProps): BaseColumn {
  const parameters = mergeColumnParameters(
    // Default parameters:
    {
      options:
        Quiver.getTypeName(props.arrowType) === "bool"
          ? ["true", "false"]
          : [],
    },
    // User parameters:
    props.columnTypeMetadata
  ) as CategoricalColumnParams

  const cellTemplate = {
    kind: GridCellKind.Custom,
    allowOverlay: props.isEditable,
    copyData: "",
    contentAlign: props.contentAlignment,
    data: {
      kind: "dropdown-cell",
      allowedValues: [
        "", // Enforce the empty option
        ...parameters.options.filter(opt => opt !== ""), // ignore empty option if it exists
      ],
      value: "",
      readonly: !props.isEditable,
    },
  } as DropdownCellType

  return {
    ...props,
    kind: "categorical",
    sortMode: "default",
    getCell(data?: any): GridCell {
      // Empty string refers to a missing value
      let cellData = ""
      if (notNullOrUndefined(data)) {
        cellData = toSafeString(data)
      }

      if (!cellTemplate.data.allowedValues.includes(cellData)) {
        return getErrorCell(
          toSafeString(cellData),
          `The value is not part of the allowed options.`
        )
      }
      return {
        ...cellTemplate,
        isMissingValue: cellData === "",
        copyData: cellData,
        data: {
          ...cellTemplate.data,
          value: cellData,
        },
      } as DropdownCellType
    },
    getCellValue(cell: DropdownCellType): string | null {
      if (cell.data?.value === undefined || cell.data?.value === "") {
        return null
      }
      return cell.data?.value
    },
  }
}

CategoricalColumn.isEditableType = true

export default CategoricalColumn as ColumnCreator
