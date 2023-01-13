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

import { SizedGridColumn } from "@glideapps/glide-data-grid"
import { renderHook, act } from "@testing-library/react-hooks"
import { GridColumn } from "@glideapps/glide-data-grid"

import useColumnSizer from "./useColumnSizer"

const MOCK_COLUMNS: GridColumn[] = [
  {
    id: "column_1",
    title: "column_1",
  },
  {
    id: "column_2",
    title: "column_2",
    width: 100,
  },
  {
    id: "column_3",
    title: "column_3",
    grow: 1,
  },
]

describe("useColumnSizer hook", () => {
  it("should correctly apply column resizing.", () => {
    const { result } = renderHook(() => useColumnSizer(MOCK_COLUMNS))
    // Check initial state
    expect((result.current.columns[0] as SizedGridColumn).width).toBe(
      undefined
    )
    expect((result.current.columns[1] as SizedGridColumn).width).toBe(100)

    // Resize first column to size of 123:
    act(() => {
      const { onColumnResize } = result.current
      onColumnResize?.(MOCK_COLUMNS[0], 123, 0, 123)
    })
    expect((result.current.columns[0] as SizedGridColumn).width).toBe(123)

    // Resize first column to size of 321:
    act(() => {
      const { onColumnResize } = result.current
      onColumnResize?.(MOCK_COLUMNS[0], 321, 0, 321)
    })
    expect((result.current.columns[0] as SizedGridColumn).width).toBe(321)

    // First column should stay at previous value if other column is resized
    act(() => {
      const { onColumnResize } = result.current
      onColumnResize?.(MOCK_COLUMNS[1], 88, 1, 88)
    })
    expect((result.current.columns[0] as SizedGridColumn).width).toBe(321)
  })

  it("should deactivate grow on resize.", () => {
    const { result } = renderHook(() => useColumnSizer(MOCK_COLUMNS))

    // Check initial state
    expect((result.current.columns[2] as SizedGridColumn).width).toBe(
      undefined
    )
    expect((result.current.columns[2] as SizedGridColumn).grow).toBe(1)

    // Resize column with grow
    act(() => {
      const { onColumnResize } = result.current
      onColumnResize?.(MOCK_COLUMNS[2], 123, 0, 123)
    })
    expect((result.current.columns[2] as SizedGridColumn).width).toBe(123)
    // Grow should be deactivated (by setting it to 0)
    expect((result.current.columns[2] as SizedGridColumn).grow).toBe(0)
  })
})
