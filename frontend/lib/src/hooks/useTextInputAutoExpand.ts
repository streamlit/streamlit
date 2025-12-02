/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { RefObject, useCallback, useLayoutEffect, useState } from "react"

import { useEmotionTheme } from "@streamlit/lib"

// Constants for auto-expansion behavior
// We want to show easily that there's scrolling so we deliberately choose
// a half size.
const MAX_VISIBLE_NUM_LINES = 6.5
// Rounding errors can arbitrarily create scrollbars. We add a rounding offset
// to manage it better.
const ROUNDING_OFFSET = 1

/**
 * Calculates the natural scroll height of a textarea by temporarily resetting its height
 */
const getScrollHeight = (
  textareaRef: RefObject<HTMLTextAreaElement>
): number => {
  let newScrollHeight = 0
  const { current: textarea } = textareaRef
  if (textarea) {
    const originalHeight = textarea.style.height
    textarea.style.height = "auto"
    // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Required to measure natural content height
    newScrollHeight = textarea.scrollHeight
    textarea.style.height = originalHeight
  }
  return newScrollHeight
}

/**
 * Determines if the text input should be in extended state.
 * Extended means the content height exceeds the default single-line height.
 */
const calculateIsExtended = (
  scrollHeight: number,
  minHeight: number
): boolean => {
  // Only consider extended if scrollHeight is greater than minHeight
  // (accounting for rounding errors)
  return scrollHeight > 0 && scrollHeight - minHeight > ROUNDING_OFFSET
}

/**
 * Calculates the appropriate height style for an auto-expanding textarea
 * Caps the height at maxHeight to enable scrolling beyond the visible line limit
 */
const calculateHeight = (
  isExtended: boolean,
  scrollHeight: number,
  maxHeight: number,
  defaultHeight?: string | number
): string => {
  if (isExtended) {
    const targetHeight = scrollHeight + ROUNDING_OFFSET
    // Cap height at maxHeight to trigger scrolling when content exceeds limit
    const cappedHeight =
      maxHeight > 0 ? Math.min(targetHeight, maxHeight) : targetHeight
    return `${cappedHeight}px`
  }
  return defaultHeight ? String(defaultHeight) : ""
}

/**
 * Calculates the appropriate max-height style for an auto-expanding textarea
 */
const calculateMaxHeight = (maxHeight: number): string => {
  return maxHeight ? `${maxHeight}px` : ""
}

export interface UseTextInputAutoExpandResult {
  /** Whether the textarea is currently in extended state */
  isExtended: boolean
  /** Calculated height style for the textarea */
  height: string
  /** Calculated max-height style for the textarea */
  maxHeight: string
  /** Function to update scroll height (call this when content changes) */
  updateScrollHeight: () => void
  /** Function to clear scroll height */
  clearScrollHeight: () => void
}

export interface UseTextInputAutoExpandOptions {
  /** Ref to the textarea element */
  textareaRef: RefObject<HTMLTextAreaElement>
  /** Dependencies that should trigger scroll height recalculation */
  dependencies?: React.DependencyList
}

/**
 * Custom hook for text input auto-expansion functionality
 * Handles all the logic for automatically expanding textarea height based on content
 */
export const useTextInputAutoExpand = ({
  textareaRef,
  dependencies = [],
}: UseTextInputAutoExpandOptions): UseTextInputAutoExpandResult => {
  const theme = useEmotionTheme()

  const [scrollHeight, setScrollHeight] = useState(0)
  const [isExtended, setIsExtended] = useState(false)
  const [minHeight, setMinHeight] = useState(0)
  const [maxHeight, setMaxHeight] = useState(0)

  // State setters are guaranteed stable by React, no need to include in deps
  const updateScrollHeight = useCallback((): void => {
    const newScrollHeight = getScrollHeight(textareaRef)
    setScrollHeight(newScrollHeight)
    setIsExtended(calculateIsExtended(newScrollHeight, minHeight))
  }, [textareaRef, minHeight])

  const clearScrollHeight = useCallback((): void => {
    setScrollHeight(0)
    setIsExtended(false)
  }, [])

  // Initialize height guidance on mount
  useLayoutEffect(() => {
    if (!textareaRef.current) {
      return
    }

    // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Required to measure element dimensions
    const { offsetHeight } = textareaRef.current
    // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Required to calculate line height and padding
    const computedStyle = window.getComputedStyle(textareaRef.current)

    // parseFloat("normal") returns NaN, so fallback to offsetHeight
    const lineHeight = parseFloat(computedStyle.lineHeight) || offsetHeight
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0
    const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0
    const totalPadding = paddingTop + paddingBottom

    setMinHeight(offsetHeight)
    // Calculate maxHeight based on line height, not offsetHeight
    // This ensures we get exactly MAX_VISIBLE_NUM_LINES of content
    const calculatedMaxHeight =
      lineHeight * MAX_VISIBLE_NUM_LINES + totalPadding
    setMaxHeight(calculatedMaxHeight)
  }, [textareaRef])

  // Update scroll height and extended state when dependencies change
  // Combined into single effect to avoid render cascade
  useLayoutEffect(() => {
    const newScrollHeight = getScrollHeight(textareaRef)
    setScrollHeight(newScrollHeight)
    setIsExtended(calculateIsExtended(newScrollHeight, minHeight))
  }, [textareaRef, minHeight, ...dependencies]) // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate height values using theme default
  const defaultHeight = theme.sizes.minElementHeight
  const calculatedHeight = calculateHeight(
    isExtended,
    scrollHeight,
    maxHeight,
    defaultHeight
  )
  const calculatedMaxHeight = calculateMaxHeight(maxHeight)

  return {
    isExtended,
    height: calculatedHeight,
    maxHeight: calculatedMaxHeight,
    updateScrollHeight,
    clearScrollHeight,
  }
}
