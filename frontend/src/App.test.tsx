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
import { shallow, mount } from "lib/test_util"
import { ForwardMsg, NewReport } from "autogen/proto"
import { IMenuItem } from "hocs/withS4ACommunication/types"
import { ConnectionState } from "lib/ConnectionState"
import { MetricsManager } from "./lib/MetricsManager"
import { getMetricsManagerForTest } from "./lib/MetricsManagerTestUtils"
import { SessionInfo, Args as SessionInfoArgs } from "./lib/SessionInfo"

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
      initialize: {
        environmentInfo: {
          streamlitVersion: "svv",
        },
        sessionId: "sessionId",
        userInfo: {},
        config: {},
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
  const NEW_REPORT = new NewReport({
    initialize: {
      userInfo: {
        installationId: "installationId",
        installationIdV1: "installationIdV1",
        installationIdV2: "installationIdV2",
        email: "email",
      },
      config: {
        sharingEnabled: false,
        gatherUsageStats: false,
        maxCachedMessageAge: 0,
        mapboxToken: "mapboxToken",
        allowRunOnSave: false,
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
  })

  afterEach(() => {
    const UnsafeSessionInfo = SessionInfo as any
    UnsafeSessionInfo.singleton = undefined
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
