/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"
import {
  DataEditor as GlideDataEditor,
  SizedGridColumn,
  NumberCell,
} from "@glideapps/glide-data-grid"
import { renderHook, act } from "@testing-library/react-hooks"

import { TEN_BY_TEN } from "src/lib/mocks/arrow"
import { mount } from "src/lib/test_util"
import { Quiver } from "src/lib/Quiver"

import DataFrame, {
  DataFrameProps,
  useDataLoader,
  getColumns,
} from "./DataFrame"
import { ResizableContainer } from "./DataFrameContainer"

const getProps = (data: Quiver): DataFrameProps => ({
  element: data,
  width: 400,
  height: 400,
})

describe("DataFrame widget", () => {
  const props = getProps(new Quiver({ data: TEN_BY_TEN }))
  const wrapper = mount(<DataFrame {...props} />)

  it("renders without crashing", () => {
    expect(wrapper.find(GlideDataEditor).length).toBe(1)
  })

  it("should have correct className", () => {
    expect(wrapper.find(ResizableContainer).prop("className")).toContain(
      "stDataFrame"
    )
  })

  it("grid container should render with specific size", () => {
    const dataFrameContainer = wrapper.find(ResizableContainer).props() as any
    expect(dataFrameContainer.width).toBe(400)
    expect(dataFrameContainer.height).toBe(400)
  })

  it("Test column resizing function.", () => {
    const { result } = renderHook(() =>
      useDataLoader(new Quiver({ data: TEN_BY_TEN }))
    )

    // Resize first column to size of 123:
    act(() => {
      const { columns, onColumnResize } = result.current
      onColumnResize?.(columns[0], 123)
    })
    expect((result.current.columns[0] as SizedGridColumn).width).toBe(123)

    // Resize first column to size of 321:
    act(() => {
      const { columns, onColumnResize } = result.current
      onColumnResize?.(columns[0], 321)
    })
    expect((result.current.columns[0] as SizedGridColumn).width).toBe(321)

    // First column should stay at previous value if other column is resized
    act(() => {
      const { columns, onColumnResize } = result.current
      onColumnResize?.(columns[1], 88)
    })
    expect((result.current.columns[0] as SizedGridColumn).width).toBe(321)
  })

  it("should correctly sort the table descending order", () => {
    const tableColumns = getColumns(new Quiver({ data: TEN_BY_TEN }))

    // Add descending sort for first column
    const { result } = renderHook(() =>
      useDataLoader(new Quiver({ data: TEN_BY_TEN }), {
        column: tableColumns[0],
        mode: "smart",
        direction: "desc",
      })
    )

    const sortedData = []

    for (let i = 0; i < result.current.numRows; i++) {
      sortedData.push(
        (result.current.getCellContent([0, i]) as NumberCell).data
      )
    }

    expect(Array.from(sortedData)).toEqual(
      Array.from(sortedData)
        .sort()
        .reverse()
    )
  })

  it("should correctly sort the table ascending order", () => {
    const tableColumns = getColumns(new Quiver({ data: TEN_BY_TEN }))

    // Add ascending sort for first column
    const { result } = renderHook(() =>
      useDataLoader(new Quiver({ data: TEN_BY_TEN }), {
        column: tableColumns[0],
        mode: "smart",
        direction: "asc",
      })
    )

    const sortedData = []

    for (let i = 0; i < result.current.numRows; i++) {
      sortedData.push(
        (result.current.getCellContent([0, i]) as NumberCell).data
      )
    }

    expect(Array.from(sortedData)).toEqual(Array.from(sortedData).sort())
  })
})
