/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import { renderHook, act } from "@testing-library/react-hooks"
import useScrollAnimation from "./useScrollAnimation"

describe("useScrollAnimation", () => {
  let targetElement: HTMLElement
  let onEndMock: () => void
  let scrollHeight: number
  let offsetHeight: number

  beforeEach(() => {
    targetElement = document.createElement("div")
    targetElement.scrollTop = 0
    scrollHeight = 200
    offsetHeight = 100
    Object.defineProperty(targetElement, "scrollHeight", {
      set: value => (scrollHeight = value),
      get: () => scrollHeight,
    })
    Object.defineProperty(targetElement, "offsetHeight", {
      set: value => (offsetHeight = value),
      get: () => offsetHeight,
    })
    targetElement.addEventListener = jest.fn()
    targetElement.removeEventListener = jest.fn()
    onEndMock = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("should animate scroll", () => {
    jest.useFakeTimers()

    renderHook(() => useScrollAnimation(targetElement, onEndMock, true))

    // Simulate scroll animation
    act(() => {
      jest.advanceTimersByTime(5)
      // Trigger the callback of requestAnimationFrame
      act(() => {
        jest.runOnlyPendingTimers()
      })
    })

    // Assert the updated scrollTop value
    expect(targetElement.scrollTop).toBeGreaterThan(0)

    // Simulate reaching the end of animation
    act(() => {
      jest.advanceTimersByTime(100)
      // Trigger the callback of requestAnimationFrame
      act(() => {
        jest.runOnlyPendingTimers()
      })
    })

    // Assert that onEnd callback is called
    expect(onEndMock).toHaveBeenCalled()

    jest.useRealTimers()
  })

  it("should register and deregister the correct events", () => {
    jest.useFakeTimers()

    const { unmount } = renderHook(() =>
      useScrollAnimation(targetElement, onEndMock, true)
    )

    expect(targetElement.addEventListener).toHaveBeenCalledTimes(2)
    expect(targetElement.addEventListener).toHaveBeenCalledWith(
      "pointerdown",
      expect.any(Function),
      { passive: true }
    )
    expect(targetElement.addEventListener).toHaveBeenCalledWith(
      "wheel",
      expect.any(Function),
      { passive: true }
    )

    unmount()

    // Cleanup
    expect(targetElement.removeEventListener).toHaveBeenCalledTimes(2)
    expect(targetElement.removeEventListener).toHaveBeenCalledWith(
      "pointerdown",
      expect.any(Function)
    )
    expect(targetElement.removeEventListener).toHaveBeenCalledWith(
      "wheel",
      expect.any(Function)
    )

    jest.useRealTimers()
  })

  it("should not animate scroll if target element is null", () => {
    renderHook(() => useScrollAnimation(null, onEndMock, true))

    expect(targetElement.addEventListener).not.toHaveBeenCalled()
  })

  it("should not animate scroll if isAnimating is false", () => {
    renderHook(() => useScrollAnimation(targetElement, onEndMock, false))

    expect(targetElement.addEventListener).not.toHaveBeenCalled()
  })
})
