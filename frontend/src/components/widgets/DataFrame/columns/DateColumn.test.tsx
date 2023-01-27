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

import { Type as QuiverType } from "src/lib/Quiver"
import { GridCellKind } from "@glideapps/glide-data-grid"
import { DatePickerCell } from "src/components/widgets/DataFrame/customCells/DatePickerCell"
import { DatetimeLocalPickerCell } from "src/components/widgets/DataFrame/customCells/DatetimeLocalPickerCell"
import { BaseColumnProps } from "./utils"
import DateColumn, { DateColumnParams } from "./DateColumn"
import moment from "moment"

const MOCK_DATE_QUIVER_TYPE: QuiverType = {
  pandas_type: "datetime",
  numpy_type: "datetime64",
}

const DATE_COLUMN_TEMPLATE: Partial<BaseColumnProps> = {
  id: "1",
  title: "datetime.time",
  indexNumber: 0,
  isEditable: true,
  isHidden: false,
  isIndex: false,
  isStretched: false,
}

function getDateColumn(
  quiverType: QuiverType,
  params?: DateColumnParams
): ReturnType<typeof DateColumn> {
  return DateColumn({
    ...DATE_COLUMN_TEMPLATE,
    quiverType,
    columnTypeMetadata: params,
  } as BaseColumnProps)
}

const constantDate = new Date("05 October 2011 14:48")

// deal with machines in different timezones
const constantDisplayDate = moment.utc(constantDate).format(format)

describe("DateColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = getDateColumn(MOCK_DATE_QUIVER_TYPE)
    expect(mockColumn.title).toEqual(DATE_COLUMN_TEMPLATE.title)
    expect(mockColumn.id).toEqual(DATE_COLUMN_TEMPLATE.id)
    expect(mockColumn.isEditable).toEqual(DATE_COLUMN_TEMPLATE.isEditable)

    const mockCell = mockColumn.getCell(constantDate)
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect((mockCell as DatePickerCell).data.date).toEqual(constantDate)
  })

  it.each([
    [constantDate, constantDate.toISOString(), constantDisplayDate],
    [null, null, ""],
    [undefined, null, ""],
  ])(
    "supports date value (%p parsed as %p)",
    (input: any, value: string | null, displayDate: string) => {
      const mockColumn = getDateColumn(MOCK_DATE_QUIVER_TYPE)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
      expect((cell as DatetimeLocalPickerCell).data.displayDate).toEqual(
        displayDate
      )
    }
  )

  it.each([
    [{ format: undefined } as DateColumnParams, "%Y / %m / %d"],
    [{ format: "%d %B, %Y" } as DateColumnParams, "%d %B, %Y"],
  ])(
    "Given %p, shows %p format",
    (params: DateColumnParams, expFormat: string) => {
      const mockColumn = getDateColumn(MOCK_DATE_QUIVER_TYPE, params)
      const cell = mockColumn.getCell(null)
      expect((cell as DatePickerCell).data.format).toEqual(expFormat)
    }
  )
})
