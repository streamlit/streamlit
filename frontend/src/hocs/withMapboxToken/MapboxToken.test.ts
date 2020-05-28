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

import axios from "axios"
import { SessionInfo } from "lib/SessionInfo"
import AxiosMockAdapter from "axios-mock-adapter"
import { MapboxToken, TOKENS_URL } from "hocs/withMapboxToken/MapboxToken"

function setSessionInfo(
  userMapboxToken = "",
  commandLine = "streamlit hello"
): void {
  SessionInfo.current = new SessionInfo({
    sessionId: "mockSessionId",
    streamlitVersion: "sv",
    pythonVersion: "pv",
    installationId: "iid",
    authorEmail: "ae",
    maxCachedMessageAge: 2,
    commandLine,
    userMapboxToken,
  })
}

describe("MapboxToken", () => {
  let axiosMock: AxiosMockAdapter

  beforeEach(() => {
    window.location.hostname = "localhost"
    axiosMock = new AxiosMockAdapter(axios)
    setSessionInfo("")
  })

  afterEach(() => {
    axiosMock.restore()
    MapboxToken["token"] = undefined
    MapboxToken["commandLine"] = undefined
    SessionInfo["singleton"] = undefined
  })

  test("Returns cached token if defined", async () => {
    MapboxToken["token"] = "cached"
    MapboxToken["commandLine"] = "streamlit hello"

    await expect(MapboxToken.get()).resolves.toEqual("cached")
  })

  test("Returns userMapboxToken if non-empty", async () => {
    const userToken = "nonEmptyToken"

    setSessionInfo(userToken)
    await expect(MapboxToken.get()).resolves.toEqual(userToken)

    // The token should also be cached.
    expect(MapboxToken["token"]).toEqual(userToken)
  })

  test("Fetches remote token if userMapboxToken is empty", async () => {
    const remoteToken = "remoteMapboxToken"

    axiosMock.onGet(TOKENS_URL).reply(200, { "mapbox-localhost": remoteToken })

    await expect(MapboxToken.get()).resolves.toEqual(remoteToken)

    // The token should also be cached.
    expect(MapboxToken["token"]).toEqual(remoteToken)
  })

  test("Errors if remote token is missing", async () => {
    axiosMock.onGet(TOKENS_URL).replyOnce(200, { ohNo: "noTokenHere" })

    await expect(MapboxToken.get()).rejects.toEqual(
      new Error(`Missing token "mapbox" (${TOKENS_URL})`)
    )

    // No cached token after failure.
    expect(MapboxToken["token"]).toBeUndefined()

    axiosMock.onGet(TOKENS_URL).replyOnce(404, {})
    await expect(MapboxToken.get()).rejects.toEqual(
      new Error(`Request failed with status code 404 (${TOKENS_URL})`)
    )

    // No cached token after failure.
    expect(MapboxToken["token"]).toBeUndefined()
  })

  it("Errors if not localhost and missing token", async () => {
    delete window.location
    window.location = { hostname: "http://streamlit.io" } as Location
    setSessionInfo("")

    await expect(MapboxToken.get()).rejects.toThrow("No Mapbox token provided")
  })

  it("Errors if not hello.py and missing token", async () => {
    setSessionInfo("", "streamlit run example.py")

    await expect(MapboxToken.get()).rejects.toThrow("No Mapbox token provided")
  })

  it("Should reload token if command line has changed", async () => {
    setSessionInfo()

    const remoteToken = "remoteMapboxToken"

    axiosMock.onGet(TOKENS_URL).reply(200, { "mapbox-localhost": remoteToken })

    await expect(MapboxToken.get()).resolves.toEqual(remoteToken)

    setSessionInfo("password", "streamlit run test.py")

    await expect(MapboxToken.get()).resolves.toEqual("password")
  })
})
