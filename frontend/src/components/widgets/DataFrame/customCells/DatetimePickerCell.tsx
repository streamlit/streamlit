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
  TextCellEntry,
} from "@glideapps/glide-data-grid"

interface DatetimePickerCellProps {
  readonly kind: "DatetimePickerCell"
  readonly date: Date | undefined
  readonly displayDate: string
  readonly format: any
  readonly type: DateKind
  readonly readonly?: boolean
  readonly min?: string
  readonly max?: string
  readonly step?: string
}

export type DateKind = "date" | "time" | "datetime-local"

export const formatValueForHTMLInput = (
  dateKind: DateKind,
  date: Date | undefined
): string => {
  if (date === undefined) {
    return ""
  }
  switch (dateKind) {
    case "date":
      return date.toISOString().split("T")[0]
    case "datetime-local":
      return date.toISOString().replace("Z", "")
    case "time":
      return date.toISOString().split("T")[1].replace("Z", "")
    default:
      return ""
  }
}

export type DatetimePickerCell = CustomCell<DatetimePickerCellProps>

const Editor: ReturnType<ProvideEditorCallback<DatetimePickerCell>> = cell => {
  const cellData = cell.value.data
  const { min, max, step, readonly, type, displayDate } = cellData
  const value = formatValueForHTMLInput(type, cellData.date)
  if (readonly) {
    return (
      <TextCellEntry
        highlight={true}
        autoFocus={false}
        disabled={true}
        value={displayDate ?? ""}
        onChange={() => undefined}
      />
    )
  }
  return (
    <input
      required
      style={{ minHeight: 26, border: "none", outline: "none" }}
      type={type}
      value={value}
      min={min}
      max={max}
      step={step}
      autoFocus={true}
      onChange={event => {
        if (event.target.value === "") {
          cell.onChange({
            ...cell.value,
            data: {
              ...cell.value.data,
              // just set the value to undefined if submitted (enter or clicking out)
              // escape still works
              date: undefined,
            },
          })
        } else {
          cell.onChange({
            ...cell.value,
            data: {
              ...cell.value.data,
              // use valueAsNumber because valueAsDate is null for "datetime-local"
              // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/datetime-local#technical_summary
              date: new Date(event.target.valueAsNumber) ?? cellData.date,
            },
          })
        }
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
