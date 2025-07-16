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
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { MockInstance } from "vitest"

import { HostCommunicationManager } from "@streamlit/lib"
import {
  AppPage,
  Navigation,
  NewSession,
  PageConfig,
} from "@streamlit/protobuf"

import {
  AppNavigation,
  PageNotFoundCallback,
  PageUrlUpdateCallback,
  SetIconCallback,
} from "./AppNavigation"

function generateNewSession(changes = {}): NewSession {
  return new NewSession({
    name: "scriptName",
    config: {
      gatherUsageStats: false,
      maxCachedMessageAge: 0,
      mapboxToken: "mapboxToken",
      allowRunOnSave: false,
      hideSidebarNav: false,
      hideTopBar: false,
    },
    customTheme: {
      primaryColor: "red",
      fontFaces: [],
    },
    initialize: {
      userInfo: {
        installationId: "installationId",
        installationIdV3: "installationIdV3",
        installationIdV4: "mockInstallationIdV4",
      },
      environmentInfo: {
        streamlitVersion: "streamlitVersion",
        pythonVersion: "pythonVersion",
        serverOs: "mockServerOS",
        hasDisplay: true,
      },
      sessionStatus: {
        runOnSave: false,
        scriptIsRunning: false,
      },
      sessionId: "sessionId",
      isHello: false,
    },
    appPages: [
      {
        pageScriptHash: "page_script_hash",
        pageName: "streamlit app",
        urlPathname: "streamlit_app",
      },
    ],
    pageScriptHash: "page_script_hash",
    mainScriptHash: "main_script_hash",
    mainScriptPath: "path/to/file.py",
    scriptRunId: "script_run_id",
    fragmentIdsThisRun: [],
    ...changes,
  })
}

