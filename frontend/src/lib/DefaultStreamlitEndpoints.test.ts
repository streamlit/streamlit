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
import { BaseUriParts, buildHttpUri } from "src/lib/UriUtil"
import { DefaultStreamlitEndpoints } from "./DefaultStreamlitEndpoints"

const MOCK_SERVER_URI = {
  host: "streamlit.mock",
  port: 80,
  basePath: "",
}

describe("DefaultStreamlitEndpoints", () => {
  test("Caches server URI", () => {
    // If we never connect to a server, getComponentURL will fail:
    let serverURI: BaseUriParts | undefined
    const endpoint = new DefaultStreamlitEndpoints({
      getServerUri: () => serverURI,
      csrfEnabled: true,
    })
    expect(() => endpoint.buildComponentURL("foo", "index.html")).toThrow()

    // But if we connect once, and then disconnect, our original URI should
    // be cached.

    // "Connect" to the server
    serverURI = MOCK_SERVER_URI
    expect(endpoint.buildComponentURL("foo", "index.html")).toEqual(
      "http://streamlit.mock:80/component/foo/index.html"
    )

    // "Disconnect" from the server, and call buildComponentURL again;
    // it should return a URL constructed from the cached server URI.
    serverURI = undefined
    expect(endpoint.buildComponentURL("bar", "index.html")).toEqual(
      "http://streamlit.mock:80/component/bar/index.html"
    )
  })

  describe("csrfRequest() API", () => {
    const spyRequest = jest.spyOn(axios, "request")
    let prevDocumentCookie: string

    beforeEach(() => {
      prevDocumentCookie = document.cookie
      document.cookie = "_xsrf=mockXsrfCookie;"
    })

    afterEach(() => {
      document.cookie = prevDocumentCookie
    })

    test("sets token when csrfEnabled: true", () => {
      const endpoints = new DefaultStreamlitEndpoints({
        getServerUri: () => MOCK_SERVER_URI,
        csrfEnabled: true,
      })

      // @ts-expect-error
      endpoints.csrfRequest("mockUrl", {})

      expect(spyRequest).toHaveBeenCalledWith({
        headers: { "X-Xsrftoken": "mockXsrfCookie" },
        withCredentials: true,
        url: buildHttpUri(MOCK_SERVER_URI, "mockUrl"),
      })
    })

    test("omits token when csrfEnabled: false", () => {
      const endpoints = new DefaultStreamlitEndpoints({
        getServerUri: () => MOCK_SERVER_URI,
        csrfEnabled: false,
      })

      // @ts-expect-error
      endpoints.csrfRequest("mockUrl", {})
      expect(spyRequest).toHaveBeenCalledWith({
        url: buildHttpUri(MOCK_SERVER_URI, "mockUrl"),
      })
    })
  })
})
