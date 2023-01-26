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
import { DatetimeLocalPickerCell } from "src/components/widgets/DataFrame/customCells/DatetimeLocalPickerCell"

import {
  addDST,
  addTimezoneOffset,
  BaseColumn,
  BaseColumnProps,
  getErrorCell,
  isValidDate,
  removeTInIsoString,
  removeZeroMillisecondsInISOString,
} from "src/components/widgets/DataFrame/columns/utils"

export interface DateTimeColumnParams {
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
      displayDate: "NA",
      format: parameters.format ?? "%Y-%m-%dT%H:%M:%S.%L",
    },
  } as DatetimeLocalPickerCell

  return {
    ...props,
    kind: "datetime",
    sortMode: "smart",
    isEditable: true,
    getCell(data?: any): GridCell {
      if (isNullOrUndefined(data)) {
        return {
          ...cellTemplate,
          allowOverlay: true,
          // missing value
          copyData: "",
          isMissingValue: true,
          data: {
            kind: "DatetimeLocalPickerCell",
            date: undefined,
            displayDate: "",
            format: cellTemplate.data.format,
          },
        } as DatetimeLocalPickerCell
      }

      try {
        if (!isValidDate(data)) {
          return getErrorCell(`Incompatible time value: ${data}`)
        }
        if (typeof data === "bigint") {
          data = Number(data) / 1000
        }

        // safe to do new Date() because checked through isValidDate()
        const dataDate = new Date(data)
        const displayDate = removeTInIsoString(
          removeZeroMillisecondsInISOString(
            // TODO (willhuang1997): Check if we want to use strftime
            strftime(
              cellTemplate.data.format,
              addDST(addTimezoneOffset(dataDate))
            )
          )
        )
        return {
          ...cellTemplate,
          allowOverlay: true,
          copyData: dataDate.toISOString(),
          data: {
            kind: "DatetimeLocalPickerCell",
            date: dataDate,
            displayDate,
            format: cellTemplate.data.format,
          },
        } as DatetimeLocalPickerCell
      } catch (error) {
        return getErrorCell(`Incompatible time value: ${data}`)
      }
    },
    getCellValue(cell: DatetimeLocalPickerCell): string | null {
      return !notNullOrUndefined(cell.data.date)
        ? null
        : cell.data.date.toISOString()
    },
  }
}

DateTimeColumn.isEditableType = true

export default DateTimeColumn
