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

import { useCalculatedDimensions } from "./useCalculatedDimensions"
import * as useResizeObserver from "./useResizeObserver"

// Mock ResizeObserver
class MockResizeObserver {
  callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

describe("useCalculatedDimensions", () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it.each([
    {
      values: [],
      expectedWidth: -1,
      expectedHeight: -1,
      description: "no dimensions available",
    },
    {
      values: [0, 0],
      expectedWidth: -1,
      expectedHeight: -1,
      description: "zero dimensions",
    },
    {
      values: [-100, -50],
      expectedWidth: -100,
      expectedHeight: -50,
      description: "negative dimensions",
    },
    {
      values: [-1, -1],
      expectedWidth: -1,
      expectedHeight: -1,
      description: "negative one dimensions",
    },
    {
      values: [1, 1],
      expectedWidth: 1,
      expectedHeight: 1,
      description: "small positive dimensions",
    },
    {
      values: [100, 200],
      expectedWidth: 100,
      expectedHeight: 200,
      description: "positive dimensions",
    },
    {
      values: [200],
      expectedWidth: 200,
      expectedHeight: -1,
      description: "width only",
    },
    {
      values: [0, 150],
      expectedWidth: -1,
      expectedHeight: 150,
      description: "height with zero width",
    },
  ])(
    "with observed values $values should return width=$expectedWidth, height=$expectedHeight ($description)",
    ({ values, expectedWidth, expectedHeight }) => {
      vi.spyOn(useResizeObserver, "useResizeObserver").mockImplementation(
        () => ({
          values,
          elementRef: { current: null },
        })
      )

      const { result } = renderHook(() => useCalculatedDimensions())
      const {
        width: actualWidth,
        height: actualHeight,
        elementRef,
      } = result.current

      expect(actualWidth).toBe(expectedWidth)
      expect(actualHeight).toBe(expectedHeight)
      expect(elementRef).toBeDefined()
      expect(typeof elementRef).toBe("object")
      expect("current" in elementRef).toBe(true)
    }
  )

  it("calls useResizeObserver with correct parameters", () => {
    const spy = vi
      .spyOn(useResizeObserver, "useResizeObserver")
      .mockImplementation(() => ({
        values: [100, 50],
        elementRef: { current: null },
      }))

    renderHook(() => useCalculatedDimensions())

    expect(spy).toHaveBeenCalledWith(["width", "height"], [])
  })

  it("passes dependencies to useResizeObserver", () => {
    const dependencies = ["test", "dependency"]
    const spy = vi
      .spyOn(useResizeObserver, "useResizeObserver")
      .mockImplementation(() => ({
        values: [100, 50],
        elementRef: { current: null },
      }))

    renderHook(() => useCalculatedDimensions(dependencies))

    expect(spy).toHaveBeenCalledWith(["width", "height"], dependencies)
  })

  it("uses custom fallback value when provided", () => {
    vi.spyOn(useResizeObserver, "useResizeObserver").mockImplementation(
      () => ({
        values: [0, 0], // Zero dimensions
        elementRef: { current: null },
      })
    )

    const { result } = renderHook(() => useCalculatedDimensions([], 42))
    const { width, height } = result.current

    expect(width).toBe(42)
    expect(height).toBe(42)
  })

  it("defaults to -1 fallback when no custom fallback provided", () => {
    vi.spyOn(useResizeObserver, "useResizeObserver").mockImplementation(
      () => ({
        values: [0, 0], // Zero dimensions
        elementRef: { current: null },
      })
    )

    const { result } = renderHook(() => useCalculatedDimensions())
    const { width, height } = result.current

    expect(width).toBe(-1)
    expect(height).toBe(-1)
  })

  it("maintains referential stability of the ref object", () => {
    const mockElementRef = { current: null }
    vi.spyOn(useResizeObserver, "useResizeObserver").mockImplementation(
      () => ({
        values: [100, 50],
        elementRef: mockElementRef,
      })
    )

    const { result, rerender } = renderHook(() => useCalculatedDimensions())
    const { elementRef: initialRef } = result.current

    rerender()
    const { elementRef: rerenderedRef } = result.current

    expect(initialRef).toBe(rerenderedRef)
  })
})
