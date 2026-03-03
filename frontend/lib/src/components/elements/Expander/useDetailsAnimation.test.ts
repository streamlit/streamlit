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
      } as DOMRect)
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

    it("locks inline styles when content height is zero so ResizeObserver can animate later", async () => {
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

      // Summary has height, but content returns 0 (e.g. widget mode where
      // content hasn't loaded yet)
      mockElementHeight(details, 42)
      mockElementHeight(summary, 40)
      mockElementHeight(content, 0)
      ;(Element.prototype.animate as ReturnType<typeof vi.fn>).mockClear()

      // Click to expand — animateTo(true) hits the contentHeight === 0 branch
      await user.click(screen.getByTestId("summary"))

      // No animation should have been started (nothing to animate to yet)
      expect(Element.prototype.animate).not.toHaveBeenCalled()
      // Inline styles should remain LOCKED so the ResizeObserver can later
      // animate from this height to the full content height once it loads
      expect(details.style.height).toBe("42px")
      expect(details.style.overflow).toBe("hidden")
      // Element should still be set to open for content to render
      expect(details).toHaveAttribute("open")
    })

    it("animates from locked height when content loads after zero-content open", async () => {
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

      // Click to expand — locks height at 42px (content is 0)
      await user.click(screen.getByTestId("summary"))
      ;(Element.prototype.animate as ReturnType<typeof vi.fn>).mockClear()

      // Content loads: now content=200, but details is still locked at 42px
      // (the ResizeObserver reads the locked details height)
      mockElementHeight(content, 200)
      // details stays locked at 42 since style.height="42px"
      // target = 40 + 200 + 2*1 = 242, current = 42, diff = 200 > 5

      fireResize()
      vi.advanceTimersByTime(50)

      // ResizeObserver should trigger an animation from locked height to full
      expect(Element.prototype.animate).toHaveBeenCalledTimes(1)
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
