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

import { SessionInfo } from "src/lib/SessionInfo"
import { NewReport } from "src/autogen/proto"

test("Throws an error when used before initialization", () => {
  expect(() => SessionInfo.current).toThrow()
})

test("Clears session info", () => {
  SessionInfo.current = new SessionInfo({
    sessionId: "sessionId",
    streamlitVersion: "sv",
    pythonVersion: "pv",
    installationId: "iid",
    installationIdV3: "iid3",
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
  const MESSAGE = new NewReport({
    config: {
      sharingEnabled: false,
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
      sessionState: {
        runOnSave: false,
        reportIsRunning: false,
      },
      sessionId: "sessionId",
      commandLine: "commandLine",
    },
  })

  const si = SessionInfo.fromNewReportMessage(MESSAGE)
  expect(si.sessionId).toEqual("sessionId")
  expect(si.streamlitVersion).toEqual("streamlitVersion")
  expect(si.pythonVersion).toEqual("pythonVersion")
  expect(si.installationId).toEqual("installationId")
  expect(si.installationIdV3).toEqual("installationIdV3")
  expect(si.authorEmail).toEqual("email")
  expect(si.maxCachedMessageAge).toEqual(31)
  expect(si.commandLine).toEqual("commandLine")
})
