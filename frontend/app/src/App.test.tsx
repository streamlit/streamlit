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

import React from "react"
import { ReactWrapper, ShallowWrapper } from "enzyme"
import { waitFor } from "@testing-library/react"
import cloneDeep from "lodash/cloneDeep"
import {
  LocalStore,
  hashString,
  shallow,
  mount,
  mockWindowLocation,
  ScriptRunState,
  SessionInfo,
  createAutoTheme,
  CUSTOM_THEME_NAME,
  lightTheme,
  toExportedTheme,
  Modal,
  mockSessionInfo,
  mockSessionInfoProps,
  Config,
  CustomThemeConfig,
  Delta,
  ForwardMsg,
  ForwardMsgMetadata,
  ICustomThemeConfig,
  INewSession,
  NewSession,
  PageConfig,
  PageInfo,
  PageNotFound,
  PagesChanged,
  mockTheme,
  HOST_COMM_VERSION,
} from "@streamlit/lib"
import { ConnectionState } from "@streamlit/app/src/connection/ConnectionState"
import {
  DialogType,
  StreamlitDialog,
} from "@streamlit/app/src/components/StreamlitDialog"
import { App, Props, showDevelopmentOptions } from "./App"
import MainMenu from "@streamlit/app/src/components/MainMenu"
import ToolbarActions from "@streamlit/app/src/components/ToolbarActions"

jest.mock("@streamlit/app/src/connection/ConnectionManager")
jest.mock("@streamlit/lib/src/baseconsts", () => {
  return {
    ...jest.requireActual("@streamlit/lib/src/baseconsts"),
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

const getWrapper = (): ReactWrapper => {
  const mountPoint = document.createElement("div")
  mountPoint.setAttribute("id", "ConnectionStatus")
  document.body.appendChild(mountPoint)
  const props = getProps()

  return mount(<App {...props} />, { attachTo: mountPoint })
}

// Mocking "message" event listeners on the window;
// returns function to establish a listener
function mockEventListeners(): (type: string, event: any) => void {
  const listeners: { [name: string]: ((event: Event) => void)[] } = {}

  window.addEventListener = jest.fn((event: string, cb: any) => {
    listeners[event] = listeners[event] || []
    listeners[event].push(cb)
  })

  return (type: string, event: Event): void =>
    listeners[type].forEach(cb => cb(event))
}

const NEW_SESSION_JSON: INewSession = {
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
    commandLine: "commandLine",
  },
  appPages: [
    { pageScriptHash: "page_script_hash", pageName: "streamlit_app" },
  ],
  pageScriptHash: "page_script_hash",
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

describe("App", () => {
  beforeEach(() => {
    // @ts-expect-error
    window.prerenderReady = false
  })

  it("renders without crashing", () => {
    const wrapper = getWrapper()

    expect(wrapper.html()).not.toBeNull()
  })

  it("calls connectionManager.disconnect() when unmounting", () => {
    const wrapper = getWrapper()
    const instance = wrapper.instance() as App

    wrapper.unmount()

    // @ts-expect-error
    expect(instance.connectionManager.disconnect).toHaveBeenCalled()
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
      const props = getProps()
      const wrapper = shallow(<App {...props} />)
      const app = wrapper.instance() as App

      // A HACK to mock `window.location.reload`.
      // NOTE: The mocking must be done after mounting, but before `handleMessage` is called.
      // @ts-expect-error
      delete window.location
      // @ts-expect-error
      window.location = { reload: jest.fn() }

      // Ensure SessionInfo is initialized
      // @ts-expect-error
      const sessionInfo: SessionInfo = app.sessionInfo
      sessionInfo.setCurrent(
        mockSessionInfoProps({ streamlitVersion: "oldStreamlitVersion" })
      )
      expect(sessionInfo.isSet).toBe(true)

      const fwMessage = new ForwardMsg()
      fwMessage.newSession = {
        config: {},
        initialize: {
          environmentInfo: {
            streamlitVersion: "newStreamlitVersion",
          },
          sessionId: "sessionId",
          userInfo: {},
          sessionStatus: {},
        },
      }

      app.handleMessage(fwMessage)

      expect(window.location.reload).toHaveBeenCalled()
    })
  })

  it("starts screencast recording when the MainMenu is clicked", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)

    wrapper.setState({
      scriptName: "scriptName",
    })

    wrapper.find(MainMenu).props().screencastCallback()

    expect(props.screenCast.startRecording).toHaveBeenCalledWith(
      "streamlit-scriptName-date"
    )
  })

  it("stops screencast when esc is pressed", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)

    // @ts-expect-error
    wrapper.instance().keyHandlers.STOP_RECORDING()

    expect(props.screenCast.stopRecording).toHaveBeenCalled()
  })

  it("hides the top bar if hideTopBar === true", () => {
    const wrapper = shallow(<App {...getProps()} />)
    // hideTopBar is true by default

    expect(wrapper.find("WithTheme(StatusWidget)").exists()).toBe(false)
    expect(wrapper.find("ToolbarActions").exists()).toBe(false)
  })

  it("shows the top bar if hideTopBar === false", () => {
    const wrapper = shallow(<App {...getProps()} />)
    wrapper.setState({ hideTopBar: false })

    expect(wrapper.find("WithTheme(StatusWidget)").exists()).toBe(true)
    expect(wrapper.find("ToolbarActions").exists()).toBe(true)
  })
})

const mockGetBaseUriParts = (basePath?: string) => () => ({
  basePath: basePath || "",
})

