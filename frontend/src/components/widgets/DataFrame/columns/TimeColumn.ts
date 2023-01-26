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

import { isNullOrUndefined, notNullOrUndefined } from "src/lib/utils"
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
    getCell(data?: any): GridCell {
      if (isNullOrUndefined(data)) {
        return {
          ...cellTemplate,
          allowOverlay: true,
          copyData: "",
          data: {
            kind: "TimePickerCell",
            time: undefined,
            displayTime: "",
            format: cellTemplate.data.format,
          },
          isMissingValue: true,
        } as TimePickerCell
      }
      try {
        if (typeof data === "bigint") {
          // Python datetime uses microseconds, but JS & Moment uses milliseconds
          data = Number(data) / 1000
        }
        if (!isValidDate(data)) {
          return getErrorCell(`Incompatible time value: ${data}`)
        }

        const dateVersion = new Date(data)
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
            time: data,
            displayTime: removeTInIsoString(
              removeZeroMillisecondsInISOString(
                strftime(
                  cellTemplate.data.format,
                  addDST(addTimezoneOffset(dateVersion))
                )
              )
            ),
            format: cellTemplate.data.format,
          },
        } as TimePickerCell
      } catch (error) {
        return getErrorCell(
          `Incompatible time value: ${data}`,
          `Error: ${error}`
        )
      }
    },
    getCellValue(cell: TimePickerCell): string | null {
      return !notNullOrUndefined(cell.data.time)
        ? null
        : new Date(cell.data.time).toISOString()
    },
  }
}

TimeColumn.isEditableType = true

export default TimeColumn
