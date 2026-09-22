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
import { parseToRgba, rgba } from "color2k"

import { PageConfig } from "@streamlit/protobuf"
import { localStorageAvailable } from "@streamlit/utils"

export const DEFAULT_WIDTH = "300"

/**
 * Convert a CSS breakpoint string (e.g. "768px") to the max-width threshold
 * used for media-query comparisons. Subtracts 0.02px to match the CSS
 * `max-width` convention (exclusive upper bound).
 */
export function calculateMaxBreakpoint(value: string): number {
  return Number.parseInt(value, 10) - 0.02
}

export function shouldCollapse(
  initialSidebarState: PageConfig.SidebarState | undefined,
  mediumBreakpointPx: number,
  windowInnerWidth: number
): boolean {
  switch (initialSidebarState) {
    case PageConfig.SidebarState.EXPANDED:
      return false
    case PageConfig.SidebarState.COLLAPSED:
      return true
    case PageConfig.SidebarState.LOCKED:
      // On desktop the sidebar is pinned open; on mobile degrade like AUTO
      // so the overlay sidebar doesn't trap users.
      return windowInnerWidth <= mediumBreakpointPx
    case PageConfig.SidebarState.AUTO:
    default: {
      // Expand sidebar only if browser width > MEDIUM_BREAKPOINT_PX
      return windowInnerWidth <= mediumBreakpointPx
    }
  }
}

const getSidebarCollapsedKey = (pageLinkBaseUrl: string): string =>
  `stSidebarCollapsed-${pageLinkBaseUrl}`

export const getSavedSidebarState = (
  pageLinkBaseUrl: string
): boolean | null => {
  if (!localStorageAvailable()) {
    return null
  }

  const saved = window.localStorage.getItem(
    getSidebarCollapsedKey(pageLinkBaseUrl)
  )
  return saved === null ? null : saved === "true"
}

export const saveSidebarState = (
  pageLinkBaseUrl: string,
  isCollapsed: boolean
): void => {
  if (localStorageAvailable()) {
    window.localStorage.setItem(
      getSidebarCollapsedKey(pageLinkBaseUrl),
      isCollapsed.toString()
    )
  }
}

export function clampSidebarWidth(width: number): number {
  if (Number.isNaN(width)) {
    return Number.parseInt(DEFAULT_WIDTH, 10)
  }
  return Math.min(600, Math.max(200, width))
}

/**
 * Border color for the sidebar resize handle on hover.
 *
 * When the border is already visible, increase its opacity so the resize
 * affordance is still discoverable while staying on `borderColor` (darker in
 * light themes / lighter in dark themes).
 */
export function getSidebarResizeHandleHoverBorderColor(
  borderColor: string,
  showSidebarBorder: boolean
): string {
  if (!showSidebarBorder) {
    return borderColor
  }

  const [r, g, b, a] = parseToRgba(borderColor)
  return rgba(r, g, b, Math.min(1, a + 0.1))
}

/** CSS `background-image` gradient for the sidebar resize handle border line. */
export function getSidebarResizeHandleBackgroundImage(
  borderColor: string,
  {
    showSidebarBorder,
    isHovered,
  }: { showSidebarBorder: boolean; isHovered: boolean }
): string {
  const color = isHovered
    ? getSidebarResizeHandleHoverBorderColor(borderColor, showSidebarBorder)
    : borderColor
  const fadeEnd = isHovered ? "44%" : "36%"

  return `linear-gradient(to right, transparent 20%, ${color} 28%, transparent ${fadeEnd})`
}
