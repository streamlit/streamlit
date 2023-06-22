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

import { useEffect, useRef, useCallback, RefObject } from "react"
import useScrollSpy from "./useScrollSpy"
import useScrollAnimation from "./useScrollAnimation"
import useStateRef from "./useStateRef"

export interface ScrollToBottomOptions {
  bottomThreshold?: number
  debounceMs?: number
}

const DEFAULT_BOTTOM_THRESHOLD = 1
const SCROLL_DECISION_DURATION = 34 // 2 frames
const MIN_CHECK_INTERVAL = 17 // 1 frame

function setImmediateInterval(fn: () => void, ms: number): NodeJS.Timeout {
  fn()

  return setInterval(fn, ms)
}

function isAtBottom({
  scrollHeight,
  offsetHeight,
  scrollTop,
}: HTMLElement): boolean {
  return scrollHeight - scrollTop - offsetHeight < DEFAULT_BOTTOM_THRESHOLD
}

/**
 * useScrollToBottom is a custom React hook managing automatic
 * scrolling behavior for an HTML element. It keeps the scroll view
 * at the bottom unless a user scrolls up, then stops auto-scroll.
 *
 * This hook returns a ref object attached to the HTML element.
 * It maintains several pieces of state:
 * - isSticky: a boolean for whether the scroll position should
 *   "stick" to the bottom.
 * - isAnimating: a boolean for whether the scroll view is animating.
 *
 * It has two major functions:
 * - handleScrollToBottomFinished: resets stickiness if necessary.
 * - handleScroll: adjusts isSticky based on user scroll behavior.
 *
 * The hook includes side effects with the useEffect hook:
 * - The first effect sets an interval to check the scroll position
 *   and adjust stickiness and animating state.
 * - The second effect attaches a focus event listener to update
 *   the scrollHeight value.
 */
