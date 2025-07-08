/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

/**
 * Interface for the return value of the useDebouncedCallback hook.
 */
interface UseDebouncedCallbackReturn<A extends unknown[]> {
  /**
   * The debounced callback function.
   */
  debouncedCallback: (...args: A) => void
  /**
   * A function to cancel any pending invocation of the debounced callback.
   */
  cancel: () => void
}

/**
 * A custom hook that provides a debounced callback function and a cancel function.
 *
 * The debounced callback will only execute after a specified delay has passed
 * since the last time it was invoked. This can be useful for preventing
 * expensive operations from being called too frequently, such as API calls
 * triggered by user input.
 *
 * The cancel function can be used to cancel any pending invocation of the
 * debounced callback.
 *
 * @param {function} callback - The function to be debounced.
 * @param {number} delay - The delay in milliseconds.
 * @returns {UseDebouncedCallbackReturn<A>} An object containing the debounced callback function and the cancel function.
 *
 * @example
 * const { debouncedCallback, cancel } = useDebouncedCallback(
 *   (value) => console.log('Debounced value:', value),
 *   500
 * );
 *
 * // Call the debounced function:
 * debouncedCallback('some value');
 *
 * // Cancel any pending invocation:
 * cancel();
 */
export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delay: number
): UseDebouncedCallbackReturn<A> {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const argsRef = useRef<A>()

  const cancel = useCallback((): void => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  // Clear all timeouts when the component unmounts
  useEffect(() => cancel, [cancel])

  const debouncedCallback = useCallback(
    (...args: A) => {
      argsRef.current = args

      cancel()

      timeoutRef.current = setTimeout(() => {
        if (argsRef.current) {
          callback(...argsRef.current)
          argsRef.current = undefined
        }
      }, delay)
    },
    [callback, delay, cancel]
  )

  return {
    debouncedCallback,
    cancel,
  }
}
