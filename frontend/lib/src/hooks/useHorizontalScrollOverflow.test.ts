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

import { useHorizontalScrollOverflow } from "./useHorizontalScrollOverflow"

function refOf(el: HTMLElement): { current: HTMLElement } {
  return { current: el }
}

function mockScrollMetrics(
  el: HTMLElement,
  metrics: {
    scrollLeft?: number
    scrollWidth?: number
    clientWidth?: number
  }
): void {
  Object.defineProperties(el, {
    scrollLeft: {
      configurable: true,
      get: () => metrics.scrollLeft ?? 0,
    },
    scrollWidth: {
      configurable: true,
      get: () => metrics.scrollWidth ?? 100,
    },
    clientWidth: {
      configurable: true,
      get: () => metrics.clientWidth ?? 100,
    },
  })
}

describe("useHorizontalScrollOverflow", () => {
  let element: HTMLDivElement

  beforeEach(() => {
    element = document.createElement("div")
    document.body.appendChild(element)
  })

  afterEach(() => {
    element.remove()
  })

  it("reports no overflow when disabled", () => {
    mockScrollMetrics(element, {
      scrollLeft: 0,
      scrollWidth: 800,
      clientWidth: 200,
    })
    const { result } = renderHook(() =>
      useHorizontalScrollOverflow(refOf(element), false)
    )

    act(() => {
      element.dispatchEvent(new Event("scroll"))
    })

    expect(result.current.canScrollLeft).toBe(false)
    expect(result.current.canScrollRight).toBe(false)
  })

  it("reports right-only overflow at the start of a scrollport", () => {
    mockScrollMetrics(element, {
      scrollLeft: 0,
      scrollWidth: 800,
      clientWidth: 200,
    })
    const { result } = renderHook(() =>
      useHorizontalScrollOverflow(refOf(element), true)
    )

    act(() => {
      element.dispatchEvent(new Event("scroll"))
    })

    expect(result.current.canScrollLeft).toBe(false)
    expect(result.current.canScrollRight).toBe(true)
  })

  it("reports left-only overflow at the end of a scrollport", () => {
    mockScrollMetrics(element, {
      scrollLeft: 600,
      scrollWidth: 800,
      clientWidth: 200,
    })
    const { result } = renderHook(() =>
      useHorizontalScrollOverflow(refOf(element), true)
    )

    act(() => {
      element.dispatchEvent(new Event("scroll"))
    })

    expect(result.current.canScrollLeft).toBe(true)
    expect(result.current.canScrollRight).toBe(false)
  })

  it("reports both edges when scrolled in the middle", () => {
    mockScrollMetrics(element, {
      scrollLeft: 50,
      scrollWidth: 800,
      clientWidth: 200,
    })
    const { result } = renderHook(() =>
      useHorizontalScrollOverflow(refOf(element), true)
    )

    act(() => {
      element.dispatchEvent(new Event("scroll"))
    })

    expect(result.current.canScrollLeft).toBe(true)
    expect(result.current.canScrollRight).toBe(true)
  })

  it("clears overflow flags when enabled becomes false", () => {
    mockScrollMetrics(element, {
      scrollLeft: 50,
      scrollWidth: 800,
      clientWidth: 200,
    })
    const { result, rerender } = renderHook(
      ({ enabled }) => useHorizontalScrollOverflow(refOf(element), enabled),
      { initialProps: { enabled: true } }
    )

    act(() => {
      element.dispatchEvent(new Event("scroll"))
    })
    expect(result.current.canScrollRight).toBe(true)

    rerender({ enabled: false })

    expect(result.current.canScrollLeft).toBe(false)
    expect(result.current.canScrollRight).toBe(false)
  })
})
