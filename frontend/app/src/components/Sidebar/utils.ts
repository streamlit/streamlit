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
 * Alpha increase applied to a visible sidebar border on hover.
 *
 * Matches the default theme step from `fadedText10` (alpha 0.2) to
 * `fadedText20` (alpha 0.3). Already-opaque custom `borderColor` values clamp
 * at 1, so their hover feedback is only the wider gradient fade.
 */
export const SIDEBAR_RESIZE_HANDLE_HOVER_ALPHA_BUMP = 0.1

/**
 * Increase `borderColor` opacity for a visible sidebar border on hover.
 *
 * Keep the same RGB so the line gets darker in light themes and lighter in
 * dark themes. Callers should only apply this when `showSidebarBorder` is
 * true — when the border is hidden, the line appearing on hover is feedback
 * enough.
 */
export function getSidebarResizeHandleHoverBorderColor(
  borderColor: string
): string {
  const [r, g, b, a] = parseToRgba(borderColor)
  return rgba(r, g, b, Math.min(1, a + SIDEBAR_RESIZE_HANDLE_HOVER_ALPHA_BUMP))
}

/**
 * Build the sidebar resize-handle border as a CSS gradient.
 *
 * The stops place a ~1px line about 2px into the 8px hit target. Hover uses a
 * wider fade (44% vs 36%). Pass the already-resolved line color — including
 * any hover opacity bump — as `borderColor`.
 */
export function getSidebarResizeHandleBackgroundImage(
  borderColor: string,
  { isHovered }: { isHovered: boolean }
): string {
  const fadeEnd = isHovered ? "44%" : "36%"

  return `linear-gradient(to right, transparent 20%, ${borderColor} 28%, transparent ${fadeEnd})`
}
