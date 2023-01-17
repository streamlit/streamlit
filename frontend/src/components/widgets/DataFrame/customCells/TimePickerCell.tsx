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

import React from "react"
import {
  CustomCell,
  CustomRenderer,
  drawTextCell,
  GridCellKind,
  ProvideEditorCallback,
} from "@glideapps/glide-data-grid"
import {
  addDST,
  addTimezoneOffset,
  appendZeroDateFormat,
  appendZeroDateFormatMs,
  isValidDate,
} from "src/components/widgets/DataFrame/columns/utils"

interface TimePickerCellProps {
  readonly kind: "TimePickerCell"
  readonly time: number | undefined
  readonly displayTime: string
  readonly format: string
}

export type TimePickerCell = CustomCell<TimePickerCellProps>

const Editor: ReturnType<ProvideEditorCallback<TimePickerCell>> = cell => {
  const { time: timeIn } = cell.value.data
  // const timeAsNumber = addDST(addTimezoneOffset(timeIn as number))
  const timeAsNumber = timeIn as number
  const timeAsDate = isValidDate(timeAsNumber)
    ? new Date(timeAsNumber)
    : new Date()
  console.log(timeAsDate)
  const hours = appendZeroDateFormat(timeAsDate.getUTCHours().toString())
  const minutes = appendZeroDateFormat(timeAsDate.getMinutes().toString())
  const seconds = appendZeroDateFormat(timeAsDate.getSeconds().toString())
  const milliseconds = appendZeroDateFormatMs(
    timeAsDate.getMilliseconds().toString()
  )
  // format example: 08:05:01.004
  const initialDisplayValue = `${hours}:${minutes}:${seconds}.${milliseconds}`
  console.log(initialDisplayValue)
  return (
    <input
      required
      style={{ minHeight: 26, border: "none", outline: "none" }}
      type="time"
      autoFocus={true}
      // determines whether or not to display milliseconds
      step={timeAsDate.getMilliseconds() !== 0 ? ".001" : undefined}
      value={initialDisplayValue}
      onChange={event => {
        cell.onChange({
          ...cell.value,
          data: {
            ...cell.value.data,
            time:
              event.target.valueAsDate === null
                ? timeIn
                : event.target.valueAsNumber,
          },
        })
      }}
    />
  )
}

const renderer: CustomRenderer<TimePickerCell> = {
  kind: GridCellKind.Custom,
  isMatch: (cell: CustomCell): cell is TimePickerCell =>
    (cell.data as any).kind === "TimePickerCell",
  draw: (args, cell) => {
    const { displayTime } = cell.data
    drawTextCell(args, displayTime, cell.contentAlign)
    return true
  },
  provideEditor: () => ({
    editor: Editor,
  }),
}

export default renderer
