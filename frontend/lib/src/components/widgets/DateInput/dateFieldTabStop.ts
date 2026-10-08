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

import { useCallback, useRef } from "react"

import { SEGMENT_SELECTOR } from "./dateInputUtils"

function isDisabledSegment(segment: HTMLElement): boolean {
  return segment.getAttribute("aria-disabled") === "true"
}

function getEditableSegments(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(SEGMENT_SELECTOR)
  ).filter(segment => !isDisabledSegment(segment))
}

/**
 * Temporarily makes every enabled segment tabbable so React Aria's field
 * press handler (`focusLast`, `{ tabbable: true }`) can see separators and
 * padding clicks as nearest-segment targets. Call from pointerdown capture
 * before that handler runs; `focusin` collapses back to one Tab stop.
 */
export function exposeEnabledSegmentsForPointer(container: HTMLElement): void {
  for (const segment of getEditableSegments(container)) {
    if (segment.tabIndex !== 0) {
      segment.tabIndex = 0
    }
  }
}

/**
 * Leaves one segment tabbable (`tabIndex` 0) and sets the others to -1.
 * `preferred` wins when it is an enabled segment of the field; otherwise the
 * segment that is already tabbable, or the first enabled segment. When every
 * segment is `aria-disabled`, all stay at -1.
 *
 * Callers re-apply this after render. React Aria sets every editable
 * segment's `tabIndex` prop to 0. Temporary until
 * `keyboardNavigationBehavior="tab"` ships (adobe/react-spectrum#10294).
 */
export function applyDateFieldSingleTabStop(
  container: HTMLElement,
  preferred: HTMLElement | null = null
): HTMLElement | null {
  const segments = Array.from(
    container.querySelectorAll<HTMLElement>(SEGMENT_SELECTOR)
  )
  if (segments.length === 0) return null

  // React Aria omits tabIndex when disabled (attribute absent / property -1).
  // Do not promote them: `aria-disabled` alone does not remove a span from Tab
  // order. Force `-1` so a prior single-stop `0` is cleared on disable.
  if (segments.every(isDisabledSegment)) {
    for (const segment of segments) {
      if (segment.getAttribute("tabindex") !== "-1") {
        segment.tabIndex = -1
      }
    }
    return null
  }

  const enabledPreferred =
    preferred && segments.includes(preferred) && !isDisabledSegment(preferred)
      ? preferred
      : null

  // After the disabled early-return, at least one enabled segment exists.
  const tabbable =
    enabledPreferred ??
    segments.find(s => s.tabIndex === 0 && !isDisabledSegment(s)) ??
    segments.find(s => !isDisabledSegment(s))
  if (!tabbable) {
    return null
  }

  for (const segment of segments) {
    const next = segment === tabbable ? 0 : -1
    // Skip no-op writes so MutationObserver watchers converge without looping.
    if (segment.tabIndex !== next) {
      segment.tabIndex = next
    }
  }
  return tabbable
}

/**
 * Callback ref that keeps one DateField on a single Tab stop. Pass it to
 * the element that wraps that field's segments (`StyledDateFieldInput`).
 *
 * Setup runs when the node mounts. A layout effect on an object ref would
 * see `null` while DateField state is missing and would not run again
 * once the node exists.
 */
export function useDateFieldSingleTabStop(): (
  node: HTMLElement | null
) => void {
  const cleanupRef = useRef<(() => void) | null>(null)

  return useCallback((node: HTMLElement | null) => {
    cleanupRef.current?.()
    cleanupRef.current = null
    if (!node) return

    let lastTabbable: HTMLElement | null = null

    const apply = (preferred: HTMLElement | null = lastTabbable): void => {
      lastTabbable = applyDateFieldSingleTabStop(node, preferred)
    }

    apply(null)

    const onFocusIn = (e: FocusEvent): void => {
      const target = e.target
      if (!(target instanceof HTMLElement)) return
      if (!target.matches(SEGMENT_SELECTOR)) return
      apply(target)
    }

    // React Aria's group press uses a tabbable walker. Briefly expose every
    // enabled segment so padding/separator clicks focus the nearest one.
    // Listen on the DateField group when present so group padding is covered.
    const onPointerDownCapture = (): void => {
      exposeEnabledSegmentsForPointer(node)
    }
    const pressRoot = node.closest<HTMLElement>('[role="group"]') ?? node

    // Re-apply when segments remount or their tabindex changes (for example, isDisabled).
    const observer = new MutationObserver(() => {
      apply(lastTabbable)
    })
    observer.observe(node, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["tabindex"],
    })

    node.addEventListener("focusin", onFocusIn)
    pressRoot.addEventListener("pointerdown", onPointerDownCapture, true)
    cleanupRef.current = () => {
      observer.disconnect()
      node.removeEventListener("focusin", onFocusIn)
      pressRoot.removeEventListener("pointerdown", onPointerDownCapture, true)
    }
  }, [])
}
