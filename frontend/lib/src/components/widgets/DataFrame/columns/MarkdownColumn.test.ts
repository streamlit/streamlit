/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { GridCellKind } from "@glideapps/glide-data-grid"
import { Field, Utf8 } from "apache-arrow"

import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"

import { MarkdownCell } from "./cells/MarkdownCell"
import MarkdownColumn from "./MarkdownColumn"
import { type ErrorCell, isErrorCell, isMissingValueCell } from "./utils"

const MOCK_MARKDOWN_COLUMN_PROPS = {
  id: "1",
  name: "markdown_column",
  title: "Markdown Column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isPinned: false,
  isStretched: false,
  arrowType: {
    type: DataFrameCellType.DATA,
    arrowField: new Field("markdown_column", new Utf8(), true),
    pandasType: {
      field_name: "markdown_column",
      name: "markdown_column",
      pandas_type: "unicode",
      numpy_type: "object",
      metadata: null,
    },
  },
}

describe("MarkdownColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = MarkdownColumn(MOCK_MARKDOWN_COLUMN_PROPS)
    expect(mockColumn.kind).toEqual("markdown")
    expect(mockColumn.title).toEqual(MOCK_MARKDOWN_COLUMN_PROPS.title)
    expect(mockColumn.id).toEqual(MOCK_MARKDOWN_COLUMN_PROPS.id)
    expect(mockColumn.sortMode).toEqual("default")
  })

  it("creates cells with correct properties", () => {
    const mockColumn = MarkdownColumn(MOCK_MARKDOWN_COLUMN_PROPS)
    const markdownText = "# Title\n\nThis is **bold** text."
    const cell = mockColumn.getCell(markdownText) as MarkdownCell

    expect(cell.kind).toEqual(GridCellKind.Custom)
    expect(cell.allowOverlay).toEqual(true)
    expect(cell.data.kind).toEqual("markdown-cell")
    expect(cell.data.value).toEqual(markdownText)
  })

  it("handles null and undefined values as missing cells", () => {
    const mockColumn = MarkdownColumn(MOCK_MARKDOWN_COLUMN_PROPS)

    const nullCell = mockColumn.getCell(null) as MarkdownCell
    expect(nullCell.data.value).toEqual(null)
    expect(nullCell.data.displayValue).toEqual("")
    expect(isMissingValueCell(nullCell)).toEqual(true)

    const undefinedCell = mockColumn.getCell(undefined) as MarkdownCell
    expect(undefinedCell.data.value).toEqual(null)
    expect(undefinedCell.data.displayValue).toEqual("")
    expect(isMissingValueCell(undefinedCell)).toEqual(true)
  })

  it.each([
    ["Simple text", "Simple text", "Simple text"],
    ["# Header", "# Header", "# Header"],
    ["**bold**", "**bold**", "**bold**"],
    ["_italic_", "_italic_", "_italic_"],
    ["- Item 1\n- Item 2", "- Item 1\n- Item 2", "- Item 1 - Item 2"],
    [123, "123", "123"],
    [null, null, ""],
    [undefined, null, ""],
  ])(
    "handles different values (%p)",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing different input types
    (input: any, expectedValue: string | null, expectedDisplay: string) => {
      const mockColumn = MarkdownColumn(MOCK_MARKDOWN_COLUMN_PROPS)
      const cell = mockColumn.getCell(input) as MarkdownCell
      expect(mockColumn.getCellValue(cell)).toEqual(expectedValue)
      expect(cell.data.displayValue).toEqual(expectedDisplay)
    }
  )

  it.each([
    [false, true],
    [true, false],
  ])(
    "creates cells with readonly=%s when isEditable=%s",
    (expectedReadonly, isEditable) => {
      const mockColumn = MarkdownColumn({
        ...MOCK_MARKDOWN_COLUMN_PROPS,
        isEditable,
      })
      const cell = mockColumn.getCell("# Test") as MarkdownCell
      expect(cell.readonly).toBe(expectedReadonly)
    }
  )

  it.each([
    ["faded", true],
    ["normal", false],
  ])(
    "creates cells with style=%s when isPinned=%s",
    (expectedStyle, isPinned) => {
      const mockColumn = MarkdownColumn({
        ...MOCK_MARKDOWN_COLUMN_PROPS,
        isPinned,
      })
      const cell = mockColumn.getCell("# Test") as MarkdownCell
      expect(cell.style).toBe(expectedStyle)
    }
  )

  it.each([
    [true, "Some text", true],
    [true, null, false],
    [true, undefined, false],
    [false, null, true],
    [false, undefined, true],
  ])(
    "validates input correctly when isRequired=%s for value %p",
    (isRequired, input, expected) => {
      const mockColumn = MarkdownColumn({
        ...MOCK_MARKDOWN_COLUMN_PROPS,
        isRequired,
      })
      expect(mockColumn.validateInput!(input)).toBe(expected)
    }
  )

  it("returns an error cell when getCell is called with validate=true and isRequired=true for null input", () => {
    const mockColumn = MarkdownColumn({
      ...MOCK_MARKDOWN_COLUMN_PROPS,
      isRequired: true,
    })
    const errorCell = mockColumn.getCell(null, true)
    expect(isErrorCell(errorCell)).toBe(true)
    expect((errorCell as ErrorCell).errorDetails).toBe("Invalid input.")
  })

  it("returns normal cell when getCell is called with validate=true for valid input", () => {
    const mockColumn = MarkdownColumn({
      ...MOCK_MARKDOWN_COLUMN_PROPS,
      isRequired: true,
    })
    const cell = mockColumn.getCell("# Valid content", true) as MarkdownCell
    expect(isErrorCell(cell)).toBe(false)
    expect(cell.kind).toBe(GridCellKind.Custom)
    expect(cell.data.value).toBe("# Valid content")
  })
})
