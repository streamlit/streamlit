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

import { type ReactElement, useLayoutEffect } from "react"

import { act, render, renderHook, screen } from "@testing-library/react"

import { isAtBottom, useScrollToBottom } from "./useScrollToBottom"

const scrollSpyState: {
  handler: ((event: { timeStampLow: number }) => void) | null
} = { handler: null }

const scrollAnimationState: {
  onEnd: (() => void) | null
  isAnimating: boolean
} = { onEnd: null, isAnimating: false }

vi.mock("./useScrollSpy", () => ({
  default(
    _target: HTMLElement | null,
    eventHandler: (event: { timeStampLow: number }) => void,
    _active: boolean
  ): void {
    scrollSpyState.handler = eventHandler
  },
}))

vi.mock("./useScrollAnimation", () => ({
  default(
    _target: HTMLElement | null,
    onEnd: () => void,
    isAnimating: boolean,
    _active: boolean
  ): void {
    scrollAnimationState.onEnd = onEnd
    scrollAnimationState.isAnimating = isAnimating
  },
}))

function setScrollMetrics(
  element: HTMLElement,
  metrics: { offsetHeight: number; scrollHeight: number; scrollTop: number }
): void {
  Object.defineProperty(element, "offsetHeight", {
    configurable: true,
    value: metrics.offsetHeight,
  })
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: metrics.scrollHeight,
  })
  let scrollTop = metrics.scrollTop
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    get: () => scrollTop,
    set: (v: number) => {
      scrollTop = v
    },
  })
}

describe("isAtBottom", () => {
  it.each([
    {
      name: "true when distance to bottom is below the threshold",
      scrollHeight: 200,
      offsetHeight: 100,
      scrollTop: 99.5,
      expected: true,
    },
    {
      name: "false when more than threshold away from the bottom",
      scrollHeight: 200,
      offsetHeight: 100,
      scrollTop: 97,
      expected: false,
    },
    {
      name: "true when exactly at bottom (delta 0)",
      scrollHeight: 300,
      offsetHeight: 100,
      scrollTop: 200,
      expected: true,
    },
  ])("$name", ({ scrollHeight, offsetHeight, scrollTop, expected }) => {
    const el = document.createElement("div")
    setScrollMetrics(el, { offsetHeight, scrollHeight, scrollTop })
    expect(isAtBottom(el)).toBe(expected)
  })
})

function ScrollHarness({
  active,
  tallContent = true,
}: {
  active: boolean
  tallContent?: boolean
}): ReactElement {
  const ref = useScrollToBottom<HTMLDivElement>(active)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }
    setScrollMetrics(el, {
      offsetHeight: 100,
      scrollHeight: tallContent ? 400 : 100,
      scrollTop: tallContent ? 300 : 0,
    })
  }, [ref, tallContent])

  return (
    <div
      ref={ref}
      data-testid="scroll-container"
      style={{ height: 100, overflow: "auto", width: 200 }}
    >
      <button type="button">focus-target</button>
      {tallContent ? <div style={{ height: 400 }} /> : null}
    </div>
  )
}

