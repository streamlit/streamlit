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

import { SessionInfo } from "lib/SessionInfo"

test("Throws an error when used before initialization", () => {
  expect(() => SessionInfo.current).toThrow()
})

test("Properly implements equals()", () => {
  const a = new SessionInfo({
    sessionId: "sessionId",
    streamlitVersion: "streamlitVersion",
    pythonVersion: "pythonVersion",
    installationId: "installationId",
    installationIdV1: "installationIdV1",
    installationIdV2: "installationIdV2",
    authorEmail: "authorEmail",
    maxCachedMessageAge: 0,
    commandLine: "commandLine",
    userMapboxToken: "userMapboxToken",
  })

  const b = new SessionInfo({
    sessionId: "sessionId",
    streamlitVersion: "streamlitVersion",
    pythonVersion: "pythonVersion",
    installationId: "installationId",
    installationIdV1: "installationIdV1",
    installationIdV2: "installationIdV2",
    authorEmail: "authorEmail",
    maxCachedMessageAge: 0,
    commandLine: "commandLine",
    userMapboxToken: "userMapboxToken",
  })

  const c = new SessionInfo({
    sessionId: "modified!",
    streamlitVersion: "streamlitVersion",
    pythonVersion: "pythonVersion",
    installationId: "installationId",
    installationIdV1: "installationIdV1",
    installationIdV2: "installationIdV2",
    authorEmail: "authorEmail",
    maxCachedMessageAge: 0,
    commandLine: "commandLine",
    userMapboxToken: "userMapboxToken",
  })

  expect(a).toEqual(b)
  expect(a).not.toEqual(c)
})
