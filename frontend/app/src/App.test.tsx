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

import React from "react"
import {
  act,
  fireEvent,
  screen,
  waitFor,
  render,
  RenderResult,
} from "@testing-library/react"
import "@testing-library/jest-dom"
import cloneDeep from "lodash/cloneDeep"
import {
  LocalStore,
  mockWindowLocation,
  ScriptRunState,
  SessionInfo,
  createAutoTheme,
  CUSTOM_THEME_NAME,
  lightTheme,
  toExportedTheme,
  mockSessionInfoProps,
  Config,
  CustomThemeConfig,
  ForwardMsg,
  INewSession,
  HostCommunicationManager,
  PagesChanged,
  HOST_COMM_VERSION,
  mockEndpoints,
  WidgetStateManager,
  FileUploadClient,
  RootStyleProvider,
  getDefaultTheme,
} from "@streamlit/lib"
import { SegmentMetricsManager } from "@streamlit/app/src/SegmentMetricsManager"
import { ConnectionManager } from "@streamlit/app/src/connection/ConnectionManager"
import { ConnectionState } from "@streamlit/app/src/connection/ConnectionState"
import { App, Props, showDevelopmentOptions } from "./App"
import {
  getMenuStructure,
  openMenu,
} from "@streamlit/app/src/components/MainMenu/mainMenuTestHelpers"

jest.mock("@streamlit/lib/src/baseconsts", () => {
  return {
    ...jest.requireActual("@streamlit/lib/src/baseconsts"),
  }
})

jest.mock("@streamlit/app/src/connection/ConnectionManager", () => {
  const actualModule = jest.requireActual(
    "@streamlit/app/src/connection/ConnectionManager"
  )

  const MockedClass = jest.fn().mockImplementation(props => {
    return {
      props,
      connect: jest.fn(),
      isConnected: jest.fn(),
      disconnect: jest.fn(),
      sendMessage: jest.fn(),
      incrementMessageCacheRunCount: jest.fn(),
      getBaseUriParts() {
        return {
          basePath: "",
          host: "",
          port: 8501,
        }
      },
    }
  })

  return {
    ...actualModule,
    ConnectionManager: MockedClass,
  }
})
jest.mock("@streamlit/lib/src/SessionInfo", () => {
  const actualModule = jest.requireActual("@streamlit/lib/src/SessionInfo")

  const MockedClass = jest.fn().mockImplementation(() => {
    return new actualModule.SessionInfo()
  })

  // @ts-expect-error
  MockedClass.propsFromNewSessionMessage = jest
    .fn()
    .mockImplementation(actualModule.SessionInfo.propsFromNewSessionMessage)

  return {
    ...actualModule,
    SessionInfo: MockedClass,
  }
})

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

jest.mock("@streamlit/app/src/connection/DefaultStreamlitEndpoints", () => {
  const actualModule = jest.requireActual(
    "@streamlit/app/src/connection/DefaultStreamlitEndpoints"
  )

  const MockedClass = jest.fn().mockImplementation(() => {
    return mockEndpoints()
  })

  return {
    ...actualModule,
    DefaultStreamlitEndpoints: MockedClass,
  }
})

