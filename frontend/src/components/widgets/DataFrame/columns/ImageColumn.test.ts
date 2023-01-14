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

import { GridCellKind, ImageCell } from "@glideapps/glide-data-grid"

import ImageColumn from "./ImageColumn"

const MOCK_IMAGE_COLUMN_PROPS = {
  id: "1",
  title: "Image column",
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

describe("ListColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = ImageColumn(MOCK_IMAGE_COLUMN_PROPS)
    expect(mockColumn.kind).toEqual("image")
    expect(mockColumn.title).toEqual(MOCK_IMAGE_COLUMN_PROPS.title)
    expect(mockColumn.id).toEqual(MOCK_IMAGE_COLUMN_PROPS.id)
    expect(mockColumn.sortMode).toEqual("default")

    const mockCell = mockColumn.getCell("https://picsum.photos/400/400")
    expect(mockCell.kind).toEqual(GridCellKind.Image)
    expect((mockCell as ImageCell).data).toEqual([
      "https://picsum.photos/400/400",
    ])
  })

  it("ignores isEditable configuration", () => {
    const mockColumn = ImageColumn({
      ...MOCK_IMAGE_COLUMN_PROPS,
      isEditable: true,
    })

    // Column should be readonly, even if isEditable was true
    expect(mockColumn.isEditable).toEqual(false)
  })

  it.each([
    // Image column supports the
    // same conversions as the text column:
    ["https://picsum.photos/400/400", "https://picsum.photos/400/400"],
    ["/foo", "/foo"],
    ["", ""],
    [[], ""],
    [
      "data:image/png;base64,iVBORw0KGgoAAAAAAAAyCAYAAAAUYybjAAAgAElE...",
      "data:image/png;base64,iVBORw0KGgoAAAAAAAAyCAYAAAAUYybjAAAgAElE...",
    ],
    [null, null],
    [undefined, null],
  ])(
    "supports string-compatible value (%p parsed as %p)",
    (input: any, value: string | null) => {
      const mockColumn = ImageColumn(MOCK_IMAGE_COLUMN_PROPS)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )
})
