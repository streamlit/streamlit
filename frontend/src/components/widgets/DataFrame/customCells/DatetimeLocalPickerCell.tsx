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
} from "src/components/widgets/DataFrame/columns/utils"

interface DatetimeLocalPickerCellProps {
  readonly kind: "DatetimeLocalPickerCell"
  readonly date: Date | undefined
  readonly displayDate: string
  readonly format: string
}

export type DatetimeLocalPickerCell = CustomCell<DatetimeLocalPickerCellProps>

const Editor: ReturnType<
  ProvideEditorCallback<DatetimeLocalPickerCell>
> = cell => {
  const cellData = cell.value.data
  const { date, displayDate } = cellData
  let newCellData = new Date()
  if (cellData !== undefined) {
    newCellData = date ?? new Date()
  }
  // const offsetDate = new Date(addDST(addTimezoneOffset(Number(newCellData))))
  const offsetDate = new Date(Number(newCellData))

  // add 1 because getMonth is 0 index based
  const year = offsetDate?.getFullYear().toString()
  const mm = appendZeroDateFormat((offsetDate?.getUTCMonth() + 1).toString())
  const dd = appendZeroDateFormat(offsetDate?.getUTCDate().toString())
  const hours = appendZeroDateFormat(offsetDate?.getUTCHours().toString())
  const minutes = appendZeroDateFormat(offsetDate?.getUTCMinutes().toString())
  return (
    <input
      required
      style={{ minHeight: 26, border: "none", outline: "none" }}
      type={"datetime-local"}
      // format example: 2017-06-01T08:30
      value={`${year}-${mm}-${dd}T${hours}:${minutes}`}
      autoFocus={true}
      onChange={event => {
        // handle when clear is clicked and value has been wiped
        if (event.target.value === "") {
          try {
            cell.onChange({
              ...cell.value,
              data: {
                ...cell.value.data,
                date: new Date(displayDate),
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
const renderer: CustomRenderer<DatetimeLocalPickerCell> = {
  kind: GridCellKind.Custom,
  isMatch: (cell: CustomCell): cell is DatetimeLocalPickerCell =>
    (cell.data as any).kind === "DatetimeLocalPickerCell",
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
