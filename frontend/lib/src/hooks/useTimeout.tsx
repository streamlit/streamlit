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

type UseTimeoutReturn = {
  clear: () => void
  restart: (timeoutMsOverride?: number | null) => void
}

type UseTimeoutOptions = {
  /**
   * Whether to automatically schedule a timeout on mount and when timeoutMs
   * changes. When false, call `restart` to schedule manually.
   */
  autoStart?: boolean
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
 * @param options optional timeout behavior configuration
 * @param options.autoStart when true (default), schedules a timeout automatically
 * when mounted and when timeoutMs changes. When false, the timeout is only
 * scheduled when `restart` is called; changing timeoutMs will NOT cancel a
 * pending manually-started timeout.
 * @returns an object with clear and restart functions to control the timeout.
 * `restart` optionally accepts a one-off timeout override in milliseconds.
 */
function useTimeout(
  callback: () => void,
  timeoutMs: number | null,
  options: UseTimeoutOptions = {}
): UseTimeoutReturn {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef<() => void>(callback)
  const timeoutMsRef = useRef(timeoutMs)
  const { autoStart = true } = options

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    timeoutMsRef.current = timeoutMs
  }, [timeoutMs])

  const clear = useCallback((): void => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const setupTimeout = useCallback(
    (timeoutMsOverride?: number | null): void => {
      clear()
      const ms =
        timeoutMsOverride === undefined
          ? timeoutMsRef.current
          : timeoutMsOverride
      if (ms !== null) {
        // eslint-disable-next-line no-restricted-globals -- This hook is the centralized wrapper around setTimeout.
        timeoutRef.current = setTimeout(() => {
          callbackRef.current()
        }, ms)
      }
    },
    [clear]
  )

  // Auto-start: schedule on mount and when timeoutMs changes.
  // When autoStart is false, the effect returns early without registering
  // cleanup, so changing timeoutMs does not cancel manually-started timeouts.
  useEffect(() => {
    if (!autoStart) {
      return
    }
    setupTimeout()
    return clear
  }, [autoStart, timeoutMs, setupTimeout, clear])

  // Unconditional unmount cleanup: ensures manually-started timeouts
  // (autoStart: false) are cancelled when the host component unmounts.
  useEffect(() => clear, [clear])

  const restart = useCallback(
    (timeoutMsOverride?: number | null) => {
      setupTimeout(timeoutMsOverride)
    },
    [setupTimeout]
  )

  return { clear, restart }
}

export default useTimeout
