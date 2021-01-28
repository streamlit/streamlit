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

import { SessionInfo } from "lib/SessionInfo"
import { Initialize } from "autogen/proto"

test("Throws an error when used before initialization", () => {
  expect(() => SessionInfo.current).toThrow()
})

test("Clears session info", () => {
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
  })
  expect(SessionInfo.isSet()).toBe(true)

  SessionInfo.clearSession()
  expect(SessionInfo.isSet()).toBe(false)
})

test("Can be initialized from a protobuf", () => {
  const MESSAGE = new Initialize({
    userInfo: {
      installationId: "installationId",
      installationIdV1: "installationIdV1",
      installationIdV2: "installationIdV2",
      email: "email",
    },
    config: {
      sharingEnabled: false,
      gatherUsageStats: false,
      maxCachedMessageAge: 31,
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
  })

  const si = SessionInfo.fromInitializeMessage(MESSAGE)
  expect(si.sessionId).toEqual("sessionId")
  expect(si.streamlitVersion).toEqual("streamlitVersion")
  expect(si.pythonVersion).toEqual("pythonVersion")
  expect(si.installationId).toEqual("installationId")
  expect(si.installationIdV1).toEqual("installationIdV1")
  expect(si.installationIdV2).toEqual("installationIdV2")
  expect(si.authorEmail).toEqual("email")
  expect(si.maxCachedMessageAge).toEqual(31)
  expect(si.commandLine).toEqual("commandLine")
})
