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

import { useCallback, useEffect, useRef } from "react"

import useTimeout from "./useTimeout"

interface UseThrottledCallbackReturn<A extends unknown[]> {
  /** The throttled callback function. */
  throttledCallback: (...args: A) => void
  /** Cancel any pending trailing call. */
  cancel: () => void
}

/**
 * A custom hook that provides a throttled callback function.
 *
 * The throttled callback executes immediately on the first call, then at most
 * once per delay period. If called during the cooldown period, the latest args
 * are saved and executed once the cooldown ends (trailing call).
 *
 * @param callback - The function to be throttled.
 * @param delay - The minimum delay in milliseconds between executions.
 * @returns An object containing the throttled callback and cancel function.
 *
 * @example
 * const { throttledCallback, cancel } = useThrottledCallback(
 *   (value) => console.log('Throttled value:', value),
 *   100
 * );
 *
 * // First call executes immediately
 * throttledCallback('first');
 *
 * // Calls during cooldown are saved; only the last one executes after delay
 * throttledCallback('second');
 * throttledCallback('third'); // This one will execute after 100ms
 */
export function useThrottledCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delay: number
): UseThrottledCallbackReturn<A> {
  const pendingArgsRef = useRef<A | null>(null)
  const isThrottledRef = useRef(false)
  const callbackRef = useRef(callback)
  /**
   * Holds the restart function from useTimeout. Populated by the effect below
   * after the first render. The optional chaining in onTimeoutComplete is
   * defensive but effectively unreachable since the timer can only fire after
   * the effect that sets this ref has run.
   */
  const restartRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const onTimeoutComplete = useCallback(() => {
    isThrottledRef.current = false
    if (pendingArgsRef.current !== null) {
      const args = pendingArgsRef.current
      pendingArgsRef.current = null
      callbackRef.current(...args)
      isThrottledRef.current = true
      restartRef.current?.()
    }
  }, [])

  const { clear, restart } = useTimeout(onTimeoutComplete, delay, {
    autoStart: false,
  })

  /** Keep restart ref in sync with the latest useTimeout reference. */
  useEffect(() => {
    restartRef.current = restart
  }, [restart])

  const cancel = useCallback((): void => {
    clear()
    pendingArgsRef.current = null
    isThrottledRef.current = false
  }, [clear])

  const throttledCallback = useCallback(
    (...args: A) => {
      if (!isThrottledRef.current) {
        callbackRef.current(...args)
        isThrottledRef.current = true
        restart()
      } else {
        pendingArgsRef.current = args
      }
    },
    [restart]
  )

  return {
    throttledCallback,
    cancel,
  }
}
