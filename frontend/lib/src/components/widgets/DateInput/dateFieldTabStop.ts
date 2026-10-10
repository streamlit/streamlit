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

import useTimeout from "~lib/hooks/useTimeout"

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
 * padding clicks as targets. Call from pointerdown capture before that
 * handler runs. The hook suppresses MutationObserver re-apply until the
 * press settles so mouse `onPressStart` and touch/pen `onPress` still see
 * every segment.
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

  // `find` is optional for the type checker. The disabled early-return
  // already guaranteed an enabled segment.
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
  const nodeRef = useRef<HTMLElement | null>(null)
  const lastTabbableRef = useRef<HTMLElement | null>(null)
  // While true, skip MutationObserver re-apply so pointer exposure survives
  // the microtask that runs between capture pointerdown and usePress.
  const suppressApplyRef = useRef(false)
  const endPressRef = useRef<(() => void) | null>(null)

  const collapseAfterPointer = useCallback((): void => {
    suppressApplyRef.current = false
    const node = nodeRef.current
    if (!node) return
    const active = document.activeElement
    const preferred =
      active instanceof HTMLElement &&
      node.contains(active) &&
      active.matches(SEGMENT_SELECTOR)
        ? active
        : lastTabbableRef.current
    lastTabbableRef.current = applyDateFieldSingleTabStop(node, preferred)
  }, [])

  // Macrotask: touch/pen call focusLast from onPress on click, which runs
  // after pointerup in the same turn. A microtask from pointerup would
  // collapse before that click.
  const { clear: clearSettle, restart: scheduleCollapse } = useTimeout(
    collapseAfterPointer,
    0,
    { autoStart: false }
  )

  return useCallback(
    (node: HTMLElement | null) => {
      cleanupRef.current?.()
      cleanupRef.current = null
      nodeRef.current = node
      if (!node) return

      const apply = (
        preferred: HTMLElement | null = lastTabbableRef.current
      ): void => {
        if (suppressApplyRef.current) return
        lastTabbableRef.current = applyDateFieldSingleTabStop(node, preferred)
      }

      apply(null)

      const clearEndPress = (): void => {
        if (!endPressRef.current) return
        window.removeEventListener("pointerup", endPressRef.current, true)
        window.removeEventListener("pointercancel", endPressRef.current, true)
        endPressRef.current = null
      }

      const onFocusIn = (e: FocusEvent): void => {
        const target = e.target
        if (!(target instanceof HTMLElement)) return
        if (!target.matches(SEGMENT_SELECTOR)) return
        // Focus settled on a segment — collapse even if a press is in flight.
        suppressApplyRef.current = false
        clearSettle()
        clearEndPress()
        apply(target)
      }

      // Capture on this group runs before usePress, so padding clicks are included.
      const onPointerDownCapture = (e: PointerEvent): void => {
        // Ignore non-primary mouse buttons. Touch/pen and some test dispatches
        // omit `button` or report 0; only `button > 0` is a definite secondary.
        if (e.button > 0) return
        suppressApplyRef.current = true
        clearSettle()
        clearEndPress()
        exposeEnabledSegmentsForPointer(node)

        endPressRef.current = (): void => {
          clearEndPress()
          scheduleCollapse()
        }
        window.addEventListener("pointerup", endPressRef.current, true)
        window.addEventListener("pointercancel", endPressRef.current, true)
      }
      const pressRoot = node.closest<HTMLElement>('[role="group"]') ?? node

      // Re-apply when segments remount or their tabindex changes (for example, isDisabled).
      const observer = new MutationObserver(() => {
        apply(lastTabbableRef.current)
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
        pressRoot.removeEventListener(
          "pointerdown",
          onPointerDownCapture,
          true
        )
        clearEndPress()
        clearSettle()
      }
    },
    [clearSettle, scheduleCollapse]
  )
}
