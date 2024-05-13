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
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import {
  HostCommunicationManager,
  NewSession,
  SessionInfo,
  PagesChanged,
  PageNotFound,
} from "@streamlit/lib"
import { SegmentMetricsManager } from "@streamlit/app/src/SegmentMetricsManager"
import {
  AppNavigation,
  PageUrlUpdateCallback,
  PageNotFoundCallback,
} from "./AppNavigation"

jest.mock("@streamlit/lib/src/hostComm/HostCommunicationManager", () => {
  const actualModule = jest.requireActual(
    "@streamlit/lib/src/hostComm/HostCommunicationManager"
  )

  const MockedClass = jest.fn().mockImplementation((...props) => {
    const hostCommunicationMgr = new actualModule.default(...props)
    jest.spyOn(hostCommunicationMgr, "sendMessageToHost")
    return hostCommunicationMgr
  })

  return {
    __esModule: true,
    ...actualModule,
    default: MockedClass,
  }
})

jest.mock("@streamlit/app/src/SegmentMetricsManager", () => {
  const actualModule = jest.requireActual(
    "@streamlit/app/src/SegmentMetricsManager"
  )

  const MockedClass = jest.fn().mockImplementation((...props) => {
    const metricsMgr = new actualModule.SegmentMetricsManager(...props)
    jest.spyOn(metricsMgr, "enqueue")

    return metricsMgr
  })

  return {
    ...actualModule,
    SegmentMetricsManager: MockedClass,
  }
})

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
      },
      environmentInfo: {
        streamlitVersion: "streamlitVersion",
        pythonVersion: "pythonVersion",
      },
      sessionStatus: {
        runOnSave: false,
        scriptIsRunning: false,
      },
      sessionId: "sessionId",
      isHello: false,
    },
    appPages: [
      { pageScriptHash: "page_script_hash", pageName: "streamlit_app" },
    ],
    pageScriptHash: "page_script_hash",
    mainScriptPath: "path/to/file.py",
    scriptRunId: "script_run_id",
    fragmentIdsThisRun: [],
    ...changes,
  })
}

