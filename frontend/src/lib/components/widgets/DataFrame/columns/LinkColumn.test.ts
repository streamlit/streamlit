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

import { GridCellKind, UriCell } from "@glideapps/glide-data-grid"

import { isErrorCell } from "./utils"
import LinkColumn from "./LinkColumn"

const MOCK_LINK_COLUMN_PROPS = {
  id: "1",
  name: "link_column",
  title: "Link column",
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

describe("LinkColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = LinkColumn(MOCK_LINK_COLUMN_PROPS)
    expect(mockColumn.kind).toEqual("link")
    expect(mockColumn.title).toEqual(MOCK_LINK_COLUMN_PROPS.title)
    expect(mockColumn.id).toEqual(MOCK_LINK_COLUMN_PROPS.id)
    expect(mockColumn.sortMode).toEqual("default")

    const mockCell = mockColumn.getCell("https://streamlit.io")
    expect(mockCell.kind).toEqual(GridCellKind.Uri)
    expect((mockCell as UriCell).data).toEqual("https://streamlit.io")
  })

  it.each([
    ["foo", "foo"],
    ["https://streamlit.io", "https://streamlit.io"],
    ["/path/to/file", "/path/to/file"],
    [null, null],
    [undefined, null],
    // All the values that are supported by the TextColumn
    // should also be supported by the UrlColumn.
  ])(
    "supports string-compatible value (%p parsed as %p)",
    (input: any, value: string | null) => {
      const mockColumn = LinkColumn(MOCK_LINK_COLUMN_PROPS)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it("validates input based on max_chars", () => {
    const mockColumn = LinkColumn({
      ...MOCK_LINK_COLUMN_PROPS,
      columnTypeOptions: { max_chars: 5 },
    })

    expect(mockColumn.validateInput!("12345")).toBe(true)
    expect(mockColumn.validateInput!("123456")).toBe("12345")
    expect(mockColumn.validateInput!("1234567890")).toBe("12345")
  })

  it("validates input based on validate regex", () => {
    const mockColumn = LinkColumn({
      ...MOCK_LINK_COLUMN_PROPS,
      columnTypeOptions: {
        validate:
          "^https://(?:www.)?(?:[a-zA-Z0-9-]+.)*streamlit.app(?:/.*)?$",
      },
    })

    expect(mockColumn.validateInput!("https://issues.streamlit.app/")).toBe(
      true
    )
    expect(
      mockColumn.validateInput!(
        "https://issues.streamlit.app/Streamlit_Issues_Leaderboard?issue=10"
      )
    ).toBe(true)
    expect(mockColumn.validateInput!("issues.streamlit.app/")).toBe(false)
    expect(mockColumn.validateInput!("https://issues.streamlit.io/")).toBe(
      false
    )
  })

  it("applies input validation in the getCell call based on max_chars and validate regex", () => {
    const mockColumn = LinkColumn({
      ...MOCK_LINK_COLUMN_PROPS,
      columnTypeOptions: {
        max_chars: 40,
        validate:
          "^https://(?:www.)?(?:[a-zA-Z0-9-]+.)*streamlit.app(?:/.*)?$",
      },
    })

    expect(
      isErrorCell(mockColumn.getCell("https://issues.streamlit.app/", true))
    ).toBe(false)
    expect(
      isErrorCell(mockColumn.getCell("https://issues.streamlit.io/", true))
    ).toBe(true)
    // A too long input is fine since it can be auto fixed (doesn't make a lot of sense in this example)
    expect(
      isErrorCell(
        mockColumn.getCell(
          "https://issues.streamlit.app/Streamlit_Issues_Leaderboard?issue=10",
          true
        )
      )
    ).toBe(false)
  })

  it("handles invalid validate regex", () => {
    const mockColumn = LinkColumn({
      ...MOCK_LINK_COLUMN_PROPS,
      columnTypeOptions: { validate: "[" }, // Invalid regex
    })

    const cell = mockColumn.getCell("test", true)
    expect(isErrorCell(cell)).toEqual(true)
    expect((cell as UriCell).data).toContain("Invalid validate regex")
  })

  it("ignores empty validate", () => {
    const mockColumn = LinkColumn({
      ...MOCK_LINK_COLUMN_PROPS,
      columnTypeOptions: { validate: "" },
    })

    const cell = mockColumn.getCell("test", true)
    expect(isErrorCell(cell)).toEqual(false)
  })
})
