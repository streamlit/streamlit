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

class AppNavigationV1 {
  appPages: IAppPage[]

  currentPageScriptHash: string | null

  hideSidebarNav: boolean | null

  parent: AppNavigation

  constructor(parent: AppNavigation) {
    this.parent = parent
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
    this.parent.onUpdatePageUrl(mainPageName, newPageName, isViewingMainPage)

    // Set the title to its default value
    document.title = `${newPageName ?? ""} · Streamlit`

    this.parent.metricsMgr.enqueue("updateReport", {
      numPages: this.appPages.length,
      isMainPage: isViewingMainPage,
    })

    return [
      {
        hideSidebarNav: this.hideSidebarNav,
        appPages: this.appPages,
        currentPageScriptHash: this.currentPageScriptHash,
      },
      () => {
        this.parent.hostCommunicationMgr.sendMessageToHost({
          type: "SET_APP_PAGES",
          appPages: this.appPages,
        })

        this.parent.hostCommunicationMgr.sendMessageToHost({
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
        this.parent.hostCommunicationMgr.sendMessageToHost({
          type: "SET_APP_PAGES",
          appPages,
        })
      },
    ]
  }

  handlePageNotFound(pageNotFound: PageNotFound): MaybeStateUpdate {
    const { pageName } = pageNotFound
    this.parent.onPageNotFound(pageName)
    const currentPageScriptHash = this.appPages[0]?.pageScriptHash ?? ""

    return [
      { currentPageScriptHash },
      () => {
        this.parent.hostCommunicationMgr.sendMessageToHost({
          type: "SET_CURRENT_PAGE_NAME",
          currentPageName: "",
          currentPageScriptHash,
        })
      },
    ]
  }
}

export class AppNavigation {
  readonly hostCommunicationMgr: HostCommunicationManager

  readonly metricsMgr: SegmentMetricsManager

  readonly onUpdatePageUrl: PageUrlUpdateCallback

  readonly onPageNotFound: PageNotFoundCallback

  private versionManager: AppNavigationV1

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
    this.versionManager = new AppNavigationV1(this)
  }

  handleNewSession(newSession: NewSession): MaybeStateUpdate {
    return this.versionManager.handleNewSession(newSession)
  }

  handlePagesChanged(pagesChangedMsg: PagesChanged): MaybeStateUpdate {
    return this.versionManager.handlePagesChanged(pagesChangedMsg)
  }

  handlePageNotFound(pageNotFoundMsg: PageNotFound): MaybeStateUpdate {
    return this.versionManager.handlePageNotFound(pageNotFoundMsg)
  }
}
