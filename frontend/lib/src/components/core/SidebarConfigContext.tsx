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
 * We provide safe default values to prevent crashes during initial render
 * before the App component has fully initialized. These match the default
 * behavior when no explicit configuration is provided.
 */
export const SidebarConfigContext = createContext<SidebarConfigContextProps>({
  initialSidebarState: PageConfig.SidebarState.AUTO,
  appLogo: null,
  sidebarChevronDownshift: 0,
  expandSidebarNav: false,
  hideSidebarNav: false,
})

// Set the context display name for React DevTools
SidebarConfigContext.displayName = "SidebarConfigContext"
