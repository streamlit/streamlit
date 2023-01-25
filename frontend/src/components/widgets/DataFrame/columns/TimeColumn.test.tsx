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
import { TimePickerCell } from "src/components/widgets/DataFrame/customCells/TimePickerCell"
import {
  addDST,
  addTimezoneOffset,
  BaseColumnProps,
  getTimezoneOffset,
} from "./utils"
import TimeColumn, { TimeColumnParams } from "./TimeColumn"

const MOCK_TIME_QUIVER_TYPE: QuiverType = {
  pandas_type: "datetime",
  numpy_type: "datetime64",
}

const TIME_COLUMN_TEMPLATE: Partial<BaseColumnProps> = {
  id: "1",
  title: "datetime.time",
  indexNumber: 0,
  isEditable: true,
  isHidden: false,
  isIndex: false,
  isStretched: false,
}

function getTimeColumn(
  quiverType: QuiverType,
  params?: TimeColumnParams
): ReturnType<typeof TimeColumn> {
  return TimeColumn({
    ...TIME_COLUMN_TEMPLATE,
    quiverType,
    columnTypeMetadata: params,
  } as BaseColumnProps)
}

const constantDate = new Date("05 October 2011 14:48")
const constantDateWithout0MS = new Date("05 October 2011 14:48:48.001")

const constantDateAsNumber = Number(constantDate)
const dateWithout0MSAsNumber = Number(constantDateWithout0MS)

// deal with machines in different timezones
const constantDisplayDate = strftime(
  "%H:%M:%S.%L",
  new Date(Number(constantDate) - getTimezoneOffset())
).replace(".000", "")

// deal with machines in different timezones
const displayDateWithout0MS = strftime(
  "%H:%M:%S.%L",
  new Date(addDST(addTimezoneOffset(Number(constantDateWithout0MS))))
).replace("T", " ")

describe("TimeColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = getTimeColumn(MOCK_TIME_QUIVER_TYPE)
    expect(mockColumn.title).toEqual(TIME_COLUMN_TEMPLATE.title)
    expect(mockColumn.id).toEqual(TIME_COLUMN_TEMPLATE.id)
    expect(mockColumn.isEditable).toEqual(TIME_COLUMN_TEMPLATE.isEditable)

    const mockCell = mockColumn.getCell(constantDateAsNumber)
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect((mockCell as TimePickerCell).data.time).toEqual(
      constantDateAsNumber
    )
  })

  it.each([
    [constantDateAsNumber, constantDateAsNumber, constantDisplayDate],
    [dateWithout0MSAsNumber, dateWithout0MSAsNumber, displayDateWithout0MS],
    [null, null, "NA"],
    [undefined, null, "NA"],
  ])(
    "supports date value (%p parsed as %p)",
    (
      input: DataType | null | undefined,
      value: number | null,
      displayDate: string
    ) => {
      const mockColumn = getTimeColumn(MOCK_TIME_QUIVER_TYPE)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
      expect((cell as TimePickerCell).data.displayTime).toEqual(displayDate)
    }
  )

  it.each([
    [null, "faded"],
    [new Date(), "normal"],
  ])(
    "Given %p, shows %p style",
    (data: DataType | null | undefined, style: string) => {
      const mockColumn = getTimeColumn(MOCK_TIME_QUIVER_TYPE)
      const cell = mockColumn.getCell(data)
      expect(cell.style).toEqual(style)
    }
  )

  it.each([
    [{ format: undefined } as TimeColumnParams, "%H:%M:%S.%L"],
    [{ format: "%d %B, %Y" } as TimeColumnParams, "%d %B, %Y"],
  ])(
    "Given %p, shows %p format",
    (params: TimeColumnParams, expFormat: string) => {
      const mockColumn = getTimeColumn(MOCK_TIME_QUIVER_TYPE, params)
      const cell = mockColumn.getCell(100)
      expect((cell as TimePickerCell).data.format).toEqual(expFormat)
    }
  )
})
