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

import React from "react"

import { renderHook } from "@testing-library/react-hooks"
import { GridCellKind } from "@glideapps/glide-data-grid"

import { Quiver } from "src/lib/Quiver"
import { Arrow as ArrowProto } from "src/autogen/proto"
import { UNICODE } from "src/lib/mocks/arrow"
import {
  BaseColumn,
  ObjectColumn,
  TextColumn,
  BooleanColumn,
  CategoricalColumn,
  ListColumn,
  NumberColumn,
  ColumnCreator,
  isErrorCell,
} from "src/components/widgets/DataFrame/columns"
import EditingState from "src/components/widgets/DataFrame/EditingState"

import useDataLoader, {
  ColumnConfigProps,
  applyColumnConfig,
  getColumnConfig,
  getColumnType,
  INDEX_IDENTIFIER,
  COLUMN_POSITION_PREFIX,
} from "./useDataLoader"

const MOCK_COLUMNS: BaseColumn[] = [
  NumberColumn({
    id: "index_col",
    title: "",
    indexNumber: 0,
    arrowType: {
      pandas_type: "int64",
      numpy_type: "int64",
    },
    isEditable: false,
    isHidden: false,
    isIndex: true,
    isStretched: false,
  }),
  NumberColumn({
    id: "column_1",
    title: "column_1",
    indexNumber: 1,
    arrowType: {
      pandas_type: "int64",
      numpy_type: "int64",
    },
    isEditable: false,
    isHidden: false,
    isIndex: false,
    isStretched: false,
  }),
  TextColumn({
    id: "column_2",
    title: "column_2",
    indexNumber: 2,
    arrowType: {
      pandas_type: "unicode",
      numpy_type: "object",
    },
    isEditable: false,
    isHidden: false,
    isIndex: false,
    isStretched: false,
  }),
]

describe("useDataLoader hook", () => {
  it("creates columns from the Arrow data", () => {
    const element = ArrowProto.create({
      data: UNICODE,
    })
    const data = new Quiver(element)
    const numRows = data.dimensions.rows

    const { result } = renderHook(() => {
      const editingState = React.useRef<EditingState>(
        new EditingState(numRows)
      )
      return useDataLoader(element, data, numRows, false, editingState)
    })

    expect(result.current.columns.length).toBe(3)

    expect(result.current.columns[0].title).toBe("")
    expect(result.current.columns[0].isIndex).toBe(true)

    expect(result.current.columns[1].title).toBe("c1")
    expect(result.current.columns[1].isIndex).toBe(false)

    expect(result.current.columns[2].title).toBe("c2")
    expect(result.current.columns[2].isIndex).toBe(false)
  })

  it("creates a glide-data-grid compatible callback to access cells", () => {
    const element = ArrowProto.create({
      data: UNICODE,
    })
    const data = new Quiver(element)
    const numRows = data.dimensions.rows

    const { result } = renderHook(() => {
      const editingState = React.useRef<EditingState>(
        new EditingState(numRows)
      )
      return useDataLoader(element, data, numRows, false, editingState)
    })

    const { columns } = result.current
    expect(columns.length).toBe(3)

    // Row 1
    expect(
      columns[0].getCellValue(result.current.getCellContent([0, 0]))
    ).toBe("i1")
    expect(
      columns[1].getCellValue(result.current.getCellContent([1, 0]))
    ).toBe("foo")
    expect(
      columns[2].getCellValue(result.current.getCellContent([2, 0]))
    ).toBe("1")

    // Row 2
    expect(
      columns[0].getCellValue(result.current.getCellContent([0, 1]))
    ).toBe("i2")
    expect(
      columns[1].getCellValue(result.current.getCellContent([1, 1]))
    ).toBe("bar")
    expect(
      columns[2].getCellValue(result.current.getCellContent([2, 1]))
    ).toBe("2")

    // if row out of bounds. return error cell
    expect(isErrorCell(result.current.getCellContent([0, 2]))).toBe(true)

    // if column out of bounds. return error cell
    expect(isErrorCell(result.current.getCellContent([3, 0]))).toBe(true)
  })

  it("uses editing state if a cell got edited", () => {
    const element = ArrowProto.create({
      data: UNICODE,
      editingMode: ArrowProto.EditingMode.FIXED,
    })

    const data = new Quiver(element)
    const numRows = data.dimensions.rows

    const { result } = renderHook(() => {
      const editingState = React.useRef<EditingState>(
        new EditingState(numRows)
      )
      editingState.current.setCell(1, 0, {
        kind: GridCellKind.Text,
        displayData: "edited",
        data: "edited",
        allowOverlay: true,
      })
      return useDataLoader(element, data, numRows, false, editingState)
    })

    // Check if value got edited
    expect(
      result.current.columns[1].getCellValue(
        result.current.getCellContent([1, 0])
      )
    ).toEqual("edited")
  })

  it("uses editing state if a row got deleted", () => {
    const element = ArrowProto.create({
      data: UNICODE,
      editingMode: ArrowProto.EditingMode.DYNAMIC,
    })

    const data = new Quiver(element)
    const numRows = data.dimensions.rows

    const { result } = renderHook(() => {
      const editingState = React.useRef<EditingState>(
        new EditingState(numRows)
      )
      editingState.current.deleteRow(0)
      return useDataLoader(element, data, numRows, false, editingState)
    })

    // Should return value of second row
    expect(
      result.current.columns[1].getCellValue(
        result.current.getCellContent([1, 0])
      )
    ).toEqual("bar")
  })
})
