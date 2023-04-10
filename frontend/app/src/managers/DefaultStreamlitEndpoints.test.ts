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
import MockAdapter from "axios-mock-adapter"
import { BaseUriParts, buildHttpUri } from "@streamlit/lib"
import { ForwardMsg } from "src/autogen/proto"
import { DefaultStreamlitEndpoints } from "./DefaultStreamlitEndpoints"

const MOCK_SERVER_URI = {
  host: "streamlit.mock",
  port: 80,
  basePath: "mock/base/path",
}

function createMockForwardMsg(hash: string, cacheable = true): ForwardMsg {
  return ForwardMsg.fromObject({
    hash,
    metadata: { cacheable, deltaId: 0 },
  })
}

describe("DefaultStreamlitEndpoints", () => {
  const { location: originalLocation } = window
  beforeEach(() => {
    // Replace window.location with a mutable object that otherwise has
    // the same contents so that we can change port below.
    // @ts-expect-error
    delete window.location
    window.location = { ...originalLocation }
  })
  afterEach(() => {
    window.location = originalLocation
  })

  describe("buildComponentURL()", () => {
    it("errors if no serverURI", () => {
      // If we never connect to a server, getComponentURL will fail:
      let serverURI: BaseUriParts | undefined
      const endpoint = new DefaultStreamlitEndpoints({
        getServerUri: () => serverURI,
        csrfEnabled: true,
      })
      expect(() => endpoint.buildComponentURL("foo", "index.html")).toThrow()
    })

    it("uses current or cached serverURI if present", () => {
      let serverURI: BaseUriParts | undefined
      const endpoint = new DefaultStreamlitEndpoints({
        getServerUri: () => serverURI,
        csrfEnabled: true,
      })

      // "Connect" to the server. `buildComponentURL` will succeed.
      serverURI = MOCK_SERVER_URI
      expect(endpoint.buildComponentURL("foo", "index.html")).toEqual(
        "http://streamlit.mock:80/mock/base/path/component/foo/index.html"
      )

      // "Disconnect" from the server, and call buildComponentURL again;
      // it should return a URL constructed from the cached server URI.
      serverURI = undefined
      expect(endpoint.buildComponentURL("bar", "index.html")).toEqual(
        "http://streamlit.mock:80/mock/base/path/component/bar/index.html"
      )
    })
  })

  describe("buildMediaURL", () => {
    const endpoints = new DefaultStreamlitEndpoints({
      getServerUri: () => MOCK_SERVER_URI,
      csrfEnabled: false,
    })

    it("builds URL correctly for streamlit-served media", () => {
      const url = endpoints.buildMediaURL("/media/1234567890.png")
      expect(url).toBe(
        "http://streamlit.mock:80/mock/base/path/media/1234567890.png"
      )
    })

    it("passes through other media uris", () => {
      const uri = endpoints.buildMediaURL("http://example/blah.png")
      expect(uri).toBe("http://example/blah.png")
    })

    it("sanitizes SVG uris", () => {
      const url = endpoints.buildMediaURL(
        `data:image/svg+xml,<svg><script>alert('evil')</script></svg>`
      )
      expect(url).toBe(`data:image/svg+xml,<svg></svg>`)
    })
  })

  describe("buildAppPageURL", () => {
    const endpoints = new DefaultStreamlitEndpoints({
      getServerUri: () => MOCK_SERVER_URI,
      csrfEnabled: false,
    })

    const appPages = [
      { pageScriptHash: "main_page_hash", pageName: "streamlit_app" },
      { pageScriptHash: "other_page_hash", pageName: "my_other_page" },
    ]

    it("uses window.location.port", () => {
      window.location.port = "3000"
      expect(endpoints.buildAppPageURL("", appPages[0], 0)).toBe(
        "http://streamlit.mock:3000/mock/base/path/"
      )
      expect(endpoints.buildAppPageURL("", appPages[1], 1)).toBe(
        "http://streamlit.mock:3000/mock/base/path/my_other_page"
      )
    })

    it("is built using pageLinkBaseURL if set", () => {
      window.location.port = "3000"
      const pageLinkBaseURL = "https://share.streamlit.io/vdonato/foo/bar"
      expect(endpoints.buildAppPageURL(pageLinkBaseURL, appPages[0], 0)).toBe(
        "https://share.streamlit.io/vdonato/foo/bar/"
      )
      expect(endpoints.buildAppPageURL(pageLinkBaseURL, appPages[1], 1)).toBe(
        "https://share.streamlit.io/vdonato/foo/bar/my_other_page"
      )
    })
  })

  describe("uploadFileUploaderFile()", () => {
    const MOCK_FILE = new File(["file1"], "file1.txt")

    let axiosMock: MockAdapter
    const spyRequest = jest.spyOn(axios, "request")
    let endpoints: DefaultStreamlitEndpoints

    beforeEach(() => {
      axiosMock = new MockAdapter(axios)
      endpoints = new DefaultStreamlitEndpoints({
        getServerUri: () => MOCK_SERVER_URI,
        csrfEnabled: false,
      })
    })

    afterEach(() => {
      axiosMock.restore()
    })

    it("calls the appropriate endpoint", async () => {
      axiosMock
        .onPost("http://streamlit.mock:80/mock/base/path/_stcore/upload_file")
        .reply(() => [200, 1])

      const mockOnUploadProgress = (_: any): void => {}
      const mockCancelToken = axios.CancelToken.source().token

      await expect(
        endpoints.uploadFileUploaderFile(
          MOCK_FILE,
          "mockWidgetId",
          "mockSessionId",
          mockOnUploadProgress,
          mockCancelToken
        )
      ).resolves.toBeDefined()

      const expectedData = new FormData()
      expectedData.append("sessionId", "mockSessionId")
      expectedData.append("widgetId", "mockWidgetId")
      expectedData.append(MOCK_FILE.name, MOCK_FILE)

      expect(spyRequest).toHaveBeenCalledWith({
        url: "http://streamlit.mock:80/mock/base/path/_stcore/upload_file",
        method: "POST",
        responseType: "text",
        data: expectedData,
        cancelToken: mockCancelToken,
        onUploadProgress: mockOnUploadProgress,
      })
    })

    it("errors on unexpected return value", async () => {
      // If our endpoint returns a non-number, we'll return a failed promise.
      axiosMock
        .onPost("http://streamlit.mock:80/mock/base/path/_stcore/upload_file")
        .reply(() => [200, "invalidFileId"])

      await expect(
        endpoints.uploadFileUploaderFile(
          MOCK_FILE,
          "mockWidgetId",
          "mockSessionId"
        )
      ).rejects.toEqual(
        new Error(
          "Bad uploadFile response: expected a number but got 'invalidFileId'"
        )
      )
    })

    it("errors on bad status", async () => {
      axiosMock
        .onPost("http://streamlit.mock:80/mock/base/path/_stcore/upload_file")
        .reply(() => [400])

      await expect(
        endpoints.uploadFileUploaderFile(
          MOCK_FILE,
          "mockWidgetId",
          "mockSessionId"
        )
      ).rejects.toEqual(new Error("Request failed with status code 400"))
    })
  })

  describe("fetchCachedForwardMsg()", () => {
    let axiosMock: MockAdapter
    let endpoints: DefaultStreamlitEndpoints

    beforeEach(() => {
      axiosMock = new MockAdapter(axios)
      endpoints = new DefaultStreamlitEndpoints({
        getServerUri: () => MOCK_SERVER_URI,
        csrfEnabled: false,
      })
    })

    afterEach(() => {
      axiosMock.restore()
    })

    it("calls the appropriate endpoint", async () => {
      const mockForwardMsgBytes = ForwardMsg.encode(
        createMockForwardMsg("mockHash")
      ).finish()

      axiosMock
        .onGet(
          "http://streamlit.mock:80/mock/base/path/_stcore/message?hash=mockHash"
        )
        .reply(() => {
          return [200, mockForwardMsgBytes]
        })

      await expect(
        endpoints.fetchCachedForwardMsg("mockHash")
      ).resolves.toEqual(new Uint8Array(mockForwardMsgBytes))
    })

    it("errors on bad status", async () => {
      axiosMock
        .onGet(
          "http://streamlit.mock:80/mock/base/path/_stcore/message?hash=mockHash"
        )
        .reply(() => [400])

      await expect(
        endpoints.fetchCachedForwardMsg("mockHash")
      ).rejects.toEqual(new Error("Request failed with status code 400"))
    })
  })

  // Test our private csrfRequest() API, which is responsible for setting
  // the "X-Xsrftoken" header.
  describe("csrfRequest()", () => {
    const spyRequest = jest.spyOn(axios, "request")
    let prevDocumentCookie: string

    beforeEach(() => {
      prevDocumentCookie = document.cookie
      document.cookie = "_xsrf=mockXsrfCookie;"
    })

    afterEach(() => {
      document.cookie = prevDocumentCookie
    })

    it("sets token when csrfEnabled: true", () => {
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

    it("omits token when csrfEnabled: false", () => {
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
