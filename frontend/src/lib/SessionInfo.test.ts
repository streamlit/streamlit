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

import { SessionInfo } from "src/lib/SessionInfo"
import { NewSession } from "src/autogen/proto"
import { mockSessionInfoProps } from "./mocks/mocks"

test("Throws an error when used before initialization", () => {
  const sessionInfo = new SessionInfo()
  expect(() => sessionInfo.current).toThrow()
})

describe("SessionInfo.setCurrent", () => {
  test("copies props to `current`", () => {
    const sessionInfo = new SessionInfo()
    sessionInfo.setCurrent(mockSessionInfoProps())

    expect(sessionInfo.isSet).toBe(true)
    expect(sessionInfo.current).toEqual(mockSessionInfoProps())
  })

  test("copies previous props to `last`", () => {
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
  test("is true only when initialized with `streamlit hello` commandline", () => {
    const sessionInfo = new SessionInfo()
    expect(sessionInfo.isHello).toBe(false)

    sessionInfo.setCurrent(
      mockSessionInfoProps({ commandLine: "random command line" })
    )
    expect(sessionInfo.isHello).toBe(false)

    sessionInfo.setCurrent(
      mockSessionInfoProps({ commandLine: "streamlit hello" })
    )
    expect(sessionInfo.isHello).toBe(true)
  })
})

test("Props can be initialized from a protobuf", () => {
  const MESSAGE = new NewSession({
    config: {
      gatherUsageStats: false,
      maxCachedMessageAge: 31,
      mapboxToken: "mapboxToken",
      allowRunOnSave: false,
    },
    initialize: {
      userInfo: {
        installationId: "installationId",
        installationIdV3: "installationIdV3",
        email: "email",
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
  })

  const props = SessionInfo.propsFromNewSessionMessage(MESSAGE)
  expect(props.sessionId).toEqual("sessionId")
  expect(props.streamlitVersion).toEqual("streamlitVersion")
  expect(props.pythonVersion).toEqual("pythonVersion")
  expect(props.installationId).toEqual("installationId")
  expect(props.installationIdV3).toEqual("installationIdV3")
  expect(props.authorEmail).toEqual("email")
  expect(props.maxCachedMessageAge).toEqual(31)
  expect(props.commandLine).toEqual("commandLine")
})
