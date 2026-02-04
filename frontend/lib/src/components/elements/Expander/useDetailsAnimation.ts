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
  MouseEvent,
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { animateHeight, AnimationHandle } from "./animateHeight"
import { BORDER_SIZE } from "./styled-components"

/** Debounce delay for ResizeObserver callbacks (ms) */
const RESIZE_DEBOUNCE_MS = 10

export interface UseDetailsAnimationOptions {
  /** Open state from backend (initial or controlled) */
  backendOpen: boolean
  /** Label used to detect "new expander" replacing old one */
  label: string
  /** Callback when user toggles (for widget mode) */
  onToggle?: (newOpen: boolean) => void
}

export interface UseDetailsAnimationResult {
  /** Current open state */
  isOpen: boolean
  /** Ref to attach to <details> element */
  detailsRef: RefObject<HTMLDetailsElement>
  /** Ref to attach to <summary> element */
  summaryRef: RefObject<HTMLElement>
  /** Ref to attach to content panel */
  contentRef: RefObject<HTMLDivElement>
  /** Click handler for summary (toggle) */
  handleToggle: (e: MouseEvent) => void
}

/**
 * Custom hook for managing animated <details> element open/close state.
 *
 * Features:
 * - Optimistic updates: animates immediately on user toggle
 * - Backend sync: animates when backend state changes (widget mode)
 * - Content resize: animates when lazy-loaded content changes size
 * - Smooth interruption: animations can be interrupted without visual flicker
 * - Proper cleanup: all timeouts and animations cleaned up on unmount
 */
