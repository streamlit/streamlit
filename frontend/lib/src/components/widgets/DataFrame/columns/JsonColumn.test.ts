/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { GridCellKind } from "@glideapps/glide-data-grid"
import { Field, Utf8 } from "apache-arrow"

import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"

import { JsonCell } from "./cells/JsonCell"
import JsonColumn from "./JsonColumn"
import { isMissingValueCell } from "./utils"

const MOCK_JSON_COLUMN_PROPS = {
  id: "1",
  name: "json_column",
  title: "JSON Column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isPinned: false,
  isStretched: false,
  arrowType: {
    type: DataFrameCellType.DATA,
    arrowField: new Field("json_column", new Utf8(), true),
    pandasType: {
      field_name: "json_column",
      name: "json_column",
      pandas_type: "object",
      numpy_type: "object",
      metadata: null,
    },
  },
}

describe("JsonColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = JsonColumn(MOCK_JSON_COLUMN_PROPS)
    expect(mockColumn.kind).toEqual("json")
    expect(mockColumn.title).toEqual(MOCK_JSON_COLUMN_PROPS.title)
    expect(mockColumn.id).toEqual(MOCK_JSON_COLUMN_PROPS.id)
    expect(mockColumn.sortMode).toEqual("default")
    expect(mockColumn.isEditable).toEqual(false)
  })

  it("creates cells with correct properties", () => {
    const mockColumn = JsonColumn(MOCK_JSON_COLUMN_PROPS)
    const jsonData = { foo: "bar", num: 123 }
    const cell = mockColumn.getCell(jsonData) as JsonCell

    expect(cell.kind).toEqual(GridCellKind.Custom)
    expect(cell.allowOverlay).toEqual(true)
    expect(cell.readonly).toEqual(true)
    expect(cell.data.kind).toEqual("json-cell")
    expect(cell.data.value).toEqual(jsonData)
  })

  it("handles null and undefined values as missing cells", () => {
    const mockColumn = JsonColumn(MOCK_JSON_COLUMN_PROPS)

    const nullCell = mockColumn.getCell(null) as JsonCell
    expect(nullCell.data.value).toEqual(null)
    expect(nullCell.data.displayValue).toEqual("")
    expect(isMissingValueCell(nullCell)).toEqual(true)

    const undefinedCell = mockColumn.getCell(undefined) as JsonCell
    expect(undefinedCell.data.value).toEqual(undefined)
    expect(undefinedCell.data.displayValue).toEqual("")
    expect(isMissingValueCell(undefinedCell)).toEqual(true)
  })

  it.each([
    [{ foo: "bar" }, { foo: "bar" }, '{"foo":"bar"}'],
    [["a", "b", "c"], ["a", "b", "c"], '["a","b","c"]'],
    ['{"key": "value"}', '{"key": "value"}', '{"key": "value"}'],
    [123, 123, "123"],
    [true, true, "true"],
    [null, null, ""],
    [undefined, null, ""],
  ])(
    "handles different JSON-compatible values (%p)",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    (input: any, expected: any, displayValue: string) => {
      const mockColumn = JsonColumn(MOCK_JSON_COLUMN_PROPS)
      const cell = mockColumn.getCell(input) as JsonCell
      expect(mockColumn.getCellValue(cell)).toEqual(expected)
      expect(cell.data.displayValue).toEqual(displayValue)
    }
  )

  it("creates faded style cells when column is pinned", () => {
    const mockColumn = JsonColumn({
      ...MOCK_JSON_COLUMN_PROPS,
      isPinned: true,
    })
    const cell = mockColumn.getCell({ test: "value" }) as JsonCell
    expect(cell.style).toEqual("faded")
  })

  it("creates normal style cells when column is not pinned", () => {
    const mockColumn = JsonColumn(MOCK_JSON_COLUMN_PROPS)
    const cell = mockColumn.getCell({ test: "value" }) as JsonCell
    expect(cell.style).toEqual("normal")
  })
})
