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

import { type RefObject, useEffect, useRef } from "react"

import {
  type EChartsOptionObject,
  insideDataZoomCapturesWheel,
  insideDataZoomConsumesWheelEvent,
  insideDataZoomWheelSkipsSettle,
  optionHasWheelRoam,
  wheelRoamSkipsSettle,
} from "./CustomTheme"

/**
 * Wheels closer together than this belong to one flick, including the
 * inertia tail of a trackpad scroll.
 */
export const WHEEL_GESTURE_GAP_MS = 200

/**
 * The pointer must rest on the chart this long before a new wheel gesture
 * zooms. Long enough that the flick after a page scroll runs into the chart
 * still scrolls the page.
 */
export const WHEEL_SETTLE_MS = 400

/** Gesture state for one chart. Times are ``performance.now()`` milliseconds. */
export interface ChartWheelGesture {
  /** When the pointer entered the chart. Null while it is outside. */
  enteredAt: number | null
  /** When a new flick may zoom. Null while no rest period is running. */
  zoomArmedAt: number | null
  /** Whether the current flick zooms. Null until that flick's first wheel. */
  gestureZooms: boolean | null
}

export function createChartWheelGesture(): ChartWheelGesture {
  return { enteredAt: null, zoomArmedAt: null, gestureZooms: null }
}

export function noteChartPointerEntered(
  gesture: ChartWheelGesture,
  now: number,
  lastWheelAt: number
): void {
  gesture.enteredAt = now
  gesture.gestureZooms = null
  const flickInProgress =
    lastWheelAt > 0 && now - lastWheelAt < WHEEL_GESTURE_GAP_MS
  // The chart slid under a flick. Start the rest clock only once that flick
  // goes idle.
  gesture.zoomArmedAt = flickInProgress ? null : now + WHEEL_SETTLE_MS
}

export function noteChartPointerLeft(gesture: ChartWheelGesture): void {
  gesture.enteredAt = null
  gesture.zoomArmedAt = null
  gesture.gestureZooms = null
}

/**
 * True when this wheel should scroll the page instead of reaching ECharts.
 *
 * The choice sticks for the whole flick. A flick that started as a page
 * scroll stays one, including wheels that land after the chart moves under
 * the cursor. The next flick zooms only after the pointer has rested.
 */
export function chartWheelPassesToPage(
  gesture: ChartWheelGesture,
  args: {
    now: number
    previousWheelAt: number
    /** This wheel would zoom or pan if ECharts saw it. */
    consumes: boolean
    /** Pinch, or the modifier configured for wheel zoom or pan. */
    explicitGesture: boolean
  }
): boolean {
  const { now, previousWheelAt, consumes, explicitGesture } = args
  const gap =
    previousWheelAt > 0 ? now - previousWheelAt : Number.POSITIVE_INFINITY
  const latched = gesture.gestureZooms
  if (latched !== null && gap < WHEEL_GESTURE_GAP_MS) {
    return !latched
  }

  const enteredAt = gesture.enteredAt
  if (enteredAt === null) {
    // No pointerenter yet: the chart mounted under the cursor, or hover has
    // not caught up. An ordinary wheel scrolls the page. A pinch or modifier
    // zooms now and leaves later flicks zooming too.
    const zooms = consumes && explicitGesture
    gesture.enteredAt = now
    gesture.gestureZooms = zooms
    gesture.zoomArmedAt = zooms ? now : null
    return !zooms
  }

  const enteredMidScroll = latched === null && gap < WHEEL_GESTURE_GAP_MS
  // Scroll the page when:
  // - this wheel would not zoom or pan, or
  // - the chart just slid under a page-scroll flick, unless the user is
  //   pinching or holding the configured modifier.
  if (!consumes || (enteredMidScroll && !explicitGesture)) {
    gesture.gestureZooms = false
    gesture.zoomArmedAt = null
    return true
  }

  if (explicitGesture) {
    // Leave the rest timer alone so an ordinary flick still waits.
    gesture.gestureZooms = true
    return false
  }

  let armedAt = gesture.zoomArmedAt
  if (armedAt === null) {
    // Start the rest at the later of pointerenter and the previous wheel, so
    // a flick that was already scrolling does not count time from enter.
    armedAt = Math.max(previousWheelAt, enteredAt) + WHEEL_SETTLE_MS
    gesture.zoomArmedAt = armedAt
  }
  const zooms = now >= armedAt
  gesture.gestureZooms = zooms
  if (!zooms) {
    // Too early. The next flick measures its rest from this one.
    gesture.zoomArmedAt = null
  }
  return !zooms
}

