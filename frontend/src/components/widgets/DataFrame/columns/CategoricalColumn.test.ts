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
import CategoricalColumn, {
  CategoricalColumnParams,
} from "./CategoricalColumn"

const MOCK_CATEGORICAL_TYPE: ArrowType = {
  pandas_type: "int8",
  numpy_type: "categorical",
}

const MOCK_BOOLEAN_ARROW_TYPE: ArrowType = {
  pandas_type: "bool",
  numpy_type: "bool",
}

const CATEGORICAL_COLUMN_TEMPLATE: Partial<BaseColumnProps> = {
  id: "1",
  title: "Categorical column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isStretched: false,
}

function getCategoricalColumn(
  arrowType: ArrowType,
  params?: CategoricalColumnParams
): ReturnType<typeof CategoricalColumn> {
  return CategoricalColumn({
    ...CATEGORICAL_COLUMN_TEMPLATE,
    arrowType: arrowType,
    columnTypeMetadata: params,
  } as BaseColumnProps)
}

describe("CategoricalColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = getCategoricalColumn(MOCK_CATEGORICAL_TYPE, {
      options: ["foo", "bar"],
    })
    expect(mockColumn.kind).toEqual("categorical")
    expect(mockColumn.title).toEqual(CATEGORICAL_COLUMN_TEMPLATE.title)
    expect(mockColumn.id).toEqual(CATEGORICAL_COLUMN_TEMPLATE.id)
    expect(mockColumn.sortMode).toEqual("default")

    const mockCell = mockColumn.getCell("foo")
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect(mockColumn.getCellValue(mockCell)).toEqual("foo")
  })

  it("creates a valid column instance from boolean type", () => {
    const mockColumn = getCategoricalColumn(MOCK_BOOLEAN_ARROW_TYPE)
    expect(mockColumn.kind).toEqual("categorical")
    expect(mockColumn.title).toEqual(CATEGORICAL_COLUMN_TEMPLATE.title)

    const mockCell = mockColumn.getCell(true)
    expect(mockCell.kind).toEqual(GridCellKind.Custom)
    expect(mockColumn.getCellValue(mockCell)).toEqual("true")
  })

  it("creates error cell if value is not in options", () => {
    const mockColumn = getCategoricalColumn(MOCK_CATEGORICAL_TYPE, {
      options: ["foo", "bar"],
    })
    const mockCell = mockColumn.getCell("baz")
    expect(isErrorCell(mockCell)).toEqual(true)
  })

  it.each([[null], [undefined], [""]])(
    "%p is interpreted as missing value",
    (input: any) => {
      const mockColumn = getCategoricalColumn(MOCK_CATEGORICAL_TYPE, {
        options: ["foo", "bar"],
      })
      const mockCell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(mockCell)).toEqual(null)
      expect(isMissingValueCell(mockCell)).toEqual(true)
    }
  )
})
