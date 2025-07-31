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
import { PageConfig } from "@streamlit/protobuf"
import { localStorageAvailable } from "@streamlit/utils"

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
    case PageConfig.SidebarState.AUTO:
    default: {
      // Expand sidebar only if browser width > MEDIUM_BREAKPOINT_PX
      return windowInnerWidth <= mediumBreakpointPx
    }
  }
}

export const getSidebarCollapsedKey = (pageLinkBaseUrl: string): string =>
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
