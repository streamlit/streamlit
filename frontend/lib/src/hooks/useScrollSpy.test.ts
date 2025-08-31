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

import useScrollSpy, { debounce } from "./useScrollSpy"

describe("debounce function", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  it("should call the function immediately when no delay is provided", () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 0)

    debouncedFn("arg1", "arg2")

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith("arg1", "arg2")
  })

  it("should delay the function call when a delay is provided", () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)
    debouncedFn("arg1", "arg2")
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith("arg1", "arg2")

    debouncedFn("arg3", "arg4")
    expect(fn).not.toHaveBeenCalledWith("arg3", "arg4")
    vi.advanceTimersByTime(99)
    expect(fn).not.toHaveBeenCalledWith("arg3", "arg4")

    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenCalledWith("arg3", "arg4")
  })

  it("should cancel the delay when the function is called again", () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)
    debouncedFn("arg1", "arg2")
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith("arg1", "arg2")

    debouncedFn("arg3", "arg4")
    vi.advanceTimersByTime(99)

    debouncedFn("arg5", "arg6")
    expect(fn).not.toHaveBeenCalledWith("arg5", "arg6")

    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenCalledWith("arg5", "arg6")
  })
})

describe("useScrollSpy hook", () => {
  let target: HTMLElement
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  let eventHandler: ({ timeStampLow }: any) => void

  beforeEach(() => {
    vi.useFakeTimers()
    target = document.createElement("div")
    eventHandler = vi.fn()

    document.body.appendChild(target)
    vi.spyOn(target, "addEventListener")
    vi.spyOn(target, "removeEventListener")
  })

  afterEach(() => {
    document.body.removeChild(target)
    vi.clearAllMocks()
  })

  it("should set up and clean up event listeners", () => {
    const { unmount } = renderHook(() =>
      useScrollSpy(target, eventHandler, true)
    )

    expect(target.addEventListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
      { passive: true }
    )
    expect(eventHandler).toHaveBeenCalledWith({
      target,
      timeStampLow: expect.any(Number),
    })

    unmount()

    expect(target.removeEventListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function)
    )
  })

  it("should not set up event listeners if no target is provided", () => {
    renderHook(() => useScrollSpy(null, eventHandler, true))

    expect(target.addEventListener).not.toHaveBeenCalled()
    expect(eventHandler).not.toHaveBeenCalled()
  })

  it("should not set up event listeners if active is false", () => {
    renderHook(() => useScrollSpy(target, eventHandler, false))

    expect(target.addEventListener).not.toHaveBeenCalled()
    expect(eventHandler).not.toHaveBeenCalled()
  })

  it("should debounce events", () => {
    renderHook(() => useScrollSpy(target, eventHandler, true))

    const scrollEvent = new Event("scroll")
    act(() => {
      target.dispatchEvent(scrollEvent)
    })
    expect(eventHandler).toHaveBeenCalledTimes(1)

    act(() => {
      target.dispatchEvent(scrollEvent)
    })
    expect(eventHandler).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(99)
    expect(eventHandler).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1)
    expect(eventHandler).toHaveBeenCalledTimes(2)
  })
})
