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

/**
 * Animation handle returned by animateHeight.
 * Provides cancel capability and completion promise.
 */
export interface AnimationHandle {
  /** Cancel the running animation */
  cancel: () => void
  /** Promise that resolves when animation completes (finish or cancel) */
  finished: Promise<void>
}

/** Default animation duration in milliseconds */
const DEFAULT_DURATION = 500

/** Default easing function for smooth animation */
const DEFAULT_EASING = "cubic-bezier(0.23, 1, 0.32, 1)"

/**
 * Safety net against stalled Web-Animations effects (issue #16027): some rapid
 * open/close + resize sequences leave an animation "running" but stalled — never
 * advancing, never firing `finish` — which permanently holds `<details>` at a
 * clipped height with `overflow: hidden`. If an animation is still running this
 * many ms past its duration, `animateHeight` force-finishes it so the normal
 * `finish` cleanup runs. Generous so it never fires for a healthy animation.
 */
const STALL_GUARD_BUFFER_MS = 1000

/**
 * Animate an element's height using the Web Animations API.
 *
 * IMPORTANT: On cancel, styles are NOT cleared. The caller is responsible
 * for setting new styles after cancelling (typically to lock at current height
 * before starting a new animation).
 *
 * On finish, styles ARE cleared to allow natural layout. A stall guard force-
 * finishes the animation if it is still active well past its duration, so a
 * stuck Web-Animations effect can never leave the element permanently clipped
 * (issue #16027).
 *
 * @param element - The HTML element to animate
 * @param from - Starting height in pixels
 * @param to - Target height in pixels
 * @param options - Optional configuration
 * @returns AnimationHandle with cancel() and finished promise
 */
export function animateHeight(
  element: HTMLElement,
  from: number,
  to: number,
  options: {
    duration?: number
    easing?: string
    onFinish?: () => void
  } = {}
): AnimationHandle {
  const {
    duration = DEFAULT_DURATION,
    easing = DEFAULT_EASING,
    onFinish,
  } = options

  const animation = element.animate(
    { height: [`${from}px`, `${to}px`] },
    { duration, easing }
  )

  /** Safety net for stalled animations; see STALL_GUARD_BUFFER_MS. Cleared on finish/cancel. */
  // eslint-disable-next-line no-restricted-globals -- Framework-agnostic animation utility manages its own timer; useTimeout is React-only.
  const stallGuard = setTimeout(() => {
    if (animation.playState !== "finished" && animation.playState !== "idle") {
      animation.finish()
    }
  }, duration + STALL_GUARD_BUFFER_MS)

  const finished = new Promise<void>(resolve => {
    animation.addEventListener("finish", () => {
      clearTimeout(stallGuard)
      // Clean up styles on successful finish
      element.style.height = ""
      element.style.overflow = ""
      onFinish?.()
      resolve()
    })

    animation.addEventListener("cancel", () => {
      clearTimeout(stallGuard)
      // DON'T clean up on cancel - caller will set new styles
      resolve()
    })
  })

  return {
    cancel: () => animation.cancel(),
    finished,
  }
}
