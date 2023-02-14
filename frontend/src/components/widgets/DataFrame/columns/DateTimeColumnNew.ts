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
import moment from "moment"

import {
  BaseColumn,
  BaseColumnProps,
  mergeColumnParameters,
  toSafeDate,
  getErrorCell,
  toSafeString,
} from "src/components/widgets/DataFrame/columns/utils"
import { DatePickerCell } from "src/components/widgets/DataFrame/customCells/DatePickerCell"
import { isNullOrUndefined } from "src/lib/utils"

export interface DateTimeColumnParams {
  readonly format?: string
  readonly min?: string
  readonly max?: string
  readonly step?: string
}

function BaseDateTimeColumn(
  props: BaseColumnProps,
  defaultFormat: string,
  defaultStep: string,
  inputType: "datetime-local" | "time" | "date",
  toISOString: (date: Date) => string
): BaseColumn {
  const parameters = mergeColumnParameters(
    // Default parameters:
    {
      format: defaultFormat,
      step: defaultStep,
    },
    // User parameters:
    props.columnTypeMetadata
  ) as DateTimeColumnParams
  console.log(props.title, props.arrowType)
  const cellTemplate = {
    kind: GridCellKind.Custom,
    allowOverlay: true,
    copyData: "",
    readonly: !props.isEditable,
    contentAlign: props.contentAlignment,
    style: props.isIndex ? "faded" : "normal",
    data: {
      kind: "datetime-picker-cell",
      date: undefined,
      displayDate: "",
      min: parameters.min,
      max: parameters.max,
      step: parameters.step,
      format: inputType,
    },
  } as DatePickerCell

  return {
    ...props,
    kind: "datetime",
    sortMode: "default",
    isEditable: true,
    getCell(data?: any): GridCell {
      const cellData = toSafeDate(data)
      // TODO: show errors if date is < min or > max

      let copyData = ""
      let displayDate = ""

      if (cellData === undefined) {
        return getErrorCell(
          toSafeString(data),
          "The value cannot be interpreted as a datetime object."
        )
      }

      if (cellData !== null) {
        copyData = toISOString(cellData)
        displayDate = moment.utc(cellData).format(parameters.format)
      }
      return {
        ...cellTemplate,
        copyData,
        isMissingValue: isNullOrUndefined(cellData),
        data: {
          ...cellTemplate.data,
          date: cellData,
          displayDate,
        },
      } as DatePickerCell
    },
    getCellValue(cell: DatePickerCell): string | null {
      return isNullOrUndefined(cell?.data?.date)
        ? null
        : toISOString(cell.data.date)
    },
  }
}

export function DateTimeColumn(props: BaseColumnProps): BaseColumn {
  return BaseDateTimeColumn(
    props,
    "YYYY-MM-DD HH:mm:ss",
    "1",
    "datetime-local",
    (date: Date): string => {
      return date.toISOString()
    }
  )
}

DateTimeColumn.isEditableType = true

export function TimeColumn(props: BaseColumnProps): BaseColumn {
  return BaseDateTimeColumn(
    props,
    "HH:mm:ss.SSS",
    "0.1",
    "time",
    (date: Date): string => {
      // Return only the time part
      return date.toISOString().split("T")[1].replace("Z", "")
    }
  )
}

TimeColumn.isEditableType = true

export function DateColumn(props: BaseColumnProps): BaseColumn {
  return BaseDateTimeColumn(
    props,
    "YYYY-MM-DD",
    "1",
    "date",
    (date: Date): string => {
      // Return only the date part
      return date.toISOString().split("T")[0]
    }
  )
}

DateColumn.isEditableType = true

export default DateTimeColumn