describe("App.handleNewSession", () => {
  const NEW_SESSION = new NewSession(NEW_SESSION_JSON)

  afterEach(() => {
    window.localStorage.clear()
  })

  it("respects the user's theme preference if set, but adds custom theme as an option", () => {
    const props = getProps()
    window.localStorage.setItem(
      LocalStore.ACTIVE_THEME,
      JSON.stringify({ name: lightTheme.name })
    )
    const wrapper = shallow(<App {...props} />)

    // @ts-expect-error
    wrapper.instance().handleNewSession(NEW_SESSION)

    expect(props.theme.addThemes).toHaveBeenCalled()
    expect(props.theme.setTheme).not.toHaveBeenCalled()
  })

  it("sets the custom theme as the default if no user preference is set", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)

    const newSessionJson = cloneDeep(NEW_SESSION_JSON)

    // @ts-expect-error
    wrapper.instance().handleNewSession(new NewSession(newSessionJson))

    expect(props.theme.addThemes).toHaveBeenCalled()
    expect(props.theme.setTheme).toHaveBeenCalled()

    // @ts-expect-error
    expect(props.theme.setTheme.mock.calls[0][0].name).toBe(CUSTOM_THEME_NAME)
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
    const wrapper = shallow(<App {...props} />)

    const newSessionJson = cloneDeep(NEW_SESSION_JSON)

    // @ts-expect-error
    wrapper.instance().handleNewSession(new NewSession(newSessionJson))

    expect(props.theme.addThemes).toHaveBeenCalled()
    expect(props.theme.setTheme).toHaveBeenCalled()

    // @ts-expect-error
    expect(props.theme.setTheme.mock.calls[0][0].name).toBe(CUSTOM_THEME_NAME)
  })

  it("removes the custom theme from theme options if one is not received from the server", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)
    wrapper.setState({ themeHash: "customThemeHash" })

    const newSessionJson = cloneDeep(NEW_SESSION_JSON)

    newSessionJson.customTheme = null
    // @ts-expect-error
    wrapper.instance().handleNewSession(new NewSession(newSessionJson))
    expect(props.theme.addThemes).toHaveBeenCalled()

    // @ts-expect-error
    expect(props.theme.addThemes.mock.calls[0][0]).toEqual([])
  })

  it("Does not change dark/light/auto user preferences when removing a custom theme", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)
    wrapper.setState({ themeHash: "customThemeHash" })

    const newSessionJson = cloneDeep(NEW_SESSION_JSON)

    newSessionJson.customTheme = null

    // @ts-expect-error
    wrapper.instance().handleNewSession(new NewSession(newSessionJson))

    expect(props.theme.addThemes).toHaveBeenCalled()

    // @ts-expect-error
    expect(props.theme.addThemes.mock.calls[0][0]).toEqual([])

    expect(props.theme.setTheme).not.toHaveBeenCalled()
  })

  it("Changes theme to auto when user has a custom theme selected and it is removed", () => {
    const props = getProps()
    props.theme.activeTheme = {
      ...lightTheme,
      name: CUSTOM_THEME_NAME,
    }
    const wrapper = shallow(<App {...props} />)
    wrapper.setState({ themeHash: "customThemeHash" })

    const newSessionJson = cloneDeep(NEW_SESSION_JSON)
    newSessionJson.customTheme = null

    // @ts-expect-error
    wrapper.instance().handleNewSession(new NewSession(newSessionJson))

    expect(props.theme.addThemes).toHaveBeenCalled()
    // @ts-expect-error
    expect(props.theme.addThemes.mock.calls[0][0]).toEqual([])

    expect(props.theme.setTheme).toHaveBeenCalled()
    // @ts-expect-error
    expect(props.theme.setTheme.mock.calls[0][0]).toEqual(createAutoTheme())
  })

  it("updates the custom theme if the one received from server has different hash", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)

    const customThemeConfig = new CustomThemeConfig({ primaryColor: "blue" })
    // @ts-expect-error
    const themeHash = wrapper.instance().createThemeHash(customThemeConfig)
    wrapper.setState({ themeHash })

    // @ts-expect-error
    wrapper.instance().handleNewSession(NEW_SESSION)

    expect(props.theme.addThemes).toHaveBeenCalled()
    expect(props.theme.setTheme).toHaveBeenCalled()
  })

  it("does nothing if the custom theme received from server has a matching hash", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)

    const customThemeConfig = new CustomThemeConfig(
      NEW_SESSION_JSON.customTheme as ICustomThemeConfig
    )
    // @ts-expect-error
    const themeHash = wrapper.instance().createThemeHash(customThemeConfig)
    wrapper.setState({ themeHash })

    // @ts-expect-error
    wrapper.instance().handleNewSession(NEW_SESSION)

    expect(props.theme.addThemes).not.toHaveBeenCalled()
    expect(props.theme.setTheme).not.toHaveBeenCalled()
  })

  it("does nothing if no custom theme is received and themeHash is 'hash_for_undefined_custom_theme'", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)
    wrapper.setState({ themeHash: "hash_for_undefined_custom_theme" })

    const newSessionJson = cloneDeep(NEW_SESSION_JSON)
    newSessionJson.customTheme = null

    // @ts-expect-error
    wrapper.instance().handleNewSession(new NewSession(newSessionJson))

    expect(props.theme.addThemes).not.toHaveBeenCalled()
    expect(props.theme.setTheme).not.toHaveBeenCalled()
  })

  it("performs one-time initialization", () => {
    const wrapper = shallow(<App {...getProps()} />)
    const app = wrapper.instance()

    // @ts-expect-error
    const sessionInfo = app.sessionInfo

    const oneTimeInitialization = jest.spyOn(
      app,
      // @ts-expect-error
      "handleOneTimeInitialization"
    )

    expect(sessionInfo.isSet).toBe(false)

    // @ts-expect-error
    app.handleNewSession(NEW_SESSION)

    expect(oneTimeInitialization).toHaveBeenCalledTimes(1)
    expect(sessionInfo.isSet).toBe(true)
  })

  it("performs one-time initialization only once", () => {
    const wrapper = shallow(<App {...getProps()} />)
    const app = wrapper.instance()

    // @ts-expect-error
    const sessionInfo = app.sessionInfo

    const oneTimeInitialization = jest.spyOn(
      app,
      // @ts-expect-error
      "handleOneTimeInitialization"
    )

    expect(sessionInfo.isSet).toBe(false)

    // @ts-expect-error
    app.handleNewSession(NEW_SESSION)
    // @ts-expect-error
    app.handleNewSession(NEW_SESSION)
    // @ts-expect-error
    app.handleNewSession(NEW_SESSION)

    // Multiple NEW_SESSION messages should not result in one-time
    // initialization being performed more than once.
    expect(oneTimeInitialization).toHaveBeenCalledTimes(1)
    expect(sessionInfo.isSet).toBe(true)
  })

  it("performs one-time initialization after a new session is received", () => {
    const wrapper = shallow(<App {...getProps()} />)
    const app = wrapper.instance()

    // @ts-expect-error
    const sessionInfo = app.sessionInfo

    const oneTimeInitialization = jest.spyOn(
      app,
      // @ts-expect-error
      "handleOneTimeInitialization"
    )

    expect(sessionInfo.isSet).toBe(false)

    // @ts-expect-error
    app.handleNewSession(NEW_SESSION)
    expect(oneTimeInitialization).toHaveBeenCalledTimes(1)

    // @ts-expect-error
    app.handleConnectionStateChanged(ConnectionState.PINGING_SERVER)
    expect(sessionInfo.isSet).toBe(false)

    // @ts-expect-error
    app.handleConnectionStateChanged(ConnectionState.CONNECTED)
    // @ts-expect-error
    app.handleNewSession(NEW_SESSION)

    expect(oneTimeInitialization).toHaveBeenCalledTimes(2)
    expect(sessionInfo.isSet).toBe(true)
  })

  it("should set window.prerenderReady to true after app script is run successfully first time", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)

    wrapper.setState({
      scriptRunState: ScriptRunState.NOT_RUNNING,
      connectionState: ConnectionState.CONNECTING,
    })
    wrapper.update()
    // @ts-expect-error
    expect(window.prerenderReady).toBe(false)

    wrapper.setState({
      scriptRunState: ScriptRunState.RUNNING,
      connectionState: ConnectionState.CONNECTED,
    })
    wrapper.update()
    // @ts-expect-error
    expect(window.prerenderReady).toBe(false)

    wrapper.setState({
      scriptRunState: ScriptRunState.NOT_RUNNING,
      connectionState: ConnectionState.CONNECTED,
    })
    wrapper.update()
    // @ts-expect-error
    expect(window.prerenderReady).toBe(true)

    // window.prerenderReady is set to true after first
    wrapper.setState({
      scriptRunState: ScriptRunState.NOT_RUNNING,
      connectionState: ConnectionState.CONNECTED,
    })
    wrapper.update()
    // @ts-expect-error
    expect(window.prerenderReady).toBe(true)
  })

  it("plumbs appPages and currentPageScriptHash to the AppView component", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)
    const instance = wrapper.instance() as App
    const sendMessageFunc = jest.spyOn(
      // @ts-expect-error
      instance.hostCommunicationMgr,
      "sendMessageToHost"
    )

    expect(wrapper.find("AppView").prop("appPages")).toEqual([])

    const appPages = [
      { pageScriptHash: "hash1", pageName: "page1" },
      { pageScriptHash: "hash2", pageName: "page2" },
    ]

    const newSessionJson = cloneDeep(NEW_SESSION_JSON)
    newSessionJson.appPages = appPages
    newSessionJson.pageScriptHash = "hash1"

    // @ts-expect-error
    wrapper.instance().handleNewSession(new NewSession(newSessionJson))
    expect(wrapper.find("AppView").prop("appPages")).toEqual(appPages)
    expect(wrapper.find("AppView").prop("currentPageScriptHash")).toEqual(
      "hash1"
    )
    expect(document.title).toBe("page1 · Streamlit")
    expect(sendMessageFunc).toHaveBeenCalledWith({
      type: "SET_APP_PAGES",
      appPages,
    })
    expect(sendMessageFunc).toHaveBeenCalledWith({
      type: "SET_CURRENT_PAGE_NAME",
      currentPageName: "",
      currentPageScriptHash: "hash1",
    })
  })

  it("calls clearAppState if currentPageScriptHash changes", () => {
    const wrapper = shallow(<App {...getProps()} />)
    const instance = wrapper.instance() as App
    instance.clearAppState = jest.fn()

    const newSessionJson = cloneDeep(NEW_SESSION_JSON)
    newSessionJson.pageScriptHash = "different_hash"

    // @ts-expect-error
    wrapper.instance().handleNewSession(new NewSession(newSessionJson))

    expect(instance.clearAppState).toHaveBeenCalled()
  })

  it("doesn't call clearAppState if currentPageScriptHash doesn't change", () => {
    const wrapper = shallow(<App {...getProps()} />)
    wrapper.setState({
      currentPageScriptHash: "page_script_hash",
      appHash: hashString("installationId"),
    })
    const instance = wrapper.instance() as App
    instance.clearAppState = jest.fn()

    const newSessionJson = cloneDeep(NEW_SESSION_JSON)

    // @ts-expect-error
    wrapper.instance().handleNewSession(new NewSession(newSessionJson))

    expect(instance.clearAppState).not.toHaveBeenCalled()
  })

  describe("page change URL handling", () => {
    let wrapper: ShallowWrapper
    let instance: App
    let pushStateSpy: any

    beforeEach(() => {
      wrapper = shallow(<App {...getProps()} />)
      instance = wrapper.instance() as App
      // @ts-expect-error
      instance.connectionManager.getBaseUriParts = mockGetBaseUriParts()

      window.history.pushState({}, "", "/")
      pushStateSpy = jest.spyOn(window.history, "pushState")
    })

    afterEach(() => {
      pushStateSpy.mockRestore()
      window.history.pushState({}, "", "/")
    })

    it("can switch to the main page from a different page", () => {
      window.history.replaceState({}, "", "/page2")

      const instance = wrapper.instance() as App
      instance.handleNewSession(new NewSession(NEW_SESSION_JSON))

      expect(window.history.pushState).toHaveBeenLastCalledWith({}, "", "/")
    })

    it("can switch to a non-main page", () => {
      const instance = wrapper.instance() as App
      const newSessionJson = cloneDeep(NEW_SESSION_JSON)
      newSessionJson.appPages = [
        { pageScriptHash: "page_script_hash", pageName: "streamlit_app" },
        { pageScriptHash: "hash2", pageName: "page2" },
      ]
      newSessionJson.pageScriptHash = "hash2"

      instance.handleNewSession(new NewSession(newSessionJson))

      expect(window.history.pushState).toHaveBeenLastCalledWith(
        {},
        "",
        "/page2"
      )
    })

    it("retains the query string", () => {
      window.history.pushState({}, "", "/?foo=bar")

      const instance = wrapper.instance() as App
      instance.handleNewSession(new NewSession(NEW_SESSION_JSON))

      expect(window.history.pushState).toHaveBeenLastCalledWith(
        {},
        "",
        "/?foo=bar"
      )
    })

    it("works with baseUrlPaths", () => {
      const instance = wrapper.instance() as App
      // @ts-expect-error
      instance.connectionManager.getBaseUriParts = mockGetBaseUriParts("foo")

      const newSessionJson = cloneDeep(NEW_SESSION_JSON)
      newSessionJson.appPages = [
        { pageScriptHash: "page_script_hash", pageName: "streamlit_app" },
        { pageScriptHash: "hash2", pageName: "page2" },
      ]
      newSessionJson.pageScriptHash = "hash2"

      instance.handleNewSession(new NewSession(newSessionJson))

      expect(window.history.pushState).toHaveBeenLastCalledWith(
        {},
        "",
        "/foo/page2"
      )
    })

    it("doesn't push a new history when the same page URL is already set", () => {
      const instance = wrapper.instance() as App
      const newSessionJson = cloneDeep(NEW_SESSION_JSON)
      newSessionJson.appPages = [
        { pageScriptHash: "toppage_hash", pageName: "streamlit_app" },
        { pageScriptHash: "subpage_hash", pageName: "page2" },
      ]

      history.replaceState({}, "", "/") // The URL is set to the main page from the beginning.

      // Because the page URL is already "/" pointing to the main page, no new history is pushed.
      instance.handleNewSession(
        new NewSession({ ...newSessionJson, pageScriptHash: "toppage_hash" })
      )
      expect(window.history.pushState).not.toHaveBeenCalled()
      // @ts-expect-error
      window.history.pushState.mockClear()

      // When accessing a different page, a new history for that page is pushed.
      instance.handleNewSession(
        new NewSession({ ...newSessionJson, pageScriptHash: "subpage_hash" })
      )
      expect(window.history.pushState).toHaveBeenLastCalledWith(
        {},
        "",
        "/page2"
      )
      // @ts-expect-error
      window.history.pushState.mockClear()
    })

    it("doesn't push a duplicated history when rerunning", () => {
      const instance = wrapper.instance() as App
      const newSessionJson = cloneDeep(NEW_SESSION_JSON)
      newSessionJson.appPages = [
        { pageScriptHash: "toppage_hash", pageName: "streamlit_app" },
        { pageScriptHash: "subpage_hash", pageName: "page2" },
      ]

      history.replaceState({}, "", "/page2") // Starting from a not main page.

      // When running the top page first, a new history for the page is pushed.
      instance.handleNewSession(
        new NewSession({ ...newSessionJson, pageScriptHash: "toppage_hash" })
      )
      expect(window.history.pushState).toHaveBeenLastCalledWith({}, "", "/")
      // @ts-expect-error
      window.history.pushState.mockClear()

      // When running the same, e.g. clicking the "rerun" button,
      // the history is not pushed again.
      instance.handleNewSession(
        new NewSession({ ...newSessionJson, pageScriptHash: "toppage_hash" })
      )
      expect(window.history.pushState).not.toHaveBeenCalled()
      // @ts-expect-error
      window.history.pushState.mockClear()

      // When accessing a different page, a new history for that page is pushed.
      instance.handleNewSession(
        new NewSession({ ...newSessionJson, pageScriptHash: "subpage_hash" })
      )
      expect(window.history.pushState).toHaveBeenLastCalledWith(
        {},
        "",
        "/page2"
      )
      // @ts-expect-error
      window.history.pushState.mockClear()
    })
  })

  describe("DeployButton", () => {
    it("initially button should be hidden", () => {
      const props = getProps()
      const wrapper = shallow(<App {...props} />)

      expect(wrapper.find("DeployButton")).toHaveLength(0)
    })

    it("button should be visible in development mode", () => {
      const props = getProps()
      const wrapper = shallow(<App {...props} />)
      const instance = wrapper.instance() as App

      const newSession = new NewSession({
        ...NEW_SESSION_JSON,
        config: {
          ...NEW_SESSION_JSON.config,
          toolbarMode: Config.ToolbarMode.DEVELOPER,
        },
      })
      instance.handleNewSession(newSession)

      expect(wrapper.find("DeployButton")).toHaveLength(1)
    })

    it("button should be hidden in viewer mode", () => {
      const props = getProps()
      const wrapper = shallow(<App {...props} />)
      const instance = wrapper.instance() as App

      instance.handleNewSession(
        new NewSession({
          ...NEW_SESSION_JSON,
          config: {
            ...NEW_SESSION_JSON.config,
            toolbarMode: Config.ToolbarMode.VIEWER,
          },
        })
      )

      expect(wrapper.find("DeployButton")).toHaveLength(0)
    })

    it("button should be hidden for hello app", () => {
      const props = getProps()
      const wrapper = shallow(<App {...props} />)
      const instance = wrapper.instance() as App

      instance.handleNewSession(
        new NewSession({
          ...NEW_SESSION_JSON,
          config: {
            ...NEW_SESSION_JSON.config,
            toolbarMode: Config.ToolbarMode.DEVELOPER,
          },
          initialize: {
            ...NEW_SESSION_JSON.initialize,
            commandLine: "streamlit hello",
          },
        })
      )

      expect(wrapper.find("DeployButton")).toHaveLength(0)
    })
  })
})

