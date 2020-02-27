/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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
import { shallow, mount, ReactWrapper } from "enzyme"
import { ForwardMsg } from "autogen/proto"
import { MetricsManager } from "./lib/MetricsManager"
import { getMetricsManagerForTest } from "./lib/MetricsManagerTestUtils"
import { SessionInfo, Args as SessionInfoArgs } from "./lib/SessionInfo"

import { App, Props } from "./App"
import MainMenu from "./components/core/MainMenu"

const getProps = (): Props => ({
  screenCast: {
    toggleRecordAudio: jest.fn(),
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
    fileName: "",
    recording: false,
    recordAudio: false,
    countdown: -1,
    startAnimation: false,
    showRecordedDialog: false,
    showScreencastDialog: false,
    showUnsupportedDialog: false,
  },
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
      authorEmail: "ae",
      maxCachedMessageAge: 2,
      commandLine: "command line",
      userMapboxToken: "mpt",
    } as SessionInfoArgs)
    MetricsManager.current = getMetricsManagerForTest()
  })

  afterEach(() => {
    SessionInfo["singleton"] = undefined
  })

  it("renders without crashing", () => {
    const wrapper = getWrapper()

    expect(wrapper.html()).not.toBeNull()
  })

  it("should reload when streamlit server version changes", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)

    window.location.reload = jest.fn()

    const fwMessage = new ForwardMsg()

    fwMessage.initialize = {
      environmentInfo: {
        streamlitVersion: "svv",
      },
      sessionId: "sessionId",
      userInfo: {},
      config: {},
      sessionState: {},
    }

    // @ts-ignore
    wrapper.instance().handleMessage(fwMessage)

    expect(window.location.reload).toHaveBeenCalled()
  })

  it("should start screencast recording when the MainMenu is clicked", () => {
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

  it("should stop screencast when esc is pressed", () => {
    const props = getProps()
    const wrapper = shallow(<App {...props} />)

    // @ts-ignore
    wrapper.instance().keyHandlers.esc()

    expect(props.screenCast.stopRecording).toBeCalled()
  })
})
