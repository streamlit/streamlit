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

import ThemeProvider from "~lib/components/core/ThemeProvider"
import { mockTheme } from "~lib/mocks/mockTheme"

import { useWindowDimensions } from "./useWindowDimensions"

const wrapper = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <ThemeProvider theme={mockTheme.emotion}>{children}</ThemeProvider>
)

describe("useWindowDimensions", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      fontSize: "16px",
    } as CSSStyleDeclaration)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("should return initial dimensions on mount", () => {
    const { result } = renderHook(() => useWindowDimensions(), { wrapper })

    expect(result.current.innerWidth).toBe(1024)
    expect(result.current.innerHeight).toBe(768)
  })

  it("should update immediately on first resize event (throttle)", () => {
    const { result } = renderHook(() => useWindowDimensions(), { wrapper })

    act(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 800,
      })
      window.dispatchEvent(new Event("resize"))
    })

    // Throttle fires immediately on first call
    expect(result.current.innerWidth).toBe(800)
  })

  it("should throttle subsequent resize events during cooldown", () => {
    const { result } = renderHook(() => useWindowDimensions(), { wrapper })

    // First resize - fires immediately
    act(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 900,
      })
      window.dispatchEvent(new Event("resize"))
    })

    expect(result.current.innerWidth).toBe(900)

    // Second resize during cooldown - saved but not applied yet
    act(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 850,
      })
      window.dispatchEvent(new Event("resize"))
    })

    // Still at 900 during cooldown
    expect(result.current.innerWidth).toBe(900)

    // Third resize during cooldown - replaces pending
    act(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 800,
      })
      window.dispatchEvent(new Event("resize"))
    })

    // Still at 900 during cooldown
    expect(result.current.innerWidth).toBe(900)

    // After cooldown, the last pending value (800) is applied
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.innerWidth).toBe(800)
  })

  it("should cleanup timeout on unmount", () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout")

    const { unmount } = renderHook(() => useWindowDimensions(), { wrapper })

    act(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 800,
      })
      window.dispatchEvent(new Event("resize"))
    })

    const callCountBeforeUnmount = clearTimeoutSpy.mock.calls.length
    unmount()

    expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(
      callCountBeforeUnmount
    )
  })
})