describe("App.onHistoryChange", () => {
  let wrapper: ShallowWrapper
  let instance: App

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
      commandLine: "commandLine",
    },
    appPages: [
      { pageScriptHash: "top_hash", pageName: "streamlit_app" },
      { pageScriptHash: "sub_hash", pageName: "page2" },
    ],
    pageScriptHash: "top_hash",
  }

  beforeEach(() => {
    wrapper = shallow(<App {...getProps()} />)
    instance = wrapper.instance() as App
    // @ts-expect-error
    instance.connectionManager.getBaseUriParts = mockGetBaseUriParts()

    window.history.pushState({}, "", "/")
  })

  it("handles popState events, e.g. clicking browser's back button", async () => {
    const instance = wrapper.instance() as App

    jest.spyOn(instance, "onPageChange")

    instance.handleNewSession(
      new NewSession({ ...NEW_SESSION_JSON, pageScriptHash: "sub_hash" })
    )
    instance.handleNewSession(
      new NewSession({ ...NEW_SESSION_JSON, pageScriptHash: "top_hash" })
    )
    instance.handleNewSession(
      new NewSession({ ...NEW_SESSION_JSON, pageScriptHash: "sub_hash" })
    )
    expect(instance.state.currentPageScriptHash).toEqual("sub_hash")

    window.history.back()
    await waitFor(() => {
      expect(instance.onPageChange).toHaveBeenLastCalledWith("top_hash")
    })

    window.history.back()
    await waitFor(() => {
      expect(instance.onPageChange).toHaveBeenLastCalledWith("sub_hash")
    })
  })

  it("doesn't rerun when we are on the same page and the url contains an anchor", () => {
    const pushStateSpy = jest.spyOn(window.history, "pushState")

    window.history.pushState({}, "", "#foo_bar")
    jest.spyOn(instance, "onPageChange")
    instance.onHistoryChange()

    expect(instance.onPageChange).not.toHaveBeenCalled()

    pushStateSpy.mockRestore()
  })

  it("does rerun when we are navigating to a different page and the last window history url contains an anchor", async () => {
    const pushStateSpy = jest.spyOn(window.history, "pushState")
    const pageChangeSpy = jest.spyOn(instance, "onPageChange")

    // navigate to current page with anchor
    window.history.pushState({}, "", "#foo_bar")
    instance.onHistoryChange()
    expect(pageChangeSpy).not.toHaveBeenCalled()

    // navigate to new page
    instance.handleNewSession(
      new NewSession({ ...NEW_SESSION_JSON, pageScriptHash: "sub_hash" })
    )
    window.history.back()

    // Check for rerun
    await waitFor(() => {
      expect(pageChangeSpy).toHaveBeenLastCalledWith("top_hash")
    })

    pushStateSpy.mockRestore()
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
    const wrapper = shallow(<App {...getProps()} />)
    const app = wrapper.instance() as App
    app.handlePageConfigChanged(new PageConfig({ title: "Jabberwocky" }))

    expect(document.title).toBe("Jabberwocky")
  })
})

