/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import { createContext, useContext } from "react"

export enum PageConfigSideBarState {
  EXPANDED = "expanded",
  COLLAPSED = "collapsed",
  AUTO = "auto",
}
export enum PageConfigLayout {
  WIDE = "wide",
  CENTERED = "centered",
}

export interface MenuItem {
  getHelpUrl?: string
  hideGetHelp?: boolean
  reportABugUrl?: string
  hideReportABug?: boolean
  aboutSectionMd?: string
}

export interface PageConfig {
  title?: string
  favicon?: string
  layout: PageConfigLayout
  initialSidebarState: PageConfigSideBarState
  menuItems?: MenuItem
}

export const PageConfigContext = createContext<PageConfig | null>(null)

export function useStreamlitPageConfig(): PageConfig {
  const context = useContext(PageConfigContext)

  if (context === null) {
    throw new Error(
      "useStreamlitPageConfig must be used within a PageConfigContextProvider"
    )
  }

  return context
}
