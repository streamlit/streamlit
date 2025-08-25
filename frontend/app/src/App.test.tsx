/* eslint-disable @typescript-eslint/no-floating-promises */
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

import React, { act } from "react"

import {
  fireEvent,
  render,
  RenderResult,
  screen,
  waitFor,
} from "@testing-library/react"
import cloneDeep from "lodash/cloneDeep"

import {
  getMenuStructure,
  openMenu,
} from "@streamlit/app/src/components/MainMenu/mainMenuTestHelpers"
import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import {
  ConnectionManager,
  ConnectionState,
  mockEndpoints,
} from "@streamlit/connection"
import {
  CUSTOM_THEME_NAME,
  FileUploadClient,
  getDefaultTheme,
  getHostSpecifiedTheme,
  HOST_COMM_VERSION,
  HostCommunicationManager,
  isEmbed,
  isToolbarDisplayed,
  lightTheme,
  LocalStore,
  mockSessionInfoProps,
  mockWindowLocation,
  RootStyleProvider,
  ScriptRunState,
  SessionInfo,
  toExportedTheme,
  WidgetStateManager,
  WindowDimensionsProvider,
} from "@streamlit/lib"
import {
  Config,
  CustomThemeConfig,
  Delta,
  Element,
  Exception,
  ForwardMsg,
  ForwardMsgMetadata,
  IAuthRedirect,
  IAutoRerun,
  ILogo,
  INavigation,
  INewSession,
  IPageConfig,
  IPageInfo,
  IPageNotFound,
  IPagesChanged,
  IParentMessage,
  Navigation,
  SessionEvent,
  SessionStatus,
  TextInput,
} from "@streamlit/protobuf"

import { App, LOG, Props } from "./App"
import { showDevelopmentOptions } from "./showDevelopmentOptions"

vi.mock("~lib/baseconsts", async () => {
  return {
    ...(await vi.importActual("~lib/baseconsts")),
  }
})

vi.mock("@streamlit/lib", async () => {
  const actualLib = await vi.importActual("@streamlit/lib")
  return {
    ...actualLib,
    isEmbed: vi.fn(),
    isToolbarDisplayed: vi.fn(),
  }
})

vi.mock("@streamlit/connection", async () => {
  const actualModule = await vi.importActual("@streamlit/connection")

  const MockedClass = vi.fn().mockImplementation(props => {
    return {
      props,
      connect: vi.fn(),
      isConnected: vi.fn(),
      disconnect: vi.fn(),
      sendMessage: vi.fn(),
      incrementMessageCacheRunCount: vi.fn(),
      getCachedMessageHashes: vi.fn(),
      getBaseUriParts() {
        return {
          pathname: "/",
          hostname: "",
          port: "8501",
        } as URL
      },
    }
  })
  const MockedEndpoints = vi.fn().mockImplementation(() => {
    return mockEndpoints()
  })

  return {
    ...actualModule,
    ConnectionManager: MockedClass,
    DefaultStreamlitEndpoints: MockedEndpoints,
  }
})
vi.mock("~lib/SessionInfo", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  const actualModule = await vi.importActual<any>("~lib/SessionInfo")

  const MockedClass = vi.fn().mockImplementation(() => {
    return new actualModule.SessionInfo()
  })

  // @ts-expect-error
  MockedClass.propsFromNewSessionMessage = vi
    .fn()
    .mockImplementation(actualModule.SessionInfo.propsFromNewSessionMessage)

  return {
    ...actualModule,
    SessionInfo: MockedClass,
  }
})

vi.mock("~lib/hostComm/HostCommunicationManager", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  const actualModule = await vi.importActual<any>(
    "~lib/hostComm/HostCommunicationManager"
  )

  const MockedClass = vi.fn().mockImplementation((...props) => {
    const hostCommunicationMgr = new actualModule.default(...props)
    vi.spyOn(hostCommunicationMgr, "sendMessageToHost")
    vi.spyOn(hostCommunicationMgr, "sendMessageToSameOriginHost")
    return hostCommunicationMgr
  })

  return {
    __esModule: true,
    ...actualModule,
    default: MockedClass,
  }
})

vi.mock("~lib/WidgetStateManager", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  const actualModule = await vi.importActual<any>("~lib/WidgetStateManager")

  const MockedClass = vi.fn().mockImplementation((...props) => {
    const widgetStateManager = new actualModule.WidgetStateManager(...props)

    vi.spyOn(widgetStateManager, "sendUpdateWidgetsMessage")

    return widgetStateManager
  })

  return {
    ...actualModule,
    WidgetStateManager: MockedClass,
  }
})

vi.mock("@streamlit/app/src/MetricsManager", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  const actualModule = await vi.importActual<any>(
    "@streamlit/app/src/MetricsManager"
  )

  const MockedClass = vi.fn().mockImplementation((...props) => {
    const metricsMgr = new actualModule.MetricsManager(...props)
    vi.spyOn(metricsMgr, "enqueue")
    return metricsMgr
  })

  return {
    ...actualModule,
    MetricsManager: MockedClass,
  }
})