describe("AppNavigation", () => {
  let hostCommunicationMgr: HostCommunicationManager
  let sendMessageToHost: MockInstance
  let onUpdatePageUrl: PageUrlUpdateCallback
  let onPageNotFound: PageNotFoundCallback
  let onPageIconChange: SetIconCallback
  let appNavigation: AppNavigation

  beforeEach(() => {
    hostCommunicationMgr = new HostCommunicationManager({
      sendRerunBackMsg: () => {},
      closeModal: () => {},
      stopScript: () => {},
      rerunScript: () => {},
      clearCache: () => {},
      sendAppHeartbeat: () => {},
      setInputsDisabled: () => {},
      themeChanged: () => {},
      pageChanged: () => {},
      isOwnerChanged: () => {},
      hostMenuItemsChanged: () => {},
      hostToolbarItemsChanged: () => {},
      hostHideSidebarNavChanged: () => {},
      sidebarChevronDownshiftChanged: () => {},
      pageLinkBaseUrlChanged: () => {},
      queryParamsChanged: () => {},
      deployedAppMetadataChanged: () => {},
      restartWebsocketConnection: () => {},
      terminateWebsocketConnection: () => {},
      streamlitExecutionStartedAt: 0,
      fileUploadClientConfigChanged: () => {},
    })

    sendMessageToHost = vi.spyOn(hostCommunicationMgr, "sendMessageToHost")
    onUpdatePageUrl = vi.fn()
    onPageNotFound = vi.fn()
    onPageIconChange = vi.fn()
    appNavigation = new AppNavigation(
      hostCommunicationMgr,
      onUpdatePageUrl,
      onPageNotFound,
      onPageIconChange
    )
  })

  it("sets currentPageScriptHash & hideSidebarNav on new session", () => {
    const maybeState = appNavigation.handleNewSession(generateNewSession())
    expect(maybeState).not.toBeUndefined()

    const [newState] = maybeState!
    expect(newState.currentPageScriptHash).toEqual("page_script_hash")
    expect(newState.hideSidebarNav).toEqual(false)
  })

  it("continues to set hideSidebarNav on new session", () => {
    const cleanAppNavigation = new AppNavigation(
      hostCommunicationMgr,
      onUpdatePageUrl,
      onPageNotFound,
      onPageIconChange
    )

    cleanAppNavigation.handleNavigation(
      new Navigation({
        sections: ["section1", "section2"],
        appPages: [
          new AppPage({
            pageName: "streamlit_app",
            pageScriptHash: "page_script_hash",
            isDefault: true,
            sectionHeader: "section1",
          }),
          new AppPage({
            pageName: "streamlit_app2",
            pageScriptHash: "page_script_hash2",
            isDefault: false,
            sectionHeader: "section2",
          }),
        ],
        position: Navigation.Position.HIDDEN,
        pageScriptHash: "page_script_hash",
        expanded: false,
      })
    )

    const maybeState = cleanAppNavigation.handleNewSession(
      generateNewSession()
    )
    expect(maybeState).not.toBeUndefined()

    const [newState] = maybeState!
    expect(newState).toEqual({
      currentPageScriptHash: "page_script_hash",
      hideSidebarNav: true,
    })
  })

  it("sets currentPageScriptHash on page not found", () => {
    // Initialize navigation from the new session proto
    appNavigation.handleNewSession(generateNewSession())
    const maybeState = appNavigation.handlePageNotFound("")
    expect(maybeState).not.toBeUndefined()

    const [newState] = maybeState!
    expect(newState.currentPageScriptHash).toEqual("main_script_hash")
  })

  it("calls host communication on page not found", () => {
    // Initialize navigation from the new session proto
    appNavigation.handleNewSession(generateNewSession())
    const maybeState = appNavigation.handlePageNotFound("")
    expect(maybeState).not.toBeUndefined()

    const callback = maybeState![1]

    callback()
    expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
      type: "SET_CURRENT_PAGE_NAME",
      currentPageName: "",
      currentPageScriptHash: "main_script_hash",
    })
  })

  it("calls onPageNotFound when page not found", () => {
    // Initialize navigation from the new session proto
    appNavigation.handleNewSession(generateNewSession())
    appNavigation.handlePageNotFound("")
    expect(onPageNotFound).toHaveBeenCalledWith("")
  })

  it("calls onUpdatePageUrl with the right information", () => {
    const navigation = new Navigation({
      sections: ["section1", "section2"],
      appPages: [
        new AppPage({
          pageName: "streamlit app",
          pageScriptHash: "page_script_hash",
          isDefault: true,
          urlPathname: "streamlit_app",
        }),
        new AppPage({
          pageName: "streamlit app2",
          pageScriptHash: "page_script_hash2",
          isDefault: false,
          urlPathname: "streamlit_app2",
        }),
      ],
      position: Navigation.Position.HIDDEN,
      pageScriptHash: "page_script_hash2",
      expanded: false,
    })
    appNavigation.handleNavigation(navigation)
    expect(onUpdatePageUrl).toHaveBeenCalledWith(
      "streamlit_app",
      "streamlit_app2",
      false
    )
  })

  it("finds url by path when path is valid", () => {
    const navigation = new Navigation({
      sections: ["section1", "section2"],
      appPages: [
        new AppPage({
          pageName: "streamlit app",
          pageScriptHash: "page_script_hash",
          isDefault: true,
          urlPathname: "streamlit_app",
        }),
        new AppPage({
          pageName: "streamlit app2",
          pageScriptHash: "page_script_hash2",
          isDefault: false,
          urlPathname: "streamlit_app2",
        }),
      ],
      position: Navigation.Position.HIDDEN,
      pageScriptHash: "page_script_hash",
      expanded: false,
    })
    appNavigation.handleNavigation(navigation)
    const page = appNavigation.findPageByUrlPath("/streamlit_app2")

    expect(page!.pageScriptHash).toEqual("page_script_hash2")
    expect(page!.pageName).toEqual("streamlit app2")
  })

  it("returns default url by path when path is invalid", () => {
    const navigation = new Navigation({
      sections: ["section1", "section2"],
      appPages: [
        new AppPage({
          pageName: "streamlit app",
          pageScriptHash: "page_script_hash",
          isDefault: true,
          sectionHeader: "section1",
          urlPathname: "streamlit_app",
        }),
        new AppPage({
          pageName: "streamlit app2",
          pageScriptHash: "page_script_hash2",
          isDefault: false,
          sectionHeader: "section2",
          urlPathname: "streamlit_app2",
        }),
      ],
      position: Navigation.Position.HIDDEN,
      pageScriptHash: "page_script_hash",
      expanded: false,
    })
    appNavigation.handleNavigation(navigation)
    const page = appNavigation.findPageByUrlPath("foo")

    expect(page!.pageScriptHash).toEqual("page_script_hash")
    expect(page!.pageName).toEqual("streamlit app")
  })

  it("sets navigation state to hidden on navigation", () => {
    const appPages = [
      new AppPage({
        pageName: "streamlit_app",
        pageScriptHash: "page_script_hash",
        isDefault: true,
        sectionHeader: "section1",
      }),
      new AppPage({
        pageName: "streamlit_app2",
        pageScriptHash: "page_script_hash2",
        isDefault: false,
        sectionHeader: "section2",
      }),
    ]
    const navigation = new Navigation({
      sections: ["section1", "section2"],
      appPages,
      position: Navigation.Position.HIDDEN,
      pageScriptHash: "page_script_hash",
      expanded: false,
    })
    const maybeState = appNavigation.handleNavigation(navigation)
    expect(maybeState).not.toBeUndefined()

    const [newState] = maybeState!
    expect(newState).toEqual({
      appPages,
      hideSidebarNav: true,
      expandSidebarNav: false,
      currentPageScriptHash: "page_script_hash",
      navSections: ["section1", "section2"],
    })
  })

  it("sets navigation state to expanded on navigation", () => {
    const appPages = [
      new AppPage({
        pageName: "streamlit_app",
        pageScriptHash: "page_script_hash",
        isDefault: true,
        sectionHeader: "section1",
      }),
      new AppPage({
        pageName: "streamlit_app2",
        pageScriptHash: "page_script_hash2",
        isDefault: false,
        sectionHeader: "section2",
      }),
    ]
    const navigation = new Navigation({
      sections: ["section1", "section2"],
      appPages,
      position: Navigation.Position.SIDEBAR,
      pageScriptHash: "page_script_hash",
      expanded: true,
    })
    const maybeState = appNavigation.handleNavigation(navigation)
    expect(maybeState).not.toBeUndefined()

    const [newState] = maybeState!
    expect(newState).toEqual({
      appPages,
      hideSidebarNav: false,
      expandSidebarNav: true,
      currentPageScriptHash: "page_script_hash",
      navSections: ["section1", "section2"],
    })
  })

  it("calls host communication on navigation", () => {
    const appPages = [
      new AppPage({
        pageName: "streamlit_app",
        pageScriptHash: "page_script_hash",
        isDefault: true,
        sectionHeader: "section1",
        icon: "icon1",
      }),
      new AppPage({
        pageName: "streamlit_app2",
        pageScriptHash: "page_script_hash2",
        isDefault: false,
        sectionHeader: "section2",
        icon: "icon2",
      }),
    ]
    const navigation = new Navigation({
      sections: ["section1", "section2"],
      appPages,
      position: Navigation.Position.HIDDEN,
      pageScriptHash: "page_script_hash",
      expanded: false,
    })
    const maybeState = appNavigation.handleNavigation(navigation)
    expect(maybeState).not.toBeUndefined()

    const callback = maybeState![1]
    callback()

    expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
      type: "SET_PAGE_TITLE",
      title: "streamlit_app",
    })

    expect(onPageIconChange).toBeCalled()

    expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
      type: "SET_APP_PAGES",
      appPages,
    })

    expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
      type: "SET_CURRENT_PAGE_NAME",
      currentPageName: "",
      currentPageScriptHash: "page_script_hash",
    })
  })

  it("does not set the icon if set page config sets title or icon", () => {
    // Clear the mock calls to avoid any confusion from setup
    sendMessageToHost.mockClear()
    appNavigation.handlePageConfigChanged(
      new PageConfig({
        title: "foo",
        favicon: "bar",
      })
    )

    const navigation = new Navigation({
      sections: ["section1", "section2"],
      appPages: [
        new AppPage({
          pageName: "streamlit app",
          pageScriptHash: "page_script_hash",
          isDefault: true,
          sectionHeader: "section1",
          urlPathname: "streamlit_app",
          icon: "icon1",
        }),
        new AppPage({
          pageName: "streamlit app2",
          pageScriptHash: "page_script_hash2",
          isDefault: false,
          sectionHeader: "section2",
          urlPathname: "streamlit_app2",
          icon: "icon2",
        }),
      ],
      position: Navigation.Position.HIDDEN,
      pageScriptHash: "page_script_hash",
      expanded: false,
    })
    appNavigation.handleNavigation(navigation)
    const hostCommCalls = sendMessageToHost.mock.calls

    expect(hostCommCalls.some(call => call[0].type === "SET_PAGE_TITLE")).toBe(
      false
    )
    expect(onPageIconChange).not.toBeCalled()
  })
})
