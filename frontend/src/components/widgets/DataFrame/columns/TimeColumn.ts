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
import { notNullOrUndefined } from "src/lib/utils"
import strftime from "strftime"
import { TimePickerCell } from "../customCells/TimePickerCell"

import { BaseColumn, BaseColumnProps, getErrorCell, isValidDate, toSafeString } from "./utils"

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
      displayTime: "NA",
      format: parameters.format ?? "%H:%M:%S.%L",
    },
  } as TimePickerCell

  return {
    ...props,
    kind: "time",
    sortMode: "smart",
    isEditable: true,
    getCell(data?: DataType): GridCell {
      try {
        if (notNullOrUndefined(data) && !isNaN(Number(data)) && !isValidDate(Number(data))) {
          return getErrorCell(
              `Incompatible time value: ${data}`
            )
        }
        let dataInSeconds = data
        if (typeof data === "bigint") {
          // Python datetime uses microseconds, but JS & Moment uses milliseconds
          dataInSeconds = Number(data) / 1000
        }
        return {
          ...cellTemplate,
          allowOverlay: true,
          copyData: toSafeString(dataInSeconds),
          data: {
            kind: "TimePickerCell",
            time: notNullOrUndefined(dataInSeconds) && !isNaN(Number(dataInSeconds)) ? dataInSeconds : undefined,
            displayTime:
              notNullOrUndefined(dataInSeconds) && !isNaN(Number(dataInSeconds))
                ? 
                  strftime(cellTemplate.data.format, new Date(Number(dataInSeconds)))
                : "NA",
          },
          style: notNullOrUndefined(dataInSeconds) && !isNaN(Number(dataInSeconds)) ? "normal" : "faded",
        }
      } catch (error) {
        return getErrorCell(
          `Incompatible time value: ${data}`,
          `Error: ${error}`
        )
      }
    },
    getCellValue(cell: TimePickerCell): number | null {
      return !notNullOrUndefined(cell.data.time) ? null : cell.data.time
    },
  }
}

TimeColumn.isEditableType = true

export default TimeColumn
