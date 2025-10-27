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

import { IAppPage } from "@streamlit/protobuf"

import { useRequiredContext } from "~lib/hooks/useRequiredContext"

export interface NavigationContextProps {
  /**
   * Part of URL construction for an app page in a multi-page app.
   * Set from the host communication manager via host message.
   *
   * Consumed by:
   * @see SidebarNav
   */
  pageLinkBaseUrl: string

  /**
   * The current page of a multi-page app. Used for highlighting the active
   * page in navigation and managing page state.
   *
   * Consumed by:
   * @see SidebarNav
   * @see SidebarNavLink
   * @see PageLink
   */
  currentPageScriptHash: string

  /**
   * Change the page in a multi-page app. Called when user clicks on a
   * navigation link.
   *
   * Consumed by:
   * @see SidebarNav
   * @see PageLink
   */
  onPageChange: (pageScriptHash: string) => void

  /**
   * The nav sections in a multi-page app. Used to group pages into
   * collapsible sections in the sidebar navigation.
   *
   * Consumed by:
   * @see SidebarNav
   */
  navSections: string[]

  /**
   * The pages in a multi-page app. Contains metadata about each page
   * including name, script hash, and icon.
   *
   * Consumed by:
   * @see SidebarNav
   * @see TopNav
   * @see shouldShowNavigation
   */
  appPages: IAppPage[]
}

/**
 * NavigationContext provides multi-page app navigation state and controls.
 *
 * Initialize with a default value of null so downstream usages will trigger
 * runtime errors if context expected to exist but does not.
 */
export const NavigationContext = createContext<NavigationContextProps | null>(
  null
)

// Set the context display name for useRequiredContext error message
NavigationContext.displayName = "NavigationContext"

/**
 * Custom hook to access NavigationContext values in components.
 * Throws an error if used outside of a NavigationContext.Provider.
 */
export const useNavigationContext = (): NavigationContextProps => {
  return useRequiredContext(NavigationContext)
}
