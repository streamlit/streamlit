/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import {
  HostCommunicationManager,
  IAppPage,
  NewSession,
  PagesChanged,
  PageNotFound,
} from "@streamlit/lib"
import { SegmentMetricsManager } from "@streamlit/app/src/SegmentMetricsManager"

interface AppNavigationState {
  hideSidebarNav: boolean
  appPages: IAppPage[]
  currentPageScriptHash: string
}

export type MaybeStateUpdate =
  | [Partial<AppNavigationState>, () => void]
  | undefined
export type PageUrlUpdateCallback = (
  mainPageName: string,
  newPageName: string,
  isViewingMainPage: boolean
) => void
export type PageNotFoundCallback = (pageName?: string) => void

export class AppNavigation {
  readonly hostCommunicationMgr: HostCommunicationManager

  readonly metricsMgr: SegmentMetricsManager

  readonly onUpdatePageUrl: PageUrlUpdateCallback

  readonly onPageNotFound: PageNotFoundCallback

  private appPages: IAppPage[]

  private currentPageScriptHash: string | null

  private hideSidebarNav: boolean | null

  constructor(
    hostCommunicationMgr: HostCommunicationManager,
    metricsMgr: SegmentMetricsManager,
    onUpdatePageUrl: PageUrlUpdateCallback,
    onPageNotFound: PageNotFoundCallback
  ) {
    this.hostCommunicationMgr = hostCommunicationMgr
    this.metricsMgr = metricsMgr
    this.onUpdatePageUrl = onUpdatePageUrl
    this.onPageNotFound = onPageNotFound

    this.appPages = []
    this.currentPageScriptHash = null
    this.hideSidebarNav = null
  }

  handleNewSession(newSession: NewSession): MaybeStateUpdate {
    this.appPages = newSession.appPages
    this.currentPageScriptHash = newSession.pageScriptHash
    this.hideSidebarNav = newSession.config?.hideSidebarNav ?? false

    // mainPage must be a string as we're guaranteed at this point that
    // newSessionProto.appPages is nonempty and has a truthy pageName.
    // Otherwise, we'd either have no main script or a nameless main script,
    // neither of which can happen.
    const mainPage = this.appPages[0] as IAppPage
    const mainPageName = mainPage.pageName ?? ""
    // We're similarly guaranteed that newPageName will be found / truthy
    // here.
    const newPageName =
      this.appPages.find(
        page => page.pageScriptHash === this.currentPageScriptHash
      )?.pageName ?? ""

    const isViewingMainPage =
      mainPage.pageScriptHash === this.currentPageScriptHash
    this.onUpdatePageUrl(mainPageName, newPageName, isViewingMainPage)

    // Set the title to its default value
    document.title = `${newPageName ?? ""} · Streamlit`

    return [
      {
        hideSidebarNav: this.hideSidebarNav,
        appPages: this.appPages,
        currentPageScriptHash: this.currentPageScriptHash,
      },
      () => {
        this.hostCommunicationMgr.sendMessageToHost({
          type: "SET_APP_PAGES",
          appPages: this.appPages,
        })

        this.hostCommunicationMgr.sendMessageToHost({
          type: "SET_CURRENT_PAGE_NAME",
          currentPageName: isViewingMainPage ? "" : newPageName,
          currentPageScriptHash: this.currentPageScriptHash as string,
        })
      },
    ]
  }

  handlePagesChanged(pagesChangedMsg: PagesChanged): MaybeStateUpdate {
    const { appPages } = pagesChangedMsg
    return [
      { appPages },
      () => {
        this.hostCommunicationMgr.sendMessageToHost({
          type: "SET_APP_PAGES",
          appPages,
        })
      },
    ]
  }

  handlePageNotFound(pageNotFound: PageNotFound): MaybeStateUpdate {
    const { pageName } = pageNotFound
    this.onPageNotFound(pageName)
    const currentPageScriptHash = this.appPages[0]?.pageScriptHash ?? ""
    this.currentPageScriptHash = currentPageScriptHash

    return [
      { currentPageScriptHash },
      () => {
        this.hostCommunicationMgr.sendMessageToHost({
          type: "SET_CURRENT_PAGE_NAME",
          currentPageName: "",
          currentPageScriptHash,
        })
      },
    ]
  }

  sendMPAMetricsOnInitialization(): void {
    const { appPages, currentPageScriptHash } = this
    if (appPages.length === 0) {
      return
    }

    this.metricsMgr.enqueue("updateReport", {
      numPages: appPages.length,
      isMainPage: appPages[0].pageScriptHash === currentPageScriptHash,
    })
  }

  findPageByUrlPath(pathname: string): IAppPage {
    return (
      this.appPages.find(appPage =>
        // The page name is embedded at the end of the URL path, and if not, we are in the main page.
        // See https://github.com/streamlit/streamlit/blob/1.19.0/frontend/src/App.tsx#L740
        pathname.endsWith("/" + appPage.pageName)
      ) ?? this.appPages[0]
    )
  }
}
