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

import { MutableRefObject, useMemo } from "react"

import { useResizeObserver, useWindowDimensionsContext } from "@streamlit/lib"

// Content max width in regular (non-wide) mode - matches theme.sizes.contentMaxWidth
const CONTENT_MAX_WIDTH_PX = 736

export interface UseHeaderTransparencyResult {
  isTransparent: boolean
  leftRef: MutableRefObject<HTMLDivElement | null>
  rightRef: MutableRefObject<HTMLDivElement | null>
}

/**
 * Hook to determine if the header should have a transparent background.
 *
 * The header is transparent when:
 * - There's no content in the header at all
 * - In regular mode (non-wide), when the header elements (left + right sections)
 *   fit within the "gutters" (the space on either side of the centered content)
 *
 * The header is always solid when:
 * - Top navigation is present (content spans the full header)
 * - Wide mode is enabled (content extends edge-to-edge)
 */
export const useHeaderTransparency = (
  hasNavigation: boolean,
  hasAnyContent: boolean,
  isWideMode: boolean
): UseHeaderTransparencyResult => {
  const { innerWidth } = useWindowDimensionsContext()

  const { values: leftValues, elementRef: leftRef } =
    useResizeObserver<HTMLDivElement>(["width"])

  const { values: rightValues, elementRef: rightRef } =
    useResizeObserver<HTMLDivElement>(["width"])

  const leftWidth = leftValues[0] || 0
  const rightWidth = rightValues[0] || 0

  const isTransparent = useMemo(() => {
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
    hasNavigation,
    isWideMode,
    hasAnyContent,
    innerWidth,
    leftWidth,
    rightWidth,
  ])

  return { isTransparent, leftRef, rightRef }
}
