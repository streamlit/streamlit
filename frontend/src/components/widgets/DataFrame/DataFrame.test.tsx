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
import {
  DataEditor as GlideDataEditor,
  SizedGridColumn,
  NumberCell,
} from "@glideapps/glide-data-grid"
import { renderHook, act } from "@testing-library/react-hooks"

import { TEN_BY_TEN } from "src/lib/mocks/arrow"
import { mount } from "src/lib/test_util"
import { Quiver } from "src/lib/Quiver"
import { Arrow as ArrowProto } from "src/autogen/proto"

import { Resizable } from "re-resizable"
import DataFrame, {
  DataFrameProps,
  useDataLoader,
  getColumns,
} from "./DataFrame"
import { StyledResizableContainer } from "./styled-components"

const getProps = (
  data: Quiver,
  useContainerWidth = false
): DataFrameProps => ({
  element: ArrowProto.create({
    data: new Uint8Array(),
    useContainerWidth,
    width: 400,
    height: 400,
  }),
  data,
  width: 700,
})

const { ResizeObserver } = window

describe("DataFrame widget", () => {
  const props = getProps(new Quiver({ data: TEN_BY_TEN }))

  beforeEach(() => {
    // Mocking ResizeObserver to prevent:
    // TypeError: window.ResizeObserver is not a constructor
    // @ts-ignore
    delete window.ResizeObserver
    window.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }))
  })

  afterEach(() => {
    window.ResizeObserver = ResizeObserver
    jest.restoreAllMocks()
  })

  it("renders without crashing", () => {
    const wrapper = mount(<DataFrame {...props} />)
    expect(wrapper.find(GlideDataEditor).length).toBe(1)
  })

  it("should have correct className", () => {
    const wrapper = mount(<DataFrame {...props} />)
    expect(wrapper.find(StyledResizableContainer).prop("className")).toContain(
      "stDataFrame"
    )
  })

  it("grid container should use full width when useContainerWidth is used", () => {
    const wrapper = mount(
      <DataFrame {...getProps(new Quiver({ data: TEN_BY_TEN }), true)} />
    )
    const dataFrameContainer = wrapper.find(Resizable).props() as any
    expect(dataFrameContainer.size.width).toBe(700)
    expect(dataFrameContainer.size.height).toBe(400)
  })

  it("grid container should render with specific size", () => {
    const wrapper = mount(<DataFrame {...props} />)
    const dataFrameContainer = wrapper.find(Resizable).props() as any
    expect(dataFrameContainer.size.width).toBe(400)
    expect(dataFrameContainer.size.height).toBe(400)
  })

  it("Test column resizing function.", () => {
    const { result } = renderHook(() =>
      useDataLoader(props.element, props.data)
    )

    // Resize first column to size of 123:
    act(() => {
      const { columns, onColumnResize } = result.current
      onColumnResize?.(columns[0], 123, 0)
    })
    expect((result.current.columns[0] as SizedGridColumn).width).toBe(123)

    // Resize first column to size of 321:
    act(() => {
      const { columns, onColumnResize } = result.current
      onColumnResize?.(columns[0], 321, 0)
    })
    expect((result.current.columns[0] as SizedGridColumn).width).toBe(321)

    // First column should stay at previous value if other column is resized
    act(() => {
      const { columns, onColumnResize } = result.current
      onColumnResize?.(columns[1], 88, 1)
    })
    expect((result.current.columns[0] as SizedGridColumn).width).toBe(321)
  })

  it("should correctly sort the table descending order", () => {
    const tableColumns = getColumns(props.element, props.data)

    // Add descending sort for first column
    const { result } = renderHook(() =>
      useDataLoader(props.element, props.data, {
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
      Array.from(sortedData).sort().reverse()
    )
  })

  it("should correctly sort the table ascending order", () => {
    const tableColumns = getColumns(props.element, props.data)

    // Add ascending sort for first column
    const { result } = renderHook(() =>
      useDataLoader(props.element, props.data, {
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
