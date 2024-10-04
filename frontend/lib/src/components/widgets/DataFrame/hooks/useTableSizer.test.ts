/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { act, renderHook } from "@testing-library/react-hooks"

import { TEN_BY_TEN, UNICODE, VERY_TALL } from "@streamlit/lib/src/mocks/arrow"
import { Arrow as ArrowProto } from "@streamlit/lib/src/proto"

import useTableSizer, {
  calculateMaxHeight,
  MIN_TABLE_WIDTH,
} from "./useTableSizer"

describe("useTableSizer hook", () => {
  it("applies the configured width", () => {
    // The width of the surrounding containers
    const CONTAINER_WIDTH = 700
    const TABLE_WIDTH = 350
    const { result } = renderHook(() =>
      useTableSizer(
        ArrowProto.create({
          data: TEN_BY_TEN,
          useContainerWidth: false,
          width: TABLE_WIDTH,
        }),
        10,
        false,
        CONTAINER_WIDTH
      )
    )

    expect(result.current.resizableSize.width).toEqual(TABLE_WIDTH)
    expect(result.current.maxWidth).toEqual(CONTAINER_WIDTH)
  })

  it("Uses the minimum table width if container width is -1", () => {
    // The width of the surrounding containers can be -1 in some edge cases
    // caused by the resize observer in the Block component.
    // We test that the dataframe component correctly handles this case
    // by falling back to the minimum table width instead.
    // Related to: https://github.com/streamlit/streamlit/issues/7949
    const CONTAINER_WIDTH = -1
    const { result } = renderHook(() =>
      useTableSizer(
        ArrowProto.create({
          data: TEN_BY_TEN,
          useContainerWidth: true,
        }),
        10,
        false,
        CONTAINER_WIDTH
      )
    )

    expect(result.current.resizableSize.width).toEqual(MIN_TABLE_WIDTH)
    expect(result.current.maxWidth).toEqual(MIN_TABLE_WIDTH)
    expect(result.current.minWidth).toEqual(MIN_TABLE_WIDTH)
  })

  it("adapts to the surrounding container width", () => {
    // The width of the surrounding containers
    const CONTAINER_WIDTH = 200
    const TABLE_WIDTH = 350
    const { result } = renderHook(() =>
      useTableSizer(
        ArrowProto.create({
          data: TEN_BY_TEN,
          useContainerWidth: false,
          width: TABLE_WIDTH,
        }),
        10,
        false,
        CONTAINER_WIDTH
      )
    )

    expect(result.current.resizableSize.width).toEqual(CONTAINER_WIDTH)
    expect(result.current.maxWidth).toEqual(CONTAINER_WIDTH)
  })

  it("applies the configured height", () => {
    const NUMBER_OF_ROWS = 10
    const TABLE_HEIGHT = 100
    const { result } = renderHook(() =>
      useTableSizer(
        ArrowProto.create({
          data: TEN_BY_TEN,
          useContainerWidth: false,
          height: TABLE_HEIGHT,
        }),
        NUMBER_OF_ROWS,
        false,
        700
      )
    )

    expect(result.current.resizableSize.height).toEqual(TABLE_HEIGHT)
    // +1 rows for header row
    expect(result.current.maxHeight).toEqual(
      calculateMaxHeight(NUMBER_OF_ROWS + 1)
    )
  })

  it("correctly includes group row in height calculation", () => {
    const NUMBER_OF_ROWS = 10
    const TABLE_HEIGHT = 100
    const { result } = renderHook(() =>
      useTableSizer(
        ArrowProto.create({
          data: TEN_BY_TEN,
          useContainerWidth: false,
          height: TABLE_HEIGHT,
        }),
        NUMBER_OF_ROWS,
        true,
        700
      )
    )

    expect(result.current.resizableSize.height).toEqual(TABLE_HEIGHT)
    // +1 rows for header row + 1 for group row
    expect(result.current.maxHeight).toEqual(
      calculateMaxHeight(NUMBER_OF_ROWS + 2)
    )
  })

  it("applies useContainerWidth configuration", () => {
    // The width of the surrounding containers
    const CONTAINER_WIDTH = 700
    const TABLE_WIDTH = 350
    const { result } = renderHook(() =>
      useTableSizer(
        ArrowProto.create({
          data: TEN_BY_TEN,
          useContainerWidth: true,
          width: TABLE_WIDTH,
        }),
        10,
        false,
        CONTAINER_WIDTH
      )
    )

    expect(result.current.resizableSize.width).toEqual(CONTAINER_WIDTH)
    expect(result.current.maxWidth).toEqual(CONTAINER_WIDTH)
  })

  it("calculates correct container dimensions for a table", () => {
    // The width of the surrounding containers
    const CONTAINER_WIDTH = 700
    const { result } = renderHook(() =>
      useTableSizer(
        ArrowProto.create({
          data: UNICODE,
          useContainerWidth: false,
        }),
        2, // Unicode table has 2 rows
        false,
        CONTAINER_WIDTH
      )
    )

    // This is expected to be 100% to adapt to whatever width the glide data grid calculates
    expect(result.current.resizableSize.width).toEqual("100%")
    expect(result.current.maxWidth).toEqual(CONTAINER_WIDTH)
  })

  it("calculates correct container dimensions for fullscreen mode", () => {
    // The width of the surrounding containers
    const CONTAINER_WIDTH = 1920
    const CONTAINER_HEIGHT = 1080

    const TABLE_WIDTH = 350
    const { result } = renderHook(() =>
      useTableSizer(
        ArrowProto.create({
          data: VERY_TALL,
          useContainerWidth: true,
          width: TABLE_WIDTH,
        }),
        100, // VERY_TALL table has 100 rows
        false,
        CONTAINER_WIDTH,
        CONTAINER_HEIGHT,
        true
      )
    )

    expect(result.current.maxWidth).toEqual(CONTAINER_WIDTH)
    expect(result.current.maxHeight).toEqual(CONTAINER_HEIGHT)
    expect(result.current.resizableSize.width).toEqual(CONTAINER_WIDTH)
    expect(result.current.resizableSize.height).toEqual(CONTAINER_HEIGHT)
  })

  it("adapts size on resizing", () => {
    // The width of the surrounding containers
    const CONTAINER_WIDTH = 700
    const TABLE_WIDTH = 350
    const NUMBER_OF_ROWS = 10 // TEN_BY_TEN has 10 rows
    const { result } = renderHook(() =>
      useTableSizer(
        ArrowProto.create({
          data: TEN_BY_TEN,
          useContainerWidth: false,
          width: TABLE_WIDTH,
        }),
        NUMBER_OF_ROWS,
        false,
        CONTAINER_WIDTH
      )
    )

    const NEW_WIDTH = 100
    const NEW_HEIGHT = 100

    act(() => {
      const { setResizableSize } = result.current
      setResizableSize?.({
        width: NEW_WIDTH,
        height: NEW_HEIGHT,
      })
    })

    expect(result.current.resizableSize.width).toEqual(NEW_WIDTH)
    expect(result.current.resizableSize.height).toEqual(NEW_HEIGHT)
    expect(result.current.maxWidth).toEqual(CONTAINER_WIDTH)
    // +1 rows for header row
    expect(result.current.maxHeight).toEqual(
      calculateMaxHeight(NUMBER_OF_ROWS + 1)
    )
  })
})
