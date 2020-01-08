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

import {
  MapboxToken,
  TOKENS_URL,
} from "components/elements/DeckGlChart/MapboxToken"
import { SessionInfo } from "lib/SessionInfo"
import fetchMock from "fetch-mock"

function setSessionInfo(userMapboxToken: string): void {
  SessionInfo.current = new SessionInfo({
    streamlitVersion: "sv",
    pythonVersion: "pv",
    installationId: "iid",
    authorEmail: "ae",
    maxCachedMessageAge: 2,
    commandLine: "cl",
    userMapboxToken: userMapboxToken,
  })
}

describe("MapboxToken", () => {
  beforeEach(() => {
    setSessionInfo("")
  })

  afterEach(() => {
    SessionInfo["singleton"] = undefined
    MapboxToken["token"] = undefined
    fetchMock.restore()
  })

  test("Returns cached token if defined", async () => {
    MapboxToken["token"] = "cached"
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

    fetchMock.get(TOKENS_URL, { mapbox: remoteToken })
    await expect(MapboxToken.get()).resolves.toEqual(remoteToken)

    // The token should also be cached.
    expect(MapboxToken["token"]).toEqual(remoteToken)
  })

  test("Errors if remote token is missing", async () => {
    fetchMock.get(TOKENS_URL, { ohNo: "noTokenHere" })

    await expect(MapboxToken.get()).rejects.toEqual(
      new Error(`${TOKENS_URL}: Missing token "mapbox"`)
    )

    // No cached token after failure.
    expect(MapboxToken["token"]).toBeUndefined()

    fetchMock.restore()
    fetchMock.get(TOKENS_URL, 404)
    await expect(MapboxToken.get()).rejects.toEqual(
      new Error(`${TOKENS_URL}: Bad status 404`)
    )

    // No cached token after failure.
    expect(MapboxToken["token"]).toBeUndefined()
  })
})
