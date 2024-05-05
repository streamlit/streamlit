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
  AppRoot,
  HostCommunicationManager,
  IAppPage,
  Navigation,
  NewSession,
  PagesChanged,
  PageNotFound,
} from "@streamlit/lib"
import { SegmentMetricsManager } from "@streamlit/app/src/SegmentMetricsManager"

interface AppNavigationState {
  hideSidebarNav: boolean
  appPages: IAppPage[]
  currentPageScriptHash: string
  navPageSections: Map<string, IAppPage[]>
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

  static generalClearPageElements(
    elements: AppRoot,
    hideSidebarNav: boolean,
    mainScriptHash: string
  ): AppRoot {
    // Handle hideSidebarNav = true -> retain sidebar elements to avoid flicker
    const sidebarElements = (hideSidebarNav && elements.sidebar) || undefined

    return AppRoot.empty(mainScriptHash, false, sidebarElements)
  }

  clearPageElements(
    elements: AppRoot,
    hideSidebarNav: boolean,
    mainScriptHash: string
  ): AppRoot {
    return AppNavigationV1.generalClearPageElements(
      elements,
      hideSidebarNav,
      mainScriptHash
    )
  }

  static generalGetPageFromPageName(appPages: IAppPage[]): IAppPage {
    return (
      appPages.find(appPage =>
        // The page name is embedded at the end of the URL path, and if not, we are in the main page.
        // See https://github.com/streamlit/streamlit/blob/1.19.0/frontend/src/App.tsx#L740
        document.location.pathname.endsWith("/" + appPage.pageName)
      ) ?? appPages[0]
    )
  }

  getPageFromPageName(
    appPages: IAppPage[],
    _navPageSections: Map<string, IAppPage[]>
  ): IAppPage {
    return AppNavigationV1.generalGetPageFromPageName(appPages)
  }
}

export class AppNavigationV2 {
  private readonly parent: AppNavigation

  constructor(parent: AppNavigation) {
    this.parent = parent
  }

  handleNewSession(_newSession: NewSession): MaybeStateUpdate {
    // We do not know the page name, so use an empty string version
    document.title = " · Streamlit"

    return undefined
  }

  handleNavigation(navigationMsg: Navigation): MaybeStateUpdate {
    const { sections, position } = navigationMsg
    const navPageSections = new Map()
    for (const section of sections) {
      navPageSections.set(section.header || "", section.appPages)
    }

    const appPages = sections.flatMap(section => section.appPages || [])
    const hideSidebarNav = position == "hidden"

    const currentPage = appPages.find(
      p => p.pageScriptHash === navigationMsg.pageScriptHash
    ) as IAppPage
    const currentPageScriptHash = currentPage.pageScriptHash as string
    const currentPageName = currentPage.isDefault
      ? ""
      : (currentPage.pageName as string)

    this.parent.metricsMgr.enqueue("updateReport", {
      numPages: appPages.length,
      isMainPage: currentPage.isDefault,
      // TODO(kmcgrady): Add metric for v2 or v1
    })

    document.title = `${currentPage.pageName as string} · Streamlit`
    this.parent.onUpdatePageUrl(
      "",
      currentPageName.replaceAll(" ", "_"),
      currentPage.isDefault ?? false
    )

    return [
      {
        appPages: [],
        navPageSections,
        hideSidebarNav,
        currentPageScriptHash,
      },
      () => {
        this.parent.hostCommunicationMgr.sendMessageToHost({
          type: "SET_APP_PAGES",
          appPages,
        })

        this.parent.hostCommunicationMgr.sendMessageToHost({
          type: "SET_CURRENT_PAGE_NAME",
          currentPageName: currentPageName,
          currentPageScriptHash,
        })
      },
    ]
  }

  handlePagesChanged(_pagesChangedMsg: PagesChanged): MaybeStateUpdate {
    return undefined
  }

  handlePageNotFound(_pageNotFound: PageNotFound): MaybeStateUpdate {
    return undefined
  }

  clearPageElements(
    elements: AppRoot,
    _hideSidebarNav: boolean,
    mainScriptHash: string
  ): AppRoot {
    return elements.clearPageNodes(mainScriptHash)
  }

  getPageFromPageName(
    _appPages: IAppPage[],
    navPageSections: Map<string, IAppPage[]>
  ): IAppPage {
    const allPages = Array.from(navPageSections.values()).flat()
    const targetPage = allPages.find(appPage =>
      // The page name is embedded at the end of the URL path, and if not, we are in the main page.
      // See https://github.com/streamlit/streamlit/blob/1.19.0/frontend/src/App.tsx#L740
      document.location.pathname.endsWith(
        "/" + appPage.pageName?.replaceAll(" ", "_")
      )
    )

    // default page must exist in list
    return targetPage ?? (allPages.find(p => p.isDefault) as IAppPage)
  }
}

export class AppNavigation {
  readonly hostCommunicationMgr: HostCommunicationManager

  readonly metricsMgr: SegmentMetricsManager

  readonly onUpdatePageUrl: PageUrlUpdateCallback

  readonly onPageNotFound: PageNotFoundCallback

  private versionManager: AppNavigationV2 | AppNavigationV1 | null

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
    this.versionManager = null
  }

  handleNewSession(newSession: NewSession): MaybeStateUpdate {
    if (newSession.appPages.length > 1 && this.versionManager === null) {
      // We assume it's V1 based on our understanding so far
      this.versionManager = new AppNavigationV1(this)
    }

    return this.versionManager?.handleNewSession(newSession)
  }

  handlePagesChanged(pagesChangedMsg: PagesChanged): MaybeStateUpdate {
    return this.versionManager?.handlePagesChanged(pagesChangedMsg)
  }

  handleNavigation(navigation: Navigation): MaybeStateUpdate {
    if (!(this.versionManager instanceof AppNavigationV2)) {
      // We ensure it's V2 for the remainder of the session
      this.versionManager = new AppNavigationV2(this)
    }

    return this.versionManager.handleNavigation(navigation)
  }

  handlePageNotFound(pageNotFoundMsg: PageNotFound): MaybeStateUpdate {
    return this.versionManager?.handlePageNotFound(pageNotFoundMsg)
  }

  clearPageElements(
    elements: AppRoot,
    hideSidebarNav: boolean,
    mainScriptHash: string
  ): AppRoot {
    if (this.versionManager === null) {
      return AppNavigationV1.generalClearPageElements(
        elements,
        hideSidebarNav,
        mainScriptHash
      )
    }

    return this.versionManager.clearPageElements(
      elements,
      hideSidebarNav,
      mainScriptHash
    )
  }

  getPageFromPageName(
    appPages: IAppPage[],
    navPageSections: Map<string, IAppPage[]>
  ): IAppPage {
    if (this.versionManager === null) {
      return AppNavigationV1.generalGetPageFromPageName(appPages)
    }

    return this.versionManager.getPageFromPageName(appPages, navPageSections)
  }
}
