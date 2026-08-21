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

import { RefObject, useCallback, useEffect, useRef, useState } from "react"

/**
 * Pixel slack so floating-point scrollWidth/clientWidth rounding does not
 * flicker overflow affordances at the ends of the range.
 */
const SCROLL_TOLERANCE = 1

export type HorizontalScrollOverflow = {
  canScrollLeft: boolean
  canScrollRight: boolean
}

export type UseHorizontalScrollOverflowArgs = {
  /** The scrollport to observe. */
  elementRef: RefObject<HTMLElement | null>
  /** When false, both flags are false and no listeners are attached. */
  enabled: boolean
  /**
   * Remeasure when content that affects scrollWidth changes (option labels,
   * selected chips). Observer setup does not depend on this.
   */
  layoutKey?: unknown
}

/**
 * Track whether a horizontally scrollable element has overflow past either
 * edge. Shared by wrap=False pills, segmented control, and multiselect chips
 * (edge fade) and by tabs (scroll arrows).
 *
 * Drive CSS with `data-can-scroll-start` / `data-can-scroll-end` from the
 * returned flags. Listeners are omitted while `enabled` is false.
 *
 * @returns Whether the element can scroll further left and/or right.
 */
export function useHorizontalScrollOverflow({
  elementRef,
  enabled,
  layoutKey,
}: UseHorizontalScrollOverflowArgs): HorizontalScrollOverflow {
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const canScrollLeftRef = useRef(false)
  const canScrollRightRef = useRef(false)

  const applyFlags = useCallback(
    (nextLeft: boolean, nextRight: boolean): void => {
      // Skip setState when the affordance is unchanged so scroll/resize ticks
      // do not schedule redundant renders.
      if (canScrollLeftRef.current !== nextLeft) {
        canScrollLeftRef.current = nextLeft
        setCanScrollLeft(nextLeft)
      }
      if (canScrollRightRef.current !== nextRight) {
        canScrollRightRef.current = nextRight
        setCanScrollRight(nextRight)
      }
    },
    []
  )

  const updateScrollState = useCallback((): void => {
    const el = elementRef.current
    if (!el || !enabled) {
      applyFlags(false, false)
      return
    }

    // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Required for overflow tracking
    const { scrollLeft, scrollWidth, clientWidth } = el
    applyFlags(
      scrollLeft > SCROLL_TOLERANCE,
      scrollLeft + clientWidth < scrollWidth - SCROLL_TOLERANCE
    )
  }, [applyFlags, elementRef, enabled])

  useEffect(() => {
    if (!enabled) {
      applyFlags(false, false)
      return
    }

    const el = elementRef.current
    if (!el) return

    el.addEventListener("scroll", updateScrollState, { passive: true })
    const resizeObserver = new ResizeObserver(() => {
      updateScrollState()
    })
    resizeObserver.observe(el)

    return () => {
      el.removeEventListener("scroll", updateScrollState)
      resizeObserver.disconnect()
    }
  }, [applyFlags, enabled, elementRef, updateScrollState])

  useEffect(() => {
    if (!enabled) return
    // Measure after layout so scrollWidth reflects freshly rendered children
    // (React Aria collections can commit option nodes a frame later).
    const rafId = requestAnimationFrame(updateScrollState)
    return () => cancelAnimationFrame(rafId)
  }, [enabled, layoutKey, updateScrollState])

  return { canScrollLeft, canScrollRight }
}