// Using this to test the functionality provided through streamlit.experimental_set_query_params.
// Please see https://github.com/streamlit/streamlit/issues/2887 for more context on this.
describe("App.handlePageInfoChanged", () => {
  // These are used in the context of each of the test cases below.
  // Their values are set in beforeEach().
  let wrapper
  let app: App
  let pushStateSpy: any

  beforeEach(() => {
    window.history.pushState({}, "", "/")

    // Setup wrapper and app and spy on window.history.pushState.
    wrapper = shallow<App>(<App {...getProps()} />)
    app = wrapper.instance()
    pushStateSpy = jest.spyOn(window.history, "pushState")
  })

  afterEach(() => {
    pushStateSpy.mockRestore()
    // Reset the value of document.location.pathname.
    window.history.pushState({}, "", "/")
  })

  it("does not override the pathname when setting query params", () => {
    const pathname = "/foo/bar/"
    // Set the value of document.location.pathname to pathname.
    window.history.pushState({}, "", pathname)

    const pageInfo = new PageInfo({
      queryString: "flying=spaghetti&monster=omg",
    })
    const expectedUrl = `${pathname}?${pageInfo.queryString}`

    app.handlePageInfoChanged(pageInfo)

    expect(pushStateSpy).toHaveBeenLastCalledWith({}, "", expectedUrl)
  })

  it("does not override the pathname when resetting query params", () => {
    const pathname = "/foo/bar/"
    // Set the value of document.location.pathname to pathname.
    window.history.pushState({}, "", pathname)

    const pageInfo = new PageInfo({
      queryString: "",
    })

    app.handlePageInfoChanged(pageInfo)

    expect(pushStateSpy).toHaveBeenLastCalledWith({}, "", pathname)
  })

  it("resets query params as expected when at the root pathname", () => {
    // Note: One would typically set the value of document.location.pathname to '/' here,
    // However, this is already taking place in beforeEach().

    const pageInfo = new PageInfo({
      queryString: "",
    })
    app.handlePageInfoChanged(pageInfo)

    expect(pushStateSpy).toHaveBeenLastCalledWith({}, "", "/")
  })

  it("sets query params as expected when at the root pathname", () => {
    // Note: One would typically set the value of document.location.pathname to '/' here,
    // However, this is already taking place in beforeEach().

    const pageInfo = new PageInfo({
      queryString: "flying=spaghetti&monster=omg",
    })

    app.handlePageInfoChanged(pageInfo)

    const expectedUrl = `/?${pageInfo.queryString}`
    expect(pushStateSpy).toHaveBeenLastCalledWith({}, "", expectedUrl)
  })
})

