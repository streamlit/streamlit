/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"
import { ReactWrapper } from "enzyme"
import cloneDeep from "lodash/cloneDeep"
import { LocalStore } from "lib/storageUtils"
import { shallow, mount } from "lib/test_util"
import { CustomThemeConfig, ForwardMsg, NewReport } from "autogen/proto"
import { IMenuItem } from "hocs/withS4ACommunication/types"
import { ConnectionState } from "lib/ConnectionState"
import { MetricsManager } from "lib/MetricsManager"
import { getMetricsManagerForTest } from "lib/MetricsManagerTestUtils"
import { SessionInfo, Args as SessionInfoArgs } from "lib/SessionInfo"
import { CUSTOM_THEME_NAME, createAutoTheme, lightTheme } from "theme"
import { App, Props } from "./App"
import MainMenu from "./components/core/MainMenu"

jest.mock("lib/ConnectionManager")

const getProps = (extend?: Partial<Props>): Props => ({
  screenCast: {
    currentState: "OFF",
    toggleRecordAudio: jest.fn(),
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
  },
  s4aCommunication: {
    connect: jest.fn(),
    sendMessage: jest.fn(),
    currentState: {
      queryParams: "",
      items: [],
    },
  },
  theme: {
    activeTheme: lightTheme,
    availableThemes: [],
    setTheme: jest.fn(),
    addThemes: jest.fn(),
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

jest.mock("moment", () =>
  jest.fn().mockImplementation(() => ({
    format: () => "date",
  }))
)

describe("App", () => {
  beforeEach(() => {
    SessionInfo.current = new SessionInfo({
      sessionId: "sessionId",
      streamlitVersion: "sv",
      pythonVersion: "pv",
      installationId: "iid",
      installationIdV1: "iid1",
      installationIdV2: "iid2",
      authorEmail: "ae",
      maxCachedMessageAge: 2,
      commandLine: "command line",
      userMapboxToken: "mpt",
    } as SessionInfoArgs)
    MetricsManager.current = getMetricsManagerForTest()
  })

  afterEach(() => {
    const UnsafeSessionInfo = SessionInfo as any
    UnsafeSessionInfo.singleton = undefined
  })

  it("renders without crashing", () => {
    const wrapper = getWrapper()

    expect(wrapper.html()).not.toBeNull()
  })

  it("reloads when streamlit server version changes", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)

    // A HACK to mock `window.location.reload`.
    // NOTE: The mocking must be done after mounting,
    // but before `handleMessage` is called.
    const { location } = window
    // @ts-ignore
    delete window.location
    // @ts-ignore
    window.location = { reload: jest.fn() }

    const fwMessage = new ForwardMsg()
    fwMessage.newReport = {
      config: {},
      initialize: {
        environmentInfo: {
          streamlitVersion: "svv",
        },
        sessionId: "sessionId",
        userInfo: {},
        sessionState: {},
      },
    }

    // @ts-ignore
    wrapper.instance().handleMessage(fwMessage)

    expect(window.location.reload).toHaveBeenCalled()

    // Restore `window.location`.
    window.location = location
  })

  it("starts screencast recording when the MainMenu is clicked", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)

    wrapper.setState({
      reportName: "reportName",
    })

    wrapper
      .find(MainMenu)
      .props()
      .screencastCallback()

    expect(props.screenCast.startRecording).toHaveBeenCalledWith(
      "streamlit-reportName-date"
    )
  })

  it("stops screencast when esc is pressed", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)

    // @ts-ignore
    wrapper.instance().keyHandlers.STOP_RECORDING()

    expect(props.screenCast.stopRecording).toBeCalled()
  })

  it("shows s4aMenuItems", () => {
    const props = getProps({
      s4aCommunication: {
        connect: jest.fn(),
        sendMessage: jest.fn(),
        currentState: {
          queryParams: "",
          items: [
            {
              type: "separator",
            },
          ] as IMenuItem[],
        },
      },
    })
    const wrapper = shallow(<App {...props} />)

    expect(wrapper.find(MainMenu).prop("s4aMenuItems")).toStrictEqual([
      { type: "separator" },
    ])
  })
})

