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
import HttpClient from "src/lib/HttpClient"
import { buildHttpUri } from "src/lib/UriUtil"

const MOCK_SERVER_URI = {
  host: "streamlit.mock",
  port: 80,
  basePath: "",
}

describe("HttpClient", () => {
  const spyRequest = jest.spyOn(axios, "request")

  afterEach(() => {
    document.cookie.split(";").forEach(cookie => {
      const eqPos = cookie.indexOf("=")
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT`
    })
  })

  test("has xsrf enabled", () => {
    document.cookie = "_xsrf=cookie;"
    const client = new HttpClient(() => MOCK_SERVER_URI, true)

    client.request("url", {})

    expect(spyRequest).toHaveBeenCalledWith({
      headers: { "X-Xsrftoken": "cookie" },
      withCredentials: true,
      url: buildHttpUri(MOCK_SERVER_URI, `url`),
    })
  })

  test("has xsrf disabled", () => {
    const client = new HttpClient(() => MOCK_SERVER_URI, false)

    client.request("url", {})
    expect(spyRequest).toHaveBeenCalledWith({
      url: buildHttpUri(MOCK_SERVER_URI, `url`),
    })
  })
})
