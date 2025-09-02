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

import { renderHook } from "@testing-library/react"

import { DOMRectKeys, useResizeObserver } from "./useResizeObserver"

const mockDisconnect = vi.fn()
const mockObserve = vi.fn()

describe("useResizeObserver", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Mock ResizeObserver with immediate callback execution
    global.ResizeObserver = vi.fn().mockImplementation(callback => ({
      observe: mockObserve.mockImplementation(() => {
        callback([{ target: document.createElement("div") }])
      }),
      disconnect: mockDisconnect,
    }))
    // Mock requestAnimationFrame
    global.requestAnimationFrame = vi.fn().mockImplementation(cb => {
      cb()
      return 1
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it("should initialize with empty values", () => {
    const properties: DOMRectKeys[] = ["width", "height"]
    const { result } = renderHook(() => useResizeObserver(properties))

    expect(result.current.values).toEqual([])
    expect(result.current.elementRef.current).toBeNull()
  })

  it("should observe element changes", () => {
    const properties: DOMRectKeys[] = ["width", "height"]
    const { result } = renderHook(() => useResizeObserver(properties))

    // Simulate element reference
    const mockElement = document.createElement("div")
    vi.spyOn(mockElement, "getBoundingClientRect").mockReturnValue({
      width: 100,
      height: 200,
    } as DOMRect)

    // Set the ref
    result.current.elementRef.current = mockElement

    // Trigger resize observation
    const observer = new ResizeObserver(() => {})
    observer.observe(mockElement)

    expect(mockObserve).toHaveBeenCalledWith(mockElement)
  })
})
