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
import { TimePickerCell } from "../customCells/TimePickerCell"

import { BaseColumn, BaseColumnProps, getErrorCell } from "./utils"

interface TimeColumnParams {
  readonly format?: string
}

function TimeColumn(props: BaseColumnProps): BaseColumn {
  const parameters = {
    ...(props.columnTypeMetadata || {}),
  } as TimeColumnParams

  const cellTemplate = {
    kind: GridCellKind.Custom,
    allowOverlay: true,
    copyData: "",
    contentAlign: props.contentAlignment,
    data: {
      kind: "TimePickerCell",
      time: undefined,
      displayTime: "",
      format: parameters.format ? parameters.format : "%H:%M:%S.%L",
    },
  } as TimePickerCell

  return {
    ...props,
    kind: "time",
    sortMode: "default",
    isEditable: true,
    getCell(data?: DataType): GridCell {
      try {
        let newData = data
        if (typeof data === "bigint") {
          // divide by 1000 to turn into seconds since quiver returns ms
          newData = Number(data) / 1000
        }
        try {
          // TODO: Deal with error pasting properly
          // @ts-ignore
          new Date(newData)
        } catch (error) {
          return getErrorCell(
            // @ts-ignore
            `Incompatible time value: ${data}`,
            `Error: ${error}`
          )
        }
        return {
          ...cellTemplate,
          allowOverlay: true,
          data: {
            kind: "TimePickerCell",
            time: newData !== undefined ? newData : undefined,
            displayTime:
              data !== undefined
                ? // @ts-expect-error
                  strftime(cellTemplate.data.format, new Date(newData))
                : "",
          },
        }
      } catch (error) {
        return getErrorCell(
          `Incompatible time value: ${data}`,
          `Error: ${error}`
        )
      }
    },
    getCellValue(cell: TimePickerCell): number | null {
      return cell.data.time === undefined ? null : cell.data.time
    },
  }
}

TimeColumn.isEditableType = true

export default TimeColumn
