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

import { GridCellKind } from "@glideapps/glide-data-grid"
import { Field, Utf8 } from "apache-arrow"

import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"

import ButtonColumn from "./ButtonColumn"
import { ButtonCell } from "./cells/ButtonCell"

const MOCK_BUTTON_COLUMN_PROPS = {
  id: "1",
  name: "button_column",
  title: "Button column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isPinned: false,
  isStretched: false,
  arrowType: {
    type: DataFrameCellType.DATA,
    arrowField: new Field("button_column", new Utf8(), true),
    pandasType: {
      field_name: "button_column",
      name: "button_column",
      pandas_type: "unicode",
      numpy_type: "object",
      metadata: null,
    },
  },
}

describe("ButtonColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = ButtonColumn(MOCK_BUTTON_COLUMN_PROPS)
    expect(mockColumn.kind).toEqual("button")
    expect(mockColumn.title).toEqual(MOCK_BUTTON_COLUMN_PROPS.title)
    expect(mockColumn.id).toEqual(MOCK_BUTTON_COLUMN_PROPS.id)
    expect(mockColumn.sortMode).toEqual("default")
    expect(mockColumn.isEditable).toBe(false)
  })

  it("has correct typeIcon", () => {
    const mockColumn = ButtonColumn(MOCK_BUTTON_COLUMN_PROPS)
    expect(mockColumn.typeIcon).toBe(":material/smart_button:")
  })

  it("is not editable", () => {
    const mockColumn = ButtonColumn({
      ...MOCK_BUTTON_COLUMN_PROPS,
      isEditable: true, // Even if set to true, should remain false
    })
    expect(mockColumn.isEditable).toBe(false)
  })

  it("uses secondary button type by default", () => {
    const mockColumn = ButtonColumn(MOCK_BUTTON_COLUMN_PROPS)
    const cell = mockColumn.getCell("Click me") as ButtonCell
    expect(cell.data.buttonType).toEqual("secondary")
  })

  it.each(["primary", "secondary", "tertiary"] as const)(
    "respects button_type option: %s",
    buttonType => {
      const mockColumn = ButtonColumn({
        ...MOCK_BUTTON_COLUMN_PROPS,
        columnTypeOptions: { button_type: buttonType },
      })
      const cell = mockColumn.getCell("Click me") as ButtonCell
      expect(cell.data.buttonType).toEqual(buttonType)
    }
  )

  it.each([
    // Single string becomes a single button label
    ["Click me", "Click me"],
    // Array with one item becomes a single button label
    [["Click me"], "Click me"],
    // Array with multiple items becomes an array (multi-action)
    [
      ["Action 1", "Action 2"],
      ["Action 1", "Action 2"],
    ],
    // JSON string array
    [`["Action 1", "Action 2"]`, ["Action 1", "Action 2"]],
    // null/undefined
    [null, null],
    [undefined, null],
  ])(
    "parses cell value correctly (%p -> %p)",
    (input: unknown, expected: unknown) => {
      const mockColumn = ButtonColumn(MOCK_BUTTON_COLUMN_PROPS)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell as ButtonCell)).toEqual(expected)
    }
  )

  it("creates cells with null data for null input", () => {
    const mockColumn = ButtonColumn(MOCK_BUTTON_COLUMN_PROPS)
    const cell = mockColumn.getCell(null) as ButtonCell
    expect(cell.data.data).toBeNull()
  })

  it("creates cells with correct GridCellKind", () => {
    const mockColumn = ButtonColumn(MOCK_BUTTON_COLUMN_PROPS)
    const cell = mockColumn.getCell("Click me") as ButtonCell
    expect(cell.kind).toEqual(GridCellKind.Custom)
    expect(cell.data.kind).toEqual("button-cell")
  })

  it.each([
    ["readonly", true],
    ["allowOverlay", false],
  ] as const)(
    "cell has %s set to %s",
    (prop: "readonly" | "allowOverlay", expected: boolean) => {
      const mockColumn = ButtonColumn(MOCK_BUTTON_COLUMN_PROPS)
      const cell = mockColumn.getCell("Click me") as ButtonCell
      expect(cell[prop]).toBe(expected)
    }
  )

  it.each([
    ["Click me", "Click me"],
    [["Action 1", "Action 2"], "Action 1, Action 2"],
    [null, ""],
  ])(
    "sets correct copyData (%p -> %p)",
    (input: unknown, expectedCopyData: string) => {
      const mockColumn = ButtonColumn(MOCK_BUTTON_COLUMN_PROPS)
      const cell = mockColumn.getCell(input) as ButtonCell
      expect(cell.copyData).toEqual(expectedCopyData)
    }
  )

  it("has isEditableType set to false", () => {
    expect(ButtonColumn.isEditableType).toBe(false)
  })
})
