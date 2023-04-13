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

import { Type as ArrowType } from "src/lib/Quiver"

import { BaseColumnProps, isErrorCell, isMissingValueCell } from "./utils"
import SelectColumn, { SelectColumnParams } from "./SelectColumn"

const MOCK_CATEGORICAL_TYPE: ArrowType = {
  pandas_type: "int8",
  numpy_type: "categorical",
}

const MOCK_BOOLEAN_ARROW_TYPE: ArrowType = {
  pandas_type: "bool",
  numpy_type: "bool",
}

const SELECT_COLUMN_TEMPLATE: Partial<BaseColumnProps> = {
  id: "1",
  title: "Select column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isStretched: false,
}

function getSelectColumn(
  arrowType: ArrowType,
  params?: SelectColumnParams
): ReturnType<typeof SelectColumn> {
  return SelectColumn({
    ...SELECT_COLUMN_TEMPLATE,
    arrowType,
    columnTypeOptions: params,
  } as BaseColumnProps)
}

describe("SelectColumn", () => {
  it("creates a valid column instance with string values", () => {
    const mockColumn = getSelectColumn(MOCK_CATEGORICAL_TYPE, {
      options: ["foo", "bar"],
    })
    expect(mockColumn.kind).toEqual("select")
    expect(mockColumn.title).toEqual(SELECT_COLUMN_TEMPLATE.title)
    expect(mockColumn.id).toEqual(SELECT_COLUMN_TEMPLATE.id)
    expect(mockColumn.sortMode).toEqual("default")

    const mockCell = mockColumn.getCell("foo")
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect(mockColumn.getCellValue(mockCell)).toEqual("foo")
  })

  it("creates a valid column instance number values", () => {
    const mockColumn = getSelectColumn(MOCK_CATEGORICAL_TYPE, {
      options: [1, 2, 3],
    })
    expect(mockColumn.kind).toEqual("select")
    expect(mockColumn.title).toEqual(SELECT_COLUMN_TEMPLATE.title)
    expect(mockColumn.id).toEqual(SELECT_COLUMN_TEMPLATE.id)
    expect(mockColumn.sortMode).toEqual("default")

    const mockCell = mockColumn.getCell(1)
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect(mockColumn.getCellValue(mockCell)).toEqual(1)
  })

  it("creates a valid column instance from boolean type", () => {
    const mockColumn = getSelectColumn(MOCK_BOOLEAN_ARROW_TYPE)
    expect(mockColumn.kind).toEqual("select")
    expect(mockColumn.title).toEqual(SELECT_COLUMN_TEMPLATE.title)

    const mockCell = mockColumn.getCell(true)
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect(mockColumn.getCellValue(mockCell)).toEqual(true)
  })

  it("creates error cell if value is not in options", () => {
    const mockColumn = getSelectColumn(MOCK_CATEGORICAL_TYPE, {
      options: ["foo", "bar"],
    })
    const mockCell = mockColumn.getCell("baz")
    expect(isErrorCell(mockCell)).toEqual(true)
  })

  it.each([[null], [undefined], [""]])(
    "%p is interpreted as missing value",
    (input: any) => {
      const mockColumn = getSelectColumn(MOCK_CATEGORICAL_TYPE, {
        options: ["foo", "bar"],
      })
      const mockCell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(mockCell)).toEqual(null)
      expect(isMissingValueCell(mockCell)).toEqual(true)
    }
  )
})
