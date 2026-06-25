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

import { useThrottledCallback } from "./useThrottledCallback"

describe("useThrottledCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("should execute immediately on first call", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useThrottledCallback(callback, 100))

    act(() => {
      result.current.throttledCallback("first")
    })

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("first")
  })

  it("should throttle calls during cooldown period", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useThrottledCallback(callback, 100))

    // First call - executes immediately
    act(() => {
      result.current.throttledCallback("first")
    })

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("first")

    // Second call during cooldown - saved but not executed
    act(() => {
      result.current.throttledCallback("second")
    })

    expect(callback).toHaveBeenCalledTimes(1)

    // Third call during cooldown - replaces pending
    act(() => {
      result.current.throttledCallback("third")
    })

    expect(callback).toHaveBeenCalledTimes(1)

    // After cooldown, trailing call executes with latest args
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenLastCalledWith("third")
  })

  it("should allow new immediate call after cooldown with no pending", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useThrottledCallback(callback, 100))

    // First call
    act(() => {
      result.current.throttledCallback("first")
    })

    expect(callback).toHaveBeenCalledTimes(1)

    // Wait for cooldown to end
    act(() => {
      vi.advanceTimersByTime(100)
    })

    // No trailing call since no pending args
    expect(callback).toHaveBeenCalledTimes(1)

    // New call should execute immediately
    act(() => {
      result.current.throttledCallback("second")
    })

    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenLastCalledWith("second")
  })

  it("should cancel pending call when cancel is called", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useThrottledCallback(callback, 100))

    // First call
    act(() => {
      result.current.throttledCallback("first")
    })

    // Second call during cooldown
    act(() => {
      result.current.throttledCallback("second")
    })

    expect(callback).toHaveBeenCalledTimes(1)

    // Cancel pending
    act(() => {
      result.current.cancel()
    })

    // After cooldown, no trailing call
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("should allow immediate execution after cancel resets throttle state", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useThrottledCallback(callback, 100))

    // First call - starts throttle
    act(() => {
      result.current.throttledCallback("first")
    })

    expect(callback).toHaveBeenCalledTimes(1)

    // Cancel should reset isThrottledRef, allowing immediate execution
    act(() => {
      result.current.cancel()
    })

    // Next call should fire immediately (not be throttled)
    act(() => {
      result.current.throttledCallback("second")
    })

    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenLastCalledWith("second")
  })

  it("should use latest callback reference", () => {
    const callback1 = vi.fn()
    const callback2 = vi.fn()

    const { result, rerender } = renderHook(
      ({ cb }) => useThrottledCallback(cb, 100),
      { initialProps: { cb: callback1 } }
    )

    // First call with callback1
    act(() => {
      result.current.throttledCallback("first")
    })

    expect(callback1).toHaveBeenCalledTimes(1)

    // Queue a trailing call
    act(() => {
      result.current.throttledCallback("second")
    })

    // Change the callback
    rerender({ cb: callback2 })

    // After cooldown, trailing call should use the new callback
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledWith("second")

    // After the trailing call executes, we're back in cooldown
    // Wait for cooldown to end
    act(() => {
      vi.advanceTimersByTime(100)
    })

    // Now a new call should execute immediately
    act(() => {
      result.current.throttledCallback("third")
    })

    expect(callback2).toHaveBeenCalledTimes(2)
    expect(callback2).toHaveBeenLastCalledWith("third")
  })

  it("should allow immediate execution after trailing call without rerender", () => {
    // This test verifies that the throttle works correctly even without
    // a component rerender (e.g., for side-effect-only callbacks)
    const callback = vi.fn()
    const { result } = renderHook(() => useThrottledCallback(callback, 100))

    // First call - executes immediately
    act(() => {
      result.current.throttledCallback("first")
    })

    expect(callback).toHaveBeenCalledTimes(1)

    // Queue a trailing call
    act(() => {
      result.current.throttledCallback("second")
    })

    // After cooldown, trailing call executes
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenLastCalledWith("second")

    // Another cooldown - verify immediate execution after trailing call
    act(() => {
      vi.advanceTimersByTime(100)
    })

    // New call should execute immediately
    act(() => {
      result.current.throttledCallback("third")
    })

    expect(callback).toHaveBeenCalledTimes(3)
    expect(callback).toHaveBeenLastCalledWith("third")
  })
})