describe("App.sendRerunBackMsg", () => {
  let wrapper: ShallowWrapper
  let instance: App

  beforeEach(() => {
    wrapper = shallow(<App {...getProps()} />)
    instance = wrapper.instance() as App
    // @ts-expect-error
    instance.sendBackMsg = jest.fn()
    // @ts-expect-error
    instance.connectionManager.getBaseUriParts = mockGetBaseUriParts()
  })

  afterEach(() => {
    window.history.pushState({}, "", "/")
  })

  it("sends the pageScriptHash if one is given", () => {
    instance.sendRerunBackMsg(undefined, "some_page_hash")

    // @ts-expect-error
    expect(instance.sendBackMsg).toHaveBeenCalledWith({
      rerunScript: {
        pageScriptHash: "some_page_hash",
        pageName: "",
        queryString: "",
      },
    })
  })

  it("sends the currentPageScriptHash if no pageScriptHash is given", () => {
    wrapper.setState({ currentPageScriptHash: "some_other_page_hash" })
    instance.sendRerunBackMsg()

    // @ts-expect-error
    expect(instance.sendBackMsg).toHaveBeenCalledWith({
      rerunScript: {
        pageScriptHash: "some_other_page_hash",
        pageName: "",
        queryString: "",
      },
    })
  })

  it("extracts the pageName as an empty string if we can't get a pageScriptHash (main page)", () => {
    instance.sendRerunBackMsg()

    // @ts-expect-error
    expect(instance.sendBackMsg).toHaveBeenCalledWith({
      rerunScript: {
        pageScriptHash: "",
        pageName: "",
        queryString: "",
      },
    })
  })

  it("extracts the pageName as the URL path if we can't get a pageScriptHash (non-main page)", () => {
    window.history.pushState({}, "", "/foo/")
    instance.sendRerunBackMsg()

    // @ts-expect-error
    expect(instance.sendBackMsg).toHaveBeenCalledWith({
      rerunScript: {
        pageScriptHash: "",
        pageName: "foo",
        queryString: "",
      },
    })
  })

  it("extracts the pageName as the last part of the URL if we can't get a pageScriptHash and we have a nonempty basePath", () => {
    // @ts-expect-error
    instance.connectionManager.getBaseUriParts = mockGetBaseUriParts("foo/bar")

    window.history.pushState({}, "", "/foo/bar/baz")
    instance.sendRerunBackMsg()

    // @ts-expect-error
    expect(instance.sendBackMsg).toHaveBeenCalledWith({
      rerunScript: {
        pageScriptHash: "",
        pageName: "baz",
        queryString: "",
      },
    })
  })
})