describe("AppNavigation", () => {
  let hostCommunicationMgr: HostCommunicationManager
  let metricsMgr: SegmentMetricsManager
  let onUpdatePageUrl: PageUrlUpdateCallback
  let onPageNotFound: PageNotFoundCallback
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
      jwtHeaderChanged: () => {},
      hostMenuItemsChanged: () => {},
      hostToolbarItemsChanged: () => {},
      hostHideSidebarNavChanged: () => {},
      sidebarChevronDownshiftChanged: () => {},
      pageLinkBaseUrlChanged: () => {},
      queryParamsChanged: () => {},
      deployedAppMetadataChanged: () => {},
    })
    metricsMgr = new SegmentMetricsManager(new SessionInfo())
    onUpdatePageUrl = jest.fn()
    onPageNotFound = jest.fn()
    appNavigation = new AppNavigation(
      hostCommunicationMgr,
      metricsMgr,
      onUpdatePageUrl,
      onPageNotFound
    )
  })

  describe("MPA v1", () => {
    it("sets appPages on new session", () => {
      const maybeState = appNavigation.handleNewSession(generateNewSession())
      expect(maybeState).not.toBeUndefined()

      const [newState] = maybeState!
      expect(newState.appPages).toEqual([
        { pageScriptHash: "page_script_hash", pageName: "streamlit_app" },
      ])
    })

    it("sets currentPageScriptHash on new session", () => {
      const maybeState = appNavigation.handleNewSession(generateNewSession())
      expect(maybeState).not.toBeUndefined()

      const [newState] = maybeState!
      expect(newState.currentPageScriptHash).toEqual("page_script_hash")
    })

    it("calls host communication on new session", () => {
      const maybeState = appNavigation.handleNewSession(generateNewSession({}))
      expect(maybeState).not.toBeUndefined()

      const callback = maybeState![1]

      callback()
      expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
        type: "SET_APP_PAGES",
        appPages: [
          { pageScriptHash: "page_script_hash", pageName: "streamlit_app" },
        ],
      })

      expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
        type: "SET_CURRENT_PAGE_NAME",
        currentPageName: "",
        currentPageScriptHash: "page_script_hash",
      })
    })
  })

  it("calls onUpdatePageUrl with the right information", () => {
    appNavigation.handleNewSession(generateNewSession())
    expect(onUpdatePageUrl).toHaveBeenCalledWith(
      "streamlit_app",
      "streamlit_app",
      true
    )
  })

  it("sets appPages on pages changed", () => {
    const maybeState = appNavigation.handlePagesChanged(
      new PagesChanged({
        appPages: [
          { pageScriptHash: "other_page_script_hash", pageName: "foo_bar" },
        ],
      })
    )
    expect(maybeState).not.toBeUndefined()

    const [newState] = maybeState!
    expect(newState.appPages).toEqual([
      { pageScriptHash: "other_page_script_hash", pageName: "foo_bar" },
    ])
  })

  it("calls host communication on pages changed", () => {
    const maybeState = appNavigation.handlePagesChanged(
      new PagesChanged({
        appPages: [
          { pageScriptHash: "other_page_script_hash", pageName: "foo_bar" },
        ],
      })
    )
    expect(maybeState).not.toBeUndefined()

    const callback = maybeState![1]

    callback()
    expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
      type: "SET_APP_PAGES",
      appPages: [
        { pageScriptHash: "other_page_script_hash", pageName: "foo_bar" },
      ],
    })
  })

  it("sets currentPageScriptHash on page not found", () => {
    // Initialize navigation from the new session proto
    appNavigation.handleNewSession(generateNewSession())
    const maybeState = appNavigation.handlePageNotFound(
      new PageNotFound({ pageName: "foo" })
    )
    expect(maybeState).not.toBeUndefined()

    const [newState] = maybeState!
    expect(newState.currentPageScriptHash).toEqual("page_script_hash")
  })

  it("calls host communication on page not found", () => {
    // Initialize navigation from the new session proto
    appNavigation.handleNewSession(generateNewSession())
    const maybeState = appNavigation.handlePageNotFound(
      new PageNotFound({ pageName: "foo" })
    )
    expect(maybeState).not.toBeUndefined()

    const callback = maybeState![1]

    callback()
    expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
      type: "SET_CURRENT_PAGE_NAME",
      currentPageName: "",
      currentPageScriptHash: "page_script_hash",
    })
  })

  it("calls onPageNotFound when page not found", () => {
    // Initialize navigation from the new session proto
    appNavigation.handleNewSession(generateNewSession())
    appNavigation.handlePageNotFound(new PageNotFound({ pageName: "foo" }))
    expect(onPageNotFound).toHaveBeenCalledWith("foo")
  })

  it("sends metrics when initialized", () => {
    // Initialize navigation from the new session proto
    appNavigation.handleNewSession(generateNewSession())
    appNavigation.sendMPAMetricsOnInitialization()

    expect(metricsMgr.enqueue).toHaveBeenCalledWith("updateReport", {
      numPages: 1,
      isMainPage: true,
    })
  })

  it("finds url by path when path is valid", () => {
    // Initialize navigation from the new session proto
    appNavigation.handleNewSession(generateNewSession())
    const page = appNavigation.findPageByUrlPath("streamlit_app")

    expect(page.pageScriptHash).toEqual("page_script_hash")
    expect(page.pageName).toEqual("streamlit_app")
  })

  it("returns default url by path when path is invalid", () => {
    // Initialize navigation from the new session proto
    appNavigation.handleNewSession(generateNewSession())
    const page = appNavigation.findPageByUrlPath("foo")

    expect(page.pageScriptHash).toEqual("page_script_hash")
    expect(page.pageName).toEqual("streamlit_app")
  })
})
