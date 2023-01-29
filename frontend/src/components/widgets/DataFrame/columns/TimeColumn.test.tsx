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
import { DatetimePickerCell } from "src/components/widgets/DataFrame/customCells/DatetimePickerCell"
import { BaseColumnProps } from "./utils"
import TimeColumn, { TimeColumnParams } from "./TimeColumn"

const MOCK_TIME_QUIVER_TYPE: QuiverType = {
  pandas_type: "timestamp",
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

const constantDateAsNumber = Number(constantDate)

describe("TimeColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = getTimeColumn(MOCK_TIME_QUIVER_TYPE)
    expect(mockColumn.title).toEqual(TIME_COLUMN_TEMPLATE.title)
    expect(mockColumn.id).toEqual(TIME_COLUMN_TEMPLATE.id)
    expect(mockColumn.isEditable).toEqual(TIME_COLUMN_TEMPLATE.isEditable)

    const mockCell = mockColumn.getCell(constantDateAsNumber)
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect((mockCell as DatetimePickerCell).data.date).toEqual(constantDate)
  })
})
