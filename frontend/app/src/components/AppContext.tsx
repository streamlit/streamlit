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

import { IGitInfo } from "@streamlit/protobuf"

export interface AppContextProps {
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
  widgetsDisabled: false,
  gitInfo: null,
  showToolbar: true,
})
AppContext.displayName = "AppContext"
