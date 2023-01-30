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
import { formatValueForHTMLInput } from "src/components/widgets/DataFrame/columns/utils"

export interface DatetimePickerCellProps {
  readonly kind: "DatetimePickerCell"
  readonly date: Date | undefined
  readonly displayDate: string
  readonly format: string
  readonly type: PythonDateType
}

export enum PythonDateType {
  Date = "date",
  DatetimeLocal = "datetime-local",
  Time = "time",
}

export type DatetimePickerCell = CustomCell<DatetimePickerCellProps>

const Editor: ReturnType<ProvideEditorCallback<DatetimePickerCell>> = cell => {
  const cellData = cell.value.data
  const { date, displayDate, type } = cellData
  let newCellData = new Date(
    new Date().getTime() - new Date().getTimezoneOffset() * 60000
  )
  if (cellData !== undefined) {
    newCellData =
      cellData.date ??
      new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000)
  }
  const value = formatValueForHTMLInput(type, newCellData)

  return (
    <input
      required
      style={{ minHeight: 26, border: "none", outline: "none" }}
      type={type}
      step={newCellData.getMilliseconds() !== 0 ? ".001" : undefined}
      value={value}
      autoFocus={true}
      onChange={event => {
        // handle when clear is clicked and value has been wiped
        if (event.target.value === "") {
          try {
            cell.onChange({
              ...cell.value,
              data: {
                ...cell.value.data,
                date: date !== undefined ? date : new Date(displayDate),
              },
            })
          } catch (error) {
            cell.onChange({
              ...cell.value,
              data: {
                ...cell.value.data,
                displayDate: String(error),
              },
            })
          }
          return
        }
        cell.onChange({
          ...cell.value,
          data: {
            ...cell.value.data,
            date: new Date(event.target.valueAsNumber) ?? newCellData,
          },
        })
      }}
    />
  )
}

const renderer: CustomRenderer<DatetimePickerCell> = {
  kind: GridCellKind.Custom,
  isMatch: (cell: CustomCell): cell is DatetimePickerCell =>
    (cell.data as any).kind === "DatetimePickerCell",
  draw: (args, cell) => {
    const { displayDate } = cell.data
    drawTextCell(args, displayDate, cell.contentAlign)
    return true
  },
  provideEditor: () => ({
    editor: Editor,
  }),
}

export default renderer