describe("App.handleNewReport", () => {
  const NEW_REPORT_JSON = {
    config: {
      sharingEnabled: false,
      gatherUsageStats: false,
      maxCachedMessageAge: 0,
      mapboxToken: "mapboxToken",
      allowRunOnSave: false,
    },
    customTheme: {
      primaryColor: "red",
    },
    initialize: {
      userInfo: {
        installationId: "installationId",
        installationIdV1: "installationIdV1",
        installationIdV2: "installationIdV2",
        email: "email",
      },
      environmentInfo: {
        streamlitVersion: "streamlitVersion",
        pythonVersion: "pythonVersion",
      },
      sessionState: {
        runOnSave: false,
        reportIsRunning: false,
      },
      sessionId: "sessionId",
      commandLine: "commandLine",
    },
  }
  const NEW_REPORT = new NewReport(NEW_REPORT_JSON)

  afterEach(() => {
    const UnsafeSessionInfo = SessionInfo as any
    UnsafeSessionInfo.singleton = undefined
    window.localStorage.clear()
  })

  it("adds custom theme to list of available themes", () => {
    const props = getProps()
    window.localStorage.setItem(
      LocalStore.ACTIVE_THEME,
      JSON.stringify(lightTheme)
    )
    const wrapper = shallow(<App {...props} />)

    // @ts-ignore
    wrapper.instance().handleNewReport(NEW_REPORT)

    // @ts-ignore
    expect(props.theme.addThemes).toHaveBeenCalled()

    // @ts-ignore
    expect(props.theme.setTheme).not.toHaveBeenCalled()
  })

  it("sets custom theme as default if no user preference", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)

    const newReportJson = cloneDeep(NEW_REPORT_JSON)

    // @ts-ignore
    wrapper.instance().handleNewReport(new NewReport(newReportJson))

    // @ts-ignore
    expect(props.theme.addThemes).toHaveBeenCalled()

    // @ts-ignore
    expect(props.theme.setTheme).toHaveBeenCalled()

    // @ts-ignore
    expect(props.theme.setTheme.mock.calls[0][0].name).toBe(CUSTOM_THEME_NAME)
  })

  it("sets custom theme again if custom theme active", () => {
    window.localStorage.setItem(
      LocalStore.ACTIVE_THEME,
      JSON.stringify({ ...lightTheme, name: CUSTOM_THEME_NAME })
    )
    const props = getProps()
    props.theme.activeTheme = {
      ...lightTheme,
      name: CUSTOM_THEME_NAME,
    }
    const wrapper = shallow(<App {...props} />)

    const newReportJson = cloneDeep(NEW_REPORT_JSON)

    // @ts-ignore
    wrapper.instance().handleNewReport(new NewReport(newReportJson))

    // @ts-ignore
    expect(props.theme.addThemes).toHaveBeenCalled()

    // @ts-ignore
    expect(props.theme.setTheme).toHaveBeenCalled()

    // @ts-ignore
    expect(props.theme.setTheme.mock.calls[0][0].name).toBe(CUSTOM_THEME_NAME)
  })

  it("removes custom theme from options if none is received from the server", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)
    wrapper.setState({ themeHash: "someHash" })

    const newReportJson = cloneDeep(NEW_REPORT_JSON)
    // @ts-ignore
    newReportJson.customTheme = null

    // @ts-ignore
    wrapper.instance().handleNewReport(new NewReport(newReportJson))

    // @ts-ignore
    expect(props.theme.addThemes).toHaveBeenCalled()

    // @ts-ignore
    expect(props.theme.addThemes.mock.calls[0][0]).toEqual([])
  })

  it("Does not change dark/light/auto preference when removing custom theme", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)
    wrapper.setState({ themeHash: "someHash" })

    const newReportJson = cloneDeep(NEW_REPORT_JSON)

    // @ts-ignore
    newReportJson.customTheme = null

    // @ts-ignore
    wrapper.instance().handleNewReport(new NewReport(newReportJson))

    // @ts-ignore
    expect(props.theme.addThemes).toHaveBeenCalled()

    // @ts-ignore
    expect(props.theme.addThemes.mock.calls[0][0]).toEqual([])

    // @ts-ignore
    expect(props.theme.setTheme).not.toHaveBeenCalled()
  })

  it("Changes to auto when user has custom theme selected and it is removed", () => {
    const props = getProps()
    props.theme.activeTheme = {
      ...lightTheme,
      name: CUSTOM_THEME_NAME,
    }
    const wrapper = shallow(<App {...props} />)
    wrapper.setState({ themeHash: "someHash" })

    const newReportJson = cloneDeep(NEW_REPORT_JSON)
    // @ts-ignore
    newReportJson.customTheme = null

    // @ts-ignore
    wrapper.instance().handleNewReport(new NewReport(newReportJson))

    expect(props.theme.addThemes).toHaveBeenCalled()
    // @ts-ignore
    expect(props.theme.addThemes.mock.calls[0][0]).toEqual([])

    expect(props.theme.setTheme).toHaveBeenCalled()
    // @ts-ignore
    expect(props.theme.setTheme.mock.calls[0][0]).toEqual(createAutoTheme())
  })

  it("changes theme if custom theme received from server has different hash", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)

    const customThemeConfig = new CustomThemeConfig({ primaryColor: "blue" })
    // @ts-ignore
    const themeHash = wrapper.instance().createThemeHash(customThemeConfig)
    wrapper.setState({ themeHash })

    // @ts-ignore
    wrapper.instance().handleNewReport(NEW_REPORT)

    expect(props.theme.addThemes).toHaveBeenCalled()
    expect(props.theme.setTheme).toHaveBeenCalled()
  })

  it("does nothing if custom theme received from server has matching hash", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)

    const customThemeConfig = new CustomThemeConfig(
      NEW_REPORT_JSON.customTheme
    )
    // @ts-ignore
    const themeHash = wrapper.instance().createThemeHash(customThemeConfig)
    wrapper.setState({ themeHash })

    // @ts-ignore
    wrapper.instance().handleNewReport(NEW_REPORT)

    expect(props.theme.addThemes).not.toHaveBeenCalled()
    expect(props.theme.setTheme).not.toHaveBeenCalled()
  })

  it("does nothing if no theme received from server with no previous theme", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)

    const newReportJson = cloneDeep(NEW_REPORT_JSON)
    // @ts-ignore
    newReportJson.customTheme = null

    // @ts-ignore
    wrapper.instance().handleNewReport(new NewReport(newReportJson))

    expect(props.theme.addThemes).not.toHaveBeenCalled()
    expect(props.theme.setTheme).not.toHaveBeenCalled()
  })

  it("performs one-time initialization", () => {
    const wrapper = shallow(<App {...getProps()} />)
    const app = wrapper.instance()

    const oneTimeInitialization = jest.spyOn(
      app,
      // @ts-ignore
      "handleOneTimeInitialization"
    )

    expect(SessionInfo.isSet()).toBe(false)

    // @ts-ignore
    app.handleNewReport(NEW_REPORT)

    expect(oneTimeInitialization).toHaveBeenCalledTimes(1)
    expect(SessionInfo.isSet()).toBe(true)
  })

  it("performs one-time initialization only once", () => {
    const wrapper = shallow(<App {...getProps()} />)
    const app = wrapper.instance()

    const oneTimeInitialization = jest.spyOn(
      app,
      // @ts-ignore
      "handleOneTimeInitialization"
    )

    expect(SessionInfo.isSet()).toBe(false)

    // @ts-ignore
    app.handleNewReport(NEW_REPORT)
    // @ts-ignore
    app.handleNewReport(NEW_REPORT)
    // @ts-ignore
    app.handleNewReport(NEW_REPORT)

    // Multiple NEW_REPORT messages should not result in one-time
    // initialization being performed more than once.
    expect(oneTimeInitialization).toHaveBeenCalledTimes(1)
    expect(SessionInfo.isSet()).toBe(true)
  })

  it("performs one-time initialization after a new session is received", () => {
    const wrapper = shallow(<App {...getProps()} />)
    const app = wrapper.instance()

    const oneTimeInitialization = jest.spyOn(
      app,
      // @ts-ignore
      "handleOneTimeInitialization"
    )

    expect(SessionInfo.isSet()).toBe(false)

    // @ts-ignore
    app.handleNewReport(NEW_REPORT)
    expect(oneTimeInitialization).toHaveBeenCalledTimes(1)

    // @ts-ignore
    app.handleConnectionStateChanged(ConnectionState.PINGING_SERVER)
    expect(SessionInfo.isSet()).toBe(false)

    // @ts-ignore
    app.handleConnectionStateChanged(ConnectionState.CONNECTED)
    // @ts-ignore
    app.handleNewReport(NEW_REPORT)

    expect(oneTimeInitialization).toHaveBeenCalledTimes(2)
    expect(SessionInfo.isSet()).toBe(true)
  })
})
