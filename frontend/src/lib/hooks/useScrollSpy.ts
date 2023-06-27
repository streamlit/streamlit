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

import { useLayoutEffect, useMemo, useRef, useCallback } from "react"

/**
 * Creates a debounced function that delays invoking `fn` until after `ms`
 * milliseconds have passed since the last time the debounced function was
 * invoked.
 *
 * @param fn - A function to debounce. `fn` is called after the debounced
 * function has not been called for `ms` milliseconds.
 *
 * @param ms - The delay in milliseconds before `fn` is executed.
 *
 * The debounced function behaves as follows:
 * - It will be invoked immediately if 0 is passed for `ms`.
 * - It will be invoked immediately for the first call in any case.
 * - For subsequent calls, if less than `ms` milliseconds have passed since
 * the last invocation, a new invocation of `fn` is scheduled for `ms`
 * milliseconds after the last invocation.
 * - If it is invoked and `ms` milliseconds have passed since the last
 * invocation, `fn` is executed immediately and the timestamp is updated.
 * - If a new invocation of the debounced function is scheduled and it
 * is invoked again before the scheduled invocation, the scheduled
 * invocation is canceled and a new one is scheduled `ms` milliseconds
 * after the latest invocation.
 *
 * TODO: This has very similar but different behavior than our debounce function
 * in utils.ts. This behavior ensures that the debounced function is called on
 * some interval. Our other debounce function ensures that the function is
 * delayed until the user stops calling it. We should probably unify these
 *
 * @returns A debounced version of the `fn` function.
 */
export function debounce(
  fn: (...args: any[]) => void,
  ms: number
): (...args: any[]) => void {
  if (!ms) {
    return fn
  }

  let last = 0
  let timeout: ReturnType<typeof setTimeout> | null = null

  return (...args) => {
    const now = Date.now()

    if (now - last > ms) {
      fn(...args)
      last = now
    } else {
      if (timeout) {
        clearTimeout(timeout)
      }

      timeout = setTimeout(() => {
        fn(...args)
        last = Date.now()
      }, Math.max(0, ms - now + last))
    }
  }
}
const DEFAULT_DEBOUNCE_MS = 100

/**
 * A hook to add a scroll event listener to a target element with debouncing.
 *
 * @param target - The target HTMLElement to attach the scroll listener to.
 * @param eventHandler - The callback function to execute on scroll.
 *
 * The hook behaves as follows:
 * - The eventHandler callback is wrapped in a debounce function, which
 * ensures the callback is not executed too frequently.
 * - A scroll event listener is added to the target element on mount.
 * - A 'timeStampLow' property is added to the event object before it's
 * passed to the eventHandler.
 * - The scroll event listener is removed from the target when the component
 * unmounts.
 *
 * @returns void.
 */
export default function useScrollSpy(
  target: HTMLElement | null,
  eventHandler: ({ timeStampLow }: any) => void
): void {
  const onEventRef = useRef(eventHandler)

  const debouncer = useMemo(
    () =>
      debounce(event => {
        onEventRef.current(event)
      }, DEFAULT_DEBOUNCE_MS),
    [onEventRef]
  )

  const handleEvent = useCallback(
    event => {
      event.timeStampLow = Date.now()

      debouncer(event)
    },
    [debouncer]
  )

  useLayoutEffect(() => {
    if (!target) {
      return () => {}
    }

    target.addEventListener("scroll", handleEvent, { passive: true })
    handleEvent({ target })

    return () => target.removeEventListener("scroll", handleEvent)
  }, [handleEvent, target])
}
