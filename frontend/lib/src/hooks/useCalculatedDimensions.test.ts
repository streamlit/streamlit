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

import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useCalculatedDimensions } from "./useCalculatedDimensions"
import * as useDebouncedValue from "./useDebouncedValue"
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
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    vi.useRealTimers()
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

  describe("debouncing functionality", () => {
    it("applies default 16ms debouncing when no debounceMs is provided", () => {
      vi.spyOn(useResizeObserver, "useResizeObserver").mockImplementation(
        () => ({
          values: [100, 50],
          elementRef: { current: null },
        })
      )

      const debouncedValueSpy = vi.spyOn(
        useDebouncedValue,
        "useDebouncedValue"
      )

      const { result } = renderHook(() => useCalculatedDimensions())
      const { width, height } = result.current

      expect(width).toBe(100)
      expect(height).toBe(50)

      // Should call useDebouncedValue with default 16ms delay
      expect(debouncedValueSpy).toHaveBeenCalledWith(100, 16)
      expect(debouncedValueSpy).toHaveBeenCalledWith(50, 16)
    })

    it("disables debouncing when debounceMs is 0", () => {
      vi.spyOn(useResizeObserver, "useResizeObserver").mockImplementation(
        () => ({
          values: [100, 50],
          elementRef: { current: null },
        })
      )

      const debouncedValueSpy = vi.spyOn(
        useDebouncedValue,
        "useDebouncedValue"
      )

      const { result } = renderHook(() => useCalculatedDimensions([], -1, 0))
      const { width, height } = result.current

      expect(width).toBe(100)
      expect(height).toBe(50)

      // Should still call useDebouncedValue but with 0 delay and return raw values
      expect(debouncedValueSpy).toHaveBeenCalledWith(100, 0)
      expect(debouncedValueSpy).toHaveBeenCalledWith(50, 0)
    })

    it("applies debouncing when debounceMs is provided", () => {
      vi.spyOn(useResizeObserver, "useResizeObserver").mockImplementation(
        () => ({
          values: [200, 100],
          elementRef: { current: null },
        })
      )

      // Mock useDebouncedValue to return debounced values
      const debouncedValueSpy = vi
        .spyOn(useDebouncedValue, "useDebouncedValue")
        .mockImplementation((value: unknown, delay: number) => {
          // For testing, just return the value immediately
          // In real usage, this would be debounced
          return delay > 0 ? (value as number) - 10 : value // Simulate debounced behavior
        })

      const { result } = renderHook(() => useCalculatedDimensions([], -1, 150))
      const { width, height } = result.current

      // Should use debounced values when debounceMs is provided
      expect(width).toBe(190) // 200 - 10 (simulated debounced value)
      expect(height).toBe(90) // 100 - 10 (simulated debounced value)

      expect(debouncedValueSpy).toHaveBeenCalledWith(200, 150)
      expect(debouncedValueSpy).toHaveBeenCalledWith(100, 150)
    })

    it("applies fallback values before debouncing", () => {
      vi.spyOn(useResizeObserver, "useResizeObserver").mockImplementation(
        () => ({
          values: [0, 0], // Zero values should use fallback
          elementRef: { current: null },
        })
      )

      const debouncedValueSpy = vi
        .spyOn(useDebouncedValue, "useDebouncedValue")
        .mockImplementation((value: unknown) => value)

      const { result } = renderHook(() => useCalculatedDimensions([], 42, 100))
      const { width, height } = result.current

      expect(width).toBe(42)
      expect(height).toBe(42)

      // Should debounce the fallback values
      expect(debouncedValueSpy).toHaveBeenCalledWith(42, 100)
    })

    it("handles changing debounce delays", () => {
      vi.spyOn(useResizeObserver, "useResizeObserver").mockImplementation(
        () => ({
          values: [150, 75],
          elementRef: { current: null },
        })
      )

      const debouncedValueSpy = vi
        .spyOn(useDebouncedValue, "useDebouncedValue")
        .mockImplementation((value: unknown) => value)

      const { rerender } = renderHook(
        ({ debounceMs }: { debounceMs?: number }) =>
          useCalculatedDimensions([], -1, debounceMs),
        { initialProps: { debounceMs: 100 } }
      )

      // First render with 100ms debounce
      expect(debouncedValueSpy).toHaveBeenCalledWith(150, 100)
      expect(debouncedValueSpy).toHaveBeenCalledWith(75, 100)

      // Change to 200ms debounce
      rerender({ debounceMs: 200 })
      expect(debouncedValueSpy).toHaveBeenCalledWith(150, 200)
      expect(debouncedValueSpy).toHaveBeenCalledWith(75, 200)

      // Use default debouncing (16ms) - omit debounceMs to use default
      rerender({ debounceMs: 16 })
      expect(debouncedValueSpy).toHaveBeenCalledWith(150, 16)
      expect(debouncedValueSpy).toHaveBeenCalledWith(75, 16)
    })
  })
})
