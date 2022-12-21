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

import { DataType } from "src/lib/Quiver"
import strftime from "strftime"
import { DatePickerCell } from "../customCells/DatePickerCell"

import { BaseColumn, BaseColumnProps, getErrorCell } from "./utils"

interface DateColumnParams {
  readonly format?: string
}

function DateColumn(props: BaseColumnProps): BaseColumn {
  const parameters = {
    ...(props.columnTypeMetadata || {}),
  } as DateColumnParams

  const cellTemplate = {
    kind: GridCellKind.Custom,
    allowOverlay: true,
    copyData: "",
    contentAlign: props.contentAlignment,
    data: {
      kind: "DatePickerCell",
      date: undefined,
      displayDate: "",
      format: parameters.format ? parameters.format : "%m / %d / %Y",
    },
  } as DatePickerCell

  return {
    ...props,
    kind: "date",
    sortMode: "default",
    isEditable: true,
    getCell(data?: DataType): GridCell {
      try {
        return {
          ...cellTemplate,
          allowOverlay: true,
          data: {
            kind: "DatePickerCell",
            // @ts-ignore
            date: data !== undefined ? new Date(data) : undefined,
            displayDate:
              data !== undefined
                ? // @ts-ignore
                  strftime(cellTemplate.data.format, new Date(data))
                : "",
            format: cellTemplate.data.format,
          },
        }
      } catch (error) {
        return getErrorCell(
          // @ts-ignore
          `Incompatible time value: ${data}`,
          `Error: ${error}`
        )
      }
    },
    getCellValue(cell: DatePickerCell): Date | null {
      return cell.data.date === undefined ? null : cell.data.date
    },
  }
}
DateColumn.isEditableType = true

export default DateColumn