//   * handlePageNotFound has branching error messages depending on pageName
describe("App.handlePageNotFound", () => {
  it("includes the missing page name in error modal message if available", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)
    wrapper.setState({
      appPages: [{ pageScriptHash: "page_hash", pageName: "streamlit_app" }],
    })
    const instance = wrapper.instance() as App
    const sendMessageFunc = jest.spyOn(
      // @ts-expect-error
      instance.hostCommunicationMgr,
      "sendMessageToHost"
    )

    // @ts-expect-error
    instance.connectionManager.getBaseUriParts = mockGetBaseUriParts()
    instance.showError = jest.fn()

    instance.handlePageNotFound(
      new PageNotFound({ pageName: "nonexistentPage" })
    )

    expect(instance.showError).toHaveBeenCalledWith(
      "Page not found",
      expect.stringMatching("You have requested page /nonexistentPage")
    )

    expect(sendMessageFunc).toHaveBeenCalledWith({
      type: "SET_CURRENT_PAGE_NAME",
      currentPageName: "",
      currentPageScriptHash: "page_hash",
    })
  })

  it("uses a more generic error message if no page name is available", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)
    wrapper.setState({
      appPages: [{ pageScriptHash: "page_hash", pageName: "streamlit_app" }],
    })
    const instance = wrapper.instance() as App
    const sendMessageFunc = jest.spyOn(
      // @ts-expect-error
      instance.hostCommunicationMgr,
      "sendMessageToHost"
    )

    // @ts-expect-error
    instance.connectionManager.getBaseUriParts = mockGetBaseUriParts()
    instance.showError = jest.fn()

    instance.handlePageNotFound(new PageNotFound({ pageName: "" }))

    expect(instance.showError).toHaveBeenCalledWith(
      "Page not found",
      expect.stringMatching(
        "The page that you have requested does not seem to exist"
      )
    )
    expect(sendMessageFunc).toHaveBeenCalledWith({
      type: "SET_CURRENT_PAGE_NAME",
      currentPageName: "",
      currentPageScriptHash: "page_hash",
    })
  })
})

describe("App.handleDeltaMessage", () => {
  it("calls MetricsManager", () => {
    const mockHandleDeltaMessage = jest.fn()

    const wrapper = shallow(<App {...getProps()} />)
    const instance = wrapper.instance() as App
    // @ts-expect-error
    instance.metricsMgr.handleDeltaMessage = mockHandleDeltaMessage

    const delta = Delta.create({ newElement: {} })
    const metadata = ForwardMsgMetadata.create({ deltaPath: [0, 1] })
    instance.handleDeltaMsg(delta, metadata)

    expect(mockHandleDeltaMessage).toHaveBeenCalledWith(delta)
  })
})

describe("App.requestFileURLs", () => {
  let wrapper: ShallowWrapper
  let instance: App

  beforeEach(() => {
    wrapper = shallow(<App {...getProps()} />)
    instance = wrapper.instance() as App

    // @ts-expect-error
    instance.sendBackMsg = jest.fn()

    // @ts-expect-error
    instance.sessionInfo.setCurrent(mockSessionInfoProps())
  })

  it("properly constructs fileUrlsRequest BackMsg", () => {
    instance.isServerConnected = jest.fn().mockReturnValue(true)

    instance.requestFileURLs(
      "myRequestId",
      // @ts-expect-error
      [{ name: "file1.txt" }, { name: "file2.txt" }, { name: "file3.txt" }]
    )

    // @ts-expect-error
    expect(instance.sendBackMsg).toHaveBeenCalledWith({
      fileUrlsRequest: {
        fileNames: ["file1.txt", "file2.txt", "file3.txt"],
        requestId: "myRequestId",
        sessionId: "mockSessionId",
      },
    })
  })

  it("does nothing if server is disconnected", () => {
    instance.isServerConnected = jest.fn().mockReturnValue(false)

    instance.requestFileURLs(
      "myRequestId",
      // @ts-expect-error
      [{ name: "file1.txt" }, { name: "file2.txt" }, { name: "file3.txt" }]
    )

    // @ts-expect-error
    expect(instance.sendBackMsg).not.toHaveBeenCalled()
  })
})

