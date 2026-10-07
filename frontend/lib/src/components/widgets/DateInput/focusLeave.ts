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
 * Concrete outside leave for blur `relatedTarget`.
 * `null` is not a leave (Safari calendar mousedown). `document.body` is a leave
 * once popover pointerdown is ruled out. Ignore blur while the popover flag is set.
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

export type PassivePreviewTabLeave = {
  immediate: () => void
  afterFocusSettles: () => void
  beforeFocusSettles?: () => void
  focusStayedInside?: () => void
}

/**
 * Tab leave for an open passive preview. Does not preventDefault. Returns true
 * when a leave path ran or was scheduled. Use a `data-type` segmentSelector —
 * iOS React Aria segments are textboxes, not spinbuttons.
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
    // Safari/Firefox may skip the icon button; close once focus settles outside.
    leave.beforeFocusSettles?.()
    requestAnimationFrame(() => {
      if (
        isFocusInsideWidget(document.activeElement, {
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
      const target = e.target
      if (!(target instanceof Node)) return
      // Native listeners see text nodes; normalize for closest().
      const targetElement =
        target instanceof Element ? target : target.parentElement
      if (popoverRef.current?.contains(target)) {
        popoverInteractionRef.current = true
        return
      }
      if (
        targetElement &&
        excludeSelectorsRef.current.some(sel => targetElement.closest(sel))
      ) {
        popoverInteractionRef.current = true
      }
    }

    const clear = (): void => {
      popoverInteractionRef.current = false
    }

    document.addEventListener("pointerdown", onPointerDown, true)
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
