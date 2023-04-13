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

import { GridCellKind } from "@glideapps/glide-data-grid"
import { RangeCellType } from "@glideapps/glide-data-grid-cells"

import { BaseColumnProps, isErrorCell } from "./utils"
import RangeColumn, { RangeColumnParams } from "./RangeColumn"

const RANGE_COLUMN_TEMPLATE = {
  id: "1",
  title: "Range column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isStretched: false,
  arrowType: {
    // The arrow type of the underlying data is
    // not used for anything inside the column.
    pandas_type: "float64",
    numpy_type: "float64",
  },
} as BaseColumnProps

function getRangeColumn(
  params?: RangeColumnParams
): ReturnType<typeof RangeColumn> {
  return RangeColumn({
    ...RANGE_COLUMN_TEMPLATE,
    columnTypeOptions: params,
  } as BaseColumnProps)
}

describe("RangeColumn", () => {
  // TODO(lukasmasuch): Implement test for step parameter
  // TODO(lukasmasuch): Implement test for format parameter

  it("creates a valid column instance", () => {
    const mockColumn = getRangeColumn()
    expect(mockColumn.kind).toEqual("range")
    expect(mockColumn.title).toEqual(RANGE_COLUMN_TEMPLATE.title)
    expect(mockColumn.id).toEqual(RANGE_COLUMN_TEMPLATE.id)
    expect(mockColumn.sortMode).toEqual("smart")

    // Column should be readonly:
    expect(mockColumn.isEditable).toEqual(false)

    const mockCell = mockColumn.getCell(0.5)
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect((mockCell as RangeCellType).data?.value).toEqual(0.5)
    expect((mockCell as RangeCellType).data?.label).toEqual("0.50")
  })

  it("supports configuring min/max scale", () => {
    const mockColumn = getRangeColumn()
    const mockCell = mockColumn.getCell(50)
    // Default min/max scale is 0/1 so the value should be at the maximum
    expect((mockCell as RangeCellType).data?.value).toEqual(1)

    // Use a different scale
    const mockColumn1 = getRangeColumn({
      min_value: -100,
      max_value: 100,
    })
    const mockCell1 = mockColumn1.getCell(50)
    // The value fits into the scale, so don't do anything:
    expect((mockCell1 as RangeCellType).data?.value).toEqual(50)

    // Use a different scale
    const mockColumn2 = getRangeColumn({
      min_value: 100,
      max_value: -100,
    })
    const mockCell2 = mockColumn2.getCell(50)
    // min needs to be bigger than max, so this should be an error cell:
    expect(isErrorCell(mockCell2)).toEqual(true)

    // Use a different scale
    const mockColumn3 = getRangeColumn({
      min_value: undefined,
      max_value: -100,
    })
    const mockCell3 = mockColumn3.getCell(50)
    // min and max need to be defined, so this should be an error cell:
    expect(isErrorCell(mockCell3)).toEqual(true)
  })

  it.each([
    // Supports almost the same as toSafeNumber
    [null, null],
    [undefined, null],
    ["", null],
    [[], null],
    ["0.1", 0.1],
    [0.1234, 0.1234],
  ])(
    "supports number-compatible value (%p parsed as %p)",
    (input: any, value: number | null) => {
      const mockColumn = getRangeColumn()
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it.each([
    ["foo"],
    [[]],
    ["foo"],
    [[1, 2]],
    ["123.124.123"],
    ["--123"],
    ["2,,2"],
  ])("%p results in error cell", (input: any) => {
    const mockColumn = getRangeColumn()
    const cell = mockColumn.getCell(input)
    expect(isErrorCell(cell)).toEqual(true)
  })
})
