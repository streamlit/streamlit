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
  BlockNode,
  HostCommunicationManager,
  IAppPage,
  Navigation,
  NewSession,
  PageConfig,
  PageNotFound,
  PagesChanged,
} from "@streamlit/lib"

interface AppNavigationState {
  expandSidebarNav: boolean
  hideSidebarNav: boolean
  appPages: IAppPage[]
  currentPageScriptHash: string
  navSections: string[]
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
export type SetIconCallback = (icon: string) => void

function getTitle(pageName: string): string {
  if (!pageName) {
    return "Streamlit"
  }

  return pageName
}

export class StrategyV1 {
  private appPages: IAppPage[]

  private currentPageScriptHash: string | null

  private hideSidebarNav: boolean | null

  private readonly appNav: AppNavigation

  constructor(appNav: AppNavigation) {
    this.appNav = appNav
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
    const mainPageName = mainPage.urlPathname ?? ""
    // We're similarly guaranteed that newPageName will be found / truthy
    // here.
    const newPageName =
      this.appPages.find(
        page => page.pageScriptHash === this.currentPageScriptHash
      )?.urlPathname ?? ""

    const isViewingMainPage =
      mainPage.pageScriptHash === this.currentPageScriptHash
    this.appNav.onUpdatePageUrl(mainPageName, newPageName, isViewingMainPage)

    // Set the title to its default value
    document.title = getTitle(newPageName ?? "")

    return [
      {
        hideSidebarNav: this.hideSidebarNav,
        appPages: this.appPages,
        currentPageScriptHash: this.currentPageScriptHash,
      },
      () => {
        this.appNav.hostCommunicationMgr.sendMessageToHost({
          type: "SET_APP_PAGES",
          appPages: this.appPages,
        })

        this.appNav.hostCommunicationMgr.sendMessageToHost({
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
        this.appNav.hostCommunicationMgr.sendMessageToHost({
          type: "SET_APP_PAGES",
          appPages,
        })
      },
    ]
  }

  handlePageNotFound(pageNotFound: PageNotFound): MaybeStateUpdate {
    const { pageName } = pageNotFound
    this.appNav.onPageNotFound(pageName)
    const currentPageScriptHash = this.appPages[0]?.pageScriptHash ?? ""
    this.currentPageScriptHash = currentPageScriptHash

    return [
      { currentPageScriptHash },
      () => {
        this.appNav.hostCommunicationMgr.sendMessageToHost({
          type: "SET_CURRENT_PAGE_NAME",
          currentPageName: "",
          currentPageScriptHash,
        })
      },
    ]
  }

  handleNavigation(_navigationMsg: Navigation): MaybeStateUpdate {
    // This message does not apply to V1
    return undefined
  }

  findPageByUrlPath(pathname: string): IAppPage | null {
    if (this.appPages.length === 0) {
      return null
    }

    return (
      this.appPages.find(appPage =>
        pathname.endsWith("/" + appPage.urlPathname)
      ) ?? this.appPages[0]
    )
  }

  clearPageElements(
    elements: AppRoot,
    mainScriptHash: string,
    sidebarElements: BlockNode | undefined
  ): AppRoot {
    return AppRoot.empty(mainScriptHash, false, sidebarElements, elements.logo)
  }
}

export class StrategyV2 {
  readonly appNav: AppNavigation

  mainScriptHash: string | null

  appPages: IAppPage[]

  mainPage: IAppPage | null

  hideSidebarNav: boolean | null

  constructor(appNav: AppNavigation) {
    this.appNav = appNav
    this.mainScriptHash = null
    this.appPages = []
    this.mainPage = null
    this.hideSidebarNav = null
  }

  handleNewSession(newSession: NewSession): MaybeStateUpdate {
    this.mainScriptHash = newSession.mainScriptHash
    // Initialize to the config value if provided
    if (this.hideSidebarNav === null) {
      this.hideSidebarNav = newSession.config?.hideSidebarNav ?? null
    }

    // We do not know the page name, so use an empty string version
    document.title = getTitle("")

    return [{ hideSidebarNav: this.hideSidebarNav ?? false }, () => {}]
  }

  handlePagesChanged(_pagesChangedMsg: PagesChanged): MaybeStateUpdate {
    // This message does not apply to V2
    return undefined
  }

  handlePageNotFound(pageNotFound: PageNotFound): MaybeStateUpdate {
    const { pageName } = pageNotFound
    this.appNav.onPageNotFound(pageName)

    return [
      { currentPageScriptHash: this.mainScriptHash ?? "" },
      () => {
        this.appNav.hostCommunicationMgr.sendMessageToHost({
          type: "SET_CURRENT_PAGE_NAME",
          currentPageName: "",
          currentPageScriptHash: this.mainScriptHash ?? "",
        })
      },
    ]
  }

  handleNavigation(navigationMsg: Navigation): MaybeStateUpdate {
    const { sections, position, appPages } = navigationMsg

    this.appPages = appPages
    this.hideSidebarNav = position === Navigation.Position.HIDDEN

    const currentPageScriptHash = navigationMsg.pageScriptHash
    const currentPage = appPages.find(
      p => p.pageScriptHash === currentPageScriptHash
    ) as IAppPage
    const mainPage = appPages.find(p => p.isDefault) as IAppPage
    this.mainPage = mainPage
    const currentPageName = currentPage.urlPathname as string

    if (!this.appNav.isPageTitleSet) {
      const title = getTitle(currentPage.pageName as string)
      document.title = title
      this.appNav.hostCommunicationMgr.sendMessageToHost({
        type: "SET_PAGE_TITLE",
        title: currentPage.pageName ?? "",
      })
    }

    if (!this.appNav.isPageIconSet && currentPage.icon) {
      this.appNav.onPageIconChange(currentPage.icon)
    }

    this.appNav.onUpdatePageUrl(
      mainPage.urlPathname ?? "",
      currentPageName,
      currentPage.isDefault ?? false
    )

    return [
      {
        appPages,
        navSections: sections,
        hideSidebarNav: this.hideSidebarNav,
        expandSidebarNav: navigationMsg.expanded,
        currentPageScriptHash,
      },
      () => {
        this.appNav.hostCommunicationMgr.sendMessageToHost({
          type: "SET_APP_PAGES",
          appPages,
        })

        this.appNav.hostCommunicationMgr.sendMessageToHost({
          type: "SET_CURRENT_PAGE_NAME",
          // Make sure we don't send the official page name for the main page
          // This command is used to update the URL in the url bar, so the main page
          // should not have a page name in the URL.
          currentPageName: currentPage.isDefault ? "" : currentPageName,
          currentPageScriptHash,
        })
      },
    ]
  }

  findPageByUrlPath(pathname: string): IAppPage | null {
    return (
      this.appPages.find(appPage =>
        // The page name is embedded at the end of the URL path, and if not, we are in the main page.
        // See https://github.com/streamlit/streamlit/blob/1.19.0/frontend/src/App.tsx#L740
        pathname.endsWith("/" + appPage.urlPathname)
      ) ?? this.mainPage
    )
  }

  clearPageElements(
    elements: AppRoot,
    mainScriptHash: string,
    _sidebarElements: BlockNode | undefined
  ): AppRoot {
    return elements.filterMainScriptElements(mainScriptHash)
  }
}

export class AppNavigation {
  readonly hostCommunicationMgr: HostCommunicationManager

  readonly onUpdatePageUrl: PageUrlUpdateCallback

  readonly onPageNotFound: PageNotFoundCallback

  readonly onPageIconChange: SetIconCallback

  isPageTitleSet: boolean

  isPageIconSet: boolean

  strategy: StrategyV1 | StrategyV2

  constructor(
    hostCommunicationMgr: HostCommunicationManager,
    onUpdatePageUrl: PageUrlUpdateCallback,
    onPageNotFound: PageNotFoundCallback,
    onPageIconChange: SetIconCallback
  ) {
    this.hostCommunicationMgr = hostCommunicationMgr
    this.onUpdatePageUrl = onUpdatePageUrl
    this.onPageNotFound = onPageNotFound
    this.onPageIconChange = onPageIconChange
    this.isPageIconSet = false
    this.isPageTitleSet = false

    // Start with the V1 strategy as it will apply to V0 as well
    this.strategy = new StrategyV1(this)
  }

  handleNewSession(newSession: NewSession): MaybeStateUpdate {
    this.isPageTitleSet = false
    this.isPageIconSet = false

    return this.strategy.handleNewSession(newSession)
  }

  handleNavigation(navigationMsg: Navigation): MaybeStateUpdate {
    // Navigation call (through st.navigation) indicates we are using
    // MPA v2. We can change strategy here. It will set the state properly
    if (this.strategy instanceof StrategyV1) {
      this.strategy = new StrategyV2(this)
    }

    return this.strategy.handleNavigation(navigationMsg)
  }

  handlePagesChanged(pagesChangedMsg: PagesChanged): MaybeStateUpdate {
    return this.strategy.handlePagesChanged(pagesChangedMsg)
  }

  handlePageNotFound(pageNotFound: PageNotFound): MaybeStateUpdate {
    return this.strategy.handlePageNotFound(pageNotFound)
  }

  findPageByUrlPath(pathname: string): IAppPage | null {
    return this.strategy.findPageByUrlPath(pathname)
  }

  handlePageConfigChanged(pageConfig: PageConfig): void {
    this.isPageIconSet = Boolean(pageConfig.favicon)
    this.isPageTitleSet = Boolean(pageConfig.title)
  }

  clearPageElements(
    elements: AppRoot,
    mainScriptHash: string,
    sidebarElements: BlockNode | undefined
  ): AppRoot {
    return this.strategy.clearPageElements(
      elements,
      mainScriptHash,
      sidebarElements
    )
  }
}
