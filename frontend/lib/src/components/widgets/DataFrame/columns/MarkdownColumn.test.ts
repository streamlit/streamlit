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

/* eslint-disable  @typescript-eslint/no-non-null-assertion */

import { GridCellKind, MarkdownCell } from "@glideapps/glide-data-grid"

import MarkdownColumn from "./MarkdownColumn"

const MOCK_MARKDOWN_COLUMN_PROPS = {
  id: "1",
  name: "markdown_column",
  title: "Markdown column",
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

describe("MarkdownColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = MarkdownColumn(MOCK_MARKDOWN_COLUMN_PROPS)
    expect(mockColumn.kind).toEqual("markdown")
    expect(mockColumn.title).toEqual(MOCK_MARKDOWN_COLUMN_PROPS.title)
    expect(mockColumn.id).toEqual(MOCK_MARKDOWN_COLUMN_PROPS.id)
    expect(mockColumn.sortMode).toEqual("default")

    const mockCell = mockColumn.getCell("*streamlit*") as MarkdownCell
    expect(mockCell.kind).toEqual(GridCellKind.Markdown)
    expect(mockCell.data).toEqual("*streamlit*")
  })

  it.each([
    ["foo", "foo"],
    ["*streamlit*", "*streamlit*"],
    ["/path/to/file", "/path/to/file"],
    [null, null],
    [undefined, null],
    // All the values that are supported by the TextColumn
    // should also be supported by the UrlColumn.
  ])(
    "supports string-compatible value (%p parsed as %p)",
    (input: any, value: any | null) => {
      const mockColumn = MarkdownColumn(MOCK_MARKDOWN_COLUMN_PROPS)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it("validates input based on max_chars", () => {
    const mockColumn = MarkdownColumn({
      ...MOCK_MARKDOWN_COLUMN_PROPS,
      columnTypeOptions: { max_chars: 5 },
    })

    expect(mockColumn.validateInput!("12345")).toBe(true)
    expect(mockColumn.validateInput!("123456")).toBe(false)
    expect(mockColumn.validateInput!("1234567890")).toBe(false)
  })
})
