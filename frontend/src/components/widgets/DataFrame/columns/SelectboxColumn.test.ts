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
import { DropdownCellType } from "@glideapps/glide-data-grid-cells"

import { Type as ArrowType } from "src/lib/Quiver"

import { BaseColumnProps, isErrorCell, isMissingValueCell } from "./utils"
import SelectboxColumn, { SelectboxColumnParams } from "./SelectboxColumn"

const MOCK_CATEGORICAL_TYPE: ArrowType = {
  pandas_type: "int8",
  numpy_type: "categorical",
}

const MOCK_BOOLEAN_ARROW_TYPE: ArrowType = {
  pandas_type: "bool",
  numpy_type: "bool",
}

const SELECTBOX_COLUMN_TEMPLATE: Partial<BaseColumnProps> = {
  id: "1",
  name: "selectbox_column",
  title: "Selectbox column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
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
      "",
      "foo",
      "bar",
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
      "",
      "1",
      "2",
      "3",
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
      "",
      "true",
      "false",
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
      "foo",
      "bar",
    ])

    const errorCell = mockColumn.getCell(null, true)
    expect(isErrorCell(errorCell)).toEqual(true)
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
    (input: any) => {
      const mockColumn = getSelectboxColumn(MOCK_CATEGORICAL_TYPE, {
        options: ["foo", "bar"],
      })
      const mockCell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(mockCell)).toEqual(null)
      expect(isMissingValueCell(mockCell)).toEqual(true)
    }
  )
})
