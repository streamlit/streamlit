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

import { GridCellKind, TextCell } from "@glideapps/glide-data-grid"

import ObjectColumn from "./ObjectColumn"

const MOCK_OBJECT_COLUMN_PROPS = {
  id: "1",
  title: "Object column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isStretched: false,
  arrowType: {
    // The arrow type of the underlying data is
    // not used for anything inside the text column.
    pandas_type: "object",
    numpy_type: "object",
  },
}

describe("ObjectColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = ObjectColumn(MOCK_OBJECT_COLUMN_PROPS)
    expect(mockColumn.kind).toEqual("object")
    expect(mockColumn.title).toEqual(MOCK_OBJECT_COLUMN_PROPS.title)
    expect(mockColumn.id).toEqual(MOCK_OBJECT_COLUMN_PROPS.id)
    expect(mockColumn.sortMode).toEqual("default")

    const mockCell = mockColumn.getCell("foo")
    expect(mockCell.kind).toEqual(GridCellKind.Text)
    expect((mockCell as TextCell).data).toEqual("foo")
  })

  it("ignores isEditable configuration", () => {
    const mockColumn = ObjectColumn({
      ...MOCK_OBJECT_COLUMN_PROPS,
      isEditable: true,
    })

    // Column should be readonly, even if isEditable was true
    expect(mockColumn.isEditable).toEqual(false)
    // Cells from object column should always be readonly
    expect((mockColumn.getCell("foo") as TextCell).readonly).toEqual(true)
  })

  it.each([
    // Object column supports the
    // same conversions as the text column:
    ["foo", "foo"],
    ["abc def 1234 $", "abc def 1234 $"],
    [1, "1"],
    [0, "0"],
    [0.123, "0.123"],
    ["", ""],
    [[], ""],
    [["foo", "bar"], "foo,bar"],
    [[1, 2, 0.1231], "1,2,0.1231"],
    [true, "true"],
    [
      {
        foo: "bar",
      },
      "[object Object]",
    ],
    [null, null],
    [undefined, null],
  ])(
    "supports string-compatible value (%p parsed as %p)",
    (input: any, value: string | null) => {
      const mockColumn = ObjectColumn(MOCK_OBJECT_COLUMN_PROPS)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )
})