function useScrollToBottom<T extends HTMLElement>(): RefObject<T> {
  const scrollableRef = useRef<T>(null)
  const [isSticky, setIsSticky, isStickyRef] = useStateRef(false)
  const [isAnimating, setIsAnimating, isAnimatingRef] = useStateRef(true)

  // Internal context
  const ignoreScrollEventBeforeRef = useRef(0)
  const offsetHeightRef = useRef(0)
  const scrollHeightRef = useRef(0)

  // Once, we have determined we are at the bottom, we can reset
  // the ignoring of scroll events.
  const handleScrollToBottomFinished = useCallback(() => {
    ignoreScrollEventBeforeRef.current = Date.now()

    // handleScrollToBottomFinished may end at a position which should lose stickiness.
    // In that case, we will need to set sticky to false to stop the interval check.
    if (!isAnimatingRef.current) {
      // Essentially we are not suppose to be animating cause a scroll
      // occurred before we finished animating.
      setIsSticky(false)
    }

    setIsAnimating(false)
  }, [ignoreScrollEventBeforeRef, isAnimatingRef, setIsAnimating, setIsSticky])

  const handleScroll = useCallback(
    ({ timeStampLow }) => {
      const { current: target } = scrollableRef
      const animating = isAnimatingRef.current

      // Currently, there are no reliable way to check if the "scroll" event is trigger due to
      // user gesture, programmatic scrolling, or Chrome-synthesized "scroll" event to compensate size change.
      // Thus, we use our best-effort to guess if it is triggered by user gesture, and disable sticky if it is heading towards the start direction.

      if (timeStampLow <= ignoreScrollEventBeforeRef.current || !target) {
        // Since we debounce "scroll" event, this handler might be called after spineTo.onEnd (a.k.a. artificial scrolling).
        // We should ignore debounced event fired after scrollEnd, because without skipping them, the userInitiatedScroll calculated below will not be accurate.
        // Thus, on a fast machine, adding elements super fast will lose the "stickiness".

        return
      }

      const atBottom = isAtBottom(target)

      // Chrome will emit "synthetic" scroll event if the container is resized or an element is added
      // We need to ignore these "synthetic" events
      const {
        offsetHeight: nextOffsetHeight,
        scrollHeight: nextScrollHeight,
      } = target
      const { current: offsetHeight } = offsetHeightRef
      const { current: scrollHeight } = scrollHeightRef
      const offsetHeightChanged = nextOffsetHeight !== offsetHeight
      const scrollHeightChanged = nextScrollHeight !== scrollHeight

      if (offsetHeightChanged) {
        offsetHeightRef.current = nextOffsetHeight
      }

      if (scrollHeightChanged) {
        scrollHeightRef.current = nextScrollHeight
      }

      // Sticky means:
      // - If it is scrolled programatically, we are still in sticky mode
      // - If it is scrolled by the user, then sticky means if we are at the end

      // Only update stickiness if the scroll event is not due to synthetic scroll done by Chrome
      if (!offsetHeightChanged && !scrollHeightChanged) {
        // We are sticky if we are animating to the end, or we are already at the end.
        // We can be "animating but not sticky" by calling "scrollTo(100)" where the container scrollHeight is 200px.
        const nextSticky = animating || atBottom

        if (isStickyRef.current !== nextSticky) {
          setIsSticky(nextSticky)
        }
      } else if (isStickyRef.current) {
        setIsAnimating(true)
        setIsSticky(true)
      }
    },
    [
      ignoreScrollEventBeforeRef,
      offsetHeightRef,
      scrollHeightRef,
      isAnimatingRef,
      isStickyRef,
      setIsAnimating,
      setIsSticky,
    ]
  )

  useEffect(() => {
    if (scrollableRef.current) {
      let stickyButNotAtEndSince = 0

      const timeout = setImmediateInterval(() => {
        const { current: target } = scrollableRef
        const animating = isAnimatingRef.current

        if (isStickyRef.current && target) {
          if (!isAtBottom(target)) {
            if (!stickyButNotAtEndSince) {
              stickyButNotAtEndSince = Date.now()
            } else if (
              Date.now() - stickyButNotAtEndSince >
              SCROLL_DECISION_DURATION
            ) {
              // Quirks: In Firefox, after user scroll down, Firefox do two things:
              //         1. Set to a new "scrollTop"
              //         2. Fire "scroll" event
              //         For what we observed, #1 is fired about 20ms before #2. There is a chance that this stickyCheckTimeout is being scheduled between 1 and 2.
              //         That means, if we just look at #1 to decide if we should scroll, we will always scroll, in oppose to the user's intention.
              // Repro: Open Firefox, set checkInterval to a lower number, and try to scroll by dragging the scroll handler. It will jump back.

              // The "animating" check will make sure stickiness is not lost when elements are adding at a very fast pace.
              if (!animating) {
                setIsAnimating(true)
                setIsSticky(true)
              }

              stickyButNotAtEndSince = 0
            }
          } else {
            stickyButNotAtEndSince = 0
          }
        } else if (
          target &&
          target.scrollHeight <= target.offsetHeight &&
          !isStickyRef.current
        ) {
          // When the container is emptied, we will set sticky back to true.
          setIsSticky(true)
        }
      }, MIN_CHECK_INTERVAL)

      return () => clearInterval(timeout)
    }
  }, [
    scrollableRef,
    isSticky,
    isAnimating,
    isAnimatingRef,
    isStickyRef,
    setIsSticky,
    setIsAnimating,
  ])

  useEffect(() => {
    // We need to update the "scrollHeight" value to latest when the user do a focus inside the box.
    //
    // This is because:
    // - In our code that mitigate Chrome synthetic scrolling, that code will look at whether "scrollHeight" value is latest or not.
    // - That code only run on "scroll" event.
    // - That means, on every "scroll" event, if the "scrollHeight" value is not latest, we will skip modifying the stickiness.
    // - That means, if the user "focus" to an element that cause the scroll view to scroll to the bottom, the user agent will fire "scroll" event.
    //   Since the "scrollHeight" is not latest value, this "scroll" event will be ignored and stickiness will not be modified.
    // - That means, if the user "focus" to a newly added element that is at the end of the scroll view, the "scroll to bottom" button will continue to show.
    const target = scrollableRef.current
    if (target) {
      const handleFocus = (): void => {
        scrollHeightRef.current = target.scrollHeight
      }

      target.addEventListener("focus", handleFocus, {
        capture: true,
        passive: true,
      })

      return () => target.removeEventListener("focus", handleFocus)
    }
  }, [scrollableRef])

  useScrollSpy(scrollableRef.current, handleScroll)
  useScrollAnimation(
    scrollableRef.current,
    handleScrollToBottomFinished,
    isAnimating
  )

  return scrollableRef
}

export default useScrollToBottom
