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

import { GridCellKind, UriCell } from "@glideapps/glide-data-grid"

import { BaseColumnProps } from "./utils"
import UrlColumn from "./UrlColumn"

const MOCK_URL_COLUMN_PROPS = {
  id: "1",
  title: "URL column",
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
} as BaseColumnProps

describe("UrlColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = UrlColumn(MOCK_URL_COLUMN_PROPS)
    expect(mockColumn.kind).toEqual("url")
    expect(mockColumn.title).toEqual(MOCK_URL_COLUMN_PROPS.title)
    expect(mockColumn.id).toEqual(MOCK_URL_COLUMN_PROPS.id)
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
      const mockColumn = UrlColumn(MOCK_URL_COLUMN_PROPS)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )
})
