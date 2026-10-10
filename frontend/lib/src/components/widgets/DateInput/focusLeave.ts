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
 * Routes Tab while the passive preview is open. Returns true when handled.
 * Does not preventDefault. Last-segment Tab waits one frame (Safari/Firefox may
 * skip the icon button); focus that lands in the still-open grid is moved to
 * the calendar button. Use a `data-type` segmentSelector (iOS uses textboxes).
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
  const segments = Array.from(
    ctx.field.querySelectorAll<HTMLElement>(ctx.segmentSelector)
  )

  if (e.shiftKey && e.target === segments[0]) {
    leave.immediate()
    return true
  }

  if (!e.shiftKey && e.target === segments.at(-1)) {
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

  return false
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
