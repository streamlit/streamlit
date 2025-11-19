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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useScrollbarGutterSize } from "./useScrollbarGutterSize"

describe("useScrollbarGutterSize", () => {
  let mockOffsetWidth = 50

  beforeEach(() => {
    // Mock DOM element properties
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get() {
        // Outer div has scrollbar, inner div doesn't
        return this.style.width === "100%" ? 35 : mockOffsetWidth
      },
    })
  })

  afterEach(() => {
    // Clean up any remaining DOM elements
    document.body.innerHTML = ""
    vi.restoreAllMocks()
    // Reset mockOffsetWidth to default
    mockOffsetWidth = 50
  })

  it("should return the scrollbar gutter size", () => {
    const { result } = renderHook(() => useScrollbarGutterSize())

    // The hook should return the difference between outer and inner widths
    expect(result.current).toBe(15) // 50 - 35 = 15
  })

  it("should create and remove temporary DOM elements", () => {
    const appendChildSpy = vi.spyOn(document.body, "appendChild")
    const removeSpy = vi.spyOn(HTMLElement.prototype, "remove")

    renderHook(() => useScrollbarGutterSize())

    // Check that temporary elements were created
    expect(appendChildSpy).toHaveBeenCalled()

    // Check that cleanup was attempted
    expect(removeSpy).toHaveBeenCalled()

    // Find the appendChild call that matches our expected element
    const outerDivCall = appendChildSpy.mock.calls.find(call => {
      const element = call[0] as HTMLElement
      return (
        element.style?.position === "absolute" &&
        element.style?.top === "-9999px" &&
        element.style?.overflow === "scroll"
      )
    })

    expect(outerDivCall).toBeDefined()
  })

  it("should recalculate when devicePixelRatio changes", () => {
    // Mock initial devicePixelRatio
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 1,
    })

    const { result, rerender } = renderHook(() => useScrollbarGutterSize())
    const initialValue = result.current

    // Change devicePixelRatio
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 2,
    })

    // Change the mock offset to simulate different scrollbar size
    mockOffsetWidth = 48

    rerender()

    // Should recalculate with new values
    expect(result.current).toBe(13) // 48 - 35 = 13
    expect(result.current).not.toBe(initialValue)
  })

  it("should handle element removal safely", () => {
    const removeSpy = vi.spyOn(HTMLElement.prototype, "remove")

    // Create an orphaned element (no parent)
    const orphanedElement = document.createElement("div")

    // Calling remove on an element with no parent should not throw
    expect(() => orphanedElement.remove()).not.toThrow()

    const { result } = renderHook(() => useScrollbarGutterSize())

    // Hook should work normally
    expect(typeof result.current).toBe("number")
    expect(result.current).toBe(15)

    // Verify remove was called
    expect(removeSpy).toHaveBeenCalled()
  })
})
