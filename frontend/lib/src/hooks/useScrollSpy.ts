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

import { useCallback, useEffect, useLayoutEffect, useRef } from "react"

import useTimeout from "./useTimeout"

const DEFAULT_DEBOUNCE_MS = 100

/** Scroll event augmented with a low-resolution timestamp for debouncing. */
interface ScrollSpyEvent {
  timeStampLow: number
  target: EventTarget | null
}

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
  eventHandler: (event: ScrollSpyEvent) => void,
  active: boolean
): void {
  const onEventRef = useRef(eventHandler)
  const lastInvocationRef = useRef(0)
  const pendingEventRef = useRef<ScrollSpyEvent>()

  useEffect(() => {
    onEventRef.current = eventHandler
  }, [eventHandler])

  const { clear: cancelDebouncedEvent, restart: scheduleDebouncedEvent } =
    useTimeout(
      () => {
        if (!pendingEventRef.current) {
          return
        }

        onEventRef.current(pendingEventRef.current)
        pendingEventRef.current = undefined
        lastInvocationRef.current = Date.now()
      },
      DEFAULT_DEBOUNCE_MS,
      { autoStart: false }
    )

  const debouncer = useCallback(
    (event: ScrollSpyEvent) => {
      const now = Date.now()
      const elapsedMs = now - lastInvocationRef.current
      if (elapsedMs > DEFAULT_DEBOUNCE_MS) {
        cancelDebouncedEvent()
        pendingEventRef.current = undefined
        onEventRef.current(event)
        lastInvocationRef.current = now
        return
      }

      pendingEventRef.current = event
      scheduleDebouncedEvent(Math.max(0, DEFAULT_DEBOUNCE_MS - elapsedMs))
    },
    [cancelDebouncedEvent, scheduleDebouncedEvent]
  )

  const handleEvent = useCallback(
    (event: Event) => {
      const scrollSpyEvent: ScrollSpyEvent = {
        timeStampLow: Date.now(),
        target: event.target,
      }

      debouncer(scrollSpyEvent)
    },
    [debouncer]
  )

  useLayoutEffect(() => {
    if (!target || !active) {
      return () => {
        cancelDebouncedEvent()
        pendingEventRef.current = undefined
      }
    }

    target.addEventListener("scroll", handleEvent, { passive: true })
    debouncer({ timeStampLow: Date.now(), target })

    return () => {
      target.removeEventListener("scroll", handleEvent)
      cancelDebouncedEvent()
      pendingEventRef.current = undefined
    }
  }, [active, cancelDebouncedEvent, debouncer, handleEvent, target])
}
