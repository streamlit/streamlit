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

import { GridCell, NumberCell } from "@glideapps/glide-data-grid"
import { act, renderHook } from "@testing-library/react"
import { Field, Int64, Utf8 } from "apache-arrow"

import {
  BaseColumn,
  NumberColumn,
  TextColumn,
} from "~lib/components/widgets/DataFrame/columns"
import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"

import useColumnSort from "./useColumnSort"

const MOCK_COLUMNS: BaseColumn[] = [
  NumberColumn({
    id: "column_1",
    name: "column_1",
    title: "column_1",
    indexNumber: 0,
    arrowType: {
      type: DataFrameCellType.DATA,
      arrowField: new Field("column_1", new Int64(), true),
      pandasType: {
        field_name: "column_1",
        name: "column_1",
        pandas_type: "int64",
        numpy_type: "int64",
        metadata: null,
      },
    },
    isEditable: false,
    isHidden: false,
    isIndex: false,
    isPinned: false,
    isStretched: false,
  }),
  TextColumn({
    id: "column_2",
    name: "column_2",
    title: "column_2",
    indexNumber: 1,
    arrowType: {
      type: DataFrameCellType.DATA,
      arrowField: new Field("column_c2_1", new Utf8(), true),
      pandasType: {
        field_name: "column_c2_1",
        name: "column_c2_1",
        pandas_type: "unicode",
        numpy_type: "object",
        metadata: null,
      },
    },
    isEditable: false,
    isHidden: false,
    isIndex: false,
    isPinned: false,
    isStretched: false,
  }),
]

const MOCK_PROPS = {
  numRows: 3,
  columns: MOCK_COLUMNS,
  getCellContent: ([col, row]: readonly [number, number]): GridCell => {
    if (row === 0) {
      return MOCK_COLUMNS[col].getCell(90)
    }
    if (row === 1) {
      return MOCK_COLUMNS[col].getCell(100)
    }
    if (row === 2) {
      return MOCK_COLUMNS[col].getCell(5)
    }
    return MOCK_COLUMNS[col].getCell(0)
  },
}

