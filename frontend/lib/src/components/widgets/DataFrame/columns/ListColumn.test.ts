/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { BubbleCell, GridCellKind } from "@glideapps/glide-data-grid"

import ListColumn from "./ListColumn"

const MOCK_LIST_COLUMN_PROPS = {
  id: "1",
  name: "list_column",
  title: "List column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isPinned: false,
  isStretched: false,
  arrowType: {
    // The arrow type of the underlying data is
    // not used for anything inside the column.
    pandas_type: "object",
    numpy_type: "list[unicode]",
  },
}

describe("ListColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = ListColumn(MOCK_LIST_COLUMN_PROPS)
    expect(mockColumn.kind).toEqual("list")
    expect(mockColumn.title).toEqual(MOCK_LIST_COLUMN_PROPS.title)
    expect(mockColumn.id).toEqual(MOCK_LIST_COLUMN_PROPS.id)
    expect(mockColumn.sortMode).toEqual("default")

    const mockCell = mockColumn.getCell(["foo", "bar"])
    expect(mockCell.kind).toEqual(GridCellKind.Bubble)
    expect((mockCell as BubbleCell).data).toEqual(["foo", "bar"])
  })

  it("ignores isEditable configuration", () => {
    const mockColumn = ListColumn({
      ...MOCK_LIST_COLUMN_PROPS,
      isEditable: true,
    })

    // Column should be readonly, even if isEditable was true
    expect(mockColumn.isEditable).toEqual(false)
  })

  it.each([
    // Supports almost the same as toSafeArray
    [null, null],
    [undefined, null],
    ["", []],
    [[], []],
    ["[]", []],
    ["foo", ["foo"]],
    // Comma separated syntax
    ["foo,bar", ["foo", "bar"]],
    ["foo,bar,", ["foo", "bar", ""]],
    ["foo,bar,,", ["foo", "bar", "", ""]],
    // JSON Array syntax
    [`["foo","bar"]`, ["foo", "bar"]],
    // non-string values
    [0, [0]],
    [1, [1]],
    [
      [0, 1.2],
      [0, 1.2],
    ],
    [true, [true]],
    [false, [false]],
    [
      [true, false],
      [true, false],
    ],
  ])(
    "supports array-compatible value (%p parsed as %p)",
    (input: any, value: any[] | null) => {
      const mockColumn = ListColumn(MOCK_LIST_COLUMN_PROPS)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it.each([
    [null, ""],
    [undefined, ""],
    [[], ""],
    [["foo", "bar"], "foo,bar"],
    [["foo", "bar", ""], "foo,bar,"],
    [["foo", "comma,in value"], "foo,comma in value"],
    [[0, 1.2], "0,1.2"],
    [[true, false], "true,false"],
  ])(
    "correctly prepares data for copy (%p parsed as %p)",
    (input: any, copyData: string | undefined) => {
      const mockColumn = ListColumn(MOCK_LIST_COLUMN_PROPS)
      const cell = mockColumn.getCell(input)
      expect((cell as any).copyData).toEqual(copyData)
    }
  )
})
