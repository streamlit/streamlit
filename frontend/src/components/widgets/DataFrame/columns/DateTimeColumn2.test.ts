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

import { GridCellKind } from "@glideapps/glide-data-grid"

import { DateTimeCell } from "./cells/DateTimeCell"
import { BaseColumnProps, isErrorCell } from "./utils"
import DateTimeColumn from "./DateTimeColumn2"

const MOCK_DATETIME_COLUMN_TEMPLATE: BaseColumnProps = {
  id: "1",
  name: "datetime_column",
  title: "datetime_column",
  indexNumber: 0,
  isEditable: true,
  isHidden: false,
  isIndex: false,
  isStretched: false,
  arrowType: {
    // The arrow type of the underlying data is
    // not used for anything inside the column.
    pandas_type: "datetime",
    numpy_type: "datetime64",
  },
}

function getTodayIsoDate(): string {
  return new Date().toISOString().split("T")[0]
}

const constantDate = new Date("05 October 2011 14:48")

describe("DateTimeColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = DateTimeColumn(MOCK_DATETIME_COLUMN_TEMPLATE)
    expect(mockColumn.kind).toEqual("datetime")
    expect(mockColumn.title).toEqual(MOCK_DATETIME_COLUMN_TEMPLATE.title)
    expect(mockColumn.id).toEqual(MOCK_DATETIME_COLUMN_TEMPLATE.id)
    expect(mockColumn.sortMode).toEqual("default")

    const mockCell = mockColumn.getCell(constantDate)
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect((mockCell as DateTimeCell).data.date).toEqual(constantDate)
  })

  it.each([
    // valid date object
    [new Date("2023-04-25"), "2023-04-25T00:00:00.000"],
    // undefined value
    [undefined, null],
    // null value
    [null, null],
    // empty string
    ["", null],
    // valid date string
    ["2023-04-25", "2023-04-25T00:00:00.000"],
    // valid unix timestamp
    [1671951600000, "2022-12-25T07:00:00.000"],
    // valid bigint
    [BigInt(1671951600000000), "2022-12-25T07:00:00.000"],
    // other date formats:
    ["04/25/2023", "2023-04-25T00:00:00.000"],
    // valid ISO date string
    ["2023-04-25T10:30:00.000Z", "2023-04-25T10:30:00.000"],
    // valid date string with time
    ["2023-04-25 10:30", "2023-04-25T10:30:00.000"],
    // valid date string with timezone
    ["2023-04-25T10:30:00.000+02:00", "2023-04-25T08:30:00.000"],
    // valid time string
    ["10:30", getTodayIsoDate() + "T10:30:00.000"],
    // valid time string with milliseconds
    ["10:30:25.123", getTodayIsoDate() + "T10:30:25.123"],
    // valid time string with seconds
    ["10:30:25", getTodayIsoDate() + "T10:30:25.000"],
    // valid month string
    ["Jan 2023", "2023-01-01T00:00:00.000"],
    // valid month string with day
    ["Jan 15, 2023", "2023-01-15T00:00:00.000"],
    // valid date string with day and month names
    ["25 April 2023", "2023-04-25T00:00:00.000"],
    // valid date string with day and short month names
    ["25 Apr 2023", "2023-04-25T00:00:00.000"],
    // valid date string with short day and month names
    ["Tue, 25 Apr 2023", "2023-04-25T00:00:00.000"],
    // valid date string with time and AM/PM
    ["2023-04-25 10:30 AM", "2023-04-25T10:30:00.000"],
    // valid Unix timestamp in milliseconds as a string
    ["1671951600000", "2022-12-25T07:00:00.000"],
  ])(
    "supports datetime-compatible value (%p parsed as %p)",
    (input: any, value: string | null) => {
      const mockColumn = DateTimeColumn(MOCK_DATETIME_COLUMN_TEMPLATE)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it.each([[NaN], ["foo"]])("%p results in error cell", (input: any) => {
    const mockColumn = DateTimeColumn(MOCK_DATETIME_COLUMN_TEMPLATE)
    const cell = mockColumn.getCell(input)
    expect(isErrorCell(cell)).toEqual(true)
  })
})
