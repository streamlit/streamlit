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

import { createContext } from "react"

import { Logo, PageConfig } from "@streamlit/protobuf"

import { useRequiredContext } from "~lib/hooks/useRequiredContext"

export interface SidebarConfigContextProps {
  /**
   * The initial sidebar state from page config (AUTO, EXPANDED, or COLLAPSED).
   * Used to determine default sidebar behavior on app load.
   *
   * Consumed by: Sidebar, AppView
   * @see Sidebar
   * @see AppView
   */
  initialSidebarState: PageConfig.SidebarState

  /**
   * The app logo configuration (image, link, icon).
   * Displayed in the header when sidebar is collapsed or in the sidebar when expanded.
   *
   * Consumed by: Sidebar, AppView (Header)
   * @see Sidebar
   * @see AppView
   */
  appLogo: Logo | null

  /**
   * Vertical adjustment for the sidebar chevron button position.
   * Used for fine-tuning chevron alignment when custom logos are present.
   *
   * Consumed by: Sidebar
   * @see Sidebar
   */
  sidebarChevronDownshift: number

  /**
   * Whether the sidebar navigation menu should be expanded by default.
   * Controls the initial expanded/collapsed state of the nav menu.
   *
   * Consumed by: SidebarNav
   * @see SidebarNav
   */
  expandSidebarNav: boolean

  /**
   * Whether to hide the sidebar navigation menu entirely.
   * When true, sidebar nav is not rendered even if multiple pages exist.
   *
   * Consumed by: Sidebar, AppView
   * @see Sidebar
   * @see AppView
   */
  hideSidebarNav: boolean
}

/**
 * SidebarConfigContext provides sidebar configuration throughout the app.
 *
 * Initialize with a default value of null so downstream usages will trigger
 * runtime errors if context expected to exist but does not.
 */
export const SidebarConfigContext =
  createContext<SidebarConfigContextProps | null>(null)

// Set the context display name for useRequiredContext error message
SidebarConfigContext.displayName = "SidebarConfigContext"

/**
 * Custom hook to access SidebarConfigContext values in components.
 * Throws an error if used outside of a SidebarConfigContext.Provider.
 */
export const useSidebarConfigContext = (): SidebarConfigContextProps => {
  return useRequiredContext(SidebarConfigContext)
}