describe("Test Main Menu shortcut functionality", () => {
  let prevWindowLocation: Location
  beforeEach(() => {
    prevWindowLocation = window.location
    // @ts-expect-error
    delete window.location
    // @ts-expect-error
    window.location = {
      assign: jest.fn(),
      host: "testing.com",
      href: "testing.com",
    }
  })

  afterEach(() => {
    window.location = prevWindowLocation
  })

  it("Tests dev menu shortcuts cannot be accessed as a viewer", () => {
    const props = getProps()
    const wrapper = shallow<App>(<App {...props} />)

    wrapper.instance().openClearCacheDialog = jest.fn()
    wrapper.instance().keyHandlers.CLEAR_CACHE()

    expect(wrapper.instance().openClearCacheDialog).not.toHaveBeenCalled()
  })

  it("Tests dev menu shortcuts can be accessed as a developer", () => {
    const props = getProps()
    const wrapper = shallow<App>(<App {...props} />)

    wrapper.instance().openClearCacheDialog = jest.fn()

    wrapper.instance().setState({ toolbarMode: Config.ToolbarMode.DEVELOPER })

    wrapper.instance().keyHandlers.CLEAR_CACHE()

    expect(wrapper.instance().openClearCacheDialog).toHaveBeenCalled()
  })
})

