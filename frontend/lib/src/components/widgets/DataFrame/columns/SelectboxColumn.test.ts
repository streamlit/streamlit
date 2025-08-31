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
import { DropdownCellType } from "@glideapps/glide-data-grid-cells"
import { Bool, Field, Int8 } from "apache-arrow"

import { ArrowType, DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"

import SelectboxColumn, {
  prepareOptions,
  SelectboxColumnParams,
} from "./SelectboxColumn"
import { BaseColumnProps, isErrorCell, isMissingValueCell } from "./utils"

const MOCK_CATEGORICAL_TYPE: ArrowType = {
  type: DataFrameCellType.DATA,
  arrowField: new Field("selectbox_column", new Int8(), true),
  pandasType: {
    field_name: "selectbox_column",
    name: "selectbox_column",
    pandas_type: "int8",
    numpy_type: "int8",
    metadata: null,
  },
}

const MOCK_BOOLEAN_ARROW_TYPE: ArrowType = {
  type: DataFrameCellType.DATA,
  arrowField: new Field("selectbox_column", new Bool(), true),
  pandasType: {
    field_name: "selectbox_column",
    name: "selectbox_column",
    pandas_type: "bool",
    numpy_type: "bool",
    metadata: null,
  },
}

const SELECTBOX_COLUMN_TEMPLATE: Partial<BaseColumnProps> = {
  id: "1",
  name: "selectbox_column",
  title: "Selectbox column",
  indexNumber: 0,
  isEditable: true,
  isHidden: false,
  isIndex: false,
  isPinned: false,
  isStretched: false,
}

function getSelectboxColumn(
  arrowType: ArrowType,
  params?: SelectboxColumnParams,
  column_props_overwrites?: Partial<BaseColumnProps>
): ReturnType<typeof SelectboxColumn> {
  return SelectboxColumn({
    ...SELECTBOX_COLUMN_TEMPLATE,
    ...column_props_overwrites,
    arrowType,
    columnTypeOptions: params,
  } as BaseColumnProps)
}

describe("SelectboxColumn", () => {
  it("creates a valid column instance with string values", () => {
    const mockColumn = getSelectboxColumn(MOCK_CATEGORICAL_TYPE, {
      options: ["foo", "bar"],
    })
    expect(mockColumn.kind).toEqual("selectbox")
    expect(mockColumn.title).toEqual(SELECTBOX_COLUMN_TEMPLATE.title)
    expect(mockColumn.id).toEqual(SELECTBOX_COLUMN_TEMPLATE.id)
    expect(mockColumn.sortMode).toEqual("default")

    const mockCell = mockColumn.getCell("foo")
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect(mockColumn.getCellValue(mockCell)).toEqual("foo")

    expect((mockCell as DropdownCellType).data.allowedValues).toEqual([
      null,
      { value: "foo", label: "foo" },
      { value: "bar", label: "bar" },
    ])
  })

  it("creates a valid column instance number values", () => {
    const mockColumn = getSelectboxColumn(MOCK_CATEGORICAL_TYPE, {
      options: [1, 2, 3],
    })
    expect(mockColumn.kind).toEqual("selectbox")
    expect(mockColumn.title).toEqual(SELECTBOX_COLUMN_TEMPLATE.title)
    expect(mockColumn.id).toEqual(SELECTBOX_COLUMN_TEMPLATE.id)
    expect(mockColumn.sortMode).toEqual("default")

    const mockCell = mockColumn.getCell(1)
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect(mockColumn.getCellValue(mockCell)).toEqual(1)

    expect((mockCell as DropdownCellType).data.allowedValues).toEqual([
      null,
      { value: "1", label: "1" },
      { value: "2", label: "2" },
      { value: "3", label: "3" },
    ])
  })

  it("creates a valid column instance from boolean type", () => {
    const mockColumn = getSelectboxColumn(MOCK_BOOLEAN_ARROW_TYPE)
    expect(mockColumn.kind).toEqual("selectbox")
    expect(mockColumn.title).toEqual(SELECTBOX_COLUMN_TEMPLATE.title)

    const mockCell = mockColumn.getCell(true)
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect(mockColumn.getCellValue(mockCell)).toEqual(true)

    expect((mockCell as DropdownCellType).data.allowedValues).toEqual([
      null,
      { value: "true", label: "true" },
      { value: "false", label: "false" },
    ])
  })

  it("creates a required column that does not add the empty value", () => {
    const mockColumn = getSelectboxColumn(
      MOCK_CATEGORICAL_TYPE,
      {
        options: ["foo", "bar"],
      },
      { isRequired: true }
    )
    const mockCell = mockColumn.getCell("foo")
    expect((mockCell as DropdownCellType).data.allowedValues).toEqual([
      { value: "foo", label: "foo" },
      { value: "bar", label: "bar" },
    ])

    const errorCell = mockColumn.getCell(null, true)
    expect(isErrorCell(errorCell)).toEqual(true)
  })

  it("uses faded style for pinned columns", () => {
    const mockColumn = getSelectboxColumn(
      MOCK_CATEGORICAL_TYPE,
      {
        options: ["foo", "bar"],
      },
      {
        isPinned: true,
      }
    )

    const mockCell = mockColumn.getCell("foo")
    expect(mockCell.style).toEqual("faded")
  })

  it("creates error cell if value is not in options", () => {
    const mockColumn = getSelectboxColumn(MOCK_CATEGORICAL_TYPE, {
      options: ["foo", "bar"],
    })
    const mockCell = mockColumn.getCell("baz", true)
    expect(isErrorCell(mockCell)).toEqual(true)
  })

  it.each([[null], [undefined], [""]])(
    "%p is interpreted as missing value",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    (input: any) => {
      const mockColumn = getSelectboxColumn(MOCK_CATEGORICAL_TYPE, {
        options: ["foo", "bar"],
      })
      const mockCell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(mockCell)).toEqual(null)
      expect(isMissingValueCell(mockCell)).toEqual(true)
    }
  )

  it("supports SelectOption objects with custom labels", () => {
    const mockColumn = getSelectboxColumn(MOCK_CATEGORICAL_TYPE, {
      options: [
        { value: "us", label: "United States" },
        { value: "de", label: "Germany" },
      ],
    })

    const mockCell = mockColumn.getCell("us")
    expect((mockCell as DropdownCellType).data.allowedValues).toEqual([
      null,
      { value: "us", label: "United States" },
      { value: "de", label: "Germany" },
    ])
    expect(mockColumn.getCellValue(mockCell)).toEqual("us")
  })

  it("defaults SelectOption label to value when not provided", () => {
    const mockColumn = getSelectboxColumn(MOCK_CATEGORICAL_TYPE, {
      options: [{ value: "X" }, { value: "Y" }],
    })

    const mockCell = mockColumn.getCell("X")
    expect((mockCell as DropdownCellType).data.allowedValues).toEqual([
      null,
      { value: "X", label: "X" },
      { value: "Y", label: "Y" },
    ])
    expect(mockColumn.getCellValue(mockCell)).toEqual("X")
  })

  it("supports numeric SelectOption values and returns numbers", () => {
    const mockColumn = getSelectboxColumn(MOCK_CATEGORICAL_TYPE, {
      options: [
        { value: 1, label: "One" },
        { value: 2, label: "Two" },
      ],
    })

    const mockCell = mockColumn.getCell(1)
    expect((mockCell as DropdownCellType).data.allowedValues).toEqual([
      null,
      { value: "1", label: "One" },
      { value: "2", label: "Two" },
    ])
    expect(mockColumn.getCellValue(mockCell)).toEqual(1)
  })

  it("supports boolean SelectOption values and returns booleans", () => {
    const mockColumn = getSelectboxColumn(MOCK_BOOLEAN_ARROW_TYPE, {
      options: [
        { value: true, label: "Yes" },
        { value: false, label: "No" },
      ],
    })

    const mockCell = mockColumn.getCell(true)
    expect((mockCell as DropdownCellType).data.allowedValues).toEqual([
      null,
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ])
    expect(mockColumn.getCellValue(mockCell)).toEqual(true)
  })

  it("validates against object options as well", () => {
    const mockColumn = getSelectboxColumn(MOCK_CATEGORICAL_TYPE, {
      options: [
        { value: 1, label: "One" },
        { value: 2, label: "Two" },
      ],
    })
    const errorCell = mockColumn.getCell("3", true)
    expect(isErrorCell(errorCell)).toEqual(true)
  })
})