jest.mock("@streamlit/lib/src/WidgetStateManager", () => {
  const actualModule = jest.requireActual(
    "@streamlit/lib/src/WidgetStateManager"
  )

  const MockedClass = jest.fn().mockImplementation((...props) => {
    return new actualModule.WidgetStateManager(...props)
  })

  return {
    ...actualModule,
    WidgetStateManager: MockedClass,
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

jest.mock("@streamlit/lib/src/FileUploadClient", () => {
  const actualModule = jest.requireActual(
    "@streamlit/lib/src/FileUploadClient"
  )

  const MockedClass = jest.fn().mockImplementation((...props) => {
    return new actualModule.FileUploadClient(...props)
  })

  return {
    ...actualModule,
    FileUploadClient: MockedClass,
  }
})

const getProps = (extend?: Partial<Props>): Props => ({
  screenCast: {
    currentState: "OFF",
    toggleRecordAudio: jest.fn(),
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
  },
  theme: {
    activeTheme: lightTheme,
    availableThemes: [],
    setTheme: jest.fn(),
    addThemes: jest.fn(),
    setImportedTheme: jest.fn(),
  },
  ...extend,
})

const NEW_SESSION_JSON: INewSession = {
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
}

// Prevent "moment-timezone requires moment" exception when mocking "moment".
jest.mock("moment-timezone", () => jest.fn())
jest.mock("moment", () =>
  jest.fn().mockImplementation(() => ({
    format: () => "date",
  }))
)

// Mock needed for Block.tsx
class ResizeObserver {
  observe(): void {}

  unobserve(): void {}

  disconnect(): void {}
}
window.ResizeObserver = ResizeObserver

function renderApp(props: Props): RenderResult {
  return render(
    <RootStyleProvider theme={getDefaultTheme()}>
      <App {...props} />
    </RootStyleProvider>
  )
}

function getStoredValue<T>(Type: any): T {
  return Type.mock.results[0].value
}

function getMockConnectionManager(isConnected = false): ConnectionManager {
  const connectionManager =
    getStoredValue<ConnectionManager>(ConnectionManager)
  // @ts-expect-error
  connectionManager.isConnected.mockImplementation(() => isConnected)

  return connectionManager
}

function getMockConnectionManagerProp(propName: string): any {
  // @ts-expect-error
  return getStoredValue<ConnectionManager>(ConnectionManager).props[propName]
}

function sendForwardMessage(
  type: string,
  message: any,
  metadata: any = null
): void {
  act(() => {
    const fwMessage = new ForwardMsg()
    // @ts-expect-error
    fwMessage[type] = cloneDeep(message)
    if (metadata) {
      fwMessage.metadata = metadata
    }

    getMockConnectionManagerProp("onMessage")(fwMessage)
  })
}

function openCacheModal(): void {
  fireEvent.keyPress(screen.getByTestId("stApp"), {
    key: "c",
    which: 67,
  })

  expect(
    screen.getByText(
      "Are you sure you want to clear the app's function caches?"
    )
  ).toBeInTheDocument()
}

describe("App", () => {
  beforeEach(() => {
    // @ts-expect-error
    window.prerenderReady = false
    jest.clearAllMocks()
  })

  it("renders without crashing", () => {
    renderApp(getProps())

    expect(screen.getByTestId("stApp")).toBeInTheDocument()
  })

  it("calls connectionManager.disconnect() when unmounting", () => {
    const { unmount } = renderApp(getProps())

    unmount()

    expect(getMockConnectionManager().disconnect).toHaveBeenCalled()
  })

  describe("streamlit server version changes", () => {
    let prevWindowLocation: Location

    beforeEach(() => {
      prevWindowLocation = window.location
    })

    afterEach(() => {
      window.location = prevWindowLocation
    })

    it("triggers page reload", () => {
      renderApp(getProps())

      // A HACK to mock `window.location.reload`.
      // NOTE: The mocking must be done after mounting, but before `handleMessage` is called.
      // @ts-expect-error
      delete window.location
      // @ts-expect-error
      window.location = { reload: jest.fn() }

      // Ensure SessionInfo is initialized
      const sessionInfo = getStoredValue<SessionInfo>(SessionInfo)
      sessionInfo.setCurrent(
        mockSessionInfoProps({ streamlitVersion: "oldStreamlitVersion" })
      )
      expect(sessionInfo.isSet).toBe(true)

      sendForwardMessage("newSession", {
        config: {},
        initialize: {
          environmentInfo: {
            streamlitVersion: "newStreamlitVersion",
          },
          sessionId: "sessionId",
          userInfo: {},
          sessionStatus: {},
        },
      })

      expect(window.location.reload).toHaveBeenCalled()
    })
  })

  it("hides the top bar if hideTopBar === true", () => {
    renderApp(getProps())
    // hideTopBar is true by default

    expect(screen.queryByTestId("stStatusWidget")).not.toBeInTheDocument()
    expect(screen.queryByTestId("stToolbarActions")).not.toBeInTheDocument()
  })

  it("shows the top bar if hideTopBar === false", () => {
    renderApp(getProps())

    sendForwardMessage("newSession", NEW_SESSION_JSON)

    expect(screen.getByTestId("stStatusWidget")).toBeInTheDocument()
    expect(screen.getByTestId("stToolbarActions")).toBeInTheDocument()
  })

  it("sends updateReport to our metrics manager", () => {
    renderApp(getProps())

    const metricsManager = getStoredValue<SegmentMetricsManager>(
      SegmentMetricsManager
    )

    sendForwardMessage("newSession", NEW_SESSION_JSON)

    expect(metricsManager.enqueue).toHaveBeenCalledWith("updateReport")
  })

  describe("App.handleNewSession", () => {
    const makeAppWithElements = async (): Promise<void> => {
      renderApp(getProps())
      sendForwardMessage("newSession", NEW_SESSION_JSON)

      // Add an element to the screen
      // Need to set the script to running
      sendForwardMessage("sessionStatusChanged", {
        runOnSave: false,
        scriptIsRunning: true,
      })
      sendForwardMessage(
        "delta",
        {
          type: "newElement",
          newElement: {
            type: "text",
            text: {
              body: "Here is some text",
              help: "",
            },
          },
        },
        { deltaPath: [0, 0] }
      )

      sendForwardMessage(
        "delta",
        {
          type: "newElement",
          newElement: {
            type: "text",
            text: {
              body: "Here is some more text",
              help: "",
            },
          },
        },
        { deltaPath: [0, 1] }
      )

      // Delta Messages handle on a timer, so we make it async
      await waitFor(() => {
        expect(screen.getByText("Here is some more text")).toBeInTheDocument()
      })

      sendForwardMessage(
        "scriptFinished",
        ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY
      )
    }

    let documentTitle: string

    beforeEach(() => {
      documentTitle = document.title
    })

    afterEach(() => {
      document.title = documentTitle
      window.localStorage.clear()
    })

    it("respects the user's theme preference if set, but adds custom theme as an option", () => {
      const props = getProps()
      window.localStorage.setItem(
        LocalStore.ACTIVE_THEME,
        JSON.stringify({ name: lightTheme.name })
      )
      renderApp(props)

      sendForwardMessage("newSession", NEW_SESSION_JSON)

      expect(props.theme.addThemes).toHaveBeenCalled()
      expect(props.theme.setTheme).not.toHaveBeenCalled()
    })

    it("sets the custom theme as the default if no user preference is set", () => {
      const props = getProps()
      renderApp(props)

      sendForwardMessage("newSession", NEW_SESSION_JSON)

      expect(props.theme.addThemes).toHaveBeenCalled()
      expect(props.theme.setTheme).toHaveBeenCalled()

      // @ts-expect-error
      expect(props.theme.setTheme.mock.calls[0][0].name).toBe(
        CUSTOM_THEME_NAME
      )
    })

    it("sets the custom theme again if a custom theme is already active", () => {
      window.localStorage.setItem(
        LocalStore.ACTIVE_THEME,
        JSON.stringify({ name: CUSTOM_THEME_NAME, themeInput: {} })
      )
      const props = getProps()
      props.theme.activeTheme = {
        ...lightTheme,
        name: CUSTOM_THEME_NAME,
      }
      renderApp(props)

      sendForwardMessage("newSession", NEW_SESSION_JSON)

      expect(props.theme.addThemes).toHaveBeenCalled()
      expect(props.theme.setTheme).toHaveBeenCalled()

      // @ts-expect-error
      expect(props.theme.setTheme.mock.calls[0][0].name).toBe(
        CUSTOM_THEME_NAME
      )
    })

    it("removes the custom theme from theme options if one is not received from the server", () => {
      const props = getProps()
      renderApp(props)

      // Send Forward message with custom theme
      sendForwardMessage("newSession", NEW_SESSION_JSON)
      expect(props.theme.addThemes).toHaveBeenCalledTimes(1)

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        customTheme: null,
      })

      expect(props.theme.addThemes).toHaveBeenCalledTimes(2)

      // @ts-expect-error
      expect(props.theme.addThemes.mock.calls[1][0]).toEqual([])
    })

    it("Does not change dark/light/auto user preferences when removing a custom theme", () => {
      const props = getProps()
      renderApp(props)

      // Send Forward message with custom theme
      sendForwardMessage("newSession", NEW_SESSION_JSON)
      expect(props.theme.setTheme).toHaveBeenCalled()
      // @ts-expect-error
      props.theme.setTheme.mockClear()

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        customTheme: null,
      })

      expect(props.theme.addThemes).toHaveBeenCalledTimes(2)

      // @ts-expect-error
      expect(props.theme.addThemes.mock.calls[1][0]).toEqual([])

      expect(props.theme.setTheme).not.toHaveBeenCalled()
    })

    it("Changes theme to auto when user has a custom theme selected and it is removed", () => {
      const props = getProps()
      props.theme.activeTheme = {
        ...lightTheme,
        name: CUSTOM_THEME_NAME,
      }
      renderApp(props)

      // Send Forward message with custom theme
      sendForwardMessage("newSession", NEW_SESSION_JSON)

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        customTheme: null,
      })
      expect(props.theme.addThemes).toHaveBeenCalledTimes(2)
      // @ts-expect-error
      expect(props.theme.addThemes.mock.calls[1][0]).toEqual([])

      expect(props.theme.setTheme).toHaveBeenCalledTimes(2)
      // @ts-expect-error
      expect(props.theme.setTheme.mock.calls[1][0]).toEqual(createAutoTheme())
    })

    it("updates the custom theme if the one received from server has different hash", () => {
      const props = getProps()

      renderApp(props)
      const customThemeConfig = new CustomThemeConfig({ primaryColor: "blue" })

      // Send Forward message with custom theme
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        customTheme: customThemeConfig,
      })

      // Send Forward message with different custom theme
      sendForwardMessage("newSession", NEW_SESSION_JSON)

      expect(props.theme.addThemes).toHaveBeenCalled()
      expect(props.theme.setTheme).toHaveBeenCalled()
    })

    it("does nothing if the custom theme received from server has a matching hash", () => {
      const props = getProps()

      renderApp(props)
      const customThemeConfig = new CustomThemeConfig({ primaryColor: "blue" })

      // Send Forward message with custom theme
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        customTheme: customThemeConfig,
      })
      expect(props.theme.addThemes).toHaveBeenCalled()
      expect(props.theme.setTheme).toHaveBeenCalled()

      // @ts-expect-error
      props.theme.addThemes.mockClear()
      // @ts-expect-error
      props.theme.setTheme.mockClear()

      // Send Forward message with same custom theme
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        customTheme: customThemeConfig,
      })

      expect(props.theme.addThemes).not.toHaveBeenCalled()
      expect(props.theme.setTheme).not.toHaveBeenCalled()
    })

    it("does nothing if no custom theme is received and themeHash is 'hash_for_undefined_custom_theme'", () => {
      const props = getProps()
      renderApp(props)

      // Send Forward message with custom theme
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        customTheme: null,
      })

      expect(props.theme.addThemes).not.toHaveBeenCalled()
      expect(props.theme.setTheme).not.toHaveBeenCalled()
    })

    it("performs one-time initialization", () => {
      renderApp(getProps())

      // @ts-expect-error
      const sessionInfo = SessionInfo.mock.results[0].value

      const setCurrentSpy = jest.spyOn(sessionInfo, "setCurrent")

      act(() => {
        const fwMessage = new ForwardMsg()
        fwMessage.newSession = cloneDeep(NEW_SESSION_JSON)
        expect(sessionInfo.isSet).toBe(false)
        getMockConnectionManagerProp("onMessage")(fwMessage)
      })

      expect(setCurrentSpy).toHaveBeenCalledTimes(1)
      expect(sessionInfo.isSet).toBe(true)
    })

    it("performs one-time initialization only once", () => {
      renderApp(getProps())

      // @ts-expect-error
      const sessionInfo = SessionInfo.mock.results[0].value

      const setCurrentSpy = jest.spyOn(sessionInfo, "setCurrent")

      expect(sessionInfo.isSet).toBe(false)
      sendForwardMessage("newSession", NEW_SESSION_JSON)

      expect(setCurrentSpy).toHaveBeenCalledTimes(1)
      expect(sessionInfo.isSet).toBe(true)
      setCurrentSpy.mockClear()

      sendForwardMessage("newSession", NEW_SESSION_JSON)
      sendForwardMessage("newSession", NEW_SESSION_JSON)
      sendForwardMessage("newSession", NEW_SESSION_JSON)
      expect(setCurrentSpy).not.toHaveBeenCalled()
      expect(sessionInfo.isSet).toBe(true)
    })

    it("performs one-time initialization after a new session is received", () => {
      renderApp(getProps())

      // @ts-expect-error
      const sessionInfo = SessionInfo.mock.results[0].value

      const setCurrentSpy = jest.spyOn(sessionInfo, "setCurrent")

      expect(sessionInfo.isSet).toBe(false)
      sendForwardMessage("newSession", NEW_SESSION_JSON)

      expect(setCurrentSpy).toHaveBeenCalledTimes(1)
      expect(sessionInfo.isSet).toBe(true)
      setCurrentSpy.mockClear()

      sendForwardMessage("newSession", NEW_SESSION_JSON)
      expect(setCurrentSpy).not.toHaveBeenCalled()
      expect(sessionInfo.isSet).toBe(true)

      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.PINGING_SERVER
        )
      })

      expect(sessionInfo.isSet).toBe(false)
      // For clearing the current session info
      expect(setCurrentSpy).toHaveBeenCalledTimes(1)

      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.CONNECTED
        )
      })

      sendForwardMessage("newSession", NEW_SESSION_JSON)

      expect(setCurrentSpy).toHaveBeenCalledTimes(2)
      expect(sessionInfo.isSet).toBe(true)
    })

    it("should set window.prerenderReady to true after app script is run successfully first time", () => {
      renderApp(getProps())

      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.CONNECTING
        )
        // @ts-expect-error
        expect(window.prerenderReady).toBe(false)

        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.CONNECTED
        )
      })

      sendForwardMessage("sessionStatusChanged", {
        runOnSave: false,
        scriptIsRunning: true,
      })

      // @ts-expect-error
      expect(window.prerenderReady).toBe(false)

      sendForwardMessage("sessionStatusChanged", {
        runOnSave: false,
        scriptIsRunning: false,
      })

      // @ts-expect-error
      expect(window.prerenderReady).toBe(true)

      // window.prerenderReady is set to true after first run
      sendForwardMessage("sessionStatusChanged", {
        runOnSave: false,
        scriptIsRunning: true,
      })
      // @ts-expect-error
      expect(window.prerenderReady).toBe(true)
    })

    it("plumbs appPages and currentPageScriptHash to the AppView component", () => {
      renderApp(getProps())
      const hostCommunicationMgr = getStoredValue<HostCommunicationManager>(
        HostCommunicationManager
      )

      expect(screen.queryByTestId("stSidebarNav")).not.toBeInTheDocument()

      const appPages = [
        { pageScriptHash: "hash1", pageName: "page1" },
        { pageScriptHash: "hash2", pageName: "page2" },
      ]

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        appPages,
        pageScriptHash: "hash1",
      })

      expect(screen.getByTestId("stSidebarNav")).toBeInTheDocument()
      const navLinks = screen.queryAllByTestId("stSidebarNavLink")
      expect(navLinks).toHaveLength(2)
      expect(navLinks[0]).toHaveStyle("font-weight: 600")
      expect(navLinks[1]).toHaveStyle("font-weight: 400")

      expect(document.title).toBe("page1 · Streamlit")
      expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
        type: "SET_APP_PAGES",
        appPages,
      })
      expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
        type: "SET_CURRENT_PAGE_NAME",
        currentPageName: "",
        currentPageScriptHash: "hash1",
      })
    })

    it("clears app elements if currentPageScriptHash changes", async () => {
      await makeAppWithElements()

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        pageScriptHash: "different_hash",
      })

      await waitFor(() =>
        expect(screen.queryByText("Here is some text")).not.toBeInTheDocument()
      )
    })

    it("does not add stale app elements if currentPageScriptHash changes", async () => {
      await makeAppWithElements()

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        pageScriptHash: "different_hash",
        scriptRunId: "different_script_run_id",
      })

      // elements are cleared
      expect(
        screen.queryByText("Here is some more text")
      ).not.toBeInTheDocument()

      // Run the script with one new element
      sendForwardMessage("sessionStatusChanged", {
        runOnSave: false,
        scriptIsRunning: true,
      })
      sendForwardMessage(
        "delta",
        {
          type: "newElement",
          newElement: {
            type: "text",
            text: {
              body: "Here is some other text",
              help: "",
            },
          },
        },
        { deltaPath: [0, 0] }
      )

      // Wait for the new element to appear on the screen
      await waitFor(() => {
        expect(screen.getByText("Here is some other text")).toBeInTheDocument()
      })

      // Continue to expect the original element removed
      expect(
        screen.queryByText("Here is some more text")
      ).not.toBeInTheDocument()
    })

    it("doesn't clear app elements if currentPageScriptHash doesn't change", async () => {
      await waitFor(() => {
        makeAppWithElements()
      })

      sendForwardMessage("newSession", NEW_SESSION_JSON)

      const element = await screen.findByText("Here is some text")
      expect(element).toBeInTheDocument()
    })

    describe("page change URL handling", () => {
      let pushStateSpy: any

      beforeEach(() => {
        window.history.pushState({}, "", "/")
        pushStateSpy = jest.spyOn(window.history, "pushState")
      })

      afterEach(() => {
        pushStateSpy.mockRestore()
        window.history.pushState({}, "", "/")
      })

      it("can switch to the main page from a different page", () => {
        renderApp(getProps())
        window.history.replaceState({}, "", "/page2")

        sendForwardMessage("newSession", NEW_SESSION_JSON)

        expect(window.history.pushState).toHaveBeenLastCalledWith({}, "", "/")
      })

      it("can switch to a non-main page", () => {
        renderApp(getProps())
        sendForwardMessage("newSession", {
          ...NEW_SESSION_JSON,
          appPages: [
            { pageScriptHash: "page_script_hash", pageName: "streamlit_app" },
            { pageScriptHash: "hash2", pageName: "page2" },
          ],
          pageScriptHash: "hash2",
        })

        expect(window.history.pushState).toHaveBeenLastCalledWith(
          {},
          "",
          "/page2"
        )
      })

      it("does not retain the query string without embed params", () => {
        renderApp(getProps())
        window.history.pushState({}, "", "/?foo=bar")

        sendForwardMessage("newSession", NEW_SESSION_JSON)

        expect(window.history.pushState).toHaveBeenLastCalledWith(
          {},
          "",
          "/?foo=bar"
        )
      })

      it("retains embed query params even if the page hash is different", () => {
        const embedParams =
          "embed=true&embed_options=disable_scrolling&embed_options=show_colored_line"
        window.history.pushState({}, "", `/?${embedParams}`)

        renderApp(getProps())

        const hostCommunicationMgr = getStoredValue<HostCommunicationManager>(
          HostCommunicationManager
        )

        const appPages = [
          { pageScriptHash: "toppage_hash", pageName: "streamlit_app" },
          { pageScriptHash: "subpage_hash", pageName: "page2" },
        ]

        // Because the page URL is already "/" pointing to the main page, no new history is pushed.
        sendForwardMessage("newSession", {
          ...NEW_SESSION_JSON,
          appPages,
          pageScriptHash: "toppage_hash",
        })

        const navLinks = screen.queryAllByTestId("stSidebarNavLink")
        expect(navLinks).toHaveLength(2)

        fireEvent.click(navLinks[1])

        const connectionManager = getMockConnectionManager()

        expect(
          // @ts-expect-error
          connectionManager.sendMessage.mock.calls[0][0].rerunScript
            .queryString
        ).toBe(embedParams)

        expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
          type: "SET_QUERY_PARAM",
          queryParams: embedParams,
        })
      })

      it("works with baseUrlPaths", () => {
        renderApp(getProps())
        jest
          .spyOn(getMockConnectionManager(), "getBaseUriParts")
          .mockReturnValue({
            basePath: "foo",
            host: "",
            port: 8501,
          })

        sendForwardMessage("newSession", {
          ...NEW_SESSION_JSON,
          appPages: [
            { pageScriptHash: "page_script_hash", pageName: "streamlit_app" },
            { pageScriptHash: "hash2", pageName: "page2" },
          ],
          pageScriptHash: "hash2",
        })

        expect(window.history.pushState).toHaveBeenLastCalledWith(
          {},
          "",
          "/foo/page2"
        )
      })

      it("doesn't push a new history when the same page URL is already set", () => {
        renderApp(getProps())
        history.replaceState({}, "", "/") // The URL is set to the main page from the beginning.

        const appPages = [
          { pageScriptHash: "toppage_hash", pageName: "streamlit_app" },
          { pageScriptHash: "subpage_hash", pageName: "page2" },
        ]

        // Because the page URL is already "/" pointing to the main page, no new history is pushed.
        sendForwardMessage("newSession", {
          ...NEW_SESSION_JSON,
          appPages,
          pageScriptHash: "toppage_hash",
        })

        expect(window.history.pushState).not.toHaveBeenCalled()
        // @ts-expect-error
        window.history.pushState.mockClear()

        // When accessing a different page, a new history for that page is pushed.
        sendForwardMessage("newSession", {
          ...NEW_SESSION_JSON,
          appPages,
          pageScriptHash: "subpage_hash",
        })
        expect(window.history.pushState).toHaveBeenLastCalledWith(
          {},
          "",
          "/page2"
        )
        // @ts-expect-error
        window.history.pushState.mockClear()
      })

      it("doesn't push a duplicated history when rerunning", () => {
        renderApp(getProps())
        history.replaceState({}, "", "/page2") // Starting from a not main page.

        const appPages = [
          { pageScriptHash: "toppage_hash", pageName: "streamlit_app" },
          { pageScriptHash: "subpage_hash", pageName: "page2" },
        ]

        // Because the page URL is already "/" pointing to the main page, no new history is pushed.
        sendForwardMessage("newSession", {
          ...NEW_SESSION_JSON,
          appPages,
          pageScriptHash: "toppage_hash",
        })

        expect(window.history.pushState).toHaveBeenLastCalledWith({}, "", "/")
        // @ts-expect-error
        window.history.pushState.mockClear()

        // When running the same, e.g. clicking the "rerun" button,
        // the history is not pushed again.
        sendForwardMessage("newSession", {
          ...NEW_SESSION_JSON,
          appPages,
          pageScriptHash: "toppage_hash",
        })
        expect(window.history.pushState).not.toHaveBeenCalled()
        // @ts-expect-error
        window.history.pushState.mockClear()

        // When accessing a different page, a new history for that page is pushed.
        sendForwardMessage("newSession", {
          ...NEW_SESSION_JSON,
          appPages,
          pageScriptHash: "subpage_hash",
        })
        expect(window.history.pushState).toHaveBeenLastCalledWith(
          {},
          "",
          "/page2"
        )
        // @ts-expect-error
        window.history.pushState.mockClear()
      })
    })

    it("resets document title if not fragment", () => {
      renderApp(getProps())

      document.title = "some title"

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        fragmentIdsThisRun: [],
      })

      expect(document.title).toBe("streamlit_app · Streamlit")
    })

    it("does *not* reset document title if fragment", () => {
      renderApp(getProps())

      document.title = "some title"

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        fragmentIdsThisRun: ["myFragmentId"],
      })

      expect(document.title).toBe("some title")
    })
  })

  describe("DeployButton", () => {
    it("initially button should be hidden", () => {
      renderApp(getProps())

      expect(screen.queryByTestId("stDeployButton")).not.toBeInTheDocument()
    })

    it("button should be visible in development mode", () => {
      renderApp(getProps())

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        config: {
          ...NEW_SESSION_JSON.config,
          toolbarMode: Config.ToolbarMode.DEVELOPER,
        },
      })

      expect(screen.getByTestId("stDeployButton")).toBeInTheDocument()
    })

    it("button should be hidden in viewer mode", () => {
      renderApp(getProps())

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        config: {
          ...NEW_SESSION_JSON.config,
          toolbarMode: Config.ToolbarMode.VIEWER,
        },
      })

      expect(screen.queryByTestId("stDeployButton")).not.toBeInTheDocument()
    })

    it("button should be hidden for hello app", () => {
      renderApp(getProps())

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        config: {
          ...NEW_SESSION_JSON.config,
          toolbarMode: Config.ToolbarMode.VIEWER,
        },
        initialize: {
          ...NEW_SESSION_JSON.initialize,
          isHello: true,
        },
      })

      expect(screen.queryByTestId("stDeployButton")).not.toBeInTheDocument()
    })
  })

  describe("App.onHistoryChange", () => {
    const NEW_SESSION_JSON = {
      config: {
        gatherUsageStats: false,
        maxCachedMessageAge: 0,
        mapboxToken: "mapboxToken",
        allowRunOnSave: false,
        hideSidebarNav: false,
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
        { pageScriptHash: "top_hash", pageName: "streamlit_app" },
        { pageScriptHash: "sub_hash", pageName: "page2" },
      ],
      pageScriptHash: "top_hash",
      fragmentIdsThisRun: [],
    }

    beforeEach(() => {
      window.history.pushState({}, "", "/")
    })

    it("handles popState events, e.g. clicking browser's back button", async () => {
      renderApp(getProps())

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        pageScriptHash: "sub_hash",
      })

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        pageScriptHash: "top_hash",
      })

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        pageScriptHash: "sub_hash",
      })

      const connectionManager = getMockConnectionManager()

      window.history.back()
      await waitFor(() => {
        expect(connectionManager.sendMessage).toBeCalledTimes(1)
      })

      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[0][0].rerunScript
          .pageScriptHash
      ).toBe("top_hash")
      // @ts-expect-error
      connectionManager.sendMessage.mockClear()

      window.history.back()
      await waitFor(() => {
        expect(connectionManager.sendMessage).toBeCalledTimes(1)
      })

      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[0][0].rerunScript
          .pageScriptHash
      ).toBe("sub_hash")
    })

    it("doesn't rerun when we are on the same page and the url contains an anchor", () => {
      renderApp(getProps())

      window.history.pushState({}, "", "#foo_bar")
      const connectionManager = getMockConnectionManager()

      expect(connectionManager.sendMessage).not.toBeCalled()
      window.history.back()
      expect(connectionManager.sendMessage).not.toBeCalled()
    })

    it("does rerun when we are navigating to a different page and the last window history url contains an anchor", async () => {
      renderApp(getProps())

      // navigate to current page with anchor
      window.history.pushState({}, "", "#foo_bar")
      window.history.back()
      const connectionManager = getMockConnectionManager()
      expect(connectionManager.sendMessage).not.toBeCalled()

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        pageScriptHash: "sub_hash",
      })
      window.history.back()

      await waitFor(() => {
        expect(connectionManager.sendMessage).toBeCalledTimes(1)
      })

      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[0][0].rerunScript
          .pageScriptHash
      ).toBe("top_hash")
    })
  })

  describe("App.handlePageConfigChanged", () => {
    let documentTitle: string

    beforeEach(() => {
      documentTitle = document.title
    })

    afterEach(() => {
      document.title = documentTitle
    })

    it("sets document title when 'PageConfig.title' is set", () => {
      renderApp(getProps())
      sendForwardMessage("pageConfigChanged", {
        title: "Jabberwocky",
      })

      expect(document.title).toBe("Jabberwocky")
    })
  })

  // Using this to test the functionality provided through streamlit.experimental_set_query_params.
  // Please see https://github.com/streamlit/streamlit/issues/2887 for more context on this.
  describe("App.handlePageInfoChanged", () => {
    let pushStateSpy: any

    beforeEach(() => {
      window.history.pushState({}, "", "/")

      pushStateSpy = jest.spyOn(window.history, "pushState")
    })

    afterEach(() => {
      pushStateSpy.mockRestore()
      // Reset the value of document.location.pathname.
      window.history.pushState({}, "", "/")
    })

    it("does not override the pathname when setting query params", () => {
      renderApp(getProps())
      const pathname = "/foo/bar/"
      // Set the value of document.location.pathname to pathname.
      window.history.pushState({}, "", pathname)

      const queryString = "flying=spaghetti&monster=omg"
      const expectedUrl = `${pathname}?${queryString}`

      sendForwardMessage("pageInfoChanged", {
        queryString,
      })

      expect(pushStateSpy).toHaveBeenLastCalledWith({}, "", expectedUrl)
    })

    it("does not override the pathname when resetting query params", () => {
      renderApp(getProps())
      const pathname = "/foo/bar/"
      // Set the value of document.location.pathname to pathname.
      window.history.pushState({}, "", pathname)

      sendForwardMessage("pageInfoChanged", {
        queryString: "",
      })

      expect(pushStateSpy).toHaveBeenLastCalledWith({}, "", pathname)
    })

    it("resets query params as expected when at the root pathname", () => {
      renderApp(getProps())
      // Note: One would typically set the value of document.location.pathname to '/' here,
      // However, this is already taking place in beforeEach().

      sendForwardMessage("pageInfoChanged", {
        queryString: "",
      })

      expect(pushStateSpy).toHaveBeenLastCalledWith({}, "", "/")
    })

    it("sets query params as expected when at the root pathname", () => {
      renderApp(getProps())
      // Note: One would typically set the value of document.location.pathname to '/' here,
      // However, this is already taking place in beforeEach().

      const queryString = "flying=spaghetti&monster=omg"

      sendForwardMessage("pageInfoChanged", {
        queryString,
      })

      const expectedUrl = `/?${queryString}`
      expect(pushStateSpy).toHaveBeenLastCalledWith({}, "", expectedUrl)
    })
  })

  describe("App.sendRerunBackMsg", () => {
    afterEach(() => {
      window.history.pushState({}, "", "/")
    })

    it("sends the currentPageScriptHash if no pageScriptHash is given", () => {
      renderApp(getProps())

      // Set initial pageScriptHash
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        pageScriptHash: "some_other_page_hash",
      })

      const widgetStateManager =
        getStoredValue<WidgetStateManager>(WidgetStateManager)
      const connectionManager = getMockConnectionManager()

      widgetStateManager.sendUpdateWidgetsMessage(undefined)
      expect(connectionManager.sendMessage).toBeCalledTimes(1)

      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[0][0].rerunScript
          .pageScriptHash
      ).toBe("some_other_page_hash")
    })

    it("sets fragmentId in BackMsg", () => {
      renderApp(getProps())

      const widgetStateManager =
        getStoredValue<WidgetStateManager>(WidgetStateManager)
      const connectionManager = getMockConnectionManager()

      widgetStateManager.sendUpdateWidgetsMessage(undefined)
      widgetStateManager.sendUpdateWidgetsMessage("myFragmentId")
      expect(connectionManager.sendMessage).toBeCalledTimes(2)

      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[0][0].rerunScript.fragmentId
      ).toBe(undefined)
      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[1][0].rerunScript.fragmentId
      ).toBe("myFragmentId")
    })

    it("extracts the pageName as an empty string if we can't get a pageScriptHash (main page)", () => {
      renderApp(getProps())
      const widgetStateManager =
        getStoredValue<WidgetStateManager>(WidgetStateManager)
      const connectionManager = getMockConnectionManager()

      widgetStateManager.sendUpdateWidgetsMessage(undefined)
      expect(connectionManager.sendMessage).toBeCalledTimes(1)

      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[0][0].rerunScript
          .pageScriptHash
      ).toBe("")
    })

    it("extracts the pageName as the URL path if we can't get a pageScriptHash (non-main page)", () => {
      renderApp(getProps())
      window.history.pushState({}, "", "/foo/")
      const widgetStateManager =
        getStoredValue<WidgetStateManager>(WidgetStateManager)
      const connectionManager = getMockConnectionManager()

      widgetStateManager.sendUpdateWidgetsMessage(undefined)
      expect(connectionManager.sendMessage).toBeCalledTimes(1)

      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[0][0].rerunScript.pageName
      ).toBe("foo")
    })

    it("extracts the pageName as the last part of the URL if we can't get a pageScriptHash and we have a nonempty basePath", () => {
      renderApp(getProps())
      const widgetStateManager =
        getStoredValue<WidgetStateManager>(WidgetStateManager)
      const connectionManager = getMockConnectionManager()

      jest.spyOn(connectionManager, "getBaseUriParts").mockReturnValue({
        basePath: "foo/bar",
        host: "",
        port: 8501,
      })

      window.history.pushState({}, "", "/foo/bar/baz")
      widgetStateManager.sendUpdateWidgetsMessage(undefined)

      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[0][0].rerunScript.pageName
      ).toBe("baz")
    })

    it("sets queryString to an empty string if the page hash is different", () => {
      renderApp(getProps())

      const hostCommunicationMgr = getStoredValue<HostCommunicationManager>(
        HostCommunicationManager
      )

      const appPages = [
        { pageScriptHash: "toppage_hash", pageName: "streamlit_app" },
        { pageScriptHash: "subpage_hash", pageName: "page2" },
      ]

      // Because the page URL is already "/" pointing to the main page, no new history is pushed.
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        appPages,
        pageScriptHash: "toppage_hash",
      })
      sendForwardMessage("pageInfoChanged", {
        queryString: "foo=bar",
      })

      const navLinks = screen.queryAllByTestId("stSidebarNavLink")
      expect(navLinks).toHaveLength(2)

      fireEvent.click(navLinks[1])

      const connectionManager = getMockConnectionManager()

      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[0][0].rerunScript
          .pageScriptHash
      ).toBe("subpage_hash")

      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[0][0].rerunScript.queryString
      ).toBe("")

      expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
        type: "SET_QUERY_PARAM",
        queryParams: "",
      })
    })
  })

  describe("App.handleScriptFinished", () => {
    it("will not increment cache count if session info is not set", () => {
      renderApp(getProps())

      sendForwardMessage(
        "scriptFinished",
        ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY
      )

      const connectionManager = getMockConnectionManager()
      expect(connectionManager.incrementMessageCacheRunCount).not.toBeCalled()
    })

    it("will not increment cache count if session info is not set and the script finished early", () => {
      renderApp(getProps())

      sendForwardMessage(
        "scriptFinished",
        ForwardMsg.ScriptFinishedStatus.FINISHED_EARLY_FOR_RERUN
      )

      const connectionManager = getMockConnectionManager()
      expect(connectionManager.incrementMessageCacheRunCount).not.toBeCalled()
    })

    it("will not increment cache count if session info is set and the script finished early", () => {
      renderApp(getProps())
      sendForwardMessage("newSession", NEW_SESSION_JSON)
      sendForwardMessage(
        "scriptFinished",
        ForwardMsg.ScriptFinishedStatus.FINISHED_EARLY_FOR_RERUN
      )

      const connectionManager = getMockConnectionManager()
      expect(connectionManager.incrementMessageCacheRunCount).not.toBeCalled()
    })

    it("will increment cache count if session info is set", () => {
      renderApp(getProps())
      sendForwardMessage("newSession", NEW_SESSION_JSON)
      sendForwardMessage(
        "scriptFinished",
        ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY
      )

      const connectionManager = getMockConnectionManager()
      expect(connectionManager.incrementMessageCacheRunCount).toBeCalled()
    })
  })

  //   * handlePageNotFound has branching error messages depending on pageName
  describe("App.handlePageNotFound", () => {
    it("includes the missing page name in error modal message if available", () => {
      renderApp(getProps())
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        appPages: [{ pageScriptHash: "page_hash", pageName: "streamlit_app" }],
        pageScriptHash: "page_hash",
      })
      const hostCommunicationMgr = getStoredValue<HostCommunicationManager>(
        HostCommunicationManager
      )

      sendForwardMessage("pageNotFound", { pageName: "nonexistentPage" })
      expect(screen.getByText("Page not found")).toBeInTheDocument()
      expect(
        screen.getByText("You have requested page /nonexistentPage", {
          exact: false,
        })
      ).toBeInTheDocument()

      expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
        type: "SET_CURRENT_PAGE_NAME",
        currentPageName: "",
        currentPageScriptHash: "page_hash",
      })
    })

    it("uses a more generic error message if no page name is available", () => {
      renderApp(getProps())
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        appPages: [{ pageScriptHash: "page_hash", pageName: "streamlit_app" }],
        pageScriptHash: "page_hash",
      })
      const hostCommunicationMgr = getStoredValue<HostCommunicationManager>(
        HostCommunicationManager
      )

      const sendMessageFunc = jest.spyOn(
        hostCommunicationMgr,
        "sendMessageToHost"
      )

      sendForwardMessage("pageNotFound", { pageName: "" })

      expect(screen.getByText("Page not found")).toBeInTheDocument()
      expect(
        screen.getByText(
          "The page that you have requested does not seem to exist",
          { exact: false }
        )
      ).toBeInTheDocument()
      expect(sendMessageFunc).toHaveBeenCalledWith({
        type: "SET_CURRENT_PAGE_NAME",
        currentPageName: "",
        currentPageScriptHash: "page_hash",
      })
    })
  })

  describe("App.handleDeltaMessage", () => {
    it("renders something on the screen", async () => {
      renderApp(getProps())
      // Need to set up a Script ID
      sendForwardMessage("newSession", NEW_SESSION_JSON)
      // Need to set the script to running
      sendForwardMessage("sessionStatusChanged", {
        runOnSave: false,
        scriptIsRunning: true,
      })
      sendForwardMessage(
        "delta",
        {
          type: "newElement",
          newElement: {
            type: "text",
            text: {
              body: "Here is some text",
              help: "",
            },
          },
        },
        { deltaPath: [0, 0] }
      )

      // Delta Messages handle on a timer, so we make it async
      await waitFor(() => {
        expect(screen.getByText("Here is some text")).toBeInTheDocument()
      })
    })

    it("calls MetricsManager handleDeltaMessage", () => {
      renderApp(getProps())

      const metricsManager = getStoredValue<SegmentMetricsManager>(
        SegmentMetricsManager
      )
      const handleDeltaMessageSpy = jest.spyOn(
        metricsManager,
        "handleDeltaMessage"
      )

      // Need to set up a Script ID
      sendForwardMessage("newSession", NEW_SESSION_JSON)
      // Need to set the script to running
      sendForwardMessage("sessionStatusChanged", {
        runOnSave: false,
        scriptIsRunning: true,
      })
      sendForwardMessage(
        "delta",
        {
          type: "newElement",
          newElement: {
            type: "text",
            text: {
              body: "Here is some text",
              help: "",
            },
          },
        },
        { deltaPath: [0, 0] }
      )

      expect(handleDeltaMessageSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe("App.handleAutoRerun and autoRerun interval handling", () => {
    beforeEach(() => {
      jest.useFakeTimers()
      jest.spyOn(global, "setInterval")
      jest.spyOn(global, "clearInterval")
    })

    it("sets interval to call sendUpdateWidgetsMessage", () => {
      renderApp(getProps())
      sendForwardMessage("autoRerun", {
        interval: 1.0,
        fragmentId: "myFragmentId",
      })

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 1000)
    })

    it("clears intervals on handleNewSession message", () => {
      renderApp(getProps())
      sendForwardMessage("autoRerun", {
        interval: 1.0,
        fragmentId: "myFragmentId",
      })
      sendForwardMessage("autoRerun", {
        interval: 2.0,
        fragmentId: "myFragmentId",
      })

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 1000)
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 2000)

      sendForwardMessage("newSession", { ...NEW_SESSION_JSON })

      expect(clearInterval).toHaveBeenCalledWith(expect.any(Number))
      expect(clearInterval).toHaveBeenCalledWith(expect.any(Number))
    })
  })

  describe("App.requestFileURLs", () => {
    it("properly constructs fileUrlsRequest BackMsg", () => {
      renderApp(getProps())

      const sessionInfo = getStoredValue<SessionInfo>(SessionInfo)
      sessionInfo.setCurrent(mockSessionInfoProps())

      const connectionManager = getMockConnectionManager(true)

      const fileUploadClient =
        getStoredValue<FileUploadClient>(FileUploadClient)

      // @ts-expect-error - requestFileURLs is private
      fileUploadClient.requestFileURLs(
        "myRequestId",
        // @ts-expect-error
        [{ name: "file1.txt" }, { name: "file2.txt" }, { name: "file3.txt" }]
      )

      // It's called twice
      // Once for the initial script run
      // Once for the file upload
      expect(connectionManager.sendMessage).toHaveBeenCalledTimes(1)

      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[0][0].toJSON()
      ).toStrictEqual({
        fileUrlsRequest: {
          fileNames: ["file1.txt", "file2.txt", "file3.txt"],
          requestId: "myRequestId",
          sessionId: "mockSessionId",
        },
      })
    })

    it("does nothing if server is disconnected", () => {
      renderApp(getProps())

      const fileUploadClient =
        getStoredValue<FileUploadClient>(FileUploadClient)

      // @ts-expect-error - requestFileURLs is private
      fileUploadClient.requestFileURLs(
        "myRequestId",
        // @ts-expect-error
        [{ name: "file1.txt" }, { name: "file2.txt" }, { name: "file3.txt" }]
      )

      const connectionManager = getMockConnectionManager()

      expect(connectionManager.sendMessage).not.toBeCalled()
    })
  })

  describe("Test Main Menu shortcut functionality", () => {
    it("Tests dev menu shortcuts cannot be accessed as a viewer", () => {
      renderApp(getProps())

      getMockConnectionManager(true)

      fireEvent.keyPress(screen.getByTestId("stApp"), {
        key: "c",
        which: 67,
      })

      expect(
        screen.queryByText(
          "Are you sure you want to clear the app's function caches?"
        )
      ).not.toBeInTheDocument()
    })

    it("Tests dev menu shortcuts can be accessed as a developer", () => {
      renderApp(getProps())

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        config: {
          ...NEW_SESSION_JSON.config,
          toolbarMode: Config.ToolbarMode.DEVELOPER,
        },
      })

      getMockConnectionManager(true)

      expect(openCacheModal).not.toThrow()
    })
  })

  describe("showDevelopmentMenu", () => {
    it.each([
      // # Test cases for toolbarMode = Config.ToolbarMode.AUTO
      // Show developer menu only for localhost.
      ["localhost", false, Config.ToolbarMode.AUTO, true],
      ["127.0.0.1", false, Config.ToolbarMode.AUTO, true],
      ["remoteHost", false, Config.ToolbarMode.AUTO, false],
      // Show developer menu only for all host when hostIsOwner == true.
      ["localhost", true, Config.ToolbarMode.AUTO, true],
      ["127.0.0.1", true, Config.ToolbarMode.AUTO, true],
      ["remoteHost", true, Config.ToolbarMode.AUTO, true],
      // # Test cases for toolbarMode = Config.ToolbarMode.DEVELOPER
      // Show developer menu always regardless of other parameters
      ["localhost", false, Config.ToolbarMode.DEVELOPER, true],
      ["127.0.0.1", false, Config.ToolbarMode.DEVELOPER, true],
      ["remoteHost", false, Config.ToolbarMode.DEVELOPER, true],
      ["localhost", true, Config.ToolbarMode.DEVELOPER, true],
      ["127.0.0.1", true, Config.ToolbarMode.DEVELOPER, true],
      ["remoteHost", true, Config.ToolbarMode.DEVELOPER, true],
      // # Test cases for toolbarMode = Config.ToolbarMode.VIEWER
      // Hide developer menu always regardless of other parameters
      ["localhost", false, Config.ToolbarMode.VIEWER, false],
      ["127.0.0.1", false, Config.ToolbarMode.VIEWER, false],
      ["remoteHost", false, Config.ToolbarMode.VIEWER, false],
      ["localhost", true, Config.ToolbarMode.VIEWER, false],
      ["127.0.0.1", true, Config.ToolbarMode.VIEWER, false],
      ["remoteHost", true, Config.ToolbarMode.VIEWER, false],
    ])(
      "should render or not render dev menu depending on hostname, host ownership, toolbarMode[%s, %s, %s]",
      async (hostname, hostIsOwnr, toolbarMode, expectedResult) => {
        mockWindowLocation(hostname)

        const result = showDevelopmentOptions(hostIsOwnr, toolbarMode)

        expect(result).toEqual(expectedResult)
      }
    )
  })

  describe("handles HostCommunication messaging", () => {
    function prepareHostCommunicationManager(
      options = {}
    ): HostCommunicationManager {
      renderApp(getProps())

      const hostCommunicationMgr = getStoredValue<HostCommunicationManager>(
        HostCommunicationManager
      )

      act(() => {
        getMockConnectionManagerProp("onHostConfigResp")({
          allowedOrigins: ["https://devel.streamlit.test"],
          useExternalAuthToken: false,
          disableFullscreenMode: false,
          enableCustomParentMessages: false,
          mapboxToken: "",
          ...options,
        })
      })

      return hostCommunicationMgr
    }

    function fireWindowPostMessage(message: any): void {
      fireEvent(
        window,
        new MessageEvent("message", {
          data: {
            stCommVersion: HOST_COMM_VERSION,
            ...message,
          },
          origin: "https://devel.streamlit.test",
        })
      )
    }

    it("sends SCRIPT_RUN_STATE_CHANGED signal to the host when the app is first rendered", () => {
      const hostCommunicationMgr = prepareHostCommunicationManager()

      expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
        type: "SCRIPT_RUN_STATE_CHANGED",
        scriptRunState: ScriptRunState.NOT_RUNNING,
      })
    })

    it("sends theme info to the host when the app is first rendered", () => {
      const hostCommunicationMgr = prepareHostCommunicationManager()

      expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
        type: "SET_THEME_CONFIG",
        themeInfo: toExportedTheme(lightTheme.emotion),
      })
    })

    it("closes modals when the modal closure message has been received", () => {
      prepareHostCommunicationManager()

      // We display the clear cache dialog as an example
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        config: {
          ...NEW_SESSION_JSON.config,
          toolbarMode: Config.ToolbarMode.DEVELOPER,
        },
      })

      getMockConnectionManager(true)

      openCacheModal()

      fireWindowPostMessage({
        type: "CLOSE_MODAL",
      })

      expect(
        screen.queryByText(
          "Are you sure you want to clear the app's function caches?"
        )
      ).not.toBeInTheDocument()
    })

    it("does not prevent a modal from opening when closure message is set", () => {
      prepareHostCommunicationManager()

      // We display the clear cache dialog as an example
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        config: {
          ...NEW_SESSION_JSON.config,
          toolbarMode: Config.ToolbarMode.DEVELOPER,
        },
      })

      getMockConnectionManager(true)

      openCacheModal()

      fireWindowPostMessage({
        type: "CLOSE_MODAL",
      })

      expect(
        screen.queryByText(
          "Are you sure you want to clear the app's function caches?"
        )
      ).not.toBeInTheDocument()

      openCacheModal()
    })

    it("changes scriptRunState and triggers stopScript when STOP_SCRIPT message has been received", () => {
      const hostCommunicationMgr = prepareHostCommunicationManager()

      const connectionManager = getMockConnectionManager(true)

      // Mark the script as running
      sendForwardMessage("sessionStatusChanged", {
        runOnSave: false,
        scriptIsRunning: true,
      })

      fireWindowPostMessage({
        type: "STOP_SCRIPT",
      })

      expect(connectionManager.sendMessage).toHaveBeenCalledTimes(1)
      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[0][0].toJSON()
      ).toStrictEqual({
        stopScript: true,
      })
      expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
        type: "SCRIPT_RUN_STATE_CHANGED",
        scriptRunState: ScriptRunState.STOP_REQUESTED,
      })
    })

    it("changes scriptRunState and triggers rerunScript when scriptRerunRequested message has been received", () => {
      const hostCommunicationMgr = prepareHostCommunicationManager()

      const connectionManager = getMockConnectionManager(true)

      fireWindowPostMessage({
        type: "RERUN_SCRIPT",
      })

      expect(connectionManager.sendMessage).toHaveBeenCalledTimes(1)
      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[0][0].toJSON()
      ).toStrictEqual({
        rerunScript: {
          pageName: "",
          pageScriptHash: "",
          queryString: "",
          widgetStates: {},
        },
      })

      expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
        type: "SCRIPT_RUN_STATE_CHANGED",
        scriptRunState: ScriptRunState.RERUN_REQUESTED,
      })
    })

    it("fires clearCache BackMsg when CLEAR_CACHE window message has been received", () => {
      prepareHostCommunicationManager()

      const connectionManager = getMockConnectionManager(true)

      fireWindowPostMessage({
        type: "CLEAR_CACHE",
      })

      expect(connectionManager.sendMessage).toHaveBeenCalledTimes(1)
      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[0][0].toJSON()
      ).toStrictEqual({
        clearCache: true,
      })
    })

    it("fires appHeartbeat BackMsg when SEND_APP_HEARTBEAT window message has been received", () => {
      prepareHostCommunicationManager()

      const connectionManager = getMockConnectionManager(true)

      fireWindowPostMessage({
        type: "SEND_APP_HEARTBEAT",
      })

      expect(connectionManager.sendMessage).toHaveBeenCalledTimes(1)
      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[0][0].toJSON()
      ).toStrictEqual({
        appHeartbeat: true,
      })
    })

    it("disables widgets when SET_INPUTS_DISABLED is sent by host", async () => {
      renderApp(getProps())
      sendForwardMessage("newSession", NEW_SESSION_JSON)
      sendForwardMessage("sessionStatusChanged", {
        runOnSave: false,
        scriptIsRunning: true,
      })
      sendForwardMessage(
        "delta",
        {
          type: "newElement",
          newElement: {
            type: "textInput",
            textInput: {
              label: "test input",
            },
          },
        },
        { deltaPath: [0, 0] }
      )

      await waitFor(() => {
        expect(screen.getByLabelText("test input")).toBeInTheDocument()
      })

      // widgets are initially disabled since the app is not CONNECTED
      expect(screen.getByLabelText("test input")).toHaveAttribute("disabled")

      act(() =>
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.CONNECTED
        )
      )

      // widgets are enabled once CONNECTED
      expect(screen.getByLabelText("test input")).not.toHaveAttribute(
        "disabled"
      )

      // have the host disable widgets
      const hostCommunicationMgr = getStoredValue<HostCommunicationManager>(
        HostCommunicationManager
      )
      hostCommunicationMgr.setAllowedOrigins({
        allowedOrigins: ["https://devel.streamlit.test"],
        useExternalAuthToken: false,
      })
      fireWindowPostMessage({
        type: "SET_INPUTS_DISABLED",
        disabled: true,
      })

      expect(screen.getByLabelText("test input")).toHaveAttribute("disabled")

      // have the host reenable widgets
      fireWindowPostMessage({
        type: "SET_INPUTS_DISABLED",
        disabled: false,
      })

      expect(screen.getByLabelText("test input")).not.toHaveAttribute(
        "disabled"
      )
    })

    it("sends SCRIPT_RUN_STATE_CHANGED signal to the host when scriptRunState changing", () => {
      // We test the scenarios of the following runstate changes
      //   1. Script is now running
      //   2. Script was running and stopped
      //   3. Script had a compilation error
      // The other solutions test the following:
      //   1. The script's initial state of not running
      //   2. A script rerun was requested
      //   3. A script stop was requested

      const hostCommunicationMgr = prepareHostCommunicationManager()

      sendForwardMessage("sessionStatusChanged", {
        runOnSave: false,
        scriptIsRunning: true,
      })

      expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
        type: "SCRIPT_RUN_STATE_CHANGED",
        scriptRunState: ScriptRunState.RUNNING,
      })

      sendForwardMessage("sessionStatusChanged", {
        runOnSave: false,
        scriptIsRunning: false,
      })

      expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
        type: "SCRIPT_RUN_STATE_CHANGED",
        scriptRunState: ScriptRunState.NOT_RUNNING,
      })

      sendForwardMessage("sessionEvent", {
        type: "scriptCompilationException",
      })

      expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
        type: "SCRIPT_RUN_STATE_CHANGED",
        scriptRunState: ScriptRunState.COMPILATION_ERROR,
      })
    })

    it("does not sends SCRIPT_RUN_STATE_CHANGED signal to the host when scriptRunState changing to the same state", () => {
      const hostCommunicationMgr = prepareHostCommunicationManager()

      sendForwardMessage("sessionStatusChanged", {
        runOnSave: false,
        scriptIsRunning: true,
      })

      expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
        type: "SCRIPT_RUN_STATE_CHANGED",
        scriptRunState: ScriptRunState.RUNNING,
      })

      // @ts-expect-error
      hostCommunicationMgr.sendMessageToHost.mockClear()

      // Send a status of script to is running again
      sendForwardMessage("sessionStatusChanged", {
        runOnSave: false,
        scriptIsRunning: true,
      })

      expect(hostCommunicationMgr.sendMessageToHost).not.toHaveBeenCalled()
    })

    it("updates state.appPages when it receives a PagesChanged msg", () => {
      const hostCommunicationMgr = prepareHostCommunicationManager()

      const appPages = [
        { icon: "", pageName: "bob", scriptPath: "bob.py" },
        { icon: "", pageName: "carl", scriptPath: "carl.py" },
      ]

      sendForwardMessage("pagesChanged", {
        ...NEW_SESSION_JSON,
        appPages,
      })

      const msg = new ForwardMsg()
      msg.pagesChanged = new PagesChanged({ appPages })
      expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
        type: "SET_APP_PAGES",
        appPages,
      })
    })

    it("responds to page change request messages", () => {
      prepareHostCommunicationManager()

      const connectionManager = getMockConnectionManager(true)

      fireWindowPostMessage({
        type: "REQUEST_PAGE_CHANGE",
        pageScriptHash: "hash1",
      })

      expect(connectionManager.sendMessage).toHaveBeenCalledTimes(1)
      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[0][0].toJSON()
      ).toStrictEqual({
        rerunScript: {
          pageName: "",
          pageScriptHash: "hash1",
          queryString: "",
          widgetStates: {},
        },
      })
    })

    it("shows hostMenuItems", async () => {
      // We need this to use the Main Menu Button
      // eslint-disable-next-line testing-library/render-result-naming-convention
      const app = renderApp(getProps())

      const hostCommunicationMgr = getStoredValue<HostCommunicationManager>(
        HostCommunicationManager
      )

      hostCommunicationMgr.setAllowedOrigins({
        allowedOrigins: ["https://devel.streamlit.test"],
        useExternalAuthToken: false,
      })

      sendForwardMessage("newSession", NEW_SESSION_JSON)
      await openMenu(screen)
      let menuStructure = getMenuStructure(app)
      expect(menuStructure).toEqual([
        [
          {
            label: "Rerun",
            type: "option",
          },
          {
            label: "Settings",
            type: "option",
          },
          {
            type: "separator",
          },
          {
            label: "Print",
            type: "option",
          },
          {
            type: "separator",
          },
          {
            label: "About",
            type: "option",
          },
        ],
      ])

      fireWindowPostMessage({
        type: "SET_MENU_ITEMS",
        items: [{ type: "option", label: "Fork this App", key: "fork" }],
      })

      menuStructure = getMenuStructure(app)

      expect(menuStructure).toEqual([
        [
          {
            label: "Rerun",
            type: "option",
          },
          {
            label: "Settings",
            type: "option",
          },
          {
            type: "separator",
          },
          {
            label: "Print",
            type: "option",
          },
          {
            type: "separator",
          },
          {
            label: "Fork this App",
            type: "option",
          },
          {
            label: "About",
            type: "option",
          },
        ],
      ])
    })

    it("shows hostToolbarItems", () => {
      prepareHostCommunicationManager()

      sendForwardMessage("newSession", NEW_SESSION_JSON)

      expect(screen.queryByTestId("stActionButton")).not.toBeInTheDocument()

      fireWindowPostMessage({
        type: "SET_TOOLBAR_ITEMS",
        items: [
          {
            key: "favorite",
            icon: "star.svg",
          },
        ],
      })

      expect(screen.getByTestId("stActionButton")).toBeInTheDocument()
    })

    it("sets hideSidebarNav based on the server config option and host setting", () => {
      prepareHostCommunicationManager()

      expect(screen.queryByTestId("stSidebarNav")).not.toBeInTheDocument()

      const appPages = [
        { pageScriptHash: "hash1", pageName: "page1" },
        { pageScriptHash: "hash2", pageName: "page2" },
      ]

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        appPages,
        pageScriptHash: "hash1",
      })

      expect(screen.getByTestId("stSidebarNav")).toBeInTheDocument()

      fireWindowPostMessage({
        type: "SET_SIDEBAR_NAV_VISIBILITY",
        hidden: true,
      })

      expect(screen.queryByTestId("stSidebarNav")).not.toBeInTheDocument()
    })

    it("Deploy button should be hidden for cloud environment", () => {
      prepareHostCommunicationManager()

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        config: {
          ...NEW_SESSION_JSON.config,
          toolbarMode: Config.ToolbarMode.DEVELOPER,
        },
      })

      expect(screen.getByTestId("stDeployButton")).toBeInTheDocument()

      fireWindowPostMessage({
        type: "SET_MENU_ITEMS",
        items: [{ label: "Host menu item", key: "host-item", type: "text" }],
      })

      expect(screen.queryByTestId("stDeployButton")).not.toBeInTheDocument()
    })

    it("does not relay custom parent messages by default", () => {
      const hostCommunicationMgr = prepareHostCommunicationManager()

      const logErrorSpy = jest
        .spyOn(global.console, "error")
        .mockImplementation(() => {})

      sendForwardMessage("parentMessage", {
        message: "random string",
      })

      expect(logErrorSpy).toHaveBeenCalled()
      expect(logErrorSpy.mock.calls[0][0]).toEqual(
        "Sending messages to the host is disabled in line with the platform policy."
      )

      expect(hostCommunicationMgr.sendMessageToHost).not.toHaveBeenCalledWith({
        type: "CUSTOM_PARENT_MESSAGE",
        message: "random string",
      })
    })

    it("relays custom parent messages when enabled", () => {
      const hostCommunicationMgr = prepareHostCommunicationManager({
        enableCustomParentMessages: true,
      })

      sendForwardMessage("parentMessage", {
        message: "random string",
      })

      expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
        type: "CUSTOM_PARENT_MESSAGE",
        message: "random string",
      })
    })
  })
})
