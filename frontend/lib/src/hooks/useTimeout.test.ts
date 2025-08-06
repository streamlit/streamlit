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

import useTimeout from "./useTimeout"

describe("timeout function", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("should call the callback function after timeout", () => {
    const callback = vi.fn()
    const timeoutDelayMs = 50
    renderHook(() => useTimeout(callback, timeoutDelayMs))

    expect(callback).toHaveBeenCalledTimes(0)
    vi.advanceTimersByTime(timeoutDelayMs)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("should not call the callback function when cancel timeout", () => {
    const callback = vi.fn()
    const timeoutDelayMs = 100
    const { result } = renderHook(() => useTimeout(callback, timeoutDelayMs))
    const { clear } = result.current
    clear()
    vi.advanceTimersByTime(2 * timeoutDelayMs)
    expect(callback).toHaveBeenCalledTimes(0)
  })

  it("should not call the callback when timeoutMs is null", () => {
    const callback = vi.fn()
    renderHook(() => useTimeout(callback, null))
    // Wait longer than a typical timeout to ensure callback isn't called
    vi.advanceTimersByTime(200)
    expect(callback).toHaveBeenCalledTimes(0)
  })

  it("should start timeout when timeoutMs changes from null to a number", () => {
    const callback = vi.fn()
    const timeoutDelayMs = 50
    let timeoutMs: number | null = null

    const { rerender } = renderHook(() => useTimeout(callback, timeoutMs))

    // Initially no timeout should be set
    vi.advanceTimersByTime(100)
    expect(callback).toHaveBeenCalledTimes(0)

    // Change timeoutMs to a number
    timeoutMs = timeoutDelayMs
    rerender()

    // Now callback should be called after the timeout
    vi.advanceTimersByTime(timeoutDelayMs)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("should clear timeout when timeoutMs changes from a number to null", () => {
    const callback = vi.fn()
    const timeoutDelayMs = 100
    let timeoutMs: number | null = timeoutDelayMs

    const { rerender } = renderHook(() => useTimeout(callback, timeoutMs))

    // Change timeoutMs to null before the timeout fires
    timeoutMs = null
    rerender()

    // Wait longer than the original timeout to ensure callback isn't called
    vi.advanceTimersByTime(2 * timeoutDelayMs)
    expect(callback).toHaveBeenCalledTimes(0)
  })

  it("should handle multiple transitions between null and number values", () => {
    const callback = vi.fn()
    const timeoutDelayMs = 50
    let timeoutMs: number | null = null

    const { rerender } = renderHook(() => useTimeout(callback, timeoutMs))

    // Start with null - no callback
    vi.advanceTimersByTime(100)
    expect(callback).toHaveBeenCalledTimes(0)

    // Change to number - should trigger callback
    timeoutMs = timeoutDelayMs
    rerender()
    vi.advanceTimersByTime(timeoutDelayMs)
    expect(callback).toHaveBeenCalledTimes(1)

    // Change back to null - no more callbacks
    timeoutMs = null
    rerender()
    vi.advanceTimersByTime(100)
    expect(callback).toHaveBeenCalledTimes(1)

    // Change to number again - should trigger callback again
    timeoutMs = timeoutDelayMs
    rerender()
    vi.advanceTimersByTime(timeoutDelayMs)
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it("should clear timeout using the clear function when timeoutMs is null", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useTimeout(callback, null))

    // Should be able to call clear function without errors even when no timeout is set
    const { clear } = result.current
    expect(() => clear()).not.toThrow()
  })

  it("should handle changing from one number to another", () => {
    const callback = vi.fn()
    let timeoutMs = 200 // Long initial timeout

    const { rerender } = renderHook(() => useTimeout(callback, timeoutMs))

    // Change to a shorter timeout before the first one fires
    timeoutMs = 50
    rerender()

    // Should only call callback once with the new shorter timeout
    vi.advanceTimersByTime(50)
    expect(callback).toHaveBeenCalledTimes(1)

    // Ensure it doesn't call again after the original longer timeout
    vi.advanceTimersByTime(200)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("should restart timeout when restart function is called", () => {
    const callback = vi.fn()
    const timeoutDelayMs = 100
    const { result } = renderHook(() => useTimeout(callback, timeoutDelayMs))

    // Wait for half the timeout duration, then restart
    vi.advanceTimersByTime(timeoutDelayMs / 2)
    const { restart } = result.current
    restart()

    // Should not have called callback yet
    expect(callback).toHaveBeenCalledTimes(0)

    // Wait for the full timeout duration from restart
    vi.advanceTimersByTime(timeoutDelayMs)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("should handle multiple restarts before timeout fires", () => {
    const callback = vi.fn()
    const timeoutDelayMs = 80
    const { result } = renderHook(() => useTimeout(callback, timeoutDelayMs))
    const { restart } = result.current

    // Restart multiple times rapidly
    vi.advanceTimersByTime(20)
    restart()
    vi.advanceTimersByTime(20)
    restart()
    vi.advanceTimersByTime(20)
    restart()

    // Should not have called callback yet
    expect(callback).toHaveBeenCalledTimes(0)

    // Wait for the timeout from the last restart
    vi.advanceTimersByTime(timeoutDelayMs)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("should not restart timeout when timeoutMs is null", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useTimeout(callback, null))
    const { restart } = result.current

    // Should be able to call restart without errors even when timeoutMs is null
    expect(() => restart()).not.toThrow()

    // Wait a bit and ensure callback was never called
    vi.advanceTimersByTime(100)
    expect(callback).toHaveBeenCalledTimes(0)
  })
})
