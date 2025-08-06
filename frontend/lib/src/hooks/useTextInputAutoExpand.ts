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

import {
  RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import { useEmotionTheme } from "@streamlit/lib"

// Constants for auto-expansion behavior
// We want to show easily that there's scrolling so we deliberately choose
// a half size.
const MAX_VISIBLE_NUM_LINES = 6.5
// Rounding errors can arbitrarily create scrollbars. We add a rounding offset
// to manage it better.
const ROUNDING_OFFSET = 1

// Type for height guidance ref
interface HeightGuidance {
  minHeight: number
  maxHeight: number
}

/**
 * Calculates the natural scroll height of a textarea by temporarily resetting its height
 */
const getScrollHeight = (
  textareaRef: RefObject<HTMLTextAreaElement>
): number => {
  let newScrollHeight = 0
  const { current: textarea } = textareaRef
  if (textarea) {
    textarea.style.height = "auto"
    // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
    newScrollHeight = textarea.scrollHeight
    textarea.style.height = ""
  }
  return newScrollHeight
}

/**
 * Determines if the text input should be in extended state based on scroll height
 */
const calculateIsExtended = (
  scrollHeight: number,
  minHeight: number,
  textareaRef: RefObject<HTMLTextAreaElement>
): boolean => {
  return scrollHeight > 0 && textareaRef.current
    ? Math.abs(scrollHeight - minHeight) > ROUNDING_OFFSET
    : false
}

/**
 * Initializes height guidance based on the current textarea element
 */
const initializeHeightGuidance = (
  textareaRef: RefObject<HTMLTextAreaElement>,
  heightGuidance: RefObject<HeightGuidance>
): void => {
  if (textareaRef.current && heightGuidance.current) {
    const { offsetHeight } = textareaRef.current
    heightGuidance.current.minHeight = offsetHeight
    heightGuidance.current.maxHeight = offsetHeight * MAX_VISIBLE_NUM_LINES
  }
}

/**
 * Calculates the appropriate height style for an auto-expanding textarea
 */
const calculateHeight = (
  isExtended: boolean,
  scrollHeight: number,
  defaultHeight?: string | number
): string => {
  if (isExtended) {
    return `${scrollHeight + ROUNDING_OFFSET}px`
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
  const heightGuidance = useRef<HeightGuidance>({ minHeight: 0, maxHeight: 0 })

  const [scrollHeight, setScrollHeight] = useState(0)
  const [isExtended, setIsExtended] = useState(false)

  const updateScrollHeight = useCallback((): void => {
    setScrollHeight(getScrollHeight(textareaRef))
  }, [textareaRef, setScrollHeight])

  const clearScrollHeight = useCallback((): void => {
    setScrollHeight(0)
  }, [setScrollHeight])

  // Initialize height guidance
  useLayoutEffect(() => {
    if (textareaRef.current) {
      initializeHeightGuidance(textareaRef, heightGuidance)
    }
  }, [textareaRef])

  // Update extended state when scroll height changes
  useLayoutEffect(() => {
    const { minHeight } = heightGuidance.current
    setIsExtended(calculateIsExtended(scrollHeight, minHeight, textareaRef))
  }, [scrollHeight, textareaRef])

  // Update scroll height when dependencies change
  useLayoutEffect(() => {
    updateScrollHeight()
  }, [textareaRef, updateScrollHeight, ...dependencies]) // eslint-disable-line react-hooks/exhaustive-deps

  const { maxHeight: maxHeightValue } = heightGuidance.current

  // Calculate height values using theme default
  const defaultHeight = theme.sizes.minElementHeight
  const calculatedHeight = calculateHeight(
    isExtended,
    scrollHeight,
    defaultHeight
  )
  const calculatedMaxHeight = calculateMaxHeight(maxHeightValue)

  return {
    isExtended,
    height: calculatedHeight,
    maxHeight: calculatedMaxHeight,
    updateScrollHeight,
    clearScrollHeight,
  }
}
