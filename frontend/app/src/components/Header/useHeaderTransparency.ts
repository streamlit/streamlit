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

import { MutableRefObject, useEffect, useMemo, useState } from "react"

import { useResizeObserver, useWindowDimensionsContext } from "@streamlit/lib"
import { Config } from "@streamlit/protobuf"

// Content max width in regular (non-wide) mode - matches theme.sizes.contentMaxWidth
const CONTENT_MAX_WIDTH_PX = 736

// Scroll threshold in pixels - header becomes solid after scrolling this much
const SCROLL_THRESHOLD_PX = 50

export interface UseHeaderTransparencyResult {
  isTransparent: boolean
  leftRef: MutableRefObject<HTMLDivElement | null>
  rightRef: MutableRefObject<HTMLDivElement | null>
}

/**
 * Hook to determine if the header should have a transparent background.
 *
 * The transparency behavior is controlled by the headerTransparency config option:
 * - AUTO: Header is transparent when elements fit in gutters (existing behavior)
 * - ALWAYS: Header is always transparent until user scrolls
 * - NEVER: Header always has a solid background
 *
 * For AUTO mode, the header is transparent when:
 * - There's no content in the header at all
 * - In regular mode (non-wide), when the header elements (left + right sections)
 *   fit within the "gutters" (the space on either side of the centered content)
 *
 * The header is always solid in AUTO mode when:
 * - Top navigation is present (content spans the full header)
 * - Wide mode is enabled (content extends edge-to-edge)
 */
export const useHeaderTransparency = (
  hasNavigation: boolean,
  hasAnyContent: boolean,
  isWideMode: boolean,
  headerTransparency: Config.HeaderTransparency = Config.HeaderTransparency
    .HEADER_TRANSPARENCY_AUTO
): UseHeaderTransparencyResult => {
  const { innerWidth } = useWindowDimensionsContext()
  const [scrollY, setScrollY] = useState(0)

  const { values: leftValues, elementRef: leftRef } =
    useResizeObserver<HTMLDivElement>(["width"])

  const { values: rightValues, elementRef: rightRef } =
    useResizeObserver<HTMLDivElement>(["width"])

  const leftWidth = leftValues[0] || 0
  const rightWidth = rightValues[0] || 0

  // Track scroll position for dynamic transparency
  useEffect(() => {
    // Only track scroll when in "always" transparency mode
    if (
      headerTransparency !==
      Config.HeaderTransparency.HEADER_TRANSPARENCY_ALWAYS
    ) {
      return
    }

    const handleScroll = (): void => {
      // Get the main scrollable container (.stMain)
      const mainContainer = document.querySelector(".stMain")
      if (mainContainer) {
        /* eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Scroll position needed for transparency */
        setScrollY(mainContainer.scrollTop)
      } else {
        /* eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Scroll position needed for transparency */
        setScrollY(window.scrollY)
      }
    }

    // Initial check
    handleScroll()

    // Listen to scroll on the main container
    const mainContainer = document.querySelector(".stMain")
    if (mainContainer) {
      mainContainer.addEventListener("scroll", handleScroll, { passive: true })
    }
    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      if (mainContainer) {
        mainContainer.removeEventListener("scroll", handleScroll)
      }
      window.removeEventListener("scroll", handleScroll)
    }
  }, [headerTransparency])

  const isTransparent = useMemo(() => {
    // Handle "never" mode - always solid
    if (
      headerTransparency ===
      Config.HeaderTransparency.HEADER_TRANSPARENCY_NEVER
    ) {
      return false
    }

    // Handle "always" mode - transparent until scrolled
    if (
      headerTransparency ===
      Config.HeaderTransparency.HEADER_TRANSPARENCY_ALWAYS
    ) {
      // Still transparent when no content at all
      if (!hasAnyContent) {
        return true
      }
      // Transition to solid when scrolled past threshold
      return scrollY < SCROLL_THRESHOLD_PX
    }

    // "auto" mode (default) - existing behavior
    // Always transparent when no content
    if (!hasAnyContent) {
      return true
    }

    // Always solid with top navigation (navigation spans the header width)
    if (hasNavigation) {
      return false
    }

    // Always solid in wide mode (content extends to edges with only 80px padding)
    if (isWideMode) {
      return false
    }

    // Regular mode: check if header elements fit in the gutters
    // (the space on either side of the centered content)
    // Formula: availableSpace = viewportWidth - leftWidth - rightWidth
    // If availableSpace > contentMaxWidth, header elements are in the gutters
    const availableSpace = innerWidth - leftWidth - rightWidth
    return availableSpace > CONTENT_MAX_WIDTH_PX
  }, [
    headerTransparency,
    hasNavigation,
    isWideMode,
    hasAnyContent,
    innerWidth,
    leftWidth,
    rightWidth,
    scrollY,
  ])

  return { isTransparent, leftRef, rightRef }
}
