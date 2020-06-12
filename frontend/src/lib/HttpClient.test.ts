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
import HttpClient from "lib/HttpClient"
import { SessionInfo } from "lib/SessionInfo"

const MOCK_SERVER_URI = {
  host: "streamlit.mock",
  port: 80,
  basePath: "",
}

describe("HttpClient", () => {
  beforeEach(() => {
    SessionInfo.current = new SessionInfo({
      sessionId: "sessionId",
      streamlitVersion: "sv",
      pythonVersion: "pv",
      installationId: "iid",
      authorEmail: "ae",
      maxCachedMessageAge: 2,
      commandLine: "command line",
      userMapboxToken: "mockUserMapboxToken",
    })
  })

  afterEach(() => {
    document.cookie.split(";").forEach(cookie => {
      const eqPos = cookie.indexOf("=")
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT"
    })
  })

  test("has xsrf enabled", () => {
    document.cookie = "_xsrf=cookie;"
    const client = new HttpClient(() => MOCK_SERVER_URI)
    client.updateCsrfToken()

    expect(client.axiosInstance.defaults.headers["X-Xsrftoken"]).toBe("cookie")
    expect(client.axiosInstance.defaults.withCredentials).toBe(true)
  })

  test("has xsrf disabled", () => {
    const client = new HttpClient(() => MOCK_SERVER_URI)

    client.updateCsrfToken()

    expect(client.axiosInstance.defaults.headers["X-Xsrftoken"]).toBe(
      undefined
    )
    expect(client.axiosInstance.defaults.withCredentials).toBe(false)
  })
})
