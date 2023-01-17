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
import { TimePickerCell } from "src/components/widgets/DataFrame/customCells/TimePickerCell"

import {
  addDST,
  addTimezoneOffset,
  BaseColumn,
  BaseColumnProps,
  getErrorCell,
  isValidDate,
  removeTInIsoString,
  removeZeroMillisecondsInISOString,
  toSafeString,
} from "src/components/widgets/DataFrame/columns/utils"

export interface TimeColumnParams {
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
        if (
          notNullOrUndefined(data) &&
          !Number.isNaN(Number(data)) &&
          !isValidDate(Number(data))
        ) {
          return getErrorCell(`Incompatible time value: ${data}`)
        }
        let dataInSeconds = data
        if (typeof data === "bigint") {
          // Python datetime uses microseconds, but JS & Moment uses milliseconds
          dataInSeconds = Number(data) / 1000
        }

        const addedOffsetAndDST = addDST(
          addTimezoneOffset(Number(dataInSeconds))
        )
        // const addedOffsetAndDST = Number(dataInSeconds)
        const dateVersion = new Date(addedOffsetAndDST)
        // datetime.time is only hours, minutes, etc
        const withoutYearAndMonth =
          (dateVersion.getHours() * 60 * 60 +
            dateVersion.getMinutes() * 60 +
            dateVersion.getSeconds()) *
            1000 +
          dateVersion.getMilliseconds()
        return {
          ...cellTemplate,
          allowOverlay: true,
          copyData: toSafeString(withoutYearAndMonth),
          data: {
            kind: "TimePickerCell",
            time:
              notNullOrUndefined(dataInSeconds) &&
              !Number.isNaN(Number(dataInSeconds))
                ? Number(dataInSeconds)
                : undefined,
            displayTime:
              notNullOrUndefined(dataInSeconds) &&
              !Number.isNaN(Number(dataInSeconds))
                ? removeTInIsoString(
                    removeZeroMillisecondsInISOString(
                      strftime(cellTemplate.data.format, dateVersion)
                    )
                  )
                : "NA",
            format: cellTemplate.data.format,
          },
          style:
            notNullOrUndefined(dataInSeconds) &&
            !Number.isNaN(Number(dataInSeconds))
              ? "normal"
              : "faded",
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
