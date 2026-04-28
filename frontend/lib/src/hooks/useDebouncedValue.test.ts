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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useDebouncedValue } from "./useDebouncedValue"

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("initial", 300))

    expect(result.current).toBe("initial")
  })

  it("debounces value updates", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      {
        initialProps: { value: "initial", delay: 300 },
      }
    )

    expect(result.current).toBe("initial")

    // Update the value
    rerender({ value: "updated", delay: 300 })

    // Value should not update immediately
    expect(result.current).toBe("initial")

    // Fast-forward time by less than the delay
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe("initial")

    // Fast-forward time to complete the delay
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe("updated")
  })

  it("resets the debounce timer on subsequent updates", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      {
        initialProps: { value: "initial", delay: 300 },
      }
    )

    expect(result.current).toBe("initial")

    // First update
    rerender({ value: "update1", delay: 300 })
    expect(result.current).toBe("initial")

    // Fast-forward by 200ms
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe("initial")

    // Second update before the first delay completes
    rerender({ value: "update2", delay: 300 })
    expect(result.current).toBe("initial")

    // Fast-forward by 200ms (not enough to complete the new delay)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe("initial")

    // Complete the delay for the second update
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe("update2")
  })

  it("works with different data types", () => {
    // Test with numbers
    const { result: numberResult, rerender: numberRerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      {
        initialProps: { value: 42, delay: 100 },
      }
    )

    expect(numberResult.current).toBe(42)

    numberRerender({ value: 84, delay: 100 })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(numberResult.current).toBe(84)

    // Test with objects
    const initialObj = { foo: "bar" }
    const updatedObj = { foo: "baz" }

    const { result: objectResult, rerender: objectRerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      {
        initialProps: { value: initialObj, delay: 100 },
      }
    )

    expect(objectResult.current).toBe(initialObj)

    objectRerender({ value: updatedObj, delay: 100 })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(objectResult.current).toBe(updatedObj)
  })

  it("handles zero delay correctly", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      {
        initialProps: { value: "initial", delay: 0 },
      }
    )

    expect(result.current).toBe("initial")

    rerender({ value: "updated", delay: 0 })

    // Even with zero delay, the update is async due to setTimeout
    expect(result.current).toBe("initial")

    // Fast-forward minimal time
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(result.current).toBe("updated")
  })

  it("cleans up timeouts on unmount", () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout")

    const { unmount, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      {
        initialProps: { value: "initial", delay: 300 },
      }
    )

    // Update to trigger a timeout
    rerender({ value: "updated", delay: 300 })

    // Unmount before timeout completes
    unmount()

    // Verify that clearTimeout was called
    expect(clearTimeoutSpy).toHaveBeenCalled()

    clearTimeoutSpy.mockRestore()
  })
})
