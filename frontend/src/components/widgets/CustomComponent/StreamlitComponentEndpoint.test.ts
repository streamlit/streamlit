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

import { BaseUriParts } from "src/lib/UriUtil"
import { StreamlitComponentEndpoint } from "./StreamlitComponentEndpoint"

const MOCK_SERVER_URI = {
  host: "streamlit.mock",
  port: 80,
  basePath: "",
}

describe("StreamlitComponentEndpoint", () => {
  test("Caches server URI", () => {
    // If we never connect to a server, getComponentURL will fail:
    let serverURI: BaseUriParts | undefined
    const endpoint = new StreamlitComponentEndpoint(() => serverURI)
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
})
