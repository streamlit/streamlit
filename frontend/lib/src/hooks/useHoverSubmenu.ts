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

import { type CSSProperties, useCallback, useEffect, useRef } from "react"

import { type Placement } from "@floating-ui/react"

import { useFloatingOverlay } from "~lib/hooks/useFloatingOverlay"
import useTimeout from "~lib/hooks/useTimeout"

interface UseHoverSubmenuOptions {
  /** Whether the submenu is currently open. */
  isOpen: boolean
  /** Called when hover interactions change the open state. */
  onOpenChange: (open: boolean) => void
  /**
   * When false, the mouseover listener is skipped entirely.
   * Use `enabled === false` (not `!enabled`) so that omitting this prop
   * (undefined) behaves as true.
   */
  enabled?: boolean
  /** Close delay in milliseconds when the pointer leaves both anchor and panel. Defaults to 150. */
  delayMs?: number
  /** Floating-ui placement for the submenu panel. Defaults to "right". */
  placement?: Placement
  /** Pixel offset between anchor and panel. Defaults to 2. */
  offsetPx?: number
}

interface UseHoverSubmenuReturn {
  /** Floating-ui computed styles to apply to the panel element. */
  floatingStyles: CSSProperties
  /** Callback ref to attach to the anchor (trigger) element. */
  setAnchorRef: (node: HTMLElement | null) => void
  /** Callback ref to attach to the floating panel element. */
  setFloatingRef: (node: HTMLElement | null) => void
}

/**
 * Shared hook for hover-activated submenus (e.g. FormattingMenu, StatisticsMenu).
 *
 * Encapsulates:
 * - Floating-ui positioning via `useFloatingOverlay`
 * - Merged callback refs (floating-ui + local DOM refs for hit-testing)
 * - Document-level `mouseover` listener for reliable cross-browser hover detection
 * - Debounced close via `useTimeout`
 *
 * The `mouseover` approach is intentional: element-level `onPointerEnter` is
 * unreliable in WebKit with Playwright because synthetic click events don't
 * always fire `pointerenter` on FloatingPortal elements across portal boundaries.
 * `mouseover` bubbles to `document` unconditionally.
 */
export function useHoverSubmenu({
  isOpen,
  onOpenChange,
  enabled,
  delayMs = 150,
  placement = "right",
  offsetPx = 2,
}: UseHoverSubmenuOptions): UseHoverSubmenuReturn {
  const anchorRef = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)

  const { refs, floatingStyles } = useFloatingOverlay({
    open: isOpen,
    placement,
    offsetPx,
  })

  const setAnchorRef = useCallback(
    (node: HTMLElement | null): void => {
      anchorRef.current = node
      refs.setReference(node)
    },
    [refs]
  )

  const setFloatingRef = useCallback(
    (node: HTMLElement | null): void => {
      panelRef.current = node
      refs.setFloating(node)
    },
    [refs]
  )

  const { clear: clearClose, restart: scheduleClose } = useTimeout(
    () => onOpenChange(false),
    delayMs,
    { autoStart: false }
  )

  // Document-level mouseover listener for reliable cross-browser hover detection.
  // Element-level onPointerEnter is unreliable in WebKit with Playwright because
  // synthetic click events don't always fire pointerenter on FloatingPortal elements
  // when crossing portal boundaries. mouseover bubbles to document unconditionally,
  // so it fires regardless of portal structure or browser engine.
  useEffect(() => {
    // enabled === false (explicit false) disables the listener.
    // undefined (not provided) means enabled — do NOT use !enabled here.
    if (enabled === false) return

    const handleMouseOver = (e: MouseEvent): void => {
      const target = e.target as Element
      if (anchorRef.current?.contains(target)) {
        clearClose()
        onOpenChange(true)
      } else if (isOpen && panelRef.current?.contains(target)) {
        clearClose()
      } else if (isOpen) {
        scheduleClose()
      }
    }

    document.addEventListener("mouseover", handleMouseOver)
    return () => document.removeEventListener("mouseover", handleMouseOver)
  }, [isOpen, enabled, clearClose, onOpenChange, scheduleClose])

  return { floatingStyles, setAnchorRef, setFloatingRef }
}
