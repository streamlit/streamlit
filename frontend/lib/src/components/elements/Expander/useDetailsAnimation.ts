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

import { notNullOrUndefined } from "~lib/util/utils"

import { animateHeight, AnimationHandle } from "./animateHeight"
import { BORDER_SIZE } from "./styled-components"

/**
 * Delay before measuring content height for the Safari repaint workaround (ms).
 *
 * In Safari, <details> content is not painted synchronously when opened,
 * so we first animate a tiny amount (5px) to force a repaint, then measure
 * the real content height after this delay.
 */
const SAFARI_REPAINT_DELAY_MS = 100

/**
 * Arbitrary height (px) used to force a Safari repaint when expanding.
 * This is added to the collapsed height to create a small initial animation
 * that forces Safari to paint the <details> content.
 */
const SAFARI_REPAINT_HEIGHT = 5

export interface UseDetailsAnimationOptions {
  /**
   * Expanded state from the backend proto.
   *
   * - `true` / `false` – explicit state from the proto.
   * - `null` / `undefined` – the field was not set (e.g. `ClearField("expanded")`
   *   during `st.status().update()`). In this case the hook preserves the
   *   current open/closed state and defaults to `false` on initial render.
   */
  initialExpanded: boolean | null | undefined
  /** Label used to detect "new expander" replacing old one */
  label: string
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
 */
export function useDetailsAnimation({
  initialExpanded,
  label,
}: UseDetailsAnimationOptions): UseDetailsAnimationResult {
  const [isOpen, setIsOpen] = useState<boolean>(initialExpanded || false)

  const detailsRef = useRef<HTMLDetailsElement>(null)
  const summaryRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Track current animation for cancellation
  const animationRef = useRef<AnimationHandle | null>(null)

  // Track Safari repaint timeout
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Cancel any running animation and pending timeouts.
   */
  const cancelAnimation = useCallback((): void => {
    if (animationRef.current) {
      animationRef.current.cancel()
      animationRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  // Sync with backend/proto state changes.
  // Only apply the expanded state if it was actually set in the proto.
  // The label dependency ensures we reset when a "new expander" replaces
  // the old one in the same position (React may reuse the same DOM element).
  useEffect(() => {
    if (notNullOrUndefined(initialExpanded)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing with external proto state
      setIsOpen(initialExpanded)

      // We manage the open attribute via the detailsRef and not with React state
      if (detailsRef.current) {
        detailsRef.current.open = initialExpanded
      }
    }
  }, [label, initialExpanded])

  /**
   * Run the height animation between two values.
   * Cancels any in-progress animation before starting.
   */
  const startAnimation = useCallback(
    (
      detailsEl: HTMLElement,
      startHeight: number,
      endHeight: number,
      onFinish?: () => void
    ): void => {
      cancelAnimation()

      animationRef.current = animateHeight(detailsEl, startHeight, endHeight, {
        onFinish,
      })
    },
    [cancelAnimation]
  )

  /**
   * Handle user click on summary to toggle open/closed.
   * Uses a two-step animation for expansion as a Safari repaint workaround.
   */
  const handleToggle = useCallback(
    (e: MouseEvent): void => {
      e.preventDefault()

      setIsOpen(prev => !prev)

      const detailsEl = detailsRef.current
      if (!detailsEl || !summaryRef.current) {
        return
      }

      detailsEl.style.overflow = "hidden"
      // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Need current heights to calculate animation start/end values
      const detailsHeight = detailsEl.getBoundingClientRect().height
      // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Need current heights to calculate animation start/end values
      const summaryHeight = summaryRef.current.getBoundingClientRect().height

      if (!isOpen) {
        // === OPENING ===
        detailsEl.style.height = `${detailsHeight}px`
        detailsEl.open = true

        window.requestAnimationFrame(() => {
          // Safari workaround: Safari doesn't paint <details> content
          // synchronously when opened. Force a repaint by animating a tiny
          // bit first, then animate to the real height after a short delay.
          startAnimation(
            detailsEl,
            detailsHeight,
            summaryHeight + 2 * BORDER_SIZE + SAFARI_REPAINT_HEIGHT
          )

          timeoutRef.current = setTimeout(() => {
            if (!contentRef.current) {
              return
            }

            const contentHeight =
              // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Need content height to calculate animation end value
              contentRef.current.getBoundingClientRect().height
            startAnimation(
              detailsEl,
              detailsHeight,
              summaryHeight + contentHeight + 2 * BORDER_SIZE
            )
          }, SAFARI_REPAINT_DELAY_MS)
        })
      } else {
        // === CLOSING ===
        startAnimation(
          detailsEl,
          detailsHeight,
          summaryHeight + 2 * BORDER_SIZE,
          () => {
            // Set open=false after the close animation finishes
            if (detailsRef.current) {
              detailsRef.current.open = false
            }
          }
        )
      }
    },
    [isOpen, startAnimation]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimation()
    }
  }, [cancelAnimation])

  return {
    isOpen,
    detailsRef,
    summaryRef,
    contentRef,
    handleToggle,
  }
}
