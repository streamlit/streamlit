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

import { act, renderHook } from "@testing-library/react"

import useColumnVisibility from "./useColumnVisibility"

const clearSelectionMock = vi.fn()
const setColumnConfigMappingMock = vi.fn()

describe("useColumnVisibility hook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns correct initial state", () => {
    const { result } = renderHook(() =>
      useColumnVisibility(clearSelectionMock, setColumnConfigMappingMock)
    )

    expect(typeof result.current.hideColumn).toBe("function")
    expect(typeof result.current.showColumn).toBe("function")
  })

  it("hides column correctly", () => {
    const { result } = renderHook(() =>
      useColumnVisibility(clearSelectionMock, setColumnConfigMappingMock)
    )

    act(() => {
      result.current.hideColumn("column-1")
    })

    expect(setColumnConfigMappingMock).toHaveBeenCalled()
    expect(clearSelectionMock).toHaveBeenCalledWith(true, false)

    // Verify the mapping was called with correct parameters
    const setStateCallback = setColumnConfigMappingMock.mock.calls[0][0]
    const prevMap = new Map()
    const newMap = setStateCallback(prevMap)

    expect(newMap.get("column-1")).toEqual({ hidden: true })
  })

  it("shows column correctly", () => {
    const { result } = renderHook(() =>
      useColumnVisibility(clearSelectionMock, setColumnConfigMappingMock)
    )

    act(() => {
      result.current.showColumn("column-1")
    })

    expect(setColumnConfigMappingMock).toHaveBeenCalled()
    expect(clearSelectionMock).toHaveBeenCalledWith(true, false)

    // Verify the mapping was called with correct parameters
    const setStateCallback = setColumnConfigMappingMock.mock.calls[0][0]
    const prevMap = new Map()
    const newMap = setStateCallback(prevMap)

    expect(newMap.get("column-1")).toEqual({ hidden: false })
  })

  it("preserves existing column config when hiding", () => {
    const { result } = renderHook(() =>
      useColumnVisibility(clearSelectionMock, setColumnConfigMappingMock)
    )

    act(() => {
      result.current.hideColumn("column-1")
    })

    // Verify the mapping preserves existing config
    const setStateCallback = setColumnConfigMappingMock.mock.calls[0][0]
    const prevMap = new Map([["column-1", { width: 100 }]])
    const newMap = setStateCallback(prevMap)

    expect(newMap.get("column-1")).toEqual({ width: 100, hidden: true })
  })

  it("preserves existing column config when showing", () => {
    const { result } = renderHook(() =>
      useColumnVisibility(clearSelectionMock, setColumnConfigMappingMock)
    )

    act(() => {
      result.current.showColumn("column-1")
    })

    // Verify the mapping preserves existing config
    const setStateCallback = setColumnConfigMappingMock.mock.calls[0][0]
    const prevMap = new Map([["column-1", { width: 100 }]])
    const newMap = setStateCallback(prevMap)

    expect(newMap.get("column-1")).toEqual({ width: 100, hidden: false })
  })
})
