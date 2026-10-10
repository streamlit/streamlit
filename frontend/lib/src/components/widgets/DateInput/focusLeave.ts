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

import {
  type MutableRefObject,
  type RefObject,
  useEffect,
  useRef,
} from "react"

/**
 * True when blur's `relatedTarget` is outside the popover (callers check the
 * field). `null` is not a leave; `document.body` is. Callers also skip blur
 * while a popover pointer is in progress.
 */
export function isConcreteOutsideLeave(
  relatedTarget: EventTarget | null,
  options: {
    popover: Node | null
    excludeSelectors?: readonly string[]
  }
): boolean {
  if (!(relatedTarget instanceof Node)) return false
  if (relatedTarget === document.body) return true
  if (options.popover?.contains(relatedTarget)) return false
  if (
    relatedTarget instanceof Element &&
    options.excludeSelectors?.some(sel => relatedTarget.closest(sel))
  ) {
    return false
  }
  return true
}

/** True when focus is still in the field, popover, or an excluded portal. */
export function isFocusInsideWidget(
  active: EventTarget | null,
  options: {
    field: Node | null
    popover: Node | null
    excludeSelectors?: readonly string[]
  }
): boolean {
  if (!(active instanceof Node)) return false
  if (options.field?.contains(active)) return true
  if (options.popover?.contains(active)) return true
  if (
    active instanceof Element &&
    options.excludeSelectors?.some(sel => active.closest(sel))
  ) {
    return true
  }
  return false
}

/** Tab leave callbacks: immediate (button/first segment) or after one frame. */
export type PassivePreviewTabLeave = {
  immediate: () => void
  afterFocusSettles: () => void
  beforeFocusSettles?: () => void
  focusStayedInside?: () => void
}

/**
 * Handles Tab while the passive preview is open. Returns true when this
 * helper handled the key. Does not call `preventDefault`.
 *
 * Forward Tab, and Shift+Tab from any segment except the first, wait one
 * frame so the caller can tell these apart:
 * - Focus moved to another segment (range start → end): keep the preview
 * - Focus moved to the calendar button: keep the preview
 * - Focus landed in the grid (Safari/Firefox skip the button): move it to the button
 * - Focus left the widget: close the preview
 *
 * `segmentSelector` must match `data-type` segments. On iOS those segments
 * are textboxes.
 */
export function handlePassivePreviewFieldTab(
  e: Pick<KeyboardEvent, "key" | "shiftKey" | "target">,
  ctx: {
    field: HTMLElement | null
    calendarButton: Node | null
    popover: Node | null
    excludeSelectors?: readonly string[]
    segmentSelector: string
  },
  leave: PassivePreviewTabLeave
): boolean {
  if (e.key !== "Tab") return false

  if (!e.shiftKey && ctx.calendarButton?.contains(e.target as Node)) {
    leave.immediate()
    return true
  }

  if (!ctx.field) return false
  const target = e.target
  if (!(target instanceof Node)) return false
  const segments = Array.from(
    ctx.field.querySelectorAll<HTMLElement>(ctx.segmentSelector)
  )
  const fromSegment = segments.some(
    segment => segment === target || segment.contains(target)
  )
  if (!fromSegment) return false

  // Shift+Tab from the first segment always leaves the widget, so close now.
  // Any other Tab can stay inside (range start → end, or Shift+Tab onto the
  // start field) or leave (Shift+Tab from a later segment of a single field).
  // Wait one frame and close only if focus left.
  if (
    e.shiftKey &&
    (target === segments[0] || segments[0]?.contains(target))
  ) {
    leave.immediate()
    return true
  }

  leave.beforeFocusSettles?.()
  requestAnimationFrame(() => {
    const active = document.activeElement
    // Browsers that skip buttons can Tab into the open grid — move to the button.
    if (
      active instanceof Node &&
      ctx.popover?.contains(active) &&
      !(
        ctx.calendarButton instanceof Node &&
        ctx.calendarButton.contains(active)
      )
    ) {
      if (ctx.calendarButton instanceof HTMLElement) {
        ctx.calendarButton.focus()
      }
      leave.focusStayedInside?.()
      return
    }
    if (
      isFocusInsideWidget(active, {
        field: ctx.field,
        popover: ctx.popover,
        excludeSelectors: ctx.excludeSelectors,
      })
    ) {
      leave.focusStayedInside?.()
      return
    }
    leave.afterFocusSettles()
  })
  return true
}

/**
 * Popover pointerdown flag so field blur (Safari, before click) is not a leave.
 * Clear on click/cancel — not pointerup (iOS fires pointerup before the blur).
 */
export function usePopoverInteractionFlag(
  isOpen: boolean,
  popoverRef: RefObject<HTMLElement | null>,
  excludeSelectors: readonly string[] = []
): MutableRefObject<boolean> {
  const popoverInteractionRef = useRef(false)
  const excludeSelectorsRef = useRef(excludeSelectors)
  excludeSelectorsRef.current = excludeSelectors

  useEffect(() => {
    if (!isOpen) {
      popoverInteractionRef.current = false
      return
    }

    const onPointerDown = (e: PointerEvent): void => {
      // Ignore non-primary presses (they never clear via `click`).
      if (e.button > 0) return
      const target = e.target
      if (!(target instanceof Node)) return
      // Native listeners see text nodes; normalize for closest().
      const el = target instanceof Element ? target : target.parentElement
      if (popoverRef.current?.contains(target)) {
        popoverInteractionRef.current = true
        return
      }
      if (el && excludeSelectorsRef.current.some(sel => el.closest(sel))) {
        popoverInteractionRef.current = true
      }
    }

    const clear = (): void => {
      popoverInteractionRef.current = false
    }

    document.addEventListener("pointerdown", onPointerDown, true)
    // Clear on click, not pointerup (see JSDoc).
    document.addEventListener("click", clear, true)
    document.addEventListener("pointercancel", clear, true)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("click", clear, true)
      document.removeEventListener("pointercancel", clear, true)
    }
  }, [isOpen, popoverRef])

  return popoverInteractionRef
}