describe("prepareOptions", () => {
  it.each([
    [
      ["foo", "bar"],
      [
        { value: "foo", label: "foo" },
        { value: "bar", label: "bar" },
      ],
    ],
    [
      [1, 2],
      [
        { value: "1", label: "1" },
        { value: "2", label: "2" },
      ],
    ],
    [
      [true, false],
      [
        { value: "true", label: "true" },
        { value: "false", label: "false" },
      ],
    ],
    [
      [
        { value: "us", label: "United States" },
        { value: "de", label: "Germany" },
      ],
      [
        { value: "us", label: "United States" },
        { value: "de", label: "Germany" },
      ],
    ],
    [
      [{ value: "X" }, { value: "Y" }],
      [
        { value: "X", label: "X" },
        { value: "Y", label: "Y" },
      ],
    ],
    [
      // Filters out empty string and null entries
      ["", "A", null, "B"] as unknown as (
        | string
        | number
        | boolean
        | { value: string; label?: string }
      )[],
      [
        { value: "A", label: "A" },
        { value: "B", label: "B" },
      ],
    ],
    [
      // Trims whitespace around values
      ["  foo  ", "bar "],
      [
        { value: "foo", label: "foo" },
        { value: "bar", label: "bar" },
      ],
    ],
    // Nullish options return an empty array
    [null as unknown as unknown[], []],
    [undefined as unknown as unknown[], []],
  ])("normalizes %j into %j", (input, expected) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- casting for test inputs only
    expect(prepareOptions(input as any)).toEqual(expected)
  })
})
