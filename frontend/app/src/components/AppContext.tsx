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

import { IGitInfo, Logo, PageConfig } from "@streamlit/protobuf"

export interface AppContextProps {
  /**
   * The sidebar's default display state.
   * Set from the PageConfig protobuf.
   * Pulled from appContext in AppView as prop to ThemedSidebar.
   * @see Sidebar
   */
  initialSidebarState: PageConfig.SidebarState

  /**
   * The app logo (displayed in top left corner of app)
   * Pulled from appContext in Sidebar
   * @see SidebarNav
   */
  appLogo: Logo | null

  /**
   * If non-zero, this is the number of pixels that the sidebar's
   * "chevron" icon is shifted. (If sidebarChevronDownshift is 0, then
   * the current theme's spacing is used.);
   * this is set from the host communication manager via host message.
   * Pulled from appContext in AppView & ThemedSidebar
   * @see AppView (StyledSidebarOpenContainer)
   * @see Sidebar (StyledSidebarOpenContainer)
   */
  sidebarChevronDownshift: number

  /**
   * Whether to expand the sidebar nav section by default.
   * Pulled from appContext in SidebarNav
   * @see SidebarNav
   */
  expandSidebarNav: boolean

  /**
   * Whether to hide the sidebar nav. Can be configured via host message.
   * Used to control visibility of multi-page app navigation in sidebar.
   * Pulled from appContext in Sidebar
   * @see Sidebar
   * @see AppView
   */
  hideSidebarNav: boolean

  /**
   * Whether to disable widgets and sidebar page navigation links, based on connection
   * state and whether the host has disabled inputs.
   * Pulled from appContext in AppView as prop to VerticalBlock > ElementNodeRenderer
   * Pulled from appContext in SidebarNavLink
   * @see ElementNodeRenderer
   * @see SidebarNavLink
   */
  widgetsDisabled: boolean

  /**
   * The latest state of the git information related to the app.
   * Pulled from appContext in DeployDialog
   * @see DeployDialog
   */
  gitInfo: IGitInfo | null

  /**
   * Whether to show the toolbar in the app header.
   * Can be configured via host message.
   * Pulled from appContext in Header
   * @see Header
   */
  showToolbar: boolean
}

export const AppContext = createContext<AppContextProps | null>({
  initialSidebarState: PageConfig.SidebarState.AUTO,
  appLogo: null,
  sidebarChevronDownshift: 0,
  expandSidebarNav: false,
  hideSidebarNav: false,
  widgetsDisabled: false,
  gitInfo: null,
  showToolbar: true,
})
AppContext.displayName = "AppContext"
