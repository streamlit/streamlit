/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { NewSession } from "@streamlit/protobuf"

import { mockSessionInfoProps } from "./mocks/mocks"
import { SessionInfo } from "./SessionInfo"

it("Throws an error when used before initialization", () => {
  const sessionInfo = new SessionInfo()
  expect(() => sessionInfo.current).toThrow()
})

describe("SessionInfo.setCurrent", () => {
  it("copies props to `current`", () => {
    const sessionInfo = new SessionInfo()
    sessionInfo.setCurrent(mockSessionInfoProps())

    expect(sessionInfo.isSet).toBe(true)
    expect(sessionInfo.current).toEqual(mockSessionInfoProps())
  })

  it("copies previous props to `last`", () => {
    const sessionInfo = new SessionInfo()
    sessionInfo.setCurrent(mockSessionInfoProps())
    expect(sessionInfo.last).toBeUndefined()

    sessionInfo.setCurrent(mockSessionInfoProps({ appId: "newValue" }))
    expect(sessionInfo.current).toEqual(
      mockSessionInfoProps({ appId: "newValue" })
    )
    expect(sessionInfo.last).toEqual(mockSessionInfoProps())
  })
})

describe("SessionInfo.isHello", () => {
  it("is true only when `isHello` is true in current SessionInfo", () => {
    const sessionInfo = new SessionInfo()
    expect(sessionInfo.isHello).toBe(false)

    sessionInfo.setCurrent(mockSessionInfoProps({ isHello: true }))
    expect(sessionInfo.isHello).toBe(true)

    sessionInfo.setCurrent(mockSessionInfoProps({ isHello: false }))
    expect(sessionInfo.isHello).toBe(false)
  })
})

describe("SessionInfo.disconnect", () => {
  it("marks the current session as not connected and preserves prior props as `last`", () => {
    const sessionInfo = new SessionInfo()
    sessionInfo.setCurrent(mockSessionInfoProps({ isConnected: true }))

    sessionInfo.disconnect()

    expect(sessionInfo.current.isConnected).toBe(false)
    expect(sessionInfo.last).toEqual(
      mockSessionInfoProps({ isConnected: true })
    )
  })

  it("is a no-op when there is no current session", () => {
    const sessionInfo = new SessionInfo()
    sessionInfo.disconnect()

    expect(sessionInfo.isSet).toBe(false)
    expect(sessionInfo.last).toBeUndefined()
  })
})

it("Props can be initialized from a protobuf", () => {
  const MESSAGE = new NewSession({
    config: {
      gatherUsageStats: false,
      maxCachedMessageAge: 31,
      allowRunOnSave: false,
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
  })

  const props = SessionInfo.propsFromNewSessionMessage(MESSAGE)
  expect(props.sessionId).toEqual("sessionId")
  expect(props.streamlitVersion).toEqual("streamlitVersion")
  expect(props.pythonVersion).toEqual("pythonVersion")
  expect(props.serverOS).toEqual("mockServerOS")
  expect(props.hasDisplay).toBeTruthy()
  expect(props.installationId).toEqual("installationId")
  expect(props.installationIdV3).toEqual("installationIdV3")
  expect(props.installationIdV4).toEqual("mockInstallationIdV4")
  expect(props.maxCachedMessageAge).toEqual(31)
  expect(props.commandLine).toBeUndefined()
  expect(props.isHello).toBeFalsy()
})
