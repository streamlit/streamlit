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

import { animateHeight } from "./animateHeight"

describe("animateHeight", () => {
  let element: HTMLDivElement
  let mockAnimation: {
    addEventListener: ReturnType<typeof vi.fn>
    cancel: ReturnType<typeof vi.fn>
    finish: ReturnType<typeof vi.fn>
    playState: AnimationPlayState
  }

  beforeEach(() => {
    vi.useFakeTimers()
    element = document.createElement("div")
    document.body.appendChild(element)

    // Mock the Web Animations API since JSDOM doesn't fully support it
    mockAnimation = {
      addEventListener: vi.fn(),
      cancel: vi.fn(),
      finish: vi.fn(),
      playState: "running",
    }
    element.animate = vi.fn().mockReturnValue(mockAnimation)
  })

  afterEach(() => {
    document.body.removeChild(element)
    vi.useRealTimers()
  })

  /** Look up an event listener registered on the mock animation. */
  const getListener = (event: string): (() => void) | undefined =>
    mockAnimation.addEventListener.mock.calls.find(
      call => call[0] === event
    )?.[1]

  describe("animation creation", () => {
    it("calls element.animate with height keyframes", () => {
      animateHeight(element, 0, 100)

      expect(element.animate).toHaveBeenCalledWith(
        { height: ["0px", "100px"] },
        { duration: 500, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
      )
    })

    it("uses custom duration when provided", () => {
      animateHeight(element, 0, 100, { duration: 300 })

      expect(element.animate).toHaveBeenCalledWith(
        { height: ["0px", "100px"] },
        { duration: 300, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
      )
    })

    it("uses custom easing when provided", () => {
      animateHeight(element, 0, 100, { easing: "ease-in-out" })

      expect(element.animate).toHaveBeenCalledWith(
        { height: ["0px", "100px"] },
        { duration: 500, easing: "ease-in-out" }
      )
    })
  })

  describe("cancel", () => {
    it("cancel() calls animation.cancel()", () => {
      const handle = animateHeight(element, 0, 100)

      handle.cancel()

      expect(mockAnimation.cancel).toHaveBeenCalled()
    })
  })

  describe("finish behavior", () => {
    it("registers finish event listener", () => {
      animateHeight(element, 0, 100)

      expect(mockAnimation.addEventListener).toHaveBeenCalledWith(
        "finish",
        expect.any(Function)
      )
    })

    it("clears styles and calls onFinish when animation finishes", () => {
      const onFinish = vi.fn()
      element.style.height = "50px"
      element.style.overflow = "hidden"

      animateHeight(element, 0, 100, { onFinish })

      // Get the finish callback
      const finishCall = mockAnimation.addEventListener.mock.calls.find(
        call => call[0] === "finish"
      )
      const finishCallback = finishCall?.[1]

      // Simulate finish
      finishCallback?.()

      expect(element.style.height).toBe("")
      expect(element.style.overflow).toBe("")
      expect(onFinish).toHaveBeenCalled()
    })

    it("resolves finished promise on finish", async () => {
      const handle = animateHeight(element, 0, 100)

      // Get the finish callback
      const finishCall = mockAnimation.addEventListener.mock.calls.find(
        call => call[0] === "finish"
      )
      const finishCallback = finishCall?.[1]

      // Simulate finish
      finishCallback?.()

      // Should resolve without throwing
      await expect(handle.finished).resolves.toBeUndefined()
    })
  })

  describe("cancel behavior", () => {
    it("registers cancel event listener", () => {
      animateHeight(element, 0, 100)

      expect(mockAnimation.addEventListener).toHaveBeenCalledWith(
        "cancel",
        expect.any(Function)
      )
    })

    it("does NOT clear styles on cancel (caller responsibility)", () => {
      element.style.height = "50px"
      element.style.overflow = "hidden"

      animateHeight(element, 0, 100)

      // Get the cancel callback
      const cancelCall = mockAnimation.addEventListener.mock.calls.find(
        call => call[0] === "cancel"
      )
      const cancelCallback = cancelCall?.[1]

      // Simulate cancel
      cancelCallback?.()

      // Styles should NOT be cleared - caller is responsible
      expect(element.style.height).toBe("50px")
      expect(element.style.overflow).toBe("hidden")
    })

    it("resolves finished promise on cancel", async () => {
      const handle = animateHeight(element, 0, 100)

      // Get the cancel callback
      const cancelCall = mockAnimation.addEventListener.mock.calls.find(
        call => call[0] === "cancel"
      )
      const cancelCallback = cancelCall?.[1]

      // Simulate cancel
      cancelCallback?.()

      // Should resolve without throwing
      await expect(handle.finished).resolves.toBeUndefined()
    })
  })

  describe("stall guard (issue #16027)", () => {
    it("force-finishes an animation still running well past its duration", () => {
      animateHeight(element, 0, 100, { duration: 500 })

      expect(mockAnimation.finish).not.toHaveBeenCalled()

      // Advance past duration + guard buffer.
      vi.advanceTimersByTime(1500)

      expect(mockAnimation.finish).toHaveBeenCalledTimes(1)
    })

    it("does not force-finish before the guard elapses", () => {
      animateHeight(element, 0, 100, { duration: 500 })

      // Just past the animation duration but before the guard fires.
      vi.advanceTimersByTime(600)

      expect(mockAnimation.finish).not.toHaveBeenCalled()
    })

    it.each<AnimationPlayState>(["finished", "idle"])(
      "does not force-finish an animation already in %s state",
      state => {
        animateHeight(element, 0, 100)
        mockAnimation.playState = state

        vi.advanceTimersByTime(1500)

        expect(mockAnimation.finish).not.toHaveBeenCalled()
      }
    )

    it("clears the guard when the animation finishes normally", () => {
      animateHeight(element, 0, 100)

      getListener("finish")?.()
      vi.advanceTimersByTime(1500)

      // finish() came from the browser event, not the guard force-finishing.
      expect(mockAnimation.finish).not.toHaveBeenCalled()
    })

    it("clears the guard when the animation is cancelled", () => {
      animateHeight(element, 0, 100)

      getListener("cancel")?.()
      vi.advanceTimersByTime(1500)

      expect(mockAnimation.finish).not.toHaveBeenCalled()
    })
  })
})
