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

import styled from "@emotion/styled"

import {
  CustomCell,
  CustomRenderer,
  drawTextCell,
  GridCellKind,
  ProvideEditorCallback,
  TextCellEntry,
} from "@glideapps/glide-data-grid"

export const StyledInputBox = styled.input`
  min-height: 26px;
  border: none;
  outline: none;
  background-color: transparent;
  font-size: var(--gdg-editor-font-size);
  font-family: var(--gdg-font-family);
  color: var(--gdg-text-dark);
  ::-webkit-calendar-picker-indicator {
    background-color: white;
  }
`

export interface DatePickerCellProps {
  readonly kind: "date-time-cell"
  /* The current value of the datetime cell. */
  readonly date: Date | undefined | null
  /* The current display value of the datetime cell. */
  readonly displayDate: string
  /* Defines the type of the HTML input element. */
  readonly format: DateKind
  /* Timezone offset in minutes.
  This can be used to adjust the date by a given timezone offset. */
  readonly timezoneOffset?: number
  /* Minimum value that can be entered by the user.
  This is passed to the min attribute of the HTML input element. */
  readonly min?: string | Date
  /* Maximum value that can be entered by the user.
  This is passed to the max attribute of the HTML input element. */
  readonly max?: string | Date
  /* Granularity that the date must adhere.
  This is passed to the step attribute of the HTML input element. */
  readonly step?: string
}

export type DateKind = "date" | "time" | "datetime-local"

export const formatValueForHTMLInput = (
  dateKind: DateKind,
  date: Date | undefined | null
): string => {
  if (date === undefined || date === null) {
    return ""
  }
  const isoDate = date.toISOString()
  switch (dateKind) {
    case "date":
      return isoDate.split("T")[0]
    case "datetime-local":
      return isoDate.replace("Z", "")
    case "time":
      return isoDate.split("T")[1].replace("Z", "")
    default:
      throw new Error(`Unknown date kind ${dateKind}`)
  }
}

export type DatePickerCell = CustomCell<DatePickerCellProps>

const Editor: ReturnType<ProvideEditorCallback<DatePickerCell>> = cell => {
  const cellData = cell.value.data
  const { format, displayDate } = cellData

  const step =
    cellData.step !== undefined && !Number.isNaN(Number(cellData.step))
      ? Number(cellData.step)
      : undefined

  const minValue =
    cellData.min instanceof Date
      ? formatValueForHTMLInput(format, cellData.min)
      : cellData.min

  const maxValue =
    cellData.max instanceof Date
      ? formatValueForHTMLInput(format, cellData.max)
      : cellData.max

  let date = cellData.date
  // Convert timezone offset to milliseconds
  const timezoneOffsetMs = cellData.timezoneOffset
    ? cellData.timezoneOffset * 60 * 1000
    : 0
  if (timezoneOffsetMs && date) {
    // Adjust based on the timezone offset
    date = new Date(date.getTime() + timezoneOffsetMs)
  }
  const value = formatValueForHTMLInput(format, date)
  if (cell.value.readonly) {
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
    <StyledInputBox
      data-testid={"date-picker-cell"}
      required
      type={format}
      defaultValue={value}
      min={minValue}
      max={maxValue}
      step={step}
      autoFocus={true}
      onChange={event => {
        if (isNaN(event.target.valueAsNumber)) {
          // The user has cleared the date, contribute as undefined
          cell.onChange({
            ...cell.value,
            data: {
              ...cell.value.data,
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
              date: new Date(event.target.valueAsNumber - timezoneOffsetMs),
            },
          })
        }
      }}
    />
  )
}

export const DatePickerCellRenderer: CustomRenderer<DatePickerCell> = {
  kind: GridCellKind.Custom,
  isMatch: (cell: CustomCell): cell is DatePickerCell =>
    (cell.data as any).kind === "date-time-cell",
  draw: (args, cell) => {
    const { displayDate } = cell.data
    drawTextCell(args, displayDate, cell.contentAlign)
    return true
  },
  measure: (ctx, cell) => {
    const { displayDate } = cell.data
    return ctx.measureText(displayDate).width + 16
  },
  provideEditor: () => ({
    editor: Editor,
  }),
  onPaste: (v, d) => {
    // TODO(lukasmasuch): This code is not used in our implementation,
    // it's mostly for the glide-data-grid implementation which we try to merge
    // into the upstream library.
    let parseDateTimestamp = NaN
    // We only try to parse the value if it is not empty/undefined/null:
    if (v) {
      // Support for unix timestamps (milliseconds since 1970-01-01):
      parseDateTimestamp = Number(v).valueOf()

      if (Number.isNaN(parseDateTimestamp)) {
        // Support for parsing ISO 8601 date strings:
        parseDateTimestamp = Date.parse(v)
        if (d.format === "time" && Number.isNaN(parseDateTimestamp)) {
          // The pasted value was not a valid date string
          // Try to interpret value as time string instead (HH:mm:ss)
          parseDateTimestamp = Date.parse(`1970-01-01T${v}Z`)
        }
      }
    }
    return {
      ...d,
      date: Number.isNaN(parseDateTimestamp)
        ? undefined
        : new Date(parseDateTimestamp),
    }
  },
}
