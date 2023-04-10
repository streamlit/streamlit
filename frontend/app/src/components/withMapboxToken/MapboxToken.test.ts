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

import axios from "axios"
import { SessionInfo, mockSessionInfo } from "@streamlit/lib"
import AxiosMockAdapter from "axios-mock-adapter"
import {
  MapboxToken,
  TOKENS_URL,
} from "src/components/withMapboxToken/MapboxToken"

function createSessionInfo(
  userMapboxToken = "",
  commandLine = ""
): SessionInfo {
  return mockSessionInfo({ userMapboxToken, commandLine })
}

describe("MapboxToken", () => {
  let axiosMock: AxiosMockAdapter

  beforeEach(() => {
    window.location.hostname = "localhost"
    axiosMock = new AxiosMockAdapter(axios)
  })

  afterEach(() => {
    axiosMock.restore()
    MapboxToken.token = undefined
    MapboxToken.commandLine = undefined
  })

  test("Returns cached token if defined", async () => {
    MapboxToken.token = "cached"
    MapboxToken.commandLine = "streamlit hello"
    const sessionInfo = createSessionInfo("", "streamlit hello")

    await expect(MapboxToken.get(sessionInfo)).resolves.toEqual("cached")
  })

  test("Returns userMapboxToken if non-empty", async () => {
    const userToken = "nonEmptyToken"

    await expect(
      MapboxToken.get(createSessionInfo(userToken))
    ).resolves.toEqual(userToken)

    // The token should also be cached.
    expect(MapboxToken.token).toEqual(userToken)
  })

  test("Fetches remote token if userMapboxToken is empty", async () => {
    const remoteToken = "remoteMapboxToken"

    // axiosMock.onGet(TOKENS_URL).reply(200, { "mapbox-localhost": remoteToken })
    axiosMock.onGet(TOKENS_URL).reply(200, { mapbox: remoteToken })

    await expect(MapboxToken.get(createSessionInfo())).resolves.toEqual(
      remoteToken
    )

    // The token should also be cached.
    expect(MapboxToken.token).toEqual(remoteToken)
  })

  test("Errors if remote token is missing", async () => {
    axiosMock.onGet(TOKENS_URL).replyOnce(200, { ohNo: "noTokenHere" })

    await expect(MapboxToken.get(createSessionInfo())).rejects.toEqual(
      new Error(`Missing token "mapbox" (${TOKENS_URL})`)
    )

    // No cached token after failure.
    expect(MapboxToken.token).toBeUndefined()

    axiosMock.onGet(TOKENS_URL).replyOnce(404, {})
    await expect(MapboxToken.get(createSessionInfo())).rejects.toEqual(
      new Error(`Request failed with status code 404 (${TOKENS_URL})`)
    )

    // No cached token after failure.
    expect(MapboxToken.token).toBeUndefined()
  })

  xit("Errors if not localhost and missing token", async () => {
    window.location = { hostname: "https://streamlit.io" } as Location
    const sessionInfo = createSessionInfo("")

    await expect(MapboxToken.get(sessionInfo)).rejects.toThrow(
      "No Mapbox token provided"
    )
  })

  xit("Errors if not hello.py and missing token", async () => {
    const sessionInfo = createSessionInfo("", "streamlit run example.py")

    await expect(MapboxToken.get(sessionInfo)).rejects.toThrow(
      "No Mapbox token provided"
    )
  })

  xit("does not error if running hello.py and missing token", async () => {
    // If we're running `streamlit hello`, we'll fetch the remote token
    const sessionInfo = createSessionInfo("", "streamlit hello")

    const remoteToken = "remoteMapboxToken"
    axiosMock.onGet(TOKENS_URL).reply(200, { mapbox: remoteToken })

    await expect(MapboxToken.get(sessionInfo)).resolves.toEqual(
      "remoteMapboxToken"
    )
  })

  it("Should reload token if command line has changed", async () => {
    let sessionInfo = createSessionInfo()

    const remoteToken = "remoteMapboxToken"

    // axiosMock.onGet(TOKENS_URL).reply(200, { "mapbox-localhost": remoteToken })
    axiosMock.onGet(TOKENS_URL).reply(200, { mapbox: remoteToken })

    await expect(MapboxToken.get(sessionInfo)).resolves.toEqual(remoteToken)

    sessionInfo = createSessionInfo("password", "streamlit run test.py")

    await expect(MapboxToken.get(sessionInfo)).resolves.toEqual("password")
  })
})
