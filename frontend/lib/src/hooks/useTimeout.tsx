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

export type UseTimeoutReturn = {
  clear: () => void
  restart: () => void
}

/**
 * Call setTimeout with the passed callback and timeout in milliseconds. The
 * timeout can be cleared by calling the returned clear function or restarted
 * by calling the returned restart function.
 *
 * A new timeout will be set when the passed timeoutMs changes. If timeoutMs is
 * null, no timeout will be set. If timeoutMs changes from null to a number, the
 * timeout will start. If timeoutMs changes from a number to null, the timeout
 * will be cleared.
 *
 * @param callback to be called when the timeout delay is over
 * @param timeoutMs the delay in milliseconds after which the timeout callback
 * is called, or null to disable timeout
 * @returns an object with clear and restart functions to control the timeout
 */
function useTimeout(
  callback: () => void,
  timeoutMs: number | null
): UseTimeoutReturn {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef<() => void>(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const setupTimeout = useCallback(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Only set timeout if timeoutMs is not null
    if (timeoutMs !== null) {
      timeoutRef.current = setTimeout(() => {
        callbackRef.current()
      }, timeoutMs)
    }
  }, [timeoutMs])

  useEffect(() => {
    setupTimeout()

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [setupTimeout])

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const restart = useCallback(() => {
    setupTimeout()
  }, [setupTimeout])

  return { clear, restart }
}

export default useTimeout