describe("useScrollToBottom", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    scrollSpyState.handler = null
    scrollAnimationState.onEnd = null
    scrollAnimationState.isAnimating = false
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns a ref object whose current is null before the host assigns it", () => {
    const { result } = renderHook(() => useScrollToBottom(true))
    expect(result.current).not.toBeNull()
    expect(result.current.current).toBeNull()
  })

  it("does not start the sticky check interval when active is false", () => {
    vi.useFakeTimers()
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval")

    render(<ScrollHarness active={false} />)

    expect(
      setIntervalSpy.mock.calls.some(
        args => typeof args[1] === "number" && args[1] === 17
      )
    ).toBe(false)

    setIntervalSpy.mockRestore()
  })

  it("clears the interval on unmount when active", () => {
    vi.useFakeTimers()
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval")

    const { unmount } = render(<ScrollHarness active />)

    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })

  it("registers and removes a capturing passive focus listener while active", () => {
    const addSpy = vi.spyOn(HTMLElement.prototype, "addEventListener")
    const removeSpy = vi.spyOn(HTMLElement.prototype, "removeEventListener")

    const { unmount } = render(<ScrollHarness active />)

    expect(
      addSpy.mock.calls.some(
        args =>
          args[0] === "focus" &&
          (args[2] as { capture?: boolean })?.capture === true &&
          (args[2] as { passive?: boolean })?.passive === true
      )
    ).toBe(true)

    unmount()

    expect(
      removeSpy.mock.calls.some(
        args =>
          args[0] === "focus" &&
          (args[2] as { capture?: boolean })?.capture === true
      )
    ).toBe(true)

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })

  it("updates the internal scrollHeight ref when a focus event fires inside the container", () => {
    render(<ScrollHarness active />)
    const el = screen.getByTestId("scroll-container")

    // Prime the internal dimension refs with a first scroll handler call
    act(() => {
      scrollSpyState.handler?.({ timeStampLow: Date.now() + 10 })
    })

    // Stop animation so the next dimension change would re-arm it
    act(() => {
      scrollAnimationState.onEnd?.()
    })
    expect(scrollAnimationState.isAnimating).toBe(false)

    // Change scrollHeight in the DOM, then fire focus so the hook's
    // internal scrollHeightRef is updated
    Object.defineProperty(el, "scrollHeight", {
      configurable: true,
      value: 500,
    })

    act(() => {
      screen.getByRole("button", { name: "focus-target" }).focus()
    })

    // A scroll handler call now should NOT see a scrollHeight change
    // (since focus already synced the ref), so it won't re-arm animation
    act(() => {
      scrollSpyState.handler?.({ timeStampLow: Date.now() + 100 })
    })
    expect(scrollAnimationState.isAnimating).toBe(false)
  })

  it("ignores debounced scroll callbacks until after the ignore timestamp from scroll end", () => {
    render(<ScrollHarness active />)
    const el = screen.getByTestId("scroll-container")
    setScrollMetrics(el, {
      offsetHeight: 100,
      scrollHeight: 400,
      scrollTop: 50,
    })

    act(() => {
      scrollSpyState.handler?.({ timeStampLow: 0 })
    })

    let ignoreAfter = 0
    act(() => {
      scrollAnimationState.onEnd?.()
      ignoreAfter = Date.now()
    })

    act(() => {
      scrollSpyState.handler?.({ timeStampLow: ignoreAfter - 1 })
    })

    act(() => {
      scrollSpyState.handler?.({ timeStampLow: ignoreAfter + 1 })
    })

    expect(el.scrollTop).toBe(50)
  })

  it("calls setIsSticky(false) when onEnd runs while already not animating", () => {
    vi.useFakeTimers()
    render(<ScrollHarness active />)

    act(() => {
      scrollAnimationState.onEnd?.()
    })

    act(() => {
      scrollAnimationState.onEnd?.()
    })

    vi.runOnlyPendingTimers()
    expect(scrollAnimationState.isAnimating).toBe(false)
  })

  it("sets sticky back to true from the interval when content fits and sticky was false", () => {
    vi.useFakeTimers()
    const { rerender } = render(<ScrollHarness active tallContent />)

    act(() => {
      scrollAnimationState.onEnd?.()
    })

    act(() => {
      scrollSpyState.handler?.({ timeStampLow: Date.now() + 100 })
    })

    rerender(<ScrollHarness active tallContent={false} />)

    act(() => {
      vi.advanceTimersByTime(17)
    })

    const el = screen.getByTestId("scroll-container")
    expect(el.scrollHeight).toBeLessThanOrEqual(el.offsetHeight)
  })

  it("clears stickiness after animation end when the user is scrolled away from the bottom", () => {
    vi.useFakeTimers()
    render(<ScrollHarness active />)
    const el = screen.getByTestId("scroll-container")

    act(() => {
      scrollSpyState.handler?.({ timeStampLow: Date.now() + 10 })
    })

    act(() => {
      scrollAnimationState.onEnd?.()
    })

    setScrollMetrics(el, {
      offsetHeight: 100,
      scrollHeight: 400,
      scrollTop: 50,
    })

    act(() => {
      scrollSpyState.handler?.({ timeStampLow: Date.now() + 20 })
    })

    act(() => {
      scrollSpyState.handler?.({ timeStampLow: Date.now() + 30 })
    })

    expect(isAtBottom(el)).toBe(false)
  })

  it("re-arms animation when scrollHeight changes while sticky (synthetic scroll)", () => {
    render(<ScrollHarness active />)
    const el = screen.getByTestId("scroll-container")

    // Prime dimension refs
    act(() => {
      scrollSpyState.handler?.({ timeStampLow: Date.now() + 10 })
    })

    // Stop animation so the synthetic-scroll branch has a visible effect
    act(() => {
      scrollAnimationState.onEnd?.()
    })
    expect(scrollAnimationState.isAnimating).toBe(false)

    // Change scrollHeight to simulate new content
    Object.defineProperty(el, "scrollHeight", {
      configurable: true,
      value: 450,
    })

    // The handler should detect the dimension change and re-arm animation
    act(() => {
      scrollSpyState.handler?.({ timeStampLow: Date.now() + 20 })
    })

    expect(scrollAnimationState.isAnimating).toBe(true)
  })

  it("keeps sticky when offsetHeight changes while sticky (synthetic layout)", () => {
    render(<ScrollHarness active />)

    act(() => {
      scrollAnimationState.onEnd?.()
    })

    const el = screen.getByTestId("scroll-container")

    act(() => {
      scrollSpyState.handler?.({ timeStampLow: Date.now() + 20 })
    })

    Object.defineProperty(el, "offsetHeight", {
      configurable: true,
      value: 120,
    })

    act(() => {
      scrollSpyState.handler?.({ timeStampLow: Date.now() + 30 })
    })

    expect(isAtBottom(el)).toBe(true)
  })

  it("restores animating and sticky when not at bottom but sticky and dimensions change", () => {
    render(<ScrollHarness active />)
    const el = screen.getByTestId("scroll-container")

    setScrollMetrics(el, {
      offsetHeight: 100,
      scrollHeight: 400,
      scrollTop: 50,
    })

    act(() => {
      scrollSpyState.handler?.({ timeStampLow: Date.now() + 10 })
    })

    Object.defineProperty(el, "scrollHeight", {
      configurable: true,
      value: 500,
    })

    act(() => {
      scrollSpyState.handler?.({ timeStampLow: Date.now() + 20 })
    })

    expect(isAtBottom(el)).toBe(false)
  })

  it("re-arms scroll animation after sticky stays true while not at bottom past the decision window", () => {
    vi.useFakeTimers()
    render(<ScrollHarness active />)
    const el = screen.getByTestId("scroll-container")

    act(() => {
      scrollAnimationState.onEnd?.()
    })
    expect(scrollAnimationState.isAnimating).toBe(false)

    setScrollMetrics(el, {
      offsetHeight: 100,
      scrollHeight: 400,
      scrollTop: 50,
    })

    act(() => {
      vi.advanceTimersByTime(120)
    })

    expect(scrollAnimationState.isAnimating).toBe(true)
  })
})
