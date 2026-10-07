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

/**
 * Applies a single Tab stop within a DateField: one editable segment keeps
 * `tabIndex={0}`, the rest `-1`. Arrow keys still move focus (React Aria);
 * on focus we promote the focused segment so Tab/Shift+Tab leave the field.
 *
 * Temporary until react-aria-components ships `keyboardNavigationBehavior="tab"`
 * (adobe/react-spectrum#10294). RAC resets segment `tabIndex` to 0 on render,
 * so we re-apply after mutations and on focusin.
 */
export function applyDateFieldSingleTabStop(
  container: HTMLElement,
  preferred: HTMLElement | null = null
): HTMLElement | null {
  const segments = Array.from(
    container.querySelectorAll<HTMLElement>(SEGMENT_SELECTOR)
  )
  if (segments.length === 0) return null

  // React Aria leaves disabled segments without tabIndex (DOM `-1`). Do not
  // promote them: `aria-disabled` alone does not remove a span from Tab order.
  if (segments.every(isDisabledSegment)) {
    for (const segment of segments) {
      if (segment.tabIndex !== -1) {
        segment.tabIndex = -1
      }
    }
    return null
  }

  const enabledPreferred =
    preferred && segments.includes(preferred) && !isDisabledSegment(preferred)
      ? preferred
      : null

  const tabbable =
    enabledPreferred ??
    segments.find(s => s.tabIndex === 0 && !isDisabledSegment(s)) ??
    segments.find(s => !isDisabledSegment(s)) ??
    null

  if (!tabbable) {
    for (const segment of segments) {
      if (segment.tabIndex !== -1) {
        segment.tabIndex = -1
      }
    }
    return null
  }

  for (const segment of segments) {
    const next = segment === tabbable ? 0 : -1
    // Skip no-op writes so MutationObserver watchers do not loop.
    if (segment.tabIndex !== next) {
      segment.tabIndex = next
    }
  }
  return tabbable
}

/**
 * Callback ref that keeps a DateField container on one Tab stop. Attach to the
 * element that wraps that field's segments (e.g. `StyledDateFieldInput`).
 *
 * Uses a callback ref (not useLayoutEffect + object ref) so setup runs when the
 * node mounts — DateField state can be missing on the first render, which would
 * leave an object-ref effect with a null `current` and never re-run.
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
    let applying = false

    const apply = (preferred: HTMLElement | null = lastTabbable): void => {
      if (applying) return
      applying = true
      try {
        lastTabbable = applyDateFieldSingleTabStop(node, preferred)
      } finally {
        applying = false
      }
    }

    apply(null)

    const onFocusIn = (e: FocusEvent): void => {
      const target = e.target
      if (!(target instanceof HTMLElement)) return
      if (!target.matches(SEGMENT_SELECTOR)) return
      apply(target)
    }

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
    cleanupRef.current = () => {
      observer.disconnect()
      node.removeEventListener("focusin", onFocusIn)
    }
  }, [])
}