// Shared by every chart so a flick that starts on the page is still visible
// when a chart slides under the cursor. The window listener is capture-phase
// and runs before the chart listener: lastPageWheelAt is this wheel,
// previousPageWheelAt is the one before it.
let lastPageWheelAt = 0
let previousPageWheelAt = 0
let pageWheelSubscribers = 0

function recordPageWheel(): void {
  previousPageWheelAt = lastPageWheelAt
  lastPageWheelAt = performance.now()
}

function subscribePageWheelClock(): () => void {
  if (pageWheelSubscribers === 0) {
    window.addEventListener("wheel", recordPageWheel, {
      capture: true,
      passive: true,
    })
  }
  pageWheelSubscribers += 1
  let subscribed = true
  return () => {
    // Idempotent: a second call must not drop a listener another chart needs.
    if (!subscribed) {
      return
    }
    subscribed = false
    pageWheelSubscribers -= 1
    if (pageWheelSubscribers === 0) {
      window.removeEventListener("wheel", recordPageWheel, { capture: true })
    }
  }
}

/** Test hook. Production code has one clock for the life of the page. */
export function resetPageWheelClockForTests(): void {
  lastPageWheelAt = 0
  previousPageWheelAt = 0
}

/**
 * Keep page-scroll flicks from zooming an inside ``dataZoom``.
 *
 * ECharts calls ``preventDefault`` on every wheel over the plot. When the
 * flick should keep scrolling, this capture listener stops the event before
 * ECharts sees it and does not call ``preventDefault``, so the page still
 * scrolls.
 */
export function useInsideDataZoomWheelGuard(
  containerRef: RefObject<HTMLElement | null>,
  option: EChartsOptionObject | null
): void {
  const capturesWheel = insideDataZoomCapturesWheel(option)
  const optionRef = useRef(option)
  optionRef.current = option
  const gestureRef = useRef(createChartWheelGesture())

  useEffect(() => {
    const dom = containerRef.current
    if (!dom || !capturesWheel) {
      return
    }
    const unsubscribe = subscribePageWheelClock()
    const gesture = gestureRef.current
    const handleEnter = (): void => {
      noteChartPointerEntered(gesture, performance.now(), lastPageWheelAt)
    }
    const handleLeave = (): void => {
      noteChartPointerLeft(gesture)
    }
    const handleWheel = (event: WheelEvent): void => {
      const current = optionRef.current
      const passToPage = chartWheelPassesToPage(gesture, {
        now: performance.now(),
        previousWheelAt: previousPageWheelAt,
        consumes:
          insideDataZoomConsumesWheelEvent(current, event) ||
          optionHasWheelRoam(current),
        explicitGesture:
          insideDataZoomWheelSkipsSettle(current, event) ||
          wheelRoamSkipsSettle(current, event),
      })
      if (passToPage) {
        event.stopImmediatePropagation()
      }
    }
    dom.addEventListener("pointerenter", handleEnter)
    dom.addEventListener("pointerleave", handleLeave)
    // Capture on this ancestor runs before zrender's wheel listener on its
    // inner viewport. Passive: we never call preventDefault, so a stopped
    // wheel still scrolls the page.
    dom.addEventListener("wheel", handleWheel, {
      capture: true,
      passive: true,
    })
    return () => {
      noteChartPointerLeft(gesture)
      dom.removeEventListener("pointerenter", handleEnter)
      dom.removeEventListener("pointerleave", handleLeave)
      dom.removeEventListener("wheel", handleWheel, { capture: true })
      unsubscribe()
    }
  }, [containerRef, capturesWheel])
}
