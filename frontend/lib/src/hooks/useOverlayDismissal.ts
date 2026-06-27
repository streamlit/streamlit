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

import { type MutableRefObject, useCallback, useEffect, useRef } from "react"

interface UseOverlayDismissalOptions {
  /** Whether the overlay is currently open. When false, no listeners are registered. */
  isOpen: boolean
  /** Called when a dismissal gesture is detected (outside click, Escape, or Tab). */
  onClose: () => void
  /** floating-ui's refs.setFloating — the hook creates and merges its own panelRef. */
  floatingSetFn: (node: HTMLElement | null) => void
  /** floating-ui's refs.setReference — optional; the hook creates and merges its own referenceRef. */
  referenceSetFn?: (node: HTMLElement | null) => void
  /**
   * CSS selectors whose containing elements are excluded from outside-click detection.
   * Used to prevent ColumnMenu from closing when clicking into portal sub-menus.
   * Stored in a ref internally to avoid dep-array churn from array literals.
   */
  excludeSelectors?: string[]
  /**
   * Called after onClose() when Escape is pressed, used for focus restoration.
   * Use a callback (not a ref) to avoid issues with components that can't safely
   * attach a ref directly to their trigger (e.g. BaseButtonTooltip double-render).
   */
  restoreFocusFn?: () => void
  /**
   * When true, Tab also triggers onClose(). Neither stopPropagation nor
   * preventDefault is called — the Tab event propagates normally so parent
   * focus managers (FocusLock, dialogs) can route focus correctly.
   */
  closeOnTab?: boolean
}

interface UseOverlayDismissalReturn {
  /** Internal ref to the floating panel DOM element; available to callers that need it (e.g. scroll-close effects). */
  panelRef: MutableRefObject<HTMLElement | null>
  /** Callback ref to attach to the floating panel element. */
  setFloatingRef: (node: HTMLElement | null) => void
  /** Internal ref to the reference (trigger) element. Always returned; null when referenceSetFn not provided. */
  referenceRef: MutableRefObject<HTMLElement | null>
  /** Callback ref to attach to the reference (trigger) element. */
  setReferenceRef: (node: HTMLElement | null) => void
}

/**
 * Shared hook for overlay dismissal via outside-click and keyboard (Escape / Tab).
 *
 * Encapsulates:
 * - Capture-phase `pointerdown` listener for outside-click detection
 * - Capture-phase `keydown` listener for Escape (and optional Tab) dismissal
 * - Merged callback refs (floating-ui + local DOM refs for hit-testing)
 *
 * Used by: ColumnMenu, ColumnVisibilityMenu, ButtonActionMenu, MenuButton,
 * TopNavSection, MainMenu.
 *
 * Behavior notes:
 * - `e.stopPropagation()` and `e.preventDefault()` fire only for Escape.
 *   Tab must propagate so parent focus managers (FocusLock, dialogs) can
 *   route focus correctly.
 */
export function useOverlayDismissal({
  isOpen,
  onClose,
  floatingSetFn,
  referenceSetFn,
  excludeSelectors,
  restoreFocusFn,
  closeOnTab = false,
}: UseOverlayDismissalOptions): UseOverlayDismissalReturn {
  const panelRef = useRef<HTMLElement | null>(null)
  const referenceRef = useRef<HTMLElement | null>(null)

  // Store excludeSelectors in a ref to avoid re-running the effect when a
  // caller passes an array literal (which creates a new reference each render).
  const excludeSelectorsRef = useRef(excludeSelectors)
  useEffect(() => {
    excludeSelectorsRef.current = excludeSelectors
  }, [excludeSelectors])

  const setFloatingRef = useCallback(
    (node: HTMLElement | null): void => {
      panelRef.current = node
      floatingSetFn(node)
    },
    [floatingSetFn]
  )

  const setReferenceRef = useCallback(
    (node: HTMLElement | null): void => {
      referenceRef.current = node
      referenceSetFn?.(node)
    },
    [referenceSetFn]
  )

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (e: PointerEvent): void => {
      const target = e.target as Element
      if (panelRef.current?.contains(target)) return
      if (referenceRef.current?.contains(target)) return
      if (excludeSelectorsRef.current?.some(sel => target.closest(sel))) return
      onClose()
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      const isEscape = e.key === "Escape"
      const isTab = closeOnTab && e.key === "Tab"
      if (!isEscape && !isTab) return
      // stopPropagation and preventDefault only for Escape — Tab must
      // propagate so parent focus managers (FocusLock, dialogs) can handle it.
      if (isEscape) {
        e.stopPropagation()
        e.preventDefault()
      }
      onClose()
      if (isEscape) restoreFocusFn?.()
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [isOpen, onClose, closeOnTab, restoreFocusFn])

  return { panelRef, setFloatingRef, referenceRef, setReferenceRef }
}
