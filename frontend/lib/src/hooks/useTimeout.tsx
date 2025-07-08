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
 * Call setTimeout with the passed callback and timeout in milliseconds.
 * The timeout can be cleared by calling the returned clear-function.
 *
 * A new timeout will be set when the passed timeoutMs changes.
 *
 * @param callback to be called when the timeout delay is over
 * @param timeoutMs the delay in milliseconds after which the timeout callback is called
 * @returns a memoized clear (stable reference across re-runs) function to stop the timeout
 */
function useTimeout(callback: () => void, timeoutMs: number): () => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef<() => void>(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      callbackRef.current()
    }, timeoutMs)

    return () => {
      if (!timeoutRef.current) {
        return
      }
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [timeoutMs])

  const clear = useCallback(() => {
    if (!timeoutRef.current) {
      return
    }
    clearTimeout(timeoutRef.current)
  }, [])

  return clear
}

export default useTimeout
