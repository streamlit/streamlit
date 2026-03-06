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

import { useDebouncedCallback } from "./useDebouncedCallback"

describe("useDebouncedCallback hook", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("should call callback after delay", () => {
    const callback = vi.fn()
    const delay = 100

    const { result } = renderHook(() => useDebouncedCallback(callback, delay))
    const { debouncedCallback } = result.current

    debouncedCallback("test")
    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(delay)
    expect(callback).toHaveBeenCalledWith("test")
  })

  it("should debounce multiple calls", () => {
    const callback = vi.fn()
    const delay = 100

    const { result } = renderHook(() => useDebouncedCallback(callback, delay))
    const { debouncedCallback } = result.current

    debouncedCallback("test1")
    debouncedCallback("test2")
    debouncedCallback("test3")

    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(delay)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("test3")
  })

  it("should cancel pending callback when cancel is called", () => {
    const callback = vi.fn()
    const delay = 100

    const { result } = renderHook(() => useDebouncedCallback(callback, delay))
    const { debouncedCallback, cancel } = result.current

    debouncedCallback("test")
    cancel()

    vi.advanceTimersByTime(delay)
    expect(callback).not.toHaveBeenCalled()
  })

  it("should handle multiple arguments correctly", () => {
    const callback = vi.fn()
    const delay = 100

    const { result } = renderHook(() => useDebouncedCallback(callback, delay))
    const { debouncedCallback } = result.current

    debouncedCallback("arg1", 123, { test: true })

    vi.advanceTimersByTime(delay)
    expect(callback).toHaveBeenCalledWith("arg1", 123, { test: true })
  })

  it("should invoke the latest callback when callback changes between debounced calls", () => {
    const callback1 = vi.fn()
    const callback2 = vi.fn()
    let callback = callback1
    const delay = 100

    const { result, rerender } = renderHook(() =>
      useDebouncedCallback(callback, delay)
    )

    result.current.debouncedCallback("test")

    // Swap callback before the timer fires
    callback = callback2
    rerender()

    vi.advanceTimersByTime(delay)
    expect(callback1).not.toHaveBeenCalled()
    expect(callback2).toHaveBeenCalledWith("test")
  })

  it("should cleanup timeout on unmount", () => {
    const callback = vi.fn()
    const delay = 100

    const { result, unmount } = renderHook(() =>
      useDebouncedCallback(callback, delay)
    )
    const { debouncedCallback } = result.current

    debouncedCallback("test")
    unmount()

    vi.advanceTimersByTime(delay)
    expect(callback).not.toHaveBeenCalled()
  })
})
