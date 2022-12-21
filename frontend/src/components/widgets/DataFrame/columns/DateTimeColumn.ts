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
import { DatetimeLocalPickerCell } from "../customCells/DatetimeLocalPickerCell"

import { BaseColumn, BaseColumnProps, getErrorCell } from "./utils"

interface DateTimeColumnParams {
  readonly format?: string
}

function DateTimeColumn(props: BaseColumnProps): BaseColumn {
  const parameters = {
    ...(props.columnTypeMetadata || {}),
  } as DateTimeColumnParams

  const cellTemplate = {
    kind: GridCellKind.Custom,
    allowOverlay: true,
    copyData: "",
    contentAlign: props.contentAlignment,
    data: {
      kind: "DatetimeLocalPickerCell",
      date: undefined,
      displayDate: "",
      format: "%Y-%m-%dT%H:%M:%S.%L",
    },
  } as DatetimeLocalPickerCell

  return {
    ...props,
    kind: "datetime",
    sortMode: "default",
    isEditable: true,
    getCell(data?: DataType): GridCell {
      try {
        return {
          ...cellTemplate,
          allowOverlay: true,
          data: {
            kind: "DatetimeLocalPickerCell",
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
    getCellValue(cell: DatetimeLocalPickerCell): Date | null {
      return cell.data.date === undefined ? null : cell.data.date
    },
  }
}

DateTimeColumn.isEditableType = true

export default DateTimeColumn
