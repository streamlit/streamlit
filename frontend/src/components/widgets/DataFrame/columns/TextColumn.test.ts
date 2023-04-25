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

/* eslint-disable  @typescript-eslint/no-non-null-assertion */

import { GridCellKind, TextCell } from "@glideapps/glide-data-grid"

import { isErrorCell } from "./utils"
import TextColumn from "./TextColumn"

const MOCK_TEXT_COLUMN_PROPS = {
  id: "1",
  name: "text_column",
  title: "Text column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isStretched: false,
  arrowType: {
    // The arrow type of the underlying data is
    // not used for anything inside the column.
    pandas_type: "unicode",
    numpy_type: "object",
  },
}

describe("TextColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = TextColumn(MOCK_TEXT_COLUMN_PROPS)
    expect(mockColumn.kind).toEqual("text")
    expect(mockColumn.title).toEqual(MOCK_TEXT_COLUMN_PROPS.title)
    expect(mockColumn.id).toEqual(MOCK_TEXT_COLUMN_PROPS.id)
    expect(mockColumn.sortMode).toEqual("default")

    const mockCell = mockColumn.getCell("foo")
    expect(mockCell.kind).toEqual(GridCellKind.Text)
    expect((mockCell as TextCell).data).toEqual("foo")
  })

  it.each([
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
      const mockColumn = TextColumn(MOCK_TEXT_COLUMN_PROPS)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it("validates input based on max_chars", () => {
    const mockColumn = TextColumn({
      ...MOCK_TEXT_COLUMN_PROPS,
      columnTypeOptions: { max_chars: 5 },
    })

    expect(mockColumn.validateInput!("12345")).toBe(true)
    expect(mockColumn.validateInput!("123456")).toBe("12345")
    expect(mockColumn.validateInput!("1234567890")).toBe("12345")
  })

  it("validates input based on validate regex", () => {
    const mockColumn = TextColumn({
      ...MOCK_TEXT_COLUMN_PROPS,
      columnTypeOptions: { validate: "^[a-zA-Z]+$" },
    })

    expect(mockColumn.validateInput!("abcde")).toBe(true)
    expect(mockColumn.validateInput!("12345")).toBe(false)
    expect(mockColumn.validateInput!("abc123")).toBe(false)
  })

  it("validates input based on max_chars and validate regex", () => {
    const mockColumn = TextColumn({
      ...MOCK_TEXT_COLUMN_PROPS,
      columnTypeOptions: { max_chars: 5, validate: "^[a-zA-Z]+$" },
    })

    expect(mockColumn.validateInput!("abcde")).toBe(true)
    expect(mockColumn.validateInput!("abcdef")).toBe("abcde")
    expect(mockColumn.validateInput!("12345")).toBe(false)
    expect(mockColumn.validateInput!("abc123")).toBe(false)
  })

  it("applies input validation in the getCell call based on max_chars and validate regex", () => {
    const mockColumn = TextColumn({
      ...MOCK_TEXT_COLUMN_PROPS,
      columnTypeOptions: { max_chars: 5, validate: "^[a-zA-Z]+$" },
    })

    expect(isErrorCell(mockColumn.getCell("abcde", true))).toBe(false)
    expect(isErrorCell(mockColumn.getCell("12345", true))).toBe(true)
    // A too long input is fine since it can be auto fixed
    expect(isErrorCell(mockColumn.getCell("abcdef", true))).toBe(false)
    // Applies the max chars limit
    expect((mockColumn.getCell("abcdef", true) as TextCell).data).toBe("abcde")
  })

  it("handles invalid validate regex", () => {
    const mockColumn = TextColumn({
      ...MOCK_TEXT_COLUMN_PROPS,
      columnTypeOptions: { validate: "[" }, // Invalid regex
    })

    const cell = mockColumn.getCell("test", true)
    expect(isErrorCell(cell)).toEqual(true)
    expect((cell as TextCell).data).toContain("Invalid validate regex")
  })

  it("ignores empty validate", () => {
    const mockColumn = TextColumn({
      ...MOCK_TEXT_COLUMN_PROPS,
      columnTypeOptions: { validate: "" },
    })

    const cell = mockColumn.getCell("test", true)
    expect(isErrorCell(cell)).toEqual(false)
  })
})
