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

import { DataType, Type as QuiverType } from "src/lib/Quiver"
import { GridCellKind } from "@glideapps/glide-data-grid"
import strftime from "strftime"
import { DatetimeLocalPickerCell } from "src/components/widgets/DataFrame/customCells/DatetimeLocalPickerCell"
import { addDST, addTimezoneOffset, BaseColumnProps } from "./utils"
import DateTimeColumn, { DateTimeColumnParams } from "./DateTimeColumn"

const MOCK_DATETIME_QUIVER_TYPE: QuiverType = {
  pandas_type: "datetime",
  numpy_type: "datetime64",
}

const DATETIME_COLUMN_TEMPLATE: Partial<BaseColumnProps> = {
  id: "1",
  title: "datetime.datetime",
  indexNumber: 0,
  isEditable: true,
  isHidden: false,
  isIndex: false,
  isStretched: false,
}

function getDateTimeColumn(
  quiverType: QuiverType,
  params?: DateTimeColumnParams
): ReturnType<typeof DateTimeColumn> {
  return DateTimeColumn({
    ...DATETIME_COLUMN_TEMPLATE,
    quiverType,
    columnTypeMetadata: params,
  } as BaseColumnProps)
}

const constantDate = new Date("05 October 2011 14:48")

// deal with machines in different timezones
const constantDisplayDate = strftime(
  "%Y-%m-%dT%H:%M:%S.%L",
  new Date(addDST(addTimezoneOffset(Number(constantDate))))
)

describe("DateTimeColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = getDateTimeColumn(MOCK_DATETIME_QUIVER_TYPE)
    expect(mockColumn.title).toEqual(DATETIME_COLUMN_TEMPLATE.title)
    expect(mockColumn.id).toEqual(DATETIME_COLUMN_TEMPLATE.id)
    expect(mockColumn.isEditable).toEqual(DATETIME_COLUMN_TEMPLATE.isEditable)

    const mockCell = mockColumn.getCell(constantDate)
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect((mockCell as DatetimeLocalPickerCell).data.date).toEqual(
      constantDate
    )
  })

  it.each([
    [constantDate, constantDate, constantDisplayDate],
    [null, null, "NA"],
    [undefined, null, "NA"],
  ])(
    "supports date value (%p parsed as %p)",
    (
      input: DataType | null | undefined,
      value: Date | null,
      displayDate: string
    ) => {
      const mockColumn = getDateTimeColumn(MOCK_DATETIME_QUIVER_TYPE)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
      expect((cell as DatetimeLocalPickerCell).data.displayDate).toEqual(
        displayDate
      )
    }
  )

  it.each([
    [null, "faded"],
    [new Date(), "normal"],
  ])(
    "Given %p, shows %p style",
    (data: DataType | null | undefined, style: string) => {
      const mockColumn = getDateTimeColumn(MOCK_DATETIME_QUIVER_TYPE)
      const cell = mockColumn.getCell(data)
      expect(cell.style).toEqual(style)
    }
  )

  it.each([
    [{ format: undefined } as DateTimeColumnParams, "%Y-%m-%dT%H:%M:%S.%L"],
    [{ format: "%d %B, %Y" } as DateTimeColumnParams, "%d %B, %Y"],
  ])(
    "Given %p, shows %p format",
    (params: DateTimeColumnParams, expFormat: string) => {
      const mockColumn = getDateTimeColumn(MOCK_DATETIME_QUIVER_TYPE, params)
      const cell = mockColumn.getCell(null)
      expect((cell as DatetimeLocalPickerCell).data.format).toEqual(expFormat)
    }
  )
})