describe("useColumnSort hook", () => {
  it("should correctly sort numbers ascending and descending order", () => {
    const { result } = renderHook(() =>
      useColumnSort(
        MOCK_PROPS.numRows,
        MOCK_PROPS.columns,
        MOCK_PROPS.getCellContent
      )
    )
    // Select number column
    const SELECTED_COLUMN = 0

    // Sort the first time for ascending order
    act(() => {
      const { sortColumn } = result.current
      sortColumn?.(MOCK_COLUMNS[SELECTED_COLUMN].indexNumber, "auto")
    })

    // Column header should contain ascending sort icon
    expect(result.current.columns[SELECTED_COLUMN].title).toContain("↑")

    const sortedDataAsc = []

    for (let i = 0; i < MOCK_PROPS.numRows; i++) {
      sortedDataAsc.push(
        (result.current.getCellContent([SELECTED_COLUMN, i]) as NumberCell)
          .data
      )
    }

    const sortOperator = (
      a: number | undefined,
      b: number | undefined
    ): number => {
      if (a === undefined) {
        return -1
      }

      if (b === undefined) {
        return 1
      }

      return a - b
    }

    expect(Array.from(sortedDataAsc)).toEqual(
      // Sort as number array
      Array.from(sortedDataAsc).sort(sortOperator)
    )

    // Sort again for descending order
    act(() => {
      const { sortColumn } = result.current
      sortColumn?.(MOCK_COLUMNS[SELECTED_COLUMN].indexNumber, "auto")
    })

    // Column header should contain descending sort icon
    expect(result.current.columns[SELECTED_COLUMN].title).toContain("↓")

    const sortedDataDesc = []

    for (let i = 0; i < MOCK_PROPS.numRows; i++) {
      sortedDataDesc.push(
        (result.current.getCellContent([SELECTED_COLUMN, i]) as NumberCell)
          .data
      )
    }

    expect(Array.from(sortedDataDesc)).toEqual(
      // Sort as number array
      Array.from(sortedDataDesc).sort(sortOperator).reverse()
    )
  })

  it("should correctly sort text ascending and descending order", () => {
    const { result } = renderHook(() =>
      useColumnSort(
        MOCK_PROPS.numRows,
        MOCK_PROPS.columns,
        MOCK_PROPS.getCellContent
      )
    )
    // Select number column
    const SELECTED_COLUMN = 1

    // Sort the first time for ascending order
    act(() => {
      const { sortColumn } = result.current
      sortColumn?.(MOCK_COLUMNS[SELECTED_COLUMN].indexNumber, "auto")
    })

    // Column header should contain ascending sort icon
    expect(result.current.columns[SELECTED_COLUMN].title).toContain("↑")

    const sortedDataAsc = []

    for (let i = 0; i < MOCK_PROPS.numRows; i++) {
      sortedDataAsc.push(
        (result.current.getCellContent([SELECTED_COLUMN, i]) as NumberCell)
          .data
      )
    }

    expect(Array.from(sortedDataAsc)).toEqual(
      // Sort as text array
      Array.from(sortedDataAsc).sort()
    )

    // Sort again for descending order
    act(() => {
      const { sortColumn } = result.current
      sortColumn?.(MOCK_COLUMNS[SELECTED_COLUMN].indexNumber, "auto")
    })

    // Column header should contain descending sort icon
    expect(result.current.columns[SELECTED_COLUMN].title).toContain("↓")

    const sortedDataDesc = []

    for (let i = 0; i < MOCK_PROPS.numRows; i++) {
      sortedDataDesc.push(
        (result.current.getCellContent([SELECTED_COLUMN, i]) as NumberCell)
          .data
      )
    }

    expect(Array.from(sortedDataDesc)).toEqual(
      /// Sort as text array
      Array.from(sortedDataDesc).sort().reverse()
    )
  })

  it("should sort in descending order when direction is set to desc", () => {
    const { result } = renderHook(() =>
      useColumnSort(
        MOCK_PROPS.numRows,
        MOCK_PROPS.columns,
        MOCK_PROPS.getCellContent
      )
    )
    const SELECTED_COLUMN = 0

    // Sort explicitly descending
    act(() => {
      const { sortColumn } = result.current
      sortColumn?.(MOCK_COLUMNS[SELECTED_COLUMN].indexNumber, "desc")
    })

    // Column header should contain descending sort icon
    expect(result.current.columns[SELECTED_COLUMN].title).toContain("↓")

    const sortedDataDesc = []
    for (let i = 0; i < MOCK_PROPS.numRows; i++) {
      sortedDataDesc.push(
        (result.current.getCellContent([SELECTED_COLUMN, i]) as NumberCell)
          .data
      )
    }

    // Verify data is sorted in descending order
    expect(Array.from(sortedDataDesc)).toEqual(
      Array.from(sortedDataDesc)
        .sort((a, b) => {
          if (a === undefined) return -1
          if (b === undefined) return 1
          return a - b
        })
        .reverse()
    )
  })

  it("should sort in ascending order when direction is set to asc", () => {
    const { result } = renderHook(() =>
      useColumnSort(
        MOCK_PROPS.numRows,
        MOCK_PROPS.columns,
        MOCK_PROPS.getCellContent
      )
    )
    const SELECTED_COLUMN = 0

    // Change to ascending explicitly
    act(() => {
      const { sortColumn } = result.current
      sortColumn?.(MOCK_COLUMNS[SELECTED_COLUMN].indexNumber, "asc")
    })

    // Column header should contain ascending sort icon
    expect(result.current.columns[SELECTED_COLUMN].title).toContain("↑")

    const sortedDataAsc = []
    for (let i = 0; i < MOCK_PROPS.numRows; i++) {
      sortedDataAsc.push(
        (result.current.getCellContent([SELECTED_COLUMN, i]) as NumberCell)
          .data
      )
    }

    // Verify data is sorted in ascending order
    expect(Array.from(sortedDataAsc)).toEqual(
      Array.from(sortedDataAsc).sort((a, b) => {
        if (a === undefined) return -1
        if (b === undefined) return 1
        return a - b
      })
    )
  })

  it("should respect autoReset parameter when sorting", () => {
    const { result } = renderHook(() =>
      useColumnSort(
        MOCK_PROPS.numRows,
        MOCK_PROPS.columns,
        MOCK_PROPS.getCellContent
      )
    )
    const SELECTED_COLUMN = 0

    // Sort ascending
    act(() => {
      const { sortColumn } = result.current
      sortColumn?.(MOCK_COLUMNS[SELECTED_COLUMN].indexNumber, "asc")
    })

    // Column header should contain ascending sort icon
    expect(result.current.columns[SELECTED_COLUMN].title).toContain("↑")

    // Sort ascending again with autoReset true - should remove sorting
    act(() => {
      const { sortColumn } = result.current
      sortColumn?.(MOCK_COLUMNS[SELECTED_COLUMN].indexNumber, "asc", true)
    })

    // Column header should not contain any sort icon
    expect(result.current.columns[SELECTED_COLUMN].title).not.toContain("↑")
    expect(result.current.columns[SELECTED_COLUMN].title).not.toContain("↓")
  })
})
