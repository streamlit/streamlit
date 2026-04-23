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
 * Animate an element's height using the Web Animations API.
 *
 * IMPORTANT: On cancel, styles are NOT cleared. The caller is responsible
 * for setting new styles after cancelling (typically to lock at current height
 * before starting a new animation).
 *
 * On finish, styles ARE cleared to allow natural layout.
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

  const finished = new Promise<void>(resolve => {
    animation.addEventListener("finish", () => {
      // Clean up styles on successful finish
      element.style.height = ""
      element.style.overflow = ""
      onFinish?.()
      resolve()
    })

    animation.addEventListener("cancel", () => {
      // DON'T clean up on cancel - caller will set new styles
      resolve()
    })
  })

  return {
    cancel: () => animation.cancel(),
    finished,
  }
}
