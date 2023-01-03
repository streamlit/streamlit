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

import React, { useState } from "react"
import {
  CustomCell,
  CustomRenderer,
  drawTextCell,
  GridCellKind,
  ProvideEditorCallback,
} from "@glideapps/glide-data-grid"

interface DatePickerCellProps {
  readonly kind: "DatePickerCell"
  readonly date: Date | undefined
  readonly displayDate: string
  readonly format: string
}

export type DatePickerCell = CustomCell<DatePickerCellProps>

const Editor: ReturnType<ProvideEditorCallback<DatePickerCell>> = cell => {
  const cellData = cell.value.data
  const { displayDate } = cellData
  let newCellData = new Date()
  if (cellData !== undefined) {
    newCellData = cellData.date ?? new Date()
  }
  return (
    <input
      required
      style={{ minHeight: 26, border: "none", outline: "none" }}
      type={"date"}
      autoFocus={true}
      onChange={event => {
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

const renderer: CustomRenderer<DatePickerCell> = {
  kind: GridCellKind.Custom,
  isMatch: (cell: CustomCell): cell is DatePickerCell =>
    (cell.data as any).kind === "DatePickerCell",
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
