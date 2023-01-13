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

import { BooleanCell, GridCellKind } from "@glideapps/glide-data-grid"

import { isErrorCell } from "./utils"
import BooleanColumn from "./BooleanColumn"

const MOCK_BOOLEAN_COLUMN_PROPS = {
  id: "1",
  title: "Boolean column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isStretched: false,
  arrowType: {
    // The arrow type of the underlying data is
    // not used for anything inside the boolean column.
    pandas_type: "bool",
    numpy_type: "bool",
  },
}

describe("BooleanColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = BooleanColumn(MOCK_BOOLEAN_COLUMN_PROPS)
    expect(mockColumn.title).toEqual(MOCK_BOOLEAN_COLUMN_PROPS.title)
    expect(mockColumn.id).toEqual(MOCK_BOOLEAN_COLUMN_PROPS.id)

    const mockCell = mockColumn.getCell(true)
    expect(mockCell.kind).toEqual(GridCellKind.Boolean)
    expect((mockCell as BooleanCell).data).toEqual(true)
  })

  it.each([
    [true, true],
    [false, false],
    ["true", true],
    ["false", false],
    ["yes", true],
    ["no", false],
    ["t", true],
    ["f", false],
    ["y", true],
    ["n", false],
    ["on", true],
    ["off", false],
    ["1", true],
    ["0", false],
    [1, true],
    [0, false],
    [[], null],
    [null, null],
    [undefined, null],
    ["", null],
  ])(
    "supports boolean compatible value (%p parsed as %p)",
    (input: any, value: boolean | null) => {
      const mockColumn = BooleanColumn(MOCK_BOOLEAN_COLUMN_PROPS)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it.each([
    [true, false],
    [false, false],
    ["true", false],
    ["false", false],
    [1, false],
    [0, false],
    ["", false],
    [null, false],
    [undefined, false],
    [[], false],
    ["foo", true],
    [12345, true],
    [0.1, true],
    [["foo", "bar"], true],
  ])("%p results in error cell: %p", (input: any, errorCell: boolean) => {
    const mockColumn = BooleanColumn(MOCK_BOOLEAN_COLUMN_PROPS)
    const cell = mockColumn.getCell(input)
    expect(isErrorCell(cell)).toEqual(errorCell)
  })
})
