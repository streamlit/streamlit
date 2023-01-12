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
import { DatePickerCell } from "src/components/widgets/DataFrame/customCells/DatePickerCell"

import {
  addDST,
  addTimezoneOffset,
  BaseColumn,
  BaseColumnProps,
  getErrorCell,
  isValidDate,
  removeZeroMillisecondsInISOString,
} from "src/components/widgets/DataFrame/columns/utils"

export interface DateColumnParams {
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
      displayDate: "NA",
      format: parameters.format ?? "%Y / %m / %d",
    },
  } as DatePickerCell

  return {
    ...props,
    kind: "date",
    sortMode: "smart",
    isEditable: true,
    getCell(data?: DataType): GridCell {
      try {
        if (notNullOrUndefined(data) && !isValidDate(Number(data))) {
          return getErrorCell(`Incompatible time value: ${data}`)
        }
        // 0 refers to a missing value
        let cellData = 0
        if (notNullOrUndefined(data)) {
          // convert the date to a number to sort
          cellData = Number(data)
        }
        const displayDate = removeZeroMillisecondsInISOString(
          strftime(
            cellTemplate.data.format,
            new Date(addDST(addTimezoneOffset(Number(data))))
          )
        )
        return {
          ...cellTemplate,
          allowOverlay: true,
          copyData: cellData.toString(),
          data: {
            kind: "DatePickerCell",
            date: notNullOrUndefined(data) ? new Date(Number(data)) : undefined,
            displayDate: notNullOrUndefined(data) ? displayDate : "NA",
            format: cellTemplate.data.format,
          },
          style:
            notNullOrUndefined(cellData) && !Number.isNaN(Number(data))
              ? "normal"
              : "faded",
        }
      } catch (error) {
        return getErrorCell(`Incompatible time value: ${data}`)
      }
    },
    getCellValue(cell: DatePickerCell): Date | null {
      return !notNullOrUndefined(cell.data.date) ? null : cell.data.date
    },
  }
}
DateColumn.isEditableType = true

export default DateColumn
