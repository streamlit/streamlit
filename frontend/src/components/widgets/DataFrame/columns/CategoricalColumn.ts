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

import { DataType, Quiver } from "src/lib/Quiver"
import { notNullOrUndefined } from "src/lib/utils"

import {
  BaseColumn,
  BaseColumnProps,
  ColumnCreator,
  getErrorCell,
} from "./BaseColumn"

interface CategoricalColumnParams {
  readonly options: string[]
}

function CategoricalColumn(props: BaseColumnProps): BaseColumn {
  // TODO: this needs to happen somewhere else (e.g. when selecting the column type):
  // if (this.isIndex) {
  //   // Categorical column type is currently not supported for index columns:
  //   return getCell(columnConfig, data, ColumnType.Object)
  // }

  // TODO(lukasmasuch): use merge? use validation?
  const parameters = {
    options:
      Quiver.getTypeName(props.quiverType) === "boolean"
        ? ["true", "false"]
        : [],
    ...(props.columnTypeMetadata || {}),
  } as CategoricalColumnParams

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
    getCell(data?: DataType): GridCell {
      // Empty string refers to an empty cell
      let cellData = ""
      if (notNullOrUndefined(data)) {
        cellData = data.toString()
      }

      if (!cellTemplate.data.allowedValues.includes(cellData)) {
        return getErrorCell(
          String(cellData),
          `The value is not part of allowed options.`
        )
      }
      return {
        ...cellTemplate,
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
