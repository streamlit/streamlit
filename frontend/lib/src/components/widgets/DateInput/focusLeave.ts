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
 * Whether blur `relatedTarget` means focus left the date/datetime widget for a
 * concrete outside control (so the passive calendar preview should dismiss).
 *
 * `null` is not a leave — browsers (notably Safari) fire that on mousedown of
 * unfocused calendar chrome before `click`. Callers must ignore blur when a
 * popover `pointerdown` is in flight (see `usePopoverInteractionFlag`).
 *
 * `document.body` counts as leave once popover-pointerdown has been ruled out:
 * Safari can park focus on body during calendar mousedown, but that path is
 * gated by the interaction flag before this helper runs.
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

/** True when `active` is still inside the field, popover, or excluded portals. */
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

/**
 * Tracks pointerdown inside the calendar popover (or excluded nested portals)
 * so the field can ignore the blur that Safari fires before the click lands.
 *
 * Desktop mouse order is pointerdown → blur → pointerup → click. On iOS Safari,
 * pointerup runs before the compatibility mousedown that blurs, so clearing on
 * pointerup drops the flag before blur can consume it. Clear on the following
 * click (or pointercancel) instead; blur handlers also clear when they skip.
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
      if (!(target instanceof Element)) return
      if (popoverRef.current?.contains(target)) {
        popoverInteractionRef.current = true
        return
      }
      if (excludeSelectorsRef.current.some(sel => target.closest(sel))) {
        popoverInteractionRef.current = true
      }
    }

    const clear = (): void => {
      popoverInteractionRef.current = false
    }

    document.addEventListener("pointerdown", onPointerDown, true)
    // Capture click, not pointerup: iOS fires pointerup before the blur this
    // flag must still guard. requestAnimationFrame after pointerdown would
    // clear too early on that same path.
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
