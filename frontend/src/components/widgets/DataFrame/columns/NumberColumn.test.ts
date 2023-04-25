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

import { GridCellKind, NumberCell, TextCell } from "@glideapps/glide-data-grid"

import { DataType, Type as ArrowType } from "src/lib/Quiver"

import { BaseColumnProps, isErrorCell } from "./utils"
import NumberColumn, { NumberColumnParams } from "./NumberColumn"

const MOCK_FLOAT_ARROW_TYPE: ArrowType = {
  pandas_type: "float64",
  numpy_type: "float64",
}

const MOCK_INT_ARROW_TYPE: ArrowType = {
  pandas_type: "int64",
  numpy_type: "int64",
}

const MOCK_UINT_ARROW_TYPE: ArrowType = {
  pandas_type: "uint64",
  numpy_type: "uint64",
}

const NUMBER_COLUMN_TEMPLATE: Partial<BaseColumnProps> = {
  id: "1",
  name: "number_column",
  title: "Number column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isStretched: false,
}

function getNumberColumn(
  arrowType: ArrowType,
  params?: NumberColumnParams
): ReturnType<typeof NumberColumn> {
  return NumberColumn({
    ...NUMBER_COLUMN_TEMPLATE,
    arrowType,
    columnTypeOptions: params,
  } as BaseColumnProps)
}

describe("NumberColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE)
    expect(mockColumn.kind).toEqual("number")
    expect(mockColumn.title).toEqual(NUMBER_COLUMN_TEMPLATE.title)
    expect(mockColumn.id).toEqual(NUMBER_COLUMN_TEMPLATE.id)
    expect(mockColumn.isEditable).toEqual(NUMBER_COLUMN_TEMPLATE.isEditable)
    expect(mockColumn.sortMode).toEqual("smart")

    const mockCell = mockColumn.getCell("1.234")
    expect(mockCell.kind).toEqual(GridCellKind.Number)
    expect((mockCell as NumberCell).displayData).toEqual("1.234")
    expect((mockCell as NumberCell).data).toEqual(1.234)
  })

  it("alignes numbers to the right", () => {
    const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE)
    const mockCell = mockColumn.getCell("1.123")
    expect(mockCell.contentAlign).toEqual("right")
  })

  it.each([
    [true, 1],
    [false, 0],
    ["4.12", 4.12],
    ["-4.12", -4.12],
    ["4", 4],
    [1.3122, 1.3122],
    [-1.3122, -1.3122],
    ["1,212.12", 1212.12],
    [".1312314", 0.1312314],
    [null, null],
    [undefined, null],
    ["", null],
  ])(
    "supports float64 value (%p parsed as %p)",
    (input: DataType | null | undefined, value: number | null) => {
      const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it.each([
    [100, 100],
    [-100, -100],
    ["4", 4],
    ["4.12", 4],
    ["4.61", 4],
    ["-4.12", -4],
    [1.3122, 1],
    [-1.3122, -1],
    ["1,212", 1212],
    ["1,212,123,312", 1212123312],
    [null, null],
  ])(
    "supports integer value (%p parsed as %p)",
    (input: DataType | null, value: number | null) => {
      const mockColumn = getNumberColumn(MOCK_INT_ARROW_TYPE)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it.each([
    [100, 100],
    [-100, 0],
    ["4", 4],
    ["4.12", 4],
    ["4.61", 4],
    ["-4.12", 0],
    [1.3122, 1],
    [-1.3122, 0],
    ["1,212", 1212],
    ["1,212,123,312", 1212123312],
    [null, null],
  ])(
    "supports unsigned integer value (%p parsed as %p)",
    (input: DataType | null, value: number | null) => {
      const mockColumn = getNumberColumn(MOCK_UINT_ARROW_TYPE)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it.each([
    [0, 1.234567, 1],
    [1, 1.234567, 1.2],
    [2, 1.234567, 1.23],
    [3, 1.234567, 1.234],
    [4, 1.234567, 1.2345],
    [3, 1.1, 1.1],
    [100, 1, 1],
  ])(
    "converts value to precision %p (%p parsed to %p)",
    (precision: number, input: DataType, value: number | null) => {
      const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE, {
        precision,
      })
      const mockCell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(mockCell)).toEqual(value)
    }
  )

  it.each([
    [10, 10, 10],
    [10, 100, 100],
    [10, 5, 10],
    [10, -5, 10],
  ])(
    "supports minimal value %p (%p parsed to %p)",
    (min: number, input: DataType, value: number | null) => {
      const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE, {
        min,
      })
      const mockCell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(mockCell)).toEqual(value)
    }
  )

  it.each([
    [10, 10, 10],
    [10, 100, 10],
    [10, 5, 5],
    [10, -5, -5],
  ])(
    "supports maximal value %p (%p parsed to %p)",
    (max: number, input: DataType, value: number | null) => {
      const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE, {
        max,
      })
      const mockCell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(mockCell)).toEqual(value)
    }
  )

  it.each([
    [[]],
    ["foo"],
    [[1, 2]],
    ["123.124.123"],
    ["--123"],
    ["2,,2"],
    ["12345678987654321"],
  ])("%p results in error cell", (input: any) => {
    const mockColumn = getNumberColumn(MOCK_FLOAT_ARROW_TYPE)
    const cell = mockColumn.getCell(input)
    expect(isErrorCell(cell)).toEqual(true)
  })

  it("shows an error cell if the numeric value is too large", () => {
    const mockColumn = getNumberColumn(MOCK_INT_ARROW_TYPE)
    const unsafeCell = mockColumn.getCell("1234567898765432123")
    expect(isErrorCell(unsafeCell)).toEqual(true)
    expect((unsafeCell as TextCell)?.data).toEqual(
      "⚠️ 1234567898765432123\n\nThe value is larger than the maximum supported integer values in number columns (2^53).\n"
    )
  })

  it("doesn't show an error for large integers with a size up to 2^53", () => {
    const mockColumn = getNumberColumn(MOCK_INT_ARROW_TYPE)

    const safeCell = mockColumn.getCell("1234567898765432")
    expect(isErrorCell(safeCell)).toEqual(false)
  })
})