describe("test app has printCallback method", () => {
  it("test app has printCallback method", () => {
    const props = getProps()
    const wrapper = mount(
      <iframe>
        <App {...props} />
      </iframe>
    )
    const appComponentInstance = wrapper.find(App).instance() as App
    expect(appComponentInstance.printCallback).toBeDefined()
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
  let dispatchEvent: (type: string, event: Event) => void
  let props: Props
  let wrapper: ShallowWrapper
  let instance: App
  let sendMessageFunc: jest.SpyInstance

  beforeEach(() => {
    dispatchEvent = mockEventListeners()
    props = getProps()
    wrapper = shallow(<App {...props} />)
    instance = wrapper.instance() as App

    // @ts-expect-error - hostCommunicationMgr is private
    instance.hostCommunicationMgr.setAllowedOrigins({
      allowedOrigins: ["https://devel.streamlit.test"],
      useExternalAuthToken: false,
    })

    sendMessageFunc = jest.spyOn(
      // @ts-expect-error
      instance.hostCommunicationMgr,
      "sendMessageToHost"
    )
  })

  it("sends SCRIPT_RUN_STATE_CHANGED signal to the host when the app is first rendered", () => {
    instance.componentDidMount()

    expect(sendMessageFunc).toHaveBeenCalledWith({
      type: "SCRIPT_RUN_STATE_CHANGED",
      scriptRunState: ScriptRunState.NOT_RUNNING,
    })
  })

  it("sends theme info to the host when the app is first rendered", () => {
    instance.componentDidMount()

    expect(sendMessageFunc).toHaveBeenCalledWith({
      type: "SET_THEME_CONFIG",
      themeInfo: toExportedTheme(lightTheme.emotion),
    })
  })

  it("closes modals when the modal closure message has been received", () => {
    const dialog = StreamlitDialog({
      type: DialogType.ABOUT,
      sessionInfo: mockSessionInfo(),
      onClose: () => {},
    })

    wrapper.setState({ dialog })
    expect(wrapper.find(Modal)).toHaveLength(1)

    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "CLOSE_MODAL",
        },
        origin: "https://devel.streamlit.test",
      })
    )

    expect(wrapper.find(Modal)).toHaveLength(0)
  })

  it("changes scriptRunState and triggers stopScript when STOP_SCRIPT message has been received", () => {
    instance.isServerConnected = jest.fn().mockReturnValue(true)

    // We explicitly set the scriptRunState to RUNNING, so we can test that
    // scriptStopRequested is handled correctly.
    wrapper.setState({
      scriptRunState: ScriptRunState.RUNNING,
    })

    const stopScriptFunc = jest.spyOn(
      // @ts-expect-error
      instance.hostCommunicationMgr.props,
      "stopScript"
    )

    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "STOP_SCRIPT",
        },
        origin: "https://devel.streamlit.test",
      })
    )

    expect(stopScriptFunc).toHaveBeenCalledWith()
    expect(wrapper.state("scriptRunState")).toBe(ScriptRunState.STOP_REQUESTED)
  })

  it("changes scriptRunState and triggers rerunScript when scriptRerunRequested message has been received", () => {
    instance.isServerConnected = jest.fn().mockReturnValue(true)

    const rerunScriptFunc = jest.spyOn(
      // @ts-expect-error
      instance.hostCommunicationMgr.props,
      "rerunScript"
    )

    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "RERUN_SCRIPT",
        },
        origin: "https://devel.streamlit.test",
      })
    )

    expect(rerunScriptFunc).toHaveBeenCalledWith()
    expect(wrapper.state("scriptRunState")).toBe(
      ScriptRunState.RERUN_REQUESTED
    )
  })

  it("fires clearCache function when cacheClearRequested message has been received", () => {
    instance.isServerConnected = jest.fn().mockReturnValue(true)

    const clearCacheFunc = jest.spyOn(
      // @ts-expect-error
      instance.hostCommunicationMgr.props,
      "clearCache"
    )
    // the clearCache function in App.tsx calls closeDialog
    const closeDialogFunc = jest.spyOn(instance, "closeDialog")

    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "CLEAR_CACHE",
        },
        origin: "https://devel.streamlit.test",
      })
    )

    expect(clearCacheFunc).toHaveBeenCalledWith()
    expect(closeDialogFunc).toHaveBeenCalledWith()
  })

  it("does not prevent a modal from opening when closure message is set", () => {
    const dialog = StreamlitDialog({
      type: DialogType.ABOUT,
      sessionInfo: mockSessionInfo(),
      onClose: () => {},
    })

    // Open a dialog
    wrapper.setState({ dialog })
    expect(wrapper.find(Modal)).toHaveLength(1)

    // Send close message
    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "CLOSE_MODAL",
        },
        origin: "https://devel.streamlit.test",
      })
    )
    expect(wrapper.find(Modal)).toHaveLength(0)

    // Open a dialog again - make sure it works
    wrapper.setState({ dialog })
    expect(wrapper.find(Modal)).toHaveLength(1)
  })

  it("sends SCRIPT_RUN_STATE_CHANGED signal to the host when scriptRunState changing", () => {
    Object.keys(ScriptRunState).forEach(scriptRunState => {
      wrapper.setState({ scriptRunState })
      expect(sendMessageFunc).toHaveBeenCalledWith({
        type: "SCRIPT_RUN_STATE_CHANGED",
        scriptRunState,
      })
    })
  })

  it("does not sends SCRIPT_RUN_STATE_CHANGED signal to the host when scriptRunState changing to the same state", () => {
    const scriptRunState = ScriptRunState.RUNNING
    wrapper.setState({ scriptRunState })
    expect(sendMessageFunc).toHaveBeenCalledWith({
      type: "SCRIPT_RUN_STATE_CHANGED",
      scriptRunState: scriptRunState,
    })
    expect(sendMessageFunc).toHaveBeenCalledTimes(1)
    // When scriptRunState changed to the same,
    // sendMessage should not be called again.
    wrapper.setState({ scriptRunState })
    expect(sendMessageFunc).toHaveBeenCalledTimes(1)
  })

  it("both sets theme locally and sends to host when setAndSendTheme is called", () => {
    const mockThemeConfig = mockTheme

    instance.setAndSendTheme(mockThemeConfig)
    expect(props.theme.setTheme).toHaveBeenCalledWith(mockThemeConfig)

    expect(sendMessageFunc).toHaveBeenCalledWith({
      type: "SET_THEME_CONFIG",
      themeInfo: toExportedTheme(lightTheme.emotion),
    })
  })

  it("updates state.appPages when it receives a PagesChanged msg", () => {
    const appPages = [
      { icon: "", pageName: "bob", scriptPath: "bob.py" },
      { icon: "", pageName: "carl", scriptPath: "carl.py" },
    ]

    const msg = new ForwardMsg()
    msg.pagesChanged = new PagesChanged({ appPages })

    expect(wrapper.find("AppView").prop("appPages")).toEqual([])
    instance.handleMessage(msg)
    expect(wrapper.find("AppView").prop("appPages")).toEqual(appPages)

    expect(sendMessageFunc).toHaveBeenCalledWith({
      type: "SET_APP_PAGES",
      appPages,
    })
  })

  it("responds to page change request messages", () => {
    const pageChangedFunc = jest.spyOn(
      // @ts-expect-error
      instance.hostCommunicationMgr.props,
      "pageChanged"
    )

    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "REQUEST_PAGE_CHANGE",
          pageScriptHash: "hash1",
        },
        origin: "https://devel.streamlit.test",
      })
    )

    expect(pageChangedFunc).toHaveBeenCalledWith("hash1")
  })

  it("shows hostMenuItems", () => {
    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "SET_MENU_ITEMS",
          items: [{ type: "separator" }],
        },
        origin: "https://devel.streamlit.test",
      })
    )

    wrapper.setState({ hideTopBar: false })

    expect(instance.state.hostMenuItems).toStrictEqual([{ type: "separator" }])
    expect(wrapper.find(MainMenu).prop("hostMenuItems")).toStrictEqual([
      { type: "separator" },
    ])
  })

  it("shows hostToolbarItems", () => {
    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "SET_TOOLBAR_ITEMS",
          items: [
            {
              key: "favorite",
              icon: "star.svg",
            },
          ],
        },
        origin: "https://devel.streamlit.test",
      })
    )

    wrapper.setState({ hideTopBar: false })
    expect(
      wrapper.find(ToolbarActions).prop("hostToolbarItems")
    ).toStrictEqual([
      {
        key: "favorite",
        icon: "star.svg",
      },
    ])
  })

  it("sets hideSidebarNav based on the server config option and host setting", () => {
    // hideSidebarNav initializes to true.
    expect(wrapper.find("AppView").prop("hideSidebarNav")).toEqual(true)

    // Simulate the server ui.hideSidebarNav config option being false.
    instance.handleNewSession(new NewSession(NEW_SESSION_JSON))
    expect(wrapper.find("AppView").prop("hideSidebarNav")).toEqual(false)

    // Have the host override the server config option.
    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "SET_SIDEBAR_NAV_VISIBILITY",
          hidden: true,
        },
        origin: "https://devel.streamlit.test",
      })
    )

    expect(wrapper.find("AppView").prop("hideSidebarNav")).toEqual(true)
  })

  it("Deploy button should be hidden for cloud environment", () => {
    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "SET_MENU_ITEMS",
          items: [{ label: "Host menu item", key: "host-item", type: "text" }],
        },
        origin: "https://devel.streamlit.test",
      })
    )

    instance.handleNewSession(
      new NewSession({
        ...NEW_SESSION_JSON,
        config: {
          ...NEW_SESSION_JSON.config,
          toolbarMode: Config.ToolbarMode.DEVELOPER,
        },
      })
    )

    expect(wrapper.find("DeployButton")).toHaveLength(0)
  })
})
