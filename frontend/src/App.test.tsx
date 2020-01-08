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
import { mount, CommonWrapper } from "enzyme"
import { ForwardMsg } from "autogen/proto"
import { MetricsManager } from "./lib/MetricsManager"
import { getMetricsManagerForTest } from "./lib/MetricsManagerTestUtils"
import { SessionInfo, Args as SessionInfoArgs } from "./lib/SessionInfo"

import App from "./App"

const getWrapper = (): CommonWrapper => {
  const mountPoint = document.createElement("div")
  mountPoint.setAttribute("id", "ConnectionStatus")
  document.body.appendChild(mountPoint)

  return mount(<App />, { attachTo: mountPoint })
}

describe("App", () => {
  beforeEach(() => {
    SessionInfo.current = new SessionInfo({
      streamlitVersion: "sv",
      pythonVersion: "pv",
      installationId: "iid",
      authorEmail: "ae",
      maxCachedMessageAge: 2,
      commandLine: "command line",
      mapboxToken: "mpt",
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
    const wrapper = getWrapper()

    window.location.reload = jest.fn()

    const fwMessage = new ForwardMsg()

    fwMessage.initialize = {
      environmentInfo: {
        streamlitVersion: "svv",
      },
      userInfo: {},
      config: {},
      sessionState: {},
    }

    // @ts-ignore
    wrapper.instance().handleMessage(fwMessage)

    expect(window.location.reload).toHaveBeenCalled()
  })
})