export function useDetailsAnimation({
  backendOpen,
  label,
  onToggle,
}: UseDetailsAnimationOptions): UseDetailsAnimationResult {
  const [isOpen, setIsOpen] = useState(backendOpen)

  const detailsRef = useRef<HTMLDetailsElement>(null)
  const summaryRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Track current animation for cancellation
  const animationRef = useRef<AnimationHandle | null>(null)

  // Track resize debounce timeout
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track isOpen in ref to avoid stale closures in effects
  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen

  // Track previous values for change detection
  const prevBackendOpenRef = useRef(backendOpen)
  const prevLabelRef = useRef(label)

  // Track if component has mounted (to skip animation on initial render)
  const hasMountedRef = useRef(false)

  /**
   * Cancel any running animation.
   */
  const cancelAnimation = useCallback((): void => {
    animationRef.current?.cancel()
    animationRef.current = null
  }, [])

  /**
   * Animate to a target open/closed state.
   * Handles interruption smoothly by capturing current height before cancelling.
   *
   * Performance note: This function triggers 1-2 forced reflows via getBoundingClientRect().
   * This is acceptable because:
   * - It only runs on user click or backend state change (infrequent)
   * - Reflows are batched where possible (reads before writes)
   * - Accurate measurements are required for smooth animation
   */
  const animateTo = useCallback(
    (targetOpen: boolean): void => {
      const details = detailsRef.current
      const summary = summaryRef.current
      const content = contentRef.current
      if (!details || !summary) {
        return
      }

      // === BATCH READ PHASE (1 reflow) ===
      // Read all layout properties BEFORE making any style changes to minimize reflows
      /* eslint-disable streamlit-custom/no-force-reflow-access -- Batched reads for animation */
      const currentHeight = details.getBoundingClientRect().height
      const summaryHeight = summary.getBoundingClientRect().height
      /* eslint-enable streamlit-custom/no-force-reflow-access */

      // === WRITE PHASE ===
      cancelAnimation()
      details.style.height = `${currentHeight}px`
      details.style.overflow = "hidden"

      if (targetOpen) {
        // Set open so content renders
        details.open = true

        // === SECOND READ (1 reflow) ===
        // Must happen AFTER details.open = true so content is in the DOM
        // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Required after DOM change
        const contentHeight = content?.getBoundingClientRect().height ?? 0

        // Animate to full height (summary + content + borders)
        if (contentHeight > 0) {
          const targetHeight = summaryHeight + contentHeight + 2 * BORDER_SIZE
          animationRef.current = animateHeight(
            details,
            currentHeight,
            targetHeight
          )
        }
        // If contentHeight is 0 (widget with lazy content), ResizeObserver will
        // trigger animation when content arrives
      } else {
        // Closing: animate to collapsed height, then set open=false
        const targetHeight = summaryHeight + 2 * BORDER_SIZE
        animationRef.current = animateHeight(
          details,
          currentHeight,
          targetHeight,
          {
            onFinish: () => {
              if (detailsRef.current) {
                detailsRef.current.open = false
              }
            },
          }
        )
      }
    },
    [cancelAnimation]
  )

  /**
   * Animate content resize (when content height changes while open).
   */
  const animateResize = useCallback(
    (currentHeight: number, targetHeight: number): void => {
      const details = detailsRef.current
      if (!details) {
        return
      }

      // Capture and lock (same pattern as animateTo)
      cancelAnimation()
      details.style.height = `${currentHeight}px`
      details.style.overflow = "hidden"

      animationRef.current = animateHeight(
        details,
        currentHeight,
        targetHeight
      )
    },
    [cancelAnimation]
  )

  // Sync with backend state changes
  useEffect(() => {
    const labelChanged = label !== prevLabelRef.current

    // Update trackers
    prevLabelRef.current = label
    prevBackendOpenRef.current = backendOpen

    // If label changed, this is a "new expander" - cancel animations and reset
    if (labelChanged) {
      cancelAnimation()
      setIsOpen(backendOpen)
      if (detailsRef.current) {
        detailsRef.current.open = backendOpen
      }
      return
    }

    // If backend state differs from local, sync (with animation if mounted)
    if (backendOpen !== isOpenRef.current) {
      setIsOpen(backendOpen)

      if (hasMountedRef.current) {
        animateTo(backendOpen)
      } else {
        // Initial mount - set DOM state directly, no animation
        if (detailsRef.current) {
          detailsRef.current.open = backendOpen
        }
      }
    }
  }, [backendOpen, label, cancelAnimation, animateTo])

  // Set initial open state on mount (before marking as mounted)
  useEffect(() => {
    if (detailsRef.current) {
      detailsRef.current.open = backendOpen
    }
    hasMountedRef.current = true
    // Only run on mount - backendOpen changes are handled by the sync effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ResizeObserver for content size changes (lazy-loaded content)
  useEffect(() => {
    const content = contentRef.current
    const details = detailsRef.current
    const summary = summaryRef.current
    if (!content || !details || !summary) {
      return
    }

    const observer = new ResizeObserver(() => {
      // Only observe when open
      if (!details.open) {
        return
      }

      // Debounce to let rapid content changes settle
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }

      resizeTimeoutRef.current = setTimeout(() => {
        // Don't interfere if we're in "closing" mode - let the close animation finish
        // isOpenRef tracks the INTENDED state, not the current animation state
        if (!isOpenRef.current) {
          return
        }

        // === BATCH READ PHASE (1 reflow) ===
        // All reads happen before any writes, so only one reflow is triggered.
        // This only runs on content size changes (debounced), not in hot loops.
        /* eslint-disable streamlit-custom/no-force-reflow-access -- Batched reads for resize animation */
        const contentHeight = content.getBoundingClientRect().height
        const summaryHeight = summary.getBoundingClientRect().height
        const currentHeight = details.getBoundingClientRect().height
        /* eslint-enable streamlit-custom/no-force-reflow-access */

        const targetHeight = summaryHeight + contentHeight + 2 * BORDER_SIZE

        // === WRITE PHASE ===
        // Animate if significant difference (> 5px threshold avoids micro-animations)
        if (Math.abs(currentHeight - targetHeight) > 5) {
          animateResize(currentHeight, targetHeight)
        }
      }, RESIZE_DEBOUNCE_MS)
    })

    observer.observe(content)
    return () => {
      observer.disconnect()
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
    }
  }, [animateResize])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimation()
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
    }
  }, [cancelAnimation])

  // Handle user toggle
  const handleToggle = useCallback(
    (e: MouseEvent): void => {
      e.preventDefault()

      const newOpen = !isOpenRef.current

      // Optimistic update: always animate immediately
      setIsOpen(newOpen)
      animateTo(newOpen)

      // Notify backend if callback provided
      onToggle?.(newOpen)
    },
    [onToggle, animateTo]
  )

  return {
    isOpen,
    detailsRef,
    summaryRef,
    contentRef,
    handleToggle,
  }
}
