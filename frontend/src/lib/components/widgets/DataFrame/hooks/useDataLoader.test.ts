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

import { Quiver } from "src/lib/dataframes/Quiver"
import { Arrow as ArrowProto } from "src/lib/proto"
import { UNICODE } from "src/lib/mocks/arrow"
import {
  BaseColumn,
  TextColumn,
  isErrorCell,
} from "src/lib/components/widgets/DataFrame/columns"
import EditingState from "src/lib/components/widgets/DataFrame/EditingState"

import useDataLoader from "./useDataLoader"

// These columns are based on the UNICODE mock arrow table:
const MOCK_COLUMNS: BaseColumn[] = [
  TextColumn({
    arrowType: { meta: null, numpy_type: "object", pandas_type: "unicode" },
    id: "index-0",
    indexNumber: 0,
    isEditable: true,
    isHidden: false,
    isIndex: true,
    isStretched: false,
    title: "",
  }),
  TextColumn({
    arrowType: { meta: null, numpy_type: "object", pandas_type: "unicode" },
    id: "column-c1-0",
    indexNumber: 1,
    isEditable: true,
    isHidden: false,
    isIndex: false,
    isStretched: false,
    title: "c1",
  }),
  TextColumn({
    arrowType: { meta: null, numpy_type: "object", pandas_type: "unicode" },
    columnTypeMetadata: undefined,
    id: "column-c2-1",
    indexNumber: 2,
    isEditable: true,
    isHidden: false,
    isIndex: false,
    isStretched: false,
    title: "c2",
  }),
]

describe("useDataLoader hook", () => {
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
      return useDataLoader(data, MOCK_COLUMNS, numRows, editingState)
    })

    // Row 1
    expect(
      MOCK_COLUMNS[0].getCellValue(result.current.getCellContent([0, 0]))
    ).toBe("i1")
    expect(
      MOCK_COLUMNS[1].getCellValue(result.current.getCellContent([1, 0]))
    ).toBe("foo")
    expect(
      MOCK_COLUMNS[2].getCellValue(result.current.getCellContent([2, 0]))
    ).toBe("1")

    // Row 2
    expect(
      MOCK_COLUMNS[0].getCellValue(result.current.getCellContent([0, 1]))
    ).toBe("i2")
    expect(
      MOCK_COLUMNS[1].getCellValue(result.current.getCellContent([1, 1]))
    ).toBe("bar")
    expect(
      MOCK_COLUMNS[2].getCellValue(result.current.getCellContent([2, 1]))
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
      return useDataLoader(data, MOCK_COLUMNS, numRows, editingState)
    })

    // Check if value got edited
    expect(
      MOCK_COLUMNS[1].getCellValue(result.current.getCellContent([1, 0]))
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
      return useDataLoader(data, MOCK_COLUMNS, numRows, editingState)
    })

    // Should return value of second row
    expect(
      MOCK_COLUMNS[1].getCellValue(result.current.getCellContent([1, 0]))
    ).toEqual("bar")
  })
})
