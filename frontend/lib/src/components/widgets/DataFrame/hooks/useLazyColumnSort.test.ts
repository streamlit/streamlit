/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { BaseColumn } from "~lib/components/widgets/DataFrame/columns"

import useLazyColumnSort from "./useLazyColumnSort"

const makeColumn = (id: string, name: string, title: string): BaseColumn =>
  ({ id, name, title }) as unknown as BaseColumn

const COLUMNS: BaseColumn[] = [
  makeColumn("col-0", "a", "A"),
  makeColumn("col-1", "b", "B"),
]

describe("useLazyColumnSort", () => {
  it("starts with no sort state and identity row mapping", () => {
    const { result } = renderHook(() => useLazyColumnSort(COLUMNS))
    expect(result.current.sortState).toBeUndefined()
    expect(result.current.getOriginalIndex(42)).toBe(42)
    expect(result.current.columns).toEqual(COLUMNS)
  })

  it("applies an ascending sort using the backend column name", () => {
    const { result } = renderHook(() => useLazyColumnSort(COLUMNS))
    act(() => result.current.sortColumn(0, "auto"))
    expect(result.current.sortState).toEqual({
      column: "a",
      descending: false,
    })
    // The header indicator is applied to the sorted column only.
    expect(result.current.columns[0].title).toBe("↑ A")
    expect(result.current.columns[1].title).toBe("B")
  })

  it("toggles asc -> desc -> none on repeated auto clicks", () => {
    const { result } = renderHook(() => useLazyColumnSort(COLUMNS))

    act(() => result.current.sortColumn(1, "auto"))
    expect(result.current.sortState).toEqual({
      column: "b",
      descending: false,
    })

    act(() => result.current.sortColumn(1, "auto"))
    expect(result.current.sortState).toEqual({ column: "b", descending: true })
    expect(result.current.columns[1].title).toBe("↓ B")

    act(() => result.current.sortColumn(1, "auto"))
    expect(result.current.sortState).toBeUndefined()
  })

  it("applies an explicit descending sort", () => {
    const { result } = renderHook(() => useLazyColumnSort(COLUMNS))
    act(() => result.current.sortColumn(0, "desc"))
    expect(result.current.sortState).toEqual({ column: "a", descending: true })
  })

  it("removes the sort when autoReset is used with the same direction", () => {
    const { result } = renderHook(() => useLazyColumnSort(COLUMNS))
    act(() => result.current.sortColumn(0, "asc"))
    act(() => result.current.sortColumn(0, "asc", true))
    expect(result.current.sortState).toBeUndefined()
  })

  it("ignores out-of-range column indices", () => {
    const { result } = renderHook(() => useLazyColumnSort(COLUMNS))
    act(() => result.current.sortColumn(99, "auto"))
    expect(result.current.sortState).toBeUndefined()
  })

  it("ignores columns without a backend field name (e.g. index columns)", () => {
    const columnsWithIndex = [makeColumn("index-0", "", ""), ...COLUMNS]
    const { result } = renderHook(() => useLazyColumnSort(columnsWithIndex))
    act(() => result.current.sortColumn(0, "auto"))
    // The index column has no backend name, so sorting is a no-op and no
    // header indicator is applied.
    expect(result.current.sortState).toBeUndefined()
    expect(result.current.columns[0].title).toBe("")
  })
})
