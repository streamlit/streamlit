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

import { createElement, MouseEvent } from "react"

import { act, render, renderHook, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import {
  useDetailsAnimation,
  UseDetailsAnimationOptions,
} from "./useDetailsAnimation"

/** Wrapper component that renders DOM elements wired to the hook's refs. */
function TestHarness(
  props: UseDetailsAnimationOptions
): ReturnType<typeof createElement> {
  const result = useDetailsAnimation(props)
  return createElement(
    "details",
    { ref: result.detailsRef, "data-testid": "details" },
    createElement(
      "summary",
      {
        ref: result.summaryRef,
        "data-testid": "summary",
        onClick: result.handleToggle,
      },
      props.label
    ),
    createElement(
      "div",
      { ref: result.contentRef, "data-testid": "content" },
      "Content"
    )
  )
}

/**
 * Mirrors how a step renders: without content there is no <details> at all, and
 * one is mounted only once the first child arrives.
 */
function StepHarness(
  props: UseDetailsAnimationOptions & { collapsible: boolean }
): ReturnType<typeof createElement> {
  const result = useDetailsAnimation(props)
  if (!props.collapsible) {
    return createElement("div", { "data-testid": "header" }, props.label)
  }
  return createElement(
    "details",
    { ref: result.detailsRef, "data-testid": "details" },
    createElement(
      "summary",
      {
        ref: result.summaryRef,
        "data-testid": "summary",
        onClick: result.handleToggle,
      },
      props.label
    ),
    createElement(
      "div",
      { ref: result.contentRef, "data-testid": "content" },
      "Content"
    )
  )
}

describe("useDetailsAnimation", () => {
  describe("initial state", () => {
    it("returns isOpen=true when backendExpanded is true", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: true,
          label: "Test",
        })
      )

      expect(result.current.isOpen).toBe(true)
    })

    it("returns isOpen=false when backendExpanded is false", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: false,
          label: "Test",
        })
      )

      expect(result.current.isOpen).toBe(false)
    })

    it("returns isOpen=false when backendExpanded is null", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: null,
          label: "Test",
        })
      )

      expect(result.current.isOpen).toBe(false)
    })

    it("returns isOpen=false when backendExpanded is undefined", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: undefined,
          label: "Test",
        })
      )

      expect(result.current.isOpen).toBe(false)
    })
  })

  describe("handleToggle", () => {
    it("toggles isOpen state from false to true", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: false,
          label: "Test",
        })
      )

      expect(result.current.isOpen).toBe(false)

      act(() => {
        const mockEvent = {
          preventDefault: vi.fn(),
        } as unknown as MouseEvent
        result.current.handleToggle(mockEvent)
      })

      expect(result.current.isOpen).toBe(true)
    })

    it("toggles isOpen state from true to false", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: true,
          label: "Test",
        })
      )

      expect(result.current.isOpen).toBe(true)

      act(() => {
        const mockEvent = {
          preventDefault: vi.fn(),
        } as unknown as MouseEvent
        result.current.handleToggle(mockEvent)
      })

      expect(result.current.isOpen).toBe(false)
    })

    it("calls onToggle callback with new state", () => {
      const onToggle = vi.fn()
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: false,
          label: "Test",
          onToggle,
        })
      )

      act(() => {
        const mockEvent = {
          preventDefault: vi.fn(),
        } as unknown as MouseEvent
        result.current.handleToggle(mockEvent)
      })

      expect(onToggle).toHaveBeenCalledWith(true)
    })

    it("does not call onToggle when not provided", () => {
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: false,
          label: "Test",
        })
      )

      // Should not throw when onToggle is undefined
      act(() => {
        const mockEvent = {
          preventDefault: vi.fn(),
        } as unknown as MouseEvent
        result.current.handleToggle(mockEvent)
      })

      expect(result.current.isOpen).toBe(true)
    })

    it("prevents default event behavior", () => {
      const preventDefault = vi.fn()
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: false,
          label: "Test",
        })
      )

      act(() => {
        const mockEvent = {
          preventDefault,
        } as unknown as MouseEvent
        result.current.handleToggle(mockEvent)
      })

      expect(preventDefault).toHaveBeenCalled()
    })

    it("handles rapid double-toggle correctly", () => {
      const onToggle = vi.fn()
      const { result } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: false,
          label: "Test",
          onToggle,
        })
      )

      expect(result.current.isOpen).toBe(false)

      // Simulate two rapid clicks before React re-renders
      act(() => {
        const mockEvent1 = {
          preventDefault: vi.fn(),
        } as unknown as MouseEvent
        const mockEvent2 = {
          preventDefault: vi.fn(),
        } as unknown as MouseEvent
        result.current.handleToggle(mockEvent1)
        result.current.handleToggle(mockEvent2)
      })

      // Should end up back at the original state (false -> true -> false)
      expect(result.current.isOpen).toBe(false)
      // Both toggles should have fired with correct values
      expect(onToggle).toHaveBeenCalledTimes(2)
      expect(onToggle).toHaveBeenNthCalledWith(1, true)
      expect(onToggle).toHaveBeenNthCalledWith(2, false)
    })
  })

  describe("backend sync", () => {
    it("syncs isOpen when backendExpanded changes", () => {
      const { result, rerender } = renderHook(
        ({ backendExpanded }) =>
          useDetailsAnimation({
            backendExpanded,
            label: "Test",
          }),
        { initialProps: { backendExpanded: false as boolean | null } }
      )

      expect(result.current.isOpen).toBe(false)

      rerender({ backendExpanded: true })

      expect(result.current.isOpen).toBe(true)
    })

    it("preserves current state when backendExpanded is null (ClearField)", () => {
      const { result, rerender } = renderHook(
        ({ backendExpanded }) =>
          useDetailsAnimation({
            backendExpanded,
            label: "Test",
          }),
        { initialProps: { backendExpanded: true as boolean | null } }
      )

      expect(result.current.isOpen).toBe(true)

      // User manually toggles closed
      act(() => {
        const mockEvent = {
          preventDefault: vi.fn(),
        } as unknown as MouseEvent
        result.current.handleToggle(mockEvent)
      })

      expect(result.current.isOpen).toBe(false)

      // Backend sends null (ClearField) - should NOT change state
      rerender({ backendExpanded: null })

      expect(result.current.isOpen).toBe(false)
    })

    it("preserves current state when backendExpanded becomes undefined", () => {
      const { result, rerender } = renderHook(
        ({ backendExpanded }) =>
          useDetailsAnimation({
            backendExpanded,
            label: "Test",
          }),
        {
          initialProps: {
            backendExpanded: true as boolean | null | undefined,
          },
        }
      )

      expect(result.current.isOpen).toBe(true)

      // Backend sends undefined - should NOT change state
      rerender({ backendExpanded: undefined })

      expect(result.current.isOpen).toBe(true)
    })

    it("resets state when label changes (new expander)", () => {
      const { result, rerender } = renderHook(
        ({ backendExpanded, label }) =>
          useDetailsAnimation({
            backendExpanded,
            label,
          }),
        {
          initialProps: {
            backendExpanded: true as boolean | null,
            label: "Old Label",
          },
        }
      )

      // Toggle to false locally
      act(() => {
        const mockEvent = {
          preventDefault: vi.fn(),
        } as unknown as MouseEvent
        result.current.handleToggle(mockEvent)
      })

      expect(result.current.isOpen).toBe(false)

      // Change label (simulates new expander) - should reset to backendExpanded
      rerender({ backendExpanded: true, label: "New Label" })

      expect(result.current.isOpen).toBe(true)
    })
  })

  describe("cleanup", () => {
    it("does not throw on unmount", () => {
      const { unmount } = renderHook(() =>
        useDetailsAnimation({
          backendExpanded: false,
          label: "Test",
        })
      )

      expect(() => unmount()).not.toThrow()
    })
  })

  describe("ResizeObserver", () => {
    let triggerResize: (() => void) | null
    let mockObserve: ReturnType<typeof vi.fn>
    let mockDisconnect: ReturnType<typeof vi.fn>
    const OriginalResizeObserver = globalThis.ResizeObserver

    function mockElementHeight(element: Element, height: number): void {
      vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
        x: 0,
        y: 0,
        width: 0,
        height,
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        toJSON: () => ({}),
      })
    }

    /** Assert that the ResizeObserver was constructed and fire its callback. */
    function fireResize(): void {
      expect(triggerResize).not.toBeNull()
      triggerResize?.()
    }

    beforeEach(() => {
      vi.useFakeTimers()
      triggerResize = null
      mockObserve = vi.fn()
      mockDisconnect = vi.fn()

      globalThis.ResizeObserver = class {
        constructor(cb: ResizeObserverCallback) {
          triggerResize = () => cb([], this as unknown as ResizeObserver)
        }

        observe = mockObserve

        unobserve = vi.fn()

        disconnect = mockDisconnect
      } as unknown as typeof ResizeObserver
    })

    afterEach(() => {
      vi.runOnlyPendingTimers()
      vi.useRealTimers()
      vi.restoreAllMocks()
      globalThis.ResizeObserver = OriginalResizeObserver
    })

    it("observes content element and disconnects on unmount", () => {
      const { unmount } = render(
        createElement(TestHarness, {
          backendExpanded: true,
          label: "Test",
        })
      )
      const content = screen.getByTestId("content")

      expect(mockObserve).toHaveBeenCalledWith(content)
      expect(mockDisconnect).not.toHaveBeenCalled()

      unmount()
      expect(mockDisconnect).toHaveBeenCalled()
    })

    it("does not trigger animation when details is closed", () => {
      render(
        createElement(TestHarness, {
          backendExpanded: false,
          label: "Test",
        })
      )
      ;(Element.prototype.animate as ReturnType<typeof vi.fn>).mockClear()

      fireResize()
      // Advance past debounce (50ms = RESIZE_DEBOUNCE_MS)
      vi.advanceTimersByTime(50)

      expect(Element.prototype.animate).not.toHaveBeenCalled()
    })

    it("observes content that only appears after the first render", () => {
      const { rerender } = render(
        createElement(StepHarness, {
          backendExpanded: true,
          label: "Test",
          collapsible: false,
        })
      )

      expect(mockObserve).not.toHaveBeenCalled()

      rerender(
        createElement(StepHarness, {
          backendExpanded: true,
          label: "Test",
          collapsible: true,
        })
      )

      const details = screen.getByTestId("details")
      const summary = screen.getByTestId("summary")
      const content = screen.getByTestId("content")
      mockElementHeight(details, 100)
      mockElementHeight(summary, 40)
      mockElementHeight(content, 200)
      ;(Element.prototype.animate as ReturnType<typeof vi.fn>).mockClear()

      expect(mockObserve).toHaveBeenCalledWith(content)

      fireResize()
      vi.advanceTimersByTime(50)

      expect(Element.prototype.animate).toHaveBeenCalledTimes(1)
    })

    it("debounces rapid resize events into a single animation", () => {
      render(
        createElement(TestHarness, {
          backendExpanded: true,
          label: "Test",
        })
      )

      const details = screen.getByTestId("details")
      const summary = screen.getByTestId("summary")
      const content = screen.getByTestId("content")

      // target = 40 + 200 + 2*1(BORDER_SIZE) = 242, current = 100, diff = 142 > 5
      mockElementHeight(details, 100)
      mockElementHeight(summary, 40)
      mockElementHeight(content, 200)
      ;(Element.prototype.animate as ReturnType<typeof vi.fn>).mockClear()

      // Three rapid resize events
      fireResize()
      fireResize()
      fireResize()

      // Before debounce expires — no animation yet
      expect(Element.prototype.animate).not.toHaveBeenCalled()

      // After debounce — exactly one animation
      vi.advanceTimersByTime(50)
      expect(Element.prototype.animate).toHaveBeenCalledTimes(1)
    })

    it("does not trigger animation during close mode (isOpenRef is false)", async () => {
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime,
      })

      render(
        createElement(TestHarness, {
          backendExpanded: true,
          label: "Test",
        })
      )

      // Click summary to toggle closed: sets isOpenRef.current = false synchronously.
      // details.open stays true because the mock animate never fires onFinish.
      await user.click(screen.getByTestId("summary"))

      const details = screen.getByTestId("details")
      const summary = screen.getByTestId("summary")
      const content = screen.getByTestId("content")

      // Dimensions that would trigger animation if guards didn't prevent it
      mockElementHeight(details, 100)
      mockElementHeight(summary, 40)
      mockElementHeight(content, 200)
      ;(Element.prototype.animate as ReturnType<typeof vi.fn>).mockClear()

      fireResize()
      vi.advanceTimersByTime(50)

      // No resize animation because isOpenRef.current is false
      expect(Element.prototype.animate).not.toHaveBeenCalled()
    })

    it("does not animate when height difference is within threshold", () => {
      render(
        createElement(TestHarness, {
          backendExpanded: true,
          label: "Test",
        })
      )

      const details = screen.getByTestId("details")
      const summary = screen.getByTestId("summary")
      const content = screen.getByTestId("content")

      // target = 40 + 58 + 2*1 = 100, current = 103, diff = 3 ≤ 5(RESIZE_THRESHOLD_PX)
      mockElementHeight(details, 103)
      mockElementHeight(summary, 40)
      mockElementHeight(content, 58)
      ;(Element.prototype.animate as ReturnType<typeof vi.fn>).mockClear()

      fireResize()
      vi.advanceTimersByTime(50)

      expect(Element.prototype.animate).not.toHaveBeenCalled()
    })

    // The target height is summary (40) + content (200), plus the border for
    // the default style. The compact and step styles draw no border.
    it.each<[string, boolean | undefined, string]>([
      ["includes the border in the target height", undefined, "242px"],
      ["omits the border for borderless styles", false, "240px"],
    ])("%s", (_description, hasBorder, expectedHeight) => {
      render(
        createElement(TestHarness, {
          backendExpanded: true,
          label: "Test",
          hasBorder,
        })
      )

      mockElementHeight(screen.getByTestId("details"), 100)
      mockElementHeight(screen.getByTestId("summary"), 40)
      mockElementHeight(screen.getByTestId("content"), 200)
      ;(Element.prototype.animate as ReturnType<typeof vi.fn>).mockClear()

      fireResize()
      vi.advanceTimersByTime(50)

      expect(Element.prototype.animate).toHaveBeenCalledWith(
        { height: ["100px", expectedHeight] },
        expect.anything()
      )
    })

    it("animates when height difference exceeds threshold", () => {
      render(
        createElement(TestHarness, {
          backendExpanded: true,
          label: "Test",
        })
      )

      const details = screen.getByTestId("details")
      const summary = screen.getByTestId("summary")
      const content = screen.getByTestId("content")

      // target = 40 + 200 + 2*1 = 242, current = 100, diff = 142 > 5(RESIZE_THRESHOLD_PX)
      mockElementHeight(details, 100)
      mockElementHeight(summary, 40)
      mockElementHeight(content, 200)
      ;(Element.prototype.animate as ReturnType<typeof vi.fn>).mockClear()

      fireResize()
      vi.advanceTimersByTime(50)

      expect(Element.prototype.animate).toHaveBeenCalledTimes(1)
    })

    it("clears the inline lock when content height is zero (no permanent clip)", async () => {
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime,
      })

      render(
        createElement(TestHarness, {
          backendExpanded: false,
          label: "Test",
        })
      )

      const details = screen.getByTestId("details")
      const summary = screen.getByTestId("summary")
      const content = screen.getByTestId("content")

      // Summary has height but content measures 0 (content hasn't laid out yet).
      // animateTo locks the height, then the zero-content branch must clear it.
      mockElementHeight(details, 42)
      mockElementHeight(summary, 40)
      mockElementHeight(content, 0)
      ;(Element.prototype.animate as ReturnType<typeof vi.fn>).mockClear()

      // Click to expand — animateTo(true) hits the contentHeight === 0 branch
      await user.click(screen.getByTestId("summary"))

      // No animation should have been started (nothing to animate to yet)
      expect(Element.prototype.animate).not.toHaveBeenCalled()
      // The lock must be CLEARED, not left in place: leaving overflow:hidden +
      // a fixed height with no animation to clear it is the permanent-clip bug
      // (issue #16027). The element sizes to its natural height instead.
      expect(details.style.height).toBe("")
      expect(details.style.overflow).toBe("")
      // Element is still open so the content renders once it lays out.
      expect(details).toHaveAttribute("open")
    })

    it("animates the reveal when content loads after a zero-content open", async () => {
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime,
      })

      render(
        createElement(TestHarness, {
          backendExpanded: false,
          label: "Test",
        })
      )

      const details = screen.getByTestId("details")
      const summary = screen.getByTestId("summary")
      const content = screen.getByTestId("content")

      // Initially: summary=40, content=0, details=42
      mockElementHeight(details, 42)
      mockElementHeight(summary, 40)
      mockElementHeight(content, 0)

      // Click to expand — contentHeight is 0, so the lock is cleared and no
      // animation starts yet.
      await user.click(screen.getByTestId("summary"))
      ;(Element.prototype.animate as ReturnType<typeof vi.fn>).mockClear()

      // Content loads: now content=200. The ResizeObserver reads the current
      // details height (42) and animates the reveal to the full height.
      mockElementHeight(content, 200)
      // target = 40 + 200 + 2*1 = 242, current = 42, diff = 200 > 5

      fireResize()
      vi.advanceTimersByTime(50)

      // ResizeObserver should trigger an animation from the current height to full
      expect(Element.prototype.animate).toHaveBeenCalledTimes(1)
    })

    it("clears the inline lock when the expander is replaced (label change)", async () => {
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime,
      })

      const { rerender } = render(
        createElement(TestHarness, {
          backendExpanded: true,
          label: "Old Label",
        })
      )

      const details = screen.getByTestId("details")
      const summary = screen.getByTestId("summary")
      const content = screen.getByTestId("content")

      mockElementHeight(details, 100)
      mockElementHeight(summary, 40)
      mockElementHeight(content, 200)

      // Toggle closed: locks height + overflow while the (mock) close animation
      // "runs" and never fires finish, so the lock persists on the node.
      await user.click(summary)
      expect(details.style.height).not.toBe("")
      expect(details.style.overflow).toBe("hidden")

      // A new expander reuses this <details> node (label change). cancelAnimation
      // must clear the stale lock so the reused node isn't left clipped from the
      // previous expander's interrupted animation (issue #16027).
      rerender(
        createElement(TestHarness, {
          backendExpanded: true,
          label: "New Label",
        })
      )

      expect(details.style.height).toBe("")
      expect(details.style.overflow).toBe("")
    })

    it("clears pending debounce timeout on unmount", () => {
      const { unmount } = render(
        createElement(TestHarness, {
          backendExpanded: true,
          label: "Test",
        })
      )

      const details = screen.getByTestId("details")
      const summary = screen.getByTestId("summary")
      const content = screen.getByTestId("content")

      mockElementHeight(details, 100)
      mockElementHeight(summary, 40)
      mockElementHeight(content, 200)
      ;(Element.prototype.animate as ReturnType<typeof vi.fn>).mockClear()

      // Start a resize (begins debounce timeout)
      fireResize()

      // Unmount before timeout fires
      unmount()

      // Advance past debounce — no animation should fire
      vi.advanceTimersByTime(50)

      expect(Element.prototype.animate).not.toHaveBeenCalled()
    })
  })
})