vi.mock("~lib/FileUploadClient", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  const actualModule = await vi.importActual<any>("~lib/FileUploadClient")

  const MockedClass = vi.fn().mockImplementation((...props) => {
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
    toggleRecordAudio: vi.fn(),
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
  },
  theme: {
    activeTheme: lightTheme,
    availableThemes: [],
    setTheme: vi.fn(),
    addThemes: vi.fn(),
    setImportedTheme: vi.fn(),
  },
  streamlitExecutionStartedAt: 100,
  isMobileViewport: false,
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
      installationIdV4: "mockInstallationIdV4",
    },
    environmentInfo: {
      streamlitVersion: "streamlitVersion",
      pythonVersion: "pythonVersion",
    },
    sessionStatus: {
      runOnSave: false,
      scriptIsRunning: true,
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
  mainScriptPath: "path/to/file.py",
  mainScriptHash: "page_hash",
  scriptRunId: "script_run_id",
  fragmentIdsThisRun: [],
}

const NAVIGATION_JSON: INavigation = {
  appPages: [
    {
      pageScriptHash: "page_script_hash",
      pageName: "streamlit app",
      urlPathname: "streamlit_app",
      isDefault: true,
    },
  ],
  pageScriptHash: "page_script_hash",
  position: Navigation.Position.SIDEBAR,
  sections: [],
}

// Prevent "moment-timezone requires moment" exception when mocking "moment".
vi.mock("moment-timezone", () => ({ default: vi.fn() }))
vi.mock("moment", () => ({
  default: vi.fn().mockImplementation(() => ({
    format: () => "date",
  })),
}))

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
      <WindowDimensionsProvider>
        <App {...props} />
      </WindowDimensionsProvider>
    </RootStyleProvider>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
function getStoredValue<T>(Type: any): T {
  return Type.mock.results[Type.mock.results.length - 1].value
}

function getMockConnectionManager(isConnected = false): ConnectionManager {
  const connectionManager =
    getStoredValue<ConnectionManager>(ConnectionManager)
  // @ts-expect-error
  connectionManager.isConnected.mockImplementation(() => isConnected)

  return connectionManager
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
function getMockConnectionManagerProp(propName: string): any {
  // @ts-expect-error - connectionManager.props is private
  return getStoredValue<ConnectionManager>(ConnectionManager).props[propName]
}

type DeltaWithElement = Omit<Delta, "fragmentId" | "newElement" | "toJSON"> & {
  newElement: Omit<Element, "toJSON">
}

type ForwardMsgType =
  | DeltaWithElement
  | ForwardMsg.ScriptFinishedStatus
  | IAuthRedirect
  | IAutoRerun
  | ILogo
  | INavigation
  | INewSession
  | IPagesChanged
  | IPageConfig
  | IPageInfo
  | IParentMessage
  | IPageNotFound
  | Omit<SessionEvent, "toJSON">
  | Omit<SessionStatus, "toJSON">

function sendForwardMessage(
  type: keyof ForwardMsg,
  message: ForwardMsgType,
  metadata: Partial<ForwardMsgMetadata> | null = null
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
  // TODO: Utilize user-event instead of fireEvent
  // eslint-disable-next-line testing-library/prefer-user-event
  fireEvent.keyDown(document.body, {
    key: "c",
    which: 67,
  })

  // TODO: Utilize user-event instead of fireEvent
  // eslint-disable-next-line testing-library/prefer-user-event
  fireEvent.keyUp(document.body, {
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
    vi.clearAllMocks()
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

  it("correctly sets the data-test-script-state attribute", async () => {
    renderApp(getProps())

    expect(screen.getByTestId("stApp")).toHaveAttribute(
      "data-test-script-state",
      "initial"
    )

    sendForwardMessage("newSession", NEW_SESSION_JSON)

    sendForwardMessage("sessionStatusChanged", {
      runOnSave: false,
      scriptIsRunning: true,
    })

    await waitFor(() => {
      expect(screen.getByTestId("stApp")).toHaveAttribute(
        "data-test-script-state",
        ScriptRunState.RUNNING
      )
    })

    sendForwardMessage("sessionStatusChanged", {
      runOnSave: false,
      scriptIsRunning: false,
    })

    expect(screen.getByTestId("stApp")).toHaveAttribute(
      "data-test-script-state",
      ScriptRunState.NOT_RUNNING
    )

    sendForwardMessage("sessionEvent", {
      type: "scriptCompilationException",
    })

    expect(screen.getByTestId("stApp")).toHaveAttribute(
      "data-test-script-state",
      ScriptRunState.COMPILATION_ERROR
    )
  })

  describe("streamlit server version changes", () => {
    let prevWindowLocation: Location

    beforeEach(() => {
      prevWindowLocation = window.location
    })
    afterEach(() => {
      Object.defineProperty(window, "location", {
        value: prevWindowLocation,
        writable: true,
        configurable: true,
      })
    })

    it("triggers page reload", () => {
      renderApp(getProps())

      // A HACK to mock `window.location.reload`.
      // NOTE: The mocking must be done after mounting, but before `handleMessage` is called.
      // @ts-expect-error
      delete window.location
      // @ts-expect-error
      window.location = { reload: vi.fn() }

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

    it("does not trigger page reload if version has not changed", () => {
      renderApp(getProps())

      // A HACK to mock `window.location.reload`.
      // NOTE: The mocking must be done after mounting, but before `handleMessage` is called.
      // @ts-expect-error
      delete window.location
      // @ts-expect-error
      window.location = { reload: vi.fn() }

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
            streamlitVersion: "oldStreamlitVersion",
          },
          sessionId: "sessionId",
          userInfo: {},
          sessionStatus: {},
        },
        fragmentIdsThisRun: [],
      })

      expect(window.location.reload).not.toHaveBeenCalled()
    })
  })

  describe("streamlit server version changes using hardcoded streamlit client version to detect version mismatch", () => {
    let prevWindowLocation: Location

    beforeEach(() => {
      prevWindowLocation = window.location

      window.__streamlit = {
        ENABLE_RELOAD_BASED_ON_HARDCODED_STREAMLIT_VERSION: true,
      }
    })

    afterEach(() => {
      Object.defineProperty(window, "location", {
        value: prevWindowLocation,
        writable: true,
        configurable: true,
      })

      window.__streamlit = undefined

      // @ts-expect-error
      PACKAGE_METADATA = {
        version: "tbd",
      }
    })

    it("triggers page reload", () => {
      renderApp(getProps())

      // A HACK to mock `window.location.reload`.
      // NOTE: The mocking must be done after mounting, but before `handleMessage` is called.
      // @ts-expect-error
      delete window.location
      // @ts-expect-error
      window.location = { reload: vi.fn() }

      // @ts-expect-error
      PACKAGE_METADATA = {
        version: "oldStreamlitVersion",
      }

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

    it("does not trigger page reload if version has not changed", () => {
      renderApp(getProps())

      // A HACK to mock `window.location.reload`.
      // NOTE: The mocking must be done after mounting, but before `handleMessage` is called.
      // @ts-expect-error
      delete window.location
      // @ts-expect-error
      window.location = { reload: vi.fn() }

      // @ts-expect-error
      PACKAGE_METADATA = {
        version: "oldStreamlitVersion",
      }

      sendForwardMessage("newSession", {
        config: {},
        initialize: {
          environmentInfo: {
            streamlitVersion: "oldStreamlitVersion",
          },
          sessionId: "sessionId",
          userInfo: {},
          sessionStatus: {},
        },
        fragmentIdsThisRun: [],
      })

      expect(window.location.reload).not.toHaveBeenCalled()
    })
  })

  it("sends updateReport to our metrics manager", () => {
    renderApp(getProps())

    const metricsManager = getStoredValue<MetricsManager>(MetricsManager)

    sendForwardMessage("newSession", NEW_SESSION_JSON)

    expect(metricsManager.enqueue).toHaveBeenCalledWith("updateReport")
  })

  it("reruns when the user presses 'r'", () => {
    renderApp(getProps())

    getMockConnectionManager(true)

    const widgetStateManager =
      getStoredValue<WidgetStateManager>(WidgetStateManager)
    expect(widgetStateManager.sendUpdateWidgetsMessage).not.toHaveBeenCalled()

    // TODO: Utilize user-event instead of fireEvent
    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.keyDown(document.body, {
      key: "r",
      which: 82,
    })

    expect(widgetStateManager.sendUpdateWidgetsMessage).toHaveBeenCalled()
  })

  describe("App.handleNewSession", () => {
    const makeAppWithElements = async (): Promise<void> => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      renderApp(getProps())

      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.CONNECTED
        )
      })
      // Add an element to the screen
      // Need to set the script to running
      sendForwardMessage("sessionStatusChanged", {
        runOnSave: false,
        scriptIsRunning: true,
      })

      sendForwardMessage("newSession", NEW_SESSION_JSON)
      sendForwardMessage("navigation", {
        appPages: [
          {
            pageScriptHash: "page_script_hash",
            pageName: "streamlit app",
            urlPathname: "streamlit_app",
            isDefault: true,
          },
        ],
        pageScriptHash: "page_script_hash",
        position: Navigation.Position.SIDEBAR,
        sections: [],
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
        { deltaPath: [0, 0], activeScriptHash: "hash1" }
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
        { deltaPath: [0, 1], activeScriptHash: "hash1" }
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

    it("removes the cached custom theme from theme options", () => {
      window.localStorage.setItem(
        LocalStore.ACTIVE_THEME,
        JSON.stringify({ name: CUSTOM_THEME_NAME, themeInput: {} })
      )
      const props = getProps({
        theme: {
          activeTheme: {
            ...lightTheme,
            name: CUSTOM_THEME_NAME,
          },
          availableThemes: [],
          setTheme: vi.fn(),
          addThemes: vi.fn(),
          setImportedTheme: vi.fn(),
        },
      })
      renderApp(props)

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        customTheme: null,
      })

      expect(props.theme.addThemes).toHaveBeenCalledTimes(1)

      // @ts-expect-error
      expect(props.theme.addThemes.mock.calls[0][0]).toEqual([])
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
      expect(props.theme.setTheme.mock.calls[1][0]).toEqual(
        getHostSpecifiedTheme()
      )
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

      const setCurrentSpy = vi.spyOn(sessionInfo, "setCurrent")

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

      const setCurrentSpy = vi.spyOn(sessionInfo, "setCurrent")

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

      const setCurrentSpy = vi.spyOn(sessionInfo, "setCurrent")

      expect(sessionInfo.isSet).toBe(false)
      sendForwardMessage("newSession", NEW_SESSION_JSON)

      expect(setCurrentSpy).toHaveBeenCalledTimes(1)
      expect(sessionInfo.isSet).toBe(true)
      setCurrentSpy.mockClear()

      sendForwardMessage("newSession", NEW_SESSION_JSON)
      expect(setCurrentSpy).not.toHaveBeenCalled()
      expect(sessionInfo.isSet).toBe(true)
      expect(sessionInfo.current.isConnected).toBe(true)

      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.PINGING_SERVER
        )
      })

      // the sessioninfo is set but is now marked as disconnected
      expect(sessionInfo.isSet).toBe(true)
      expect(sessionInfo.current.isConnected).toBe(false)
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
      expect(sessionInfo.current.isConnected).toBe(true)
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
      const appPages = [
        {
          pageScriptHash: "hash1",
          pageName: "page1",
          urlPathname: "page1",
          isDefault: true,
        },
        {
          pageScriptHash: "hash2",
          pageName: "page2",
          urlPathname: "page2",
          sectionHeader: "",
        },
      ]
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        pageScriptHash: "hash1",
      })

      sendForwardMessage("navigation", {
        appPages,
        pageScriptHash: "hash1",
        position: Navigation.Position.SIDEBAR,
        sections: [],
      })
      const hostCommunicationMgr = getStoredValue<HostCommunicationManager>(
        HostCommunicationManager
      )

      expect(screen.getByTestId("stSidebarNav")).toBeInTheDocument()
      const navLinks = screen.queryAllByTestId("stSidebarNavLink")
      expect(navLinks).toHaveLength(2)
      expect(navLinks[0]).toHaveStyle("font-weight: 600")
      expect(navLinks[1]).toHaveStyle("font-weight: 400")

      expect(document.title).toBe("page1")
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
      await makeAppWithElements()

      sendForwardMessage("newSession", NEW_SESSION_JSON)

      const element = await screen.findByText("Here is some text")
      expect(element).toBeInTheDocument()
    })

    it("resets document title if not fragment", () => {
      renderApp(getProps())

      document.title = "some title"

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        fragmentIdsThisRun: [],
      })
      sendForwardMessage("navigation", {
        appPages: [
          {
            pageScriptHash: "page_script_hash",
            pageName: "streamlit app",
            urlPathname: "streamlit_app",
            isDefault: true,
          },
          {
            pageScriptHash: "hash2",
            pageName: "page2",
            urlPathname: "page2",
          },
        ],
        pageScriptHash: "page_script_hash",
        position: Navigation.Position.SIDEBAR,
        sections: [],
      })

      expect(document.title).toBe("streamlit app")
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

  describe("Header", () => {
    afterEach(() => {
      vi.mocked(isEmbed).mockReset()
      vi.mocked(isToolbarDisplayed).mockReset()

      vi.clearAllMocks()
    })

    it("renders with status widget, toolbar, and main menu by default", () => {
      renderApp(getProps())
      sendForwardMessage("newSession", NEW_SESSION_JSON)

      expect(screen.getByTestId("stHeader")).toBeVisible()
      expect(screen.getByTestId("stToolbar")).toBeVisible()
      expect(screen.getByTestId("stStatusWidget")).toBeVisible()
      expect(screen.getByTestId("stMainMenu")).toBeVisible()
    })

    it("hides the top bar if hideTopBar === true", () => {
      renderApp(getProps())
      // hideTopBar is true by default

      expect(screen.queryByTestId("stStatusWidget")).toBeNull()
      expect(screen.queryByTestId("stToolbarActions")).toBeNull()
    })

    it("shows the top bar if hideTopBar === false", () => {
      renderApp(getProps())

      sendForwardMessage("newSession", NEW_SESSION_JSON)

      expect(screen.getByTestId("stStatusWidget")).toBeVisible()
      expect(screen.getByTestId("stToolbarActions")).toBeVisible()
    })

    it("does not render when app embedded & showToolbar is false", () => {
      // Mock returns of util functions
      vi.mocked(isEmbed).mockReturnValue(true)
      vi.mocked(isToolbarDisplayed).mockReturnValue(false)

      renderApp(getProps())
      sendForwardMessage("newSession", NEW_SESSION_JSON)

      // main menu should not render
      expect(screen.queryByTestId("stMainMenu")).toBeNull()
    })

    it("renders when app embedded & showToolbar is true", () => {
      // Mock returns of util functions
      vi.mocked(isEmbed).mockReturnValue(true)
      vi.mocked(isToolbarDisplayed).mockReturnValue(true)

      renderApp(getProps())
      sendForwardMessage("newSession", NEW_SESSION_JSON)

      // Header/main menu should render
      expect(screen.getByTestId("stHeader")).toBeVisible()
      expect(screen.getByTestId("stMainMenu")).toBeVisible()
    })
  })

  describe("DeployButton", () => {
    it("initially button should be hidden", () => {
      renderApp(getProps())

      expect(screen.queryByTestId("stAppDeployButton")).not.toBeInTheDocument()
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

      expect(screen.getByTestId("stAppDeployButton")).toBeInTheDocument()
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

      expect(screen.queryByTestId("stAppDeployButton")).not.toBeInTheDocument()
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

      expect(screen.queryByTestId("stAppDeployButton")).not.toBeInTheDocument()
    })

    it("button should be hidden when script changes on disk", async () => {
      renderApp(getProps())

      // First make the button visible by setting developer mode
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        config: {
          ...NEW_SESSION_JSON.config,
          toolbarMode: Config.ToolbarMode.DEVELOPER,
        },
      })

      expect(screen.getByTestId("stAppDeployButton")).toBeInTheDocument()

      // Send scriptChangedOnDisk event
      sendForwardMessage("sessionEvent", {
        type: "scriptChangedOnDisk",
      })

      await waitFor(() => {
        expect(
          screen.queryByTestId("stAppDeployButton")
        ).not.toBeInTheDocument()
      })
    })

    it("button should reappear when script starts running after file change", () => {
      renderApp(getProps())

      // First make the button visible by setting developer mode
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        config: {
          ...NEW_SESSION_JSON.config,
          toolbarMode: Config.ToolbarMode.DEVELOPER,
        },
      })

      expect(screen.getByTestId("stAppDeployButton")).toBeInTheDocument()

      // Send scriptChangedOnDisk event
      sendForwardMessage("sessionEvent", {
        type: "scriptChangedOnDisk",
      })

      expect(screen.queryByTestId("stAppDeployButton")).not.toBeInTheDocument()

      // Send session status changed with script running
      sendForwardMessage("sessionStatusChanged", {
        runOnSave: false,
        scriptIsRunning: true,
      })

      expect(screen.getByTestId("stAppDeployButton")).toBeInTheDocument()
    })
  })

  describe("App.onHistoryChange", () => {
    const CURRENT_NEW_SESSION_JSON = {
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
          installationIdV4: "mockInstallationIdV4",
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
      appPages: [],
      pageScriptHash: "top_hash",
      fragmentIdsThisRun: [],
    }
    const THIS_NAVIGATION_JSON = {
      appPages: [
        {
          pageScriptHash: "top_hash",
          pageName: "streamlit app",
          urlPathname: "",
          isDefault: true,
        },
        {
          pageScriptHash: "sub_hash",
          pageName: "page2",
          urlPathname: "page2",
        },
      ],
      pageScriptHash: "top_hash",
      fragmentIdsThisRun: [],
      sections: [],
      position: Navigation.Position.SIDEBAR,
    }

    beforeEach(() => {
      window.history.pushState({}, "", "/")
    })

    it("handles popState events, e.g. clicking browser's back button", async () => {
      renderApp(getProps())

      sendForwardMessage("newSession", {
        ...CURRENT_NEW_SESSION_JSON,
        pageScriptHash: "sub_hash",
      })
      sendForwardMessage("navigation", {
        ...THIS_NAVIGATION_JSON,
        pageScriptHash: "sub_hash",
      })

      sendForwardMessage("newSession", {
        ...CURRENT_NEW_SESSION_JSON,
        pageScriptHash: "top_hash",
      })
      sendForwardMessage("navigation", {
        ...THIS_NAVIGATION_JSON,
        pageScriptHash: "top_hash",
      })

      sendForwardMessage("newSession", {
        ...CURRENT_NEW_SESSION_JSON,
        pageScriptHash: "sub_hash",
      })
      sendForwardMessage("navigation", {
        ...THIS_NAVIGATION_JSON,
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
        ...CURRENT_NEW_SESSION_JSON,
        pageScriptHash: "sub_hash",
      })
      sendForwardMessage("navigation", {
        ...THIS_NAVIGATION_JSON,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    let pushStateSpy: any

    beforeEach(() => {
      window.history.pushState({}, "", "/")

      pushStateSpy = vi.spyOn(window.history, "pushState")
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
    let originalStreamlitWindowObj: typeof window.__streamlit

    beforeEach(() => {
      originalStreamlitWindowObj = window.__streamlit
    })

    afterEach(() => {
      window.history.pushState({}, "", "/")
      window.__streamlit = originalStreamlitWindowObj
    })

    it("sends the currentPageScriptHash if no pageScriptHash is given", () => {
      renderApp(getProps())

      // Set initial pageScriptHash
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        pageScriptHash: "some_other_page_hash",
      })
      sendForwardMessage("navigation", {
        appPages: [
          {
            pageScriptHash: "top_hash",
            pageName: "streamlit app",
            urlPathname: "",
            isDefault: true,
          },
          {
            pageScriptHash: "some_other_page_hash",
            pageName: "page2",
            urlPathname: "page2",
          },
        ],
        pageScriptHash: "some_other_page_hash",
        position: Navigation.Position.SIDEBAR,
        sections: [],
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

    it("sends cached messages if connection manager has cached messages", () => {
      renderApp(getProps())

      const widgetStateManager =
        getStoredValue<WidgetStateManager>(WidgetStateManager)
      const connectionManager = getMockConnectionManager()

      // Mock the getCachedMessageHashes method to return some cached message hashes
      connectionManager.getCachedMessageHashes = vi
        .fn()
        .mockReturnValue(["hash1", "hash2"])

      widgetStateManager.sendUpdateWidgetsMessage(undefined)
      expect(connectionManager.sendMessage).toBeCalledTimes(1)

      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[0][0].rerunScript
          .cachedMessageHashes
      ).toEqual(["hash1", "hash2"])
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

      vi.spyOn(connectionManager, "getBaseUriParts").mockReturnValue({
        pathname: "/foo/bar",
        hostname: "",
        port: "8501",
      } as URL)

      window.history.pushState({}, "", "/foo/bar/baz")
      widgetStateManager.sendUpdateWidgetsMessage(undefined)

      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[0][0].rerunScript.pageName
      ).toBe("baz")
    })

    it("extracts pageName if window.__streamlit.MAIN_PAGE_BASE_URL is set (main page)", () => {
      renderApp(getProps())
      const widgetStateManager =
        getStoredValue<WidgetStateManager>(WidgetStateManager)
      const connectionManager = getMockConnectionManager()

      window.__streamlit = { MAIN_PAGE_BASE_URL: "http://localhost/foo/bar" }
      window.history.pushState({}, "", "/foo/bar/")
      widgetStateManager.sendUpdateWidgetsMessage(undefined)

      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[0][0].rerunScript.pageName
      ).toBe("")
    })

    it("extracts pageName if window.__streamlit.MAIN_PAGE_BASE_URL is set (non-main page)", () => {
      renderApp(getProps())
      const widgetStateManager =
        getStoredValue<WidgetStateManager>(WidgetStateManager)
      const connectionManager = getMockConnectionManager()

      window.__streamlit = { MAIN_PAGE_BASE_URL: "http://localhost/foo/bar" }
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
        {
          pageScriptHash: "toppage_hash",
          pageName: "streamlit app",
          urlPathname: "streamlit_app",
          isDefault: true,
        },
        {
          pageScriptHash: "subpage_hash",
          pageName: "page2",
          urlPathname: "page2",
        },
      ]

      // Because the page URL is already "/" pointing to the main page, no new history is pushed.
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        appPages: [],
        pageScriptHash: "toppage_hash",
      })
      sendForwardMessage("navigation", {
        appPages,
        pageScriptHash: "toppage_hash",
        sections: [],
        position: Navigation.Position.SIDEBAR,
      })
      sendForwardMessage("pageInfoChanged", {
        queryString: "foo=bar",
      })

      const navLinks = screen.queryAllByTestId("stSidebarNavLink")
      expect(navLinks).toHaveLength(2)

      // TODO: Utilize user-event instead of fireEvent
      // eslint-disable-next-line testing-library/prefer-user-event
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

  describe("App.processThemeInput", () => {
    it("calls setImportedTheme when fontFaces are provided", () => {
      const fontFaces = [{ url: "test-url" }]
      const themeInput = new CustomThemeConfig({
        primaryColor: "blue",
        fontFaces,
      })

      const props = getProps()
      renderApp(props)

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        customTheme: themeInput,
      })

      // Should have called setImportedTheme
      expect(props.theme.setImportedTheme).toHaveBeenCalledWith(themeInput)
    })

    it("doesn't call setImportedTheme when fontFaces is empty", () => {
      const themeInput = new CustomThemeConfig({
        primaryColor: "blue",
        fontFaces: [],
      })

      const props = getProps()
      renderApp(props)

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        customTheme: themeInput,
      })

      // Should not have called setImportedTheme
      expect(props.theme.setImportedTheme).not.toHaveBeenCalled()
    })

    it("calls setImportedTheme when a fontSource is provided", () => {
      const fontSources = [
        {
          configName: "font",
          sourceUrl:
            "https://fonts.googleapis.com/css2?family=Inter&display=swap",
        },
      ]
      const themeInput = new CustomThemeConfig({
        primaryColor: "blue",
        fontSources,
      })

      const props = getProps()
      renderApp(props)

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        customTheme: themeInput,
      })

      // Should have called setImportedTheme
      expect(props.theme.setImportedTheme).toHaveBeenCalledWith(themeInput)
    })

    it("doesn't call setImportedTheme when fontSources is empty", () => {
      const themeInput = new CustomThemeConfig({
        primaryColor: "blue",
        fontSources: [],
      })

      const props = getProps()
      renderApp(props)

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        customTheme: themeInput,
      })

      // Should not have called setImportedTheme
      expect(props.theme.setImportedTheme).not.toHaveBeenCalled()
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

    it("will clear stale nodes if finished successfully", async () => {
      renderApp(getProps())
      // Run the script with one new element
      sendForwardMessage("sessionStatusChanged", {
        runOnSave: false,
        scriptIsRunning: true,
      })
      sendForwardMessage("newSession", NEW_SESSION_JSON)
      sendForwardMessage("navigation", NAVIGATION_JSON)
      // this message now belongs to this^ session
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
        { deltaPath: [0, 0], activeScriptHash: "random_hash" }
      )

      // start new session
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        scriptRunId: "different_script_run_id",
      })

      await waitFor(() => {
        expect(screen.getByText("Here is some text")).toBeInTheDocument()
      })

      sendForwardMessage(
        "scriptFinished",
        ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY
      )

      await waitFor(() => {
        expect(screen.queryByText("Here is some text")).not.toBeInTheDocument()
      })
    })

    it("will not clear stale nodes if finished with rerun", async () => {
      renderApp(getProps())
      sendForwardMessage("newSession", NEW_SESSION_JSON)
      sendForwardMessage("navigation", NAVIGATION_JSON)
      // Run the script with one new element
      sendForwardMessage("sessionStatusChanged", {
        runOnSave: false,
        scriptIsRunning: true,
      })
      // these messages now belongs to this^ session
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
              body: "Here is some other text",
              help: "",
            },
          },
        },
        { deltaPath: [0, 1] }
      )

      // start new session
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        scriptRunId: "different_script_run_id",
      })

      // this message now belongs to this^ session. It overrides the first message of
      // the previous session because the same delta path is used
      sendForwardMessage(
        "delta",
        {
          type: "newElement",
          newElement: {
            type: "text",
            text: {
              body: "Here is some new text",
              help: "",
            },
          },
        },
        { deltaPath: [0, 0] }
      )

      sendForwardMessage(
        "scriptFinished",
        ForwardMsg.ScriptFinishedStatus.FINISHED_EARLY_FOR_RERUN
      )

      await waitFor(() => {
        expect(screen.getByText("Here is some new text")).toBeInTheDocument()
      })
      // this message was overridden because same delta-path was used be the 'new text' message
      await waitFor(() => {
        expect(screen.queryByText("Here is some text")).not.toBeInTheDocument()
      })
      await waitFor(() => {
        expect(screen.getByText("Here is some other text")).toBeInTheDocument()
      })

      sendForwardMessage(
        "scriptFinished",
        ForwardMsg.ScriptFinishedStatus.FINISHED_FRAGMENT_RUN_SUCCESSFULLY // use finished_fragment_run_successfully here because in the other test we used the finished_successfully status
      )

      // this message was sent in the new session
      await waitFor(() => {
        expect(screen.getByText("Here is some new text")).toBeInTheDocument()
      })

      // this message was cleaned up because it was sent in the old session
      await waitFor(() => {
        expect(
          screen.queryByText("Here is some other text")
        ).not.toBeInTheDocument()
      })
    })
  })

  describe("authRedirect handling", () => {
    let prevWindowLocation: Location
    let prevWindowParent: Window

    beforeEach(() => {
      prevWindowLocation = window.location
      prevWindowParent = window.parent
    })

    afterEach(() => {
      Object.defineProperty(window, "location", {
        value: prevWindowLocation,
        writable: true,
        configurable: true,
      })
      window.parent = prevWindowParent
    })

    it("redirects to the auth URL", () => {
      renderApp(getProps())

      // NOTE: The mocking must be done after mounting, but before `handleMessage` is called.
      // @ts-expect-error
      delete window.location
      // @ts-expect-error
      window.location = {}

      sendForwardMessage("authRedirect", { url: "https://example.com" })

      expect(window.location.href).toBe("https://example.com")
    })

    it("sends a message to the host when in child frame", () => {
      renderApp(getProps())
      // A HACK to mock a condition in `isInChildFrame` util function.
      // @ts-expect-error
      delete window.parent
      // @ts-expect-error
      window.parent = { postMessage: vi.fn() }

      const hostCommunicationMgr = getStoredValue<HostCommunicationManager>(
        HostCommunicationManager
      )

      sendForwardMessage("authRedirect", { url: "https://example.com" })

      expect(
        hostCommunicationMgr.sendMessageToSameOriginHost
      ).toHaveBeenCalledWith({
        type: "REDIRECT_TO_URL",
        url: "https://example.com",
      })
    })
  })

  describe("Logo handling", () => {
    it("adds logo on receipt of logo ForwardMsg", () => {
      renderApp(getProps())

      sendForwardMessage(
        "logo",
        {
          image:
            "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png",
        },
        {
          activeScriptHash: "page_script_hash",
        }
      )

      expect(screen.getByTestId("stHeaderLogo")).toBeInTheDocument()
    })

    it("MPA V2 - will remove logo if activeScriptHash does not match", async () => {
      renderApp(getProps())

      // Trigger handleNavigation (MPA V2)
      sendForwardMessage("navigation", {
        appPages: [
          {
            pageScriptHash: "page_script_hash",
            pageName: "streamlit_app",
            isDefault: true,
          },
          { pageScriptHash: "other_page_script_hash", pageName: "Page 1" },
        ],
        pageScriptHash: "other_page_script_hash",
        position: Navigation.Position.HIDDEN,
      })

      // Logo outside common script
      sendForwardMessage(
        "logo",
        {
          image:
            "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png",
        },
        {
          activeScriptHash: "other_page_script_hash",
        }
      )
      expect(screen.getByTestId("stHeaderLogo")).toBeInTheDocument()

      // Trigger a new session with a different pageScriptHash
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        pageScriptHash: "page_script_hash",
      })

      // Specifically did not send the scriptFinished here as that would handle cleanup based on scriptRunId
      // Cleanup for MPA V2 in filterMainScriptElements
      await waitFor(() => {
        expect(screen.queryByTestId("stHeaderLogo")).not.toBeInTheDocument()
      })
    })

    it("will remove logo if scriptRunId does not match", async () => {
      renderApp(getProps())

      sendForwardMessage(
        "logo",
        {
          image:
            "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png",
        },
        {
          activeScriptHash: "page_script_hash",
        }
      )

      expect(screen.getByTestId("stHeaderLogo")).toBeInTheDocument()

      // Trigger a new scriptRunId via new session
      sendForwardMessage("newSession", NEW_SESSION_JSON)

      // Trigger cleanup in script finished handler
      sendForwardMessage(
        "scriptFinished",
        ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY
      )

      // Since no logo is sent in this script run, logo must not be present in the script anymore
      // Stale logo should be removed
      await waitFor(() => {
        expect(screen.queryByTestId("stHeaderLogo")).not.toBeInTheDocument()
      })
    })

    it("will not clear logo as stale on fragment re-run", async () => {
      renderApp(getProps())

      // Initial script run, creates logo
      sendForwardMessage("newSession", NEW_SESSION_JSON)
      sendForwardMessage("navigation", {
        appPages: [
          {
            pageScriptHash: "page_script_hash",
            pageName: "streamlit app",
            urlPathname: "streamlit_app",
            isDefault: true,
          },
        ],
        pageScriptHash: "page_script_hash",
        position: Navigation.Position.SIDEBAR,
        sections: [],
      })
      sendForwardMessage(
        "logo",
        {
          image:
            "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png",
        },
        {
          activeScriptHash: "page_script_hash",
        }
      )
      sendForwardMessage(
        "scriptFinished",
        ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY
      )
      await waitFor(() => {
        expect(screen.getByTestId("stHeaderLogo")).toBeInTheDocument()
      })

      // Fragment run - logo is not sent, but should persist (triggers scriptRunId to be updated)
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        fragmentIdsThisRun: ["myFragmentId"],
      })
      sendForwardMessage(
        "scriptFinished",
        ForwardMsg.ScriptFinishedStatus.FINISHED_FRAGMENT_RUN_SUCCESSFULLY
      )
      await waitFor(() => {
        expect(screen.getByTestId("stHeaderLogo")).toBeInTheDocument()
      })

      // Full re-run - logo is not sent, should be removed as stale (scriptRunId is different)
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        scriptRunId: "different_script_run_id",
      })
      sendForwardMessage(
        "scriptFinished",
        ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY
      )
      await waitFor(() => {
        expect(screen.queryByTestId("stHeaderLogo")).not.toBeInTheDocument()
      })
    })
  })

  //   * handlePageNotFound has branching error messages depending on pageName
  describe("App.handlePageNotFound", () => {
    it("includes the missing page name in error modal message if available", () => {
      renderApp(getProps())
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        appPages: [
          {
            pageScriptHash: "page_hash",
            pageName: "streamlit app",
            urlPathname: "streamlit_app",
          },
        ],
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
        appPages: [
          {
            pageScriptHash: "page_hash",
            pageName: "streamlit app",
            urlPathname: "streamlit_app",
          },
        ],
        pageScriptHash: "page_hash",
      })
      const hostCommunicationMgr = getStoredValue<HostCommunicationManager>(
        HostCommunicationManager
      )

      const sendMessageFunc = vi.spyOn(
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
  })

  describe("AppSkeleton rendering and styling", () => {
    let originalLocation: Location

    beforeEach(() => {
      vi.useFakeTimers()
      originalLocation = window.location
    })

    afterEach(() => {
      vi.useRealTimers()
      Object.defineProperty(window, "location", {
        value: originalLocation,
        writable: true,
        configurable: true,
      })
    })

    it("renders AppSkeleton with correct container width styling during initial load", async () => {
      renderApp(getProps())

      expect(screen.queryByTestId("stAppSkeleton")).not.toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(500)
      })

      await waitFor(() => {
        expect(screen.getByTestId("stAppSkeleton")).toBeVisible()
      })

      const skeletonElement = screen.getByTestId("stAppSkeleton")
      const elementContainer = skeletonElement.closest(
        '[data-testid="stElementContainer"]'
      )

      expect(elementContainer).toBeInTheDocument()
      expect(elementContainer).toHaveStyle("width: 100%")
    })

    it("shows skeleton with default V2 loading screen behavior", async () => {
      renderApp(getProps())

      // Skeleton should not be visible initially due to 500ms delay
      expect(screen.queryByTestId("stAppSkeleton")).not.toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(500)
      })

      await waitFor(() => {
        expect(screen.getByTestId("stAppSkeleton")).toBeVisible()
      })
    })

    it("does not show skeleton when embedded with hide_loading_screen option", () => {
      // This tests the embedding use case where the host wants to hide loading screens
      Object.defineProperty(window, "location", {
        value: { search: "?embed_options=hide_loading_screen" },
        writable: true,
        configurable: true,
      })

      renderApp(getProps())

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Skeleton should never appear when loading screen is hidden
      expect(screen.queryByTestId("stAppSkeleton")).not.toBeInTheDocument()
    })

    it("shows 'Please wait...' text when embedded with V1 loading screen", async () => {
      // This tests backwards compatibility for older embedding integrations
      Object.defineProperty(window, "location", {
        value: { search: "?embed_options=show_loading_screen_v1" },
        writable: true,
        configurable: true,
      })

      renderApp(getProps())

      // Should show "Please wait..." instead of skeleton for V1 compatibility
      await waitFor(() => {
        expect(screen.getByText("Please wait...")).toBeInTheDocument()
      })

      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(screen.queryByTestId("stAppSkeleton")).not.toBeInTheDocument()
    })

    it("replaces skeleton with real content when app loads", async () => {
      renderApp(getProps())

      act(() => {
        vi.advanceTimersByTime(500)
      })

      await waitFor(() => {
        expect(screen.getByTestId("stAppSkeleton")).toBeVisible()
      })

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
            type: "text",
            text: {
              body: "Real app content",
              help: "",
            },
          },
        },
        { deltaPath: [0, 0] }
      )

      await waitFor(() => {
        expect(screen.getByText("Real app content")).toBeVisible()
      })
      expect(screen.queryByTestId("stAppSkeleton")).not.toBeInTheDocument()
    })

    it("skeleton timing works correctly with multiple renders", async () => {
      const { unmount } = renderApp(getProps())

      // First render - advance time but not enough
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(screen.queryByTestId("stAppSkeleton")).not.toBeInTheDocument()

      unmount()
      renderApp(getProps())

      expect(screen.queryByTestId("stAppSkeleton")).not.toBeInTheDocument()

      // Now advance past the full delay
      act(() => {
        vi.advanceTimersByTime(500)
      })

      await waitFor(() => {
        expect(screen.getByTestId("stAppSkeleton")).toBeVisible()
      })
    })
  })

  describe("App.handleAutoRerun and autoRerun interval handling", () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.spyOn(global, "setInterval")
      vi.spyOn(global, "clearInterval")
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

      expect(clearInterval).toHaveBeenCalled()
      expect(clearInterval).toHaveBeenCalled()
    })

    it("triggers rerunScript with is_auto_rerun set to true", () => {
      // Since we mock the isEmbed function, we need to set its return value
      vi.mocked(isEmbed).mockReturnValue(false)
      renderApp(getProps())

      const connectionManager = getMockConnectionManager()
      act(() => {
        sendForwardMessage("autoRerun", {
          interval: 1.0,
          fragmentId: "myFragmentId",
        })
        vi.advanceTimersByTime(1000)
      })
      expect(connectionManager.sendMessage).toHaveBeenCalledTimes(1)
      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[0][0].toJSON()
      ).toStrictEqual({
        rerunScript: {
          fragmentId: "myFragmentId",
          isAutoRerun: true,
          pageName: "",
          pageScriptHash: "",
          queryString: "",
          widgetStates: {},
          contextInfo: {
            locale: "en-US",
            isEmbedded: false,
            timezone: "UTC",
            timezoneOffset: 0,
            url: "http://localhost:3000/",
            colorScheme: "light",
          },
        },
      })
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
      fileUploadClient.requestFileURLs("myRequestId", [
        new File([""], "file1.txt"),
        new File([""], "file2.txt"),
        new File([""], "file3.txt"),
      ])

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
      fileUploadClient.requestFileURLs("myRequestId", [
        new File([""], "file1.txt"),
        new File([""], "file2.txt"),
        new File([""], "file3.txt"),
      ])

      const connectionManager = getMockConnectionManager()

      expect(connectionManager.sendMessage).not.toBeCalled()
    })
  })

  describe("Test Main Menu shortcut functionality", () => {
    it("Tests dev menu shortcuts cannot be accessed as a viewer", () => {
      renderApp(getProps())

      getMockConnectionManager(true)

      // TODO: Utilize user-event instead of fireEvent
      // eslint-disable-next-line testing-library/prefer-user-event
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
    let prevWindowLocation: Location

    beforeEach(() => {
      prevWindowLocation = window.location
    })

    afterEach(() => {
      Object.defineProperty(window, "location", {
        value: prevWindowLocation,
        writable: true,
        configurable: true,
      })
    })

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
      (hostname, hostIsOwnr, toolbarMode, expectedResult) => {
        mockWindowLocation(hostname)

        const result = showDevelopmentOptions(hostIsOwnr, toolbarMode)

        expect(result).toEqual(expectedResult)
      }
    )
  })

  describe("App.handleConnectionStateChanged", () => {
    beforeEach(() => {
      // Clean all mocks
      vi.clearAllMocks()
    })

    it("sends WEBSOCKET_CONNECTED and WEBSOCKET_DISCONNECTED messages", () => {
      renderApp(getProps())

      const connectionManager = getMockConnectionManager(false)
      const hostCommunicationMgr = getStoredValue<HostCommunicationManager>(
        HostCommunicationManager
      )

      act(() =>
        // @ts-expect-error - connectionManager.props is private
        connectionManager.props.connectionStateChanged(
          ConnectionState.CONNECTED
        )
      )
      expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
        type: "WEBSOCKET_CONNECTED",
      })

      // Change the ConnectionManager state to anything other than
      // ConnectionState.CONNECTED. Moving from CONNECTED to any other state
      // should cause us to send a WEBSOCKET_DISCONNECTED message.
      act(() =>
        // @ts-expect-error - connectionManager.props is private
        connectionManager.props.connectionStateChanged(
          ConnectionState.PINGING_SERVER
        )
      )
      expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
        type: "WEBSOCKET_DISCONNECTED",
        attemptingToReconnect: true,
      })
    })

    it("correctly sets the data-test-connection-state attribute", () => {
      renderApp(getProps())

      const connectionManager = getMockConnectionManager(false)

      expect(screen.getByTestId("stApp")).toHaveAttribute(
        "data-test-connection-state",
        ConnectionState.INITIAL
      )

      act(() =>
        // @ts-expect-error - connectionManager.props is private
        connectionManager.props.connectionStateChanged(
          ConnectionState.CONNECTED
        )
      )
      expect(screen.getByTestId("stApp")).toHaveAttribute(
        "data-test-connection-state",
        ConnectionState.CONNECTED
      )

      act(() =>
        // @ts-expect-error - connectionManager.props is private
        connectionManager.props.connectionStateChanged(
          ConnectionState.PINGING_SERVER
        )
      )
      expect(screen.getByTestId("stApp")).toHaveAttribute(
        "data-test-connection-state",
        ConnectionState.PINGING_SERVER
      )
    })

    it("sets attemptingToReconnect to false if DISCONNECTED_FOREVER", () => {
      renderApp(getProps())

      const connectionManager = getMockConnectionManager(false)
      const hostCommunicationMgr = getStoredValue<HostCommunicationManager>(
        HostCommunicationManager
      )

      act(() =>
        // @ts-expect-error - connectionManager.props is private
        connectionManager.props.connectionStateChanged(
          ConnectionState.CONNECTED
        )
      )
      expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
        type: "WEBSOCKET_CONNECTED",
      })

      act(() =>
        // @ts-expect-error - connectionManager.props is private
        connectionManager.props.connectionStateChanged(
          ConnectionState.DISCONNECTED_FOREVER
        )
      )
      expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
        type: "WEBSOCKET_DISCONNECTED",
        attemptingToReconnect: false,
      })
    })

    it("requests script rerun if this is the first time we've connected", () => {
      renderApp(getProps())
      const widgetStateManager =
        getStoredValue<WidgetStateManager>(WidgetStateManager)
      const sendUpdateWidgetsMessageSpy = vi.spyOn(
        widgetStateManager,
        "sendUpdateWidgetsMessage"
      )

      sendForwardMessage("newSession", NEW_SESSION_JSON)

      // Confirm previous session info does not exist
      const sessionInfo = getStoredValue<SessionInfo>(SessionInfo)
      expect(sessionInfo.last).toBeFalsy()

      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.CONNECTED
        )
      })
      expect(sendUpdateWidgetsMessageSpy).toHaveBeenCalled()
    })

    it("requests script rerun if script run was interrupted", () => {
      renderApp(getProps())
      const widgetStateManager =
        getStoredValue<WidgetStateManager>(WidgetStateManager)

      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.CONNECTED
        )
      })

      sendForwardMessage("newSession", NEW_SESSION_JSON)

      // trigger a state transition to RUNNING
      getMockConnectionManager(true)
      sendForwardMessage("sessionStatusChanged", {
        runOnSave: false,
        scriptIsRunning: true,
      })

      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.DISCONNECTED_FOREVER
        )
      })

      // Ensure sessionInfo.last exists so check based on lastRunWasInterrupted
      const sessionInfo = getStoredValue<SessionInfo>(SessionInfo)
      sessionInfo.setCurrent(mockSessionInfoProps())
      sessionInfo.setCurrent(mockSessionInfoProps())
      expect(sessionInfo.last).toBeTruthy()

      // Initialize spy here to verify triggered from handleConnectionStateChanged
      const sendUpdateWidgetsMessageSpy = vi.spyOn(
        widgetStateManager,
        "sendUpdateWidgetsMessage"
      )

      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.CONNECTED
        )
      })
      expect(sendUpdateWidgetsMessageSpy).toHaveBeenCalled()
    })

    it("requests script rerun if wasRerunRequested is true", () => {
      renderApp(getProps())
      const widgetStateManager =
        getStoredValue<WidgetStateManager>(WidgetStateManager)

      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.CONNECTED
        )
      })

      sendForwardMessage("newSession", NEW_SESSION_JSON)

      // trigger a state transition to RERUN_REQUESTED
      getMockConnectionManager(true)
      // eslint-disable-next-line testing-library/prefer-user-event
      fireEvent.keyDown(document.body, {
        key: "r",
        which: 82,
      })

      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.DISCONNECTED_FOREVER
        )
      })

      // Ensure sessionInfo.last exists
      const sessionInfo = getStoredValue<SessionInfo>(SessionInfo)
      sessionInfo.setCurrent(mockSessionInfoProps())
      sessionInfo.setCurrent(mockSessionInfoProps())
      expect(sessionInfo.last).toBeTruthy()

      // Initialize spy here to verify triggered from handleConnectionStateChanged
      const sendUpdateWidgetsMessageSpy = vi.spyOn(
        widgetStateManager,
        "sendUpdateWidgetsMessage"
      )

      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.CONNECTED
        )
      })
      expect(sendUpdateWidgetsMessageSpy).toHaveBeenCalled()
    })

    it("does not request script rerun by default for subsequent run", () => {
      renderApp(getProps())
      const widgetStateManager =
        getStoredValue<WidgetStateManager>(WidgetStateManager)

      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.CONNECTED
        )
      })

      sendForwardMessage("newSession", NEW_SESSION_JSON)
      sendForwardMessage("sessionStatusChanged", {
        runOnSave: false,
        scriptIsRunning: false,
      })

      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.DISCONNECTED_FOREVER
        )
      })
      // Initialize spy here to verify triggered from handleConnectionStateChanged
      const sendUpdateWidgetsMessageSpy = vi.spyOn(
        widgetStateManager,
        "sendUpdateWidgetsMessage"
      )
      // Somehow the spy still registers one previous call to the function.
      // To work around this, we clear the spy
      sendUpdateWidgetsMessageSpy.mockClear()

      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.CONNECTED
        )
      })
      expect(sendUpdateWidgetsMessageSpy).not.toHaveBeenCalled()
    })

    it("requests script rerun if fragmentIdsThisRun is not empty", () => {
      renderApp(getProps())
      const widgetStateManager =
        getStoredValue<WidgetStateManager>(WidgetStateManager)

      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.CONNECTED
        )
      })

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        fragmentIdsThisRun: ["myFragmentId"],
      })

      sendForwardMessage("sessionStatusChanged", {
        runOnSave: false,
        scriptIsRunning: false,
      })

      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.DISCONNECTED_FOREVER
        )
      })

      // Ensure sessionInfo.last exists so check based on lastRunWasInterrupted
      const sessionInfo = getStoredValue<SessionInfo>(SessionInfo)
      sessionInfo.setCurrent(mockSessionInfoProps())
      sessionInfo.setCurrent(mockSessionInfoProps())
      expect(sessionInfo.last).toBeTruthy()

      // Initialize spy here to verify triggered from handleConnectionStateChanged
      const sendUpdateWidgetsMessageSpy = vi.spyOn(
        widgetStateManager,
        "sendUpdateWidgetsMessage"
      )
      sendUpdateWidgetsMessageSpy.mockClear()

      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.CONNECTED
        )
      })
      expect(sendUpdateWidgetsMessageSpy).toHaveBeenCalled()
    })

    it("requests script rerun if autoReruns is not empty", () => {
      vi.useFakeTimers()
      renderApp(getProps())
      const widgetStateManager =
        getStoredValue<WidgetStateManager>(WidgetStateManager)

      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.CONNECTED
        )
      })

      sendForwardMessage("newSession", NEW_SESSION_JSON)
      sendForwardMessage("autoRerun", {
        interval: 1,
        fragmentId: "myFragmentId",
      })

      sendForwardMessage("sessionStatusChanged", {
        runOnSave: false,
        scriptIsRunning: false,
      })

      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.DISCONNECTED_FOREVER
        )
      })

      // Ensure sessionInfo.last exists so check based on lastRunWasInterrupted
      const sessionInfo = getStoredValue<SessionInfo>(SessionInfo)
      sessionInfo.setCurrent(mockSessionInfoProps())
      sessionInfo.setCurrent(mockSessionInfoProps())
      expect(sessionInfo.last).toBeTruthy()

      // Initialize spy here to verify triggered from handleConnectionStateChanged
      const sendUpdateWidgetsMessageSpy = vi.spyOn(
        widgetStateManager,
        "sendUpdateWidgetsMessage"
      )
      sendUpdateWidgetsMessageSpy.mockClear()

      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.CONNECTED
        )
      })
      expect(sendUpdateWidgetsMessageSpy).toHaveBeenCalled()
      vi.useRealTimers()
    })
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
          metricsUrl: "test.streamlit.io",
          blockErrorDialogs: false,
          ...options,
        })
      })

      return hostCommunicationMgr
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
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
      // Since we mock the isEmbed function, we need to set its return value
      vi.mocked(isEmbed).mockReturnValue(false)
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
          contextInfo: {
            locale: "en-US",
            isEmbedded: false,
            timezone: "UTC",
            timezoneOffset: 0,
            url: "http://localhost:3000/",
            colorScheme: "light",
          },
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
      act(() => {
        sendForwardMessage(
          "delta",
          {
            type: "newElement",
            newElement: {
              type: "textInput",
              textInput: {
                label: "test input",
                type: TextInput.Type.DEFAULT,
                id: "test_input",
                disabled: false,
              },
            },
          },
          { deltaPath: [0, 0] }
        )
      })

      await waitFor(
        () => {
          expect(screen.getByLabelText("test input")).toBeInTheDocument()
        },
        {
          timeout: 10000,
        }
      )

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

    it("responds to page change request messages", () => {
      // Since we mock the isEmbed function, we need to set its return value
      vi.mocked(isEmbed).mockReturnValue(false)
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
          contextInfo: {
            locale: "en-US",
            isEmbedded: false,
            timezone: "UTC",
            timezoneOffset: 0,
            url: "http://localhost:3000/",
            colorScheme: "light",
          },
        },
      })
    })

    it("clears fragment auto rerun intervals when page changes", () => {
      prepareHostCommunicationManager()

      // autoRerun uses setInterval under-the-hood, so use fake timers
      vi.useFakeTimers()
      sendForwardMessage("autoRerun", {
        interval: 1, // in seconds
        fragmentId: "fragmentId",
      })

      // advance timer X times to trigger the interval-function
      const times = 3
      for (let i = 0; i < times; i++) {
        vi.advanceTimersByTime(1000) // in milliseconds
      }

      const connectionManager = getMockConnectionManager()
      expect(connectionManager.sendMessage).toBeCalledTimes(times)
      // ensure that all calls came from the autoRerun by checking the fragment id
      for (let i = 0; i < times; i++) {
        expect(
          // @ts-expect-error
          connectionManager.sendMessage.mock.calls[i][0].rerunScript
        ).toEqual(
          expect.objectContaining({
            isAutoRerun: true,
            fragmentId: "fragmentId",
          })
        )
      }

      // trigger a page change. we use a post message instead
      // of triggering a pange change via a newSession message,
      // because a new session also clears the autoRerun intervals
      fireWindowPostMessage({
        type: "REQUEST_PAGE_CHANGE",
        pageScriptHash: "hash1",
      })

      for (let i = 0; i < times; i++) {
        vi.advanceTimersByTime(1000) // in milliseconds
      }

      // make sure that no new messages were sent after switching the page
      // despite advancing the timer. We could check whether clearInterval
      // was called, but this check is more observing the behavior than checking
      // the exact internals.
      const oldCallCountPlusPageChangeRequest = times + 1
      expect(connectionManager.sendMessage).toBeCalledTimes(
        oldCallCountPlusPageChangeRequest
      )
    })

    describe("handleSetMenuItems", () => {
      let prevWindowLocation: Location

      beforeEach(() => {
        prevWindowLocation = window.location
      })

      afterEach(() => {
        Object.defineProperty(window, "location", {
          value: prevWindowLocation,
          writable: true,
          configurable: true,
        })
      })

      it("shows hostMenuItems", () => {
        mockWindowLocation("https://devel.streamlit.test")
        // We need this to use the Main Menu Button
        const app = renderApp(getProps())

        const hostCommunicationMgr = getStoredValue<HostCommunicationManager>(
          HostCommunicationManager
        )

        hostCommunicationMgr.setAllowedOrigins({
          allowedOrigins: ["https://devel.streamlit.test"],
          useExternalAuthToken: false,
        })

        sendForwardMessage("newSession", NEW_SESSION_JSON)
        openMenu(screen)
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
          ],
        ])
      })
    })

    it("shows hostToolbarItems", () => {
      prepareHostCommunicationManager()

      sendForwardMessage("newSession", NEW_SESSION_JSON)

      expect(
        screen.queryByTestId("stToolbarActionButton")
      ).not.toBeInTheDocument()

      fireWindowPostMessage({
        type: "SET_TOOLBAR_ITEMS",
        items: [
          {
            key: "favorite",
            icon: "star.svg",
          },
        ],
      })

      expect(screen.getByTestId("stToolbarActionButton")).toBeVisible()
    })

    it("sets hideSidebarNav based on the server config option and host setting", () => {
      prepareHostCommunicationManager()

      expect(screen.queryByTestId("stSidebarNav")).not.toBeInTheDocument()

      const appPages = [
        {
          pageScriptHash: "hash1",
          pageName: "page1",
          urlPathname: "page1",
          isDefault: true,
        },
        { pageScriptHash: "hash2", pageName: "page2", urlPathname: "page2" },
      ]

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        appPages: [],
        pageScriptHash: "hash1",
      })
      sendForwardMessage("navigation", {
        appPages,
        pageScriptHash: "hash1",
        position: Navigation.Position.SIDEBAR,
        sections: [],
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

      expect(screen.getByTestId("stAppDeployButton")).toBeInTheDocument()

      fireWindowPostMessage({
        type: "SET_MENU_ITEMS",
        items: [{ label: "Host menu item", key: "host-item", type: "text" }],
      })

      expect(screen.queryByTestId("stAppDeployButton")).not.toBeInTheDocument()
    })

    it("shows toolbar in minimal mode when host menu items exist", () => {
      prepareHostCommunicationManager()

      // Set toolbar mode to minimal
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        config: {
          ...NEW_SESSION_JSON.config,
          toolbarMode: Config.ToolbarMode.MINIMAL,
        },
      })

      // Initially no toolbar in minimal mode
      expect(screen.queryByTestId("stMainMenu")).not.toBeInTheDocument()

      // Add host menu items
      fireWindowPostMessage({
        type: "SET_MENU_ITEMS",
        items: [{ label: "Host menu item", key: "host-item", type: "text" }],
      })

      // Toolbar should now be visible
      expect(screen.getByTestId("stMainMenu")).toBeVisible()
    })

    it("shows toolbar in minimal mode when host toolbar items exist", () => {
      prepareHostCommunicationManager()

      // Set toolbar mode to minimal
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        config: {
          ...NEW_SESSION_JSON.config,
          toolbarMode: Config.ToolbarMode.MINIMAL,
        },
      })

      // Initially no toolbar actions in minimal mode
      expect(screen.queryByTestId("stToolbarActions")).not.toBeInTheDocument()

      // Add host toolbar items
      fireWindowPostMessage({
        type: "SET_TOOLBAR_ITEMS",
        items: [
          {
            key: "favorite",
            icon: "star.svg",
          },
        ],
      })

      // Toolbar actions should now be visible
      expect(screen.getByTestId("stToolbarActions")).toBeVisible()
      expect(screen.getByTestId("stToolbarActionButton")).toBeVisible()
    })

    it("does not relay custom parent messages by default", () => {
      const hostCommunicationMgr = prepareHostCommunicationManager()

      const logErrorSpy = vi.spyOn(LOG, "error").mockImplementation(() => {})

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

    it("properly handles TERMINATE_WEBSOCKET_CONNECTION & RESTART_WEBSOCKET_CONNECTION messages", () => {
      prepareHostCommunicationManager()
      const connectionMgr = getMockConnectionManager()

      fireWindowPostMessage({
        type: "TERMINATE_WEBSOCKET_CONNECTION",
      })

      expect(connectionMgr.disconnect).toHaveBeenCalled()

      fireWindowPostMessage({
        type: "RESTART_WEBSOCKET_CONNECTION",
      })

      const newConnectionManager = getMockConnectionManager()
      expect(newConnectionManager).not.toBe(connectionMgr)

      // Ensure sessionInfo.last exists so check based on scriptRunState (wasRerunRequested)
      const sessionInfo = getStoredValue<SessionInfo>(SessionInfo)
      sessionInfo.setCurrent(mockSessionInfoProps())
      expect(sessionInfo.current).toBeTruthy()
      sessionInfo.setCurrent(mockSessionInfoProps())
      expect(sessionInfo.last).toBeTruthy()

      // Set up spy to verify triggered from handleConnectionStateChanged
      const sendUpdateWidgetsMessageSpy = vi.spyOn(
        getStoredValue<WidgetStateManager>(WidgetStateManager),
        "sendUpdateWidgetsMessage"
      )

      // Mock the connection manager's state change
      act(() => {
        getMockConnectionManagerProp("connectionStateChanged")(
          ConnectionState.CONNECTED
        )
      })

      // Ensure rerun back message triggered
      expect(sendUpdateWidgetsMessageSpy).toHaveBeenCalled()
    })

    describe("blocks error dialogs when the host config option is set", () => {
      it("blocks script compile error dialog", () => {
        const hostCommunicationMgr = prepareHostCommunicationManager({
          blockErrorDialogs: true,
        })

        // send a session event forward message with a script compile error
        const sessionEvent = SessionEvent.create({
          scriptCompilationException: Exception.create({
            message: "random string",
          }),
        })
        sendForwardMessage("sessionEvent", sessionEvent)

        expect(hostCommunicationMgr.sendMessageToHost).toBeCalledWith({
          type: "CLIENT_ERROR_DIALOG",
          error: "scriptCompileError",
          message: "random string",
        })
      })

      it("block bad message format dialog", () => {
        const hostCommunicationMgr = prepareHostCommunicationManager({
          blockErrorDialogs: true,
        })

        // @ts-expect-error - send an unknown type of forward message
        sendForwardMessage("randomMessage", {})

        expect(hostCommunicationMgr.sendMessageToHost).toBeCalledWith({
          type: "CLIENT_ERROR_DIALOG",
          error: "Bad message format",
          message: 'Cannot handle type "undefined".',
        })
      })

      it("blocks page not found dialog", () => {
        const hostCommunicationMgr = prepareHostCommunicationManager({
          blockErrorDialogs: true,
        })

        // send a page not found forward message
        sendForwardMessage("pageNotFound", { pageName: "random page" })

        expect(hostCommunicationMgr.sendMessageToHost).toBeCalledWith({
          type: "CLIENT_ERROR_DIALOG",
          error: "Page not found",
          message:
            "You have requested page /random page, but no corresponding file was found in the app's pages/ directory. Running the app's main page.",
        })
      })

      it("blocks connection error dialog", () => {
        const hostCommunicationMgr = prepareHostCommunicationManager({
          blockErrorDialogs: true,
        })

        // Trigger a connection error dialog
        act(() => {
          getMockConnectionManagerProp("onConnectionError")(
            "Connection error message."
          )
        })

        expect(hostCommunicationMgr.sendMessageToHost).toBeCalledWith({
          type: "CLIENT_ERROR_DIALOG",
          error: "Connection error",
          message: "Connection error message.",
        })
      })
    })
  })

  describe("page change URL handling", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    let pushStateSpy: any
    let originalStreamlitWindowObj: typeof window.__streamlit

    beforeEach(() => {
      window.history.pushState({}, "", "/")
      pushStateSpy = vi.spyOn(window.history, "pushState")
      originalStreamlitWindowObj = window.__streamlit
    })

    afterEach(() => {
      pushStateSpy.mockRestore()
      window.history.pushState({}, "", "/")
      window.localStorage.clear()
      window.__streamlit = originalStreamlitWindowObj
    })

    it("can switch to the main page from a different page", () => {
      renderApp(getProps())
      window.history.replaceState({}, "", "/page2")

      sendForwardMessage("newSession", NEW_SESSION_JSON)
      sendForwardMessage("navigation", {
        appPages: [
          {
            pageScriptHash: "page_script_hash",
            pageName: "streamlit_app",
            isDefault: true,
          },
        ],
        pageScriptHash: "page_script_hash",
        position: Navigation.Position.SIDEBAR,
        sections: [],
      })

      expect(window.history.pushState).toHaveBeenLastCalledWith({}, "", "/")
    })

    it("can switch to a non-main page", () => {
      renderApp(getProps())
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        appPages: [],
        pageScriptHash: "hash2",
      })

      sendForwardMessage("navigation", {
        appPages: [
          {
            pageScriptHash: "page_script_hash",
            pageName: "streamlit app",
            urlPathname: "streamlit_app",
            isDefault: true,
          },
          {
            pageScriptHash: "hash2",
            pageName: "page2",
            urlPathname: "page2",
          },
        ],
        pageScriptHash: "hash2",
        position: Navigation.Position.SIDEBAR,
        sections: [],
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
      sendForwardMessage("navigation", {
        appPages: [
          {
            pageScriptHash: "page_script_hash",
            pageName: "streamlit app",
            urlPathname: "streamlit_app",
            isDefault: true,
          },
          {
            pageScriptHash: "hash2",
            pageName: "page2",
            urlPathname: "page2",
          },
        ],
        pageScriptHash: "page_script_hash",
        position: Navigation.Position.SIDEBAR,
        sections: [],
      })

      expect(window.history.pushState).toHaveBeenLastCalledWith(
        {},
        "",
        "/?foo=bar"
      )
    })

    it("retains embed query params even if the page hash is different", () => {
      const embedParams =
        "embed=true&embed_options=disable_scrolling&embed_options=show_padding"
      window.history.pushState({}, "", `/?${embedParams}`)
      renderApp(getProps())

      const hostCommunicationMgr = getStoredValue<HostCommunicationManager>(
        HostCommunicationManager
      )

      const appPages = [
        {
          pageScriptHash: "toppage_hash",
          pageName: "streamlit app",
          urlPathname: "streamlit_app",
          isDefault: true,
        },
        {
          pageScriptHash: "subpage_hash",
          pageName: "page2",
          urlPathname: "page2",
        },
      ]

      // Because the page URL is already "/" pointing to the main page, no new history is pushed.
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        appPages: [],
        pageScriptHash: "toppage_hash",
      })

      sendForwardMessage("navigation", {
        appPages,
        pageScriptHash: "toppage_hash",
        position: Navigation.Position.SIDEBAR,
        sections: [],
      })

      const navLinks = screen.queryAllByTestId("stSidebarNavLink")
      expect(navLinks).toHaveLength(2)

      // TODO: Utilize user-event instead of fireEvent
      // eslint-disable-next-line testing-library/prefer-user-event
      fireEvent.click(navLinks[1])

      const connectionManager = getMockConnectionManager()

      expect(
        // @ts-expect-error
        connectionManager.sendMessage.mock.calls[0][0].rerunScript.queryString
      ).toBe(embedParams)

      expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith({
        type: "SET_QUERY_PARAM",
        queryParams: embedParams,
      })
    })

    it("works with baseUrlPaths", () => {
      renderApp(getProps())
      vi.spyOn(getMockConnectionManager(), "getBaseUriParts").mockReturnValue({
        pathname: "/foo",
        hostname: "",
        port: "8501",
      } as URL)

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        appPages: [],
        pageScriptHash: "hash2",
      })

      sendForwardMessage("navigation", {
        appPages: [
          {
            pageScriptHash: "page_script_hash",
            pageName: "streamlit app",
            urlPathname: "streamlit_app",
            isDefault: true,
          },
          {
            pageScriptHash: "hash2",
            pageName: "page2",
            urlPathname: "page2",
          },
        ],
        pageScriptHash: "hash2",
        position: Navigation.Position.SIDEBAR,
        sections: [],
      })

      expect(window.history.pushState).toHaveBeenLastCalledWith(
        {},
        "",
        "/foo/page2"
      )
    })

    it("works with window.__streamlit.MAIN_PAGE_BASE_URL", () => {
      renderApp(getProps())

      window.__streamlit = { MAIN_PAGE_BASE_URL: "http://example.com/foo" }

      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        appPages: [],
        pageScriptHash: "hash2",
      })

      sendForwardMessage("navigation", {
        appPages: [
          {
            pageScriptHash: "page_script_hash",
            pageName: "streamlit app",
            urlPathname: "streamlit_app",
            isDefault: true,
          },
          {
            pageScriptHash: "hash2",
            pageName: "page2",
            urlPathname: "page2",
          },
        ],
        pageScriptHash: "hash2",
        position: Navigation.Position.SIDEBAR,
        sections: [],
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
        {
          pageScriptHash: "toppage_hash",
          pageName: "streamlit app",
          urlPathname: "streamlit_app",
          isDefault: true,
        },
        {
          pageScriptHash: "subpage_hash",
          pageName: "page2",
          urlPathname: "page2",
        },
      ]

      // Because the page URL is already "/" pointing to the main page, no new history is pushed.
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        appPages: [],
        pageScriptHash: "toppage_hash",
      })
      sendForwardMessage("navigation", {
        appPages,
        pageScriptHash: "toppage_hash",
        position: Navigation.Position.SIDEBAR,
        sections: [],
      })

      expect(window.history.pushState).not.toHaveBeenCalled()
      // @ts-expect-error
      window.history.pushState.mockClear()

      // When accessing a different page, a new history for that page is pushed.
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        appPages: [],
        pageScriptHash: "subpage_hash",
      })
      sendForwardMessage("navigation", {
        appPages,
        pageScriptHash: "subpage_hash",
        position: Navigation.Position.SIDEBAR,
        sections: [],
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
        {
          pageScriptHash: "toppage_hash",
          pageName: "streamlit app",
          urlPathname: "streamlit_app",
          isDefault: true,
        },
        {
          pageScriptHash: "subpage_hash",
          pageName: "page2",
          urlPathname: "page2",
        },
      ]

      // Because the page URL is already "/" pointing to the main page, no new history is pushed.
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        appPages: [],
        pageScriptHash: "toppage_hash",
      })

      sendForwardMessage("navigation", {
        appPages,
        pageScriptHash: "toppage_hash",
        position: Navigation.Position.SIDEBAR,
        sections: [],
      })

      expect(window.history.pushState).toHaveBeenLastCalledWith({}, "", "/")
      // @ts-expect-error
      window.history.pushState.mockClear()

      // When running the same, e.g. clicking the "rerun" button,
      // the history is not pushed again.
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        appPages: [],
        pageScriptHash: "toppage_hash",
      })
      sendForwardMessage("navigation", {
        appPages,
        pageScriptHash: "toppage_hash",
        position: Navigation.Position.SIDEBAR,
        sections: [],
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
      sendForwardMessage("navigation", {
        appPages,
        pageScriptHash: "subpage_hash",
        position: Navigation.Position.SIDEBAR,
        sections: [],
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
})

describe("App.hasReceivedNewSession flag behavior", () => {
  beforeEach(() => {
    // Ensure a clean state for sessionInfo and connectionManager mocks
    vi.clearAllMocks()
  })

  it("ensures incrementMessageCacheRunCount is called when hasReceivedNewSession is true", () => {
    renderApp(getProps())
    const connectionManager = getMockConnectionManager(true) // isConnected = true
    const sessionInfo = getStoredValue<SessionInfo>(SessionInfo)

    // 1. Initialize SessionInfo (so this.sessionInfo.isSet is true)
    act(() => {
      const props = mockSessionInfoProps({
        streamlitVersion: "streamlitVersion",
      })
      sessionInfo.setCurrent(props)
    })
    expect(sessionInfo.isSet).toBe(true)

    // 2. Send newSession (sets hasReceivedNewSession = true internally in App.tsx)
    sendForwardMessage("newSession", NEW_SESSION_JSON)

    // 3. Send scriptFinished
    sendForwardMessage(
      "scriptFinished",
      ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY
    )

    // 4. Assert incrementMessageCacheRunCount was called
    // It's called once because hasReceivedNewSession was true.
    expect(
      connectionManager.incrementMessageCacheRunCount
    ).toHaveBeenCalledTimes(1)
  })

  it("ensures incrementMessageCacheRunCount is NOT called when hasReceivedNewSession is false", async () => {
    renderApp(getProps())
    const connectionManager = getMockConnectionManager(true) // isConnected = true
    const sessionInfo = getStoredValue<SessionInfo>(SessionInfo)

    // 1. Initialize SessionInfo
    act(() => {
      const props = mockSessionInfoProps({
        streamlitVersion: "streamlitVersion",
      })
      sessionInfo.setCurrent(props)
    })
    expect(sessionInfo.isSet).toBe(true)

    // 2. Send newSession (sets hasReceivedNewSession = true)
    sendForwardMessage("newSession", NEW_SESSION_JSON)

    // Verify that if script finished now, incrementMessageCacheRunCount would be called
    sendForwardMessage(
      "scriptFinished",
      ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY
    )
    expect(
      connectionManager.incrementMessageCacheRunCount
    ).toHaveBeenCalledTimes(1)
    vi.mocked(connectionManager.incrementMessageCacheRunCount).mockClear()

    // 3. Trigger rerunScript (which calls sendRerunBackMsg, setting hasReceivedNewSession = false)
    // Set scriptRunState to NOT_RUNNING so rerunScript proceeds
    sendForwardMessage("sessionStatusChanged", {
      runOnSave: false,
      scriptIsRunning: false,
    })

    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.keyDown(document.body, {
      key: "r",
      which: 82, // Key code for 'r'
    })

    // Wait for state updates from rerunScript to propagate if any were async.
    // sendRerunBackMsg, which sets hasReceivedNewSession to false, is called synchronously in this path.
    await act(async () => {
      // Wrapping in act to ensure all microtasks related to fireEvent are flushed.
      // Even if it appears as a no-op, it can be important for timing in RTL tests.
      return Promise.resolve()
    })

    // 4. Send scriptFinished again
    sendForwardMessage(
      "scriptFinished",
      ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY
    )

    // 5. Assert incrementMessageCacheRunCount was NOT called this time
    expect(
      connectionManager.incrementMessageCacheRunCount
    ).not.toHaveBeenCalled()
  })

  describe("Toolbar visibility in minimal mode", () => {
    beforeEach(() => {
      vi.mocked(isEmbed).mockReturnValue(false)
      vi.mocked(isToolbarDisplayed).mockReturnValue(false)
    })

    it("shows toolbar in minimal mode when app-defined About menu item exists", () => {
      renderApp(getProps())

      // Set toolbar mode to minimal
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        config: {
          ...NEW_SESSION_JSON.config,
          toolbarMode: Config.ToolbarMode.MINIMAL,
        },
      })

      // Set About menu item via pageConfigChanged
      sendForwardMessage("pageConfigChanged", {
        menuItems: {
          aboutSectionMd: "Version X",
        },
      })

      // The toolbar should be visible because there's an About menu item
      expect(screen.getByTestId("stMainMenu")).toBeVisible()
    })

    it("shows toolbar in minimal mode when app-defined Get Help menu item exists", () => {
      renderApp(getProps())

      // Set toolbar mode to minimal
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        config: {
          ...NEW_SESSION_JSON.config,
          toolbarMode: Config.ToolbarMode.MINIMAL,
        },
      })

      // Set Get Help menu item via pageConfigChanged
      sendForwardMessage("pageConfigChanged", {
        menuItems: {
          getHelpUrl: "https://example.com/help",
          hideGetHelp: false,
        },
      })

      // The toolbar should be visible because there's a Get Help menu item
      expect(screen.getByTestId("stMainMenu")).toBeVisible()
    })

    it("shows toolbar in minimal mode when app-defined Report a Bug menu item exists", () => {
      renderApp(getProps())

      // Set toolbar mode to minimal
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        config: {
          ...NEW_SESSION_JSON.config,
          toolbarMode: Config.ToolbarMode.MINIMAL,
        },
      })

      // Set Report a Bug menu item via pageConfigChanged
      sendForwardMessage("pageConfigChanged", {
        menuItems: {
          reportABugUrl: "https://example.com/bug",
          hideReportABug: false,
        },
      })

      // The toolbar should be visible because there's a Report a Bug menu item
      expect(screen.getByTestId("stMainMenu")).toBeVisible()
    })

    it("hides toolbar in minimal mode when no menu items exist", () => {
      renderApp(getProps())

      // Set toolbar mode to minimal with no menu items
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        config: {
          ...NEW_SESSION_JSON.config,
          toolbarMode: Config.ToolbarMode.MINIMAL,
        },
      })

      // The toolbar should not be visible because there are no menu items
      expect(screen.queryByTestId("stMainMenu")).not.toBeInTheDocument()
    })

    it("hides toolbar in minimal mode when menu items are hidden", () => {
      renderApp(getProps())

      // Set toolbar mode to minimal
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        config: {
          ...NEW_SESSION_JSON.config,
          toolbarMode: Config.ToolbarMode.MINIMAL,
        },
      })

      // Set menu items but hide them
      sendForwardMessage("pageConfigChanged", {
        menuItems: {
          getHelpUrl: "https://example.com/help",
          hideGetHelp: true,
          reportABugUrl: "https://example.com/bug",
          hideReportABug: true,
        },
      })

      // The toolbar should not be visible because all menu items are hidden
      expect(screen.queryByTestId("stMainMenu")).not.toBeInTheDocument()
    })

    it("shows toolbar in non-minimal modes regardless of menu items", () => {
      renderApp(getProps())

      // Set toolbar mode to VIEWER (non-minimal)
      sendForwardMessage("newSession", {
        ...NEW_SESSION_JSON,
        config: {
          ...NEW_SESSION_JSON.config,
          toolbarMode: Config.ToolbarMode.VIEWER,
        },
      })

      // The toolbar should be visible even without menu items
      expect(screen.getByTestId("stMainMenu")).toBeVisible()
    })
  })

  describe("Connection Error Handling", () => {
    const triggerConnectionError = (
      connectionManager: ConnectionManager,
      errorMessage: string
    ): void => {
      act(() => {
        // @ts-expect-error - connectionManager.props is private
        connectionManager.props.onConnectionError(errorMessage)
      })
    }

    describe("handleConnectionError", () => {
      it("displays connection error dialog when connection error occurs", () => {
        renderApp(getProps())
        const connectionManager = getMockConnectionManager(false)

        triggerConnectionError(
          connectionManager,
          "Network error: Unable to connect"
        )

        // Verify error dialog and message are displayed
        expect(screen.getByText("Connection error")).toBeVisible()
        expect(
          screen.getByText(/Network error: Unable to connect/)
        ).toBeVisible()
      })

      it("does not display error dialog if already dismissed", () => {
        renderApp(getProps())
        const connectionManager = getMockConnectionManager(false)

        // First error
        triggerConnectionError(connectionManager, "Connection lost")

        expect(screen.getByText("Connection error")).toBeVisible()

        // Dismiss the dialog
        const closeButton = screen.getByRole("button", { name: /close/i })
        act(() => {
          // eslint-disable-next-line testing-library/prefer-user-event -- userEvent causes timeouts in this test
          fireEvent.click(closeButton)
        })

        expect(screen.queryByText("Connection error")).toBeNull()

        // Second error should not display
        triggerConnectionError(connectionManager, "Another connection error")

        expect(screen.queryByText("Connection error")).toBeNull()
      })

      it("sends error info to host when blockErrorDialogs is true", () => {
        renderApp(getProps())
        const connectionManager = getMockConnectionManager(false)
        const hostCommunicationMgr = getStoredValue<HostCommunicationManager>(
          HostCommunicationManager
        )

        // Set blockErrorDialogs config
        act(() => {
          getMockConnectionManagerProp("onHostConfigResp")({
            blockErrorDialogs: true,
            allowedOrigins: [],
            useExternalAuthToken: false,
            enableCustomParentMessages: false,
          })
        })

        // Trigger error
        triggerConnectionError(connectionManager, "Connection lost")

        // Dialog should not be displayed
        expect(screen.queryByText("Connection error")).toBeNull()

        // But error should be sent to host
        expect(hostCommunicationMgr.sendMessageToHost).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "CLIENT_ERROR_DIALOG",
            error: "Connection error",
            message: expect.stringContaining("Connection lost"),
          })
        )
      })

      it("displays error with StreamlitMarkdown formatting", () => {
        renderApp(getProps())
        const connectionManager = getMockConnectionManager(false)

        triggerConnectionError(
          connectionManager,
          "**Network Error**: Unable to connect to server"
        )

        // Verify both error dialog and markdown content are displayed
        expect(screen.getByText("Connection error")).toBeVisible()
        expect(screen.getByText(/Network Error/)).toBeVisible()
      })
    })

    describe("connection state transitions with error dismissal", () => {
      it("resets dismissal state when reconnected", () => {
        renderApp(getProps())
        const connectionManager = getMockConnectionManager(false)

        // Trigger connection error
        triggerConnectionError(connectionManager, "Connection lost")

        expect(screen.getByText("Connection error")).toBeVisible()

        // Dismiss the dialog
        const closeButton = screen.getByRole("button", { name: /close/i })
        act(() => {
          // eslint-disable-next-line testing-library/prefer-user-event -- userEvent causes timeouts in this test
          fireEvent.click(closeButton)
        })

        expect(screen.queryByText("Connection error")).toBeNull()

        // Simulate reconnection
        act(() => {
          getMockConnectionManagerProp("connectionStateChanged")(
            ConnectionState.CONNECTED
          )
        })

        // New error should be displayed after reconnection
        triggerConnectionError(connectionManager, "New connection error")

        expect(screen.getByText("Connection error")).toBeVisible()
        expect(screen.getByText(/New connection error/)).toBeVisible()
      })

      it("automatically rescinds error dialog on successful reconnection", () => {
        renderApp(getProps())
        const connectionManager = getMockConnectionManager(false)

        // Set initial state to connected
        act(() => {
          getMockConnectionManagerProp("connectionStateChanged")(
            ConnectionState.CONNECTED
          )
        })

        sendForwardMessage("newSession", NEW_SESSION_JSON)

        // Trigger disconnection
        act(() => {
          getMockConnectionManagerProp("connectionStateChanged")(
            ConnectionState.PINGING_SERVER
          )
        })

        // Trigger connection error
        triggerConnectionError(connectionManager, "Connection lost")

        expect(screen.getByText("Connection error")).toBeVisible()

        // Reconnect (without dismissing dialog)
        act(() => {
          getMockConnectionManagerProp("connectionStateChanged")(
            ConnectionState.CONNECTED
          )
        })

        // Dialog should be automatically closed
        expect(screen.queryByText("Connection error")).toBeNull()
      })

      it("only rescinds CONNECTION_ERROR type dialogs on reconnection", () => {
        renderApp(getProps())
        const connectionManager = getMockConnectionManager(false)

        // First, show a connection error dialog
        triggerConnectionError(connectionManager, "Connection lost")

        expect(screen.getByText("Connection error")).toBeVisible()

        // Simulate reconnection - should close the CONNECTION_ERROR dialog
        act(() => {
          getMockConnectionManagerProp("connectionStateChanged")(
            ConnectionState.CONNECTED
          )
        })

        // Connection error dialog should be closed
        expect(screen.queryByText("Connection error")).toBeNull()

        // Now test that other dialog types are not affected
        // This validates that only CONNECTION_ERROR dialogs are auto-closed
      })
    })

    describe("reconnection behavior", () => {
      it("requests script rerun on reconnection after interruption", () => {
        renderApp(getProps())
        const widgetStateManager =
          getStoredValue<WidgetStateManager>(WidgetStateManager)

        // Start with connected state
        act(() => {
          getMockConnectionManagerProp("connectionStateChanged")(
            ConnectionState.CONNECTED
          )
        })

        sendForwardMessage("newSession", NEW_SESSION_JSON)

        // Set script to running
        sendForwardMessage("sessionStatusChanged", {
          runOnSave: false,
          scriptIsRunning: true,
        })

        // Disconnect during script run
        act(() => {
          getMockConnectionManagerProp("connectionStateChanged")(
            ConnectionState.PINGING_SERVER
          )
        })

        const sendUpdateWidgetsMessageSpy = vi.spyOn(
          widgetStateManager,
          "sendUpdateWidgetsMessage"
        )
        sendUpdateWidgetsMessageSpy.mockClear()

        // Reconnect
        act(() => {
          getMockConnectionManagerProp("connectionStateChanged")(
            ConnectionState.CONNECTED
          )
        })

        // Should request rerun
        expect(sendUpdateWidgetsMessageSpy).toHaveBeenCalledWith(undefined)
      })

      it("handles multiple connection errors gracefully", () => {
        renderApp(getProps())
        const connectionManager = getMockConnectionManager(false)

        // Trigger multiple errors
        triggerConnectionError(connectionManager, "Error 1")

        triggerConnectionError(connectionManager, "Error 2")

        triggerConnectionError(connectionManager, "Error 3")

        // Should only show the latest error
        expect(screen.getByText("Connection error")).toBeVisible()
        expect(screen.getByText(/Error 3/)).toBeVisible()
        expect(screen.queryByText(/Error 1/)).toBeNull()
        expect(screen.queryByText(/Error 2/)).toBeNull()
      })

      it("maintains dismissal state across multiple disconnections", () => {
        renderApp(getProps())
        const connectionManager = getMockConnectionManager(false)

        // First error
        triggerConnectionError(connectionManager, "First error")

        expect(screen.getByText("Connection error")).toBeVisible()

        // Dismiss the dialog
        const closeButton = screen.getByRole("button", { name: /close/i })
        act(() => {
          // eslint-disable-next-line testing-library/prefer-user-event -- userEvent causes timeouts in this test
          fireEvent.click(closeButton)
        })

        expect(screen.queryByText("Connection error")).toBeNull()

        // Simulate multiple state changes without full reconnection
        act(() => {
          getMockConnectionManagerProp("connectionStateChanged")(
            ConnectionState.PINGING_SERVER
          )
        })

        act(() => {
          getMockConnectionManagerProp("connectionStateChanged")(
            ConnectionState.CONNECTING
          )
        })

        // Error should still not display (dismissal persists)
        triggerConnectionError(connectionManager, "Another error")

        expect(screen.queryByText("Connection error")).toBeNull()

        // Only full reconnection should reset dismissal
        act(() => {
          getMockConnectionManagerProp("connectionStateChanged")(
            ConnectionState.CONNECTED
          )
        })

        triggerConnectionError(connectionManager, "Error after reconnect")

        expect(screen.getByText("Connection error")).toBeVisible()
      })
    })

    describe("host communication integration", () => {
      it("handles host-requested reconnection", () => {
        renderApp(getProps())
        const hostCommunicationMgr = getStoredValue<HostCommunicationManager>(
          HostCommunicationManager
        )

        const restartWebsocketConnection =
          // @ts-expect-error - accessing private property for testing
          hostCommunicationMgr.props.restartWebsocketConnection

        const terminateWebsocketConnection =
          // @ts-expect-error - accessing private property for testing
          hostCommunicationMgr.props.terminateWebsocketConnection

        // First disconnect to set connectionManager to null
        act(() => {
          terminateWebsocketConnection()
        })

        // Clear the mock to count from zero
        vi.mocked(ConnectionManager).mockClear()

        // Now request reconnection
        act(() => {
          restartWebsocketConnection()
        })

        // Should have created a new ConnectionManager instance
        expect(ConnectionManager).toHaveBeenCalledTimes(1)
      })

      it("handles host-requested disconnection", () => {
        renderApp(getProps())
        const hostCommunicationMgr = getStoredValue<HostCommunicationManager>(
          HostCommunicationManager
        )
        const connectionManager = getMockConnectionManager(false)

        const terminateWebsocketConnection =
          // @ts-expect-error - accessing private property for testing
          hostCommunicationMgr.props.terminateWebsocketConnection

        // Simulate host requesting disconnection
        act(() => {
          terminateWebsocketConnection()
        })

        // Should disconnect
        expect(connectionManager.disconnect).toHaveBeenCalled()
      })

      it("logs error when not connected but trying to handle errors", () => {
        renderApp(getProps())
        const connectionManager = getMockConnectionManager(false)

        // Mock console.error to verify logging
        const logSpy = vi.spyOn(LOG, "error")

        // Mock isConnected to return false
        // @ts-expect-error
        connectionManager.isConnected.mockReturnValue(false)

        // Set connectionManager to null to simulate disconnected state
        act(() => {
          getMockConnectionManagerProp("connectionStateChanged")(
            ConnectionState.DISCONNECTED_FOREVER
          )
        })

        // Try to trigger connection error
        triggerConnectionError(connectionManager, "Error while disconnected")

        // Should still show error dialog even when disconnected
        expect(screen.getByText("Connection error")).toBeVisible()

        // Verify error was logged
        expect(logSpy).toHaveBeenCalledWith("Error while disconnected")

        logSpy.mockRestore()
      })
    })
  })
})
