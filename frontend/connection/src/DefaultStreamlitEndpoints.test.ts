/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import axios, { AxiosHeaders } from "axios"
import MockAdapter from "axios-mock-adapter"

import { buildHttpUri } from "@streamlit/utils"

import { DefaultStreamlitEndpoints } from "./DefaultStreamlitEndpoints"

const MOCK_SERVER_URI = {
  protocol: "http:",
  hostname: "streamlit.mock",
  port: "80",
  pathname: "/mock/base/path",
} as URL

afterEach(() => {
  vi.clearAllMocks()
})

describe("DefaultStreamlitEndpoints", () => {
  const { location: originalLocation } = window
  beforeEach(() => {
    // Replace window.location with a mutable object that otherwise has
    // the same contents so that we can change port below.
    Object.defineProperty(window, "location", {
      value: { ...originalLocation },
      writable: true,
      configurable: true,
    })
  })
  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    })
  })

  describe("buildComponentURL()", () => {
    it("errors if no serverURI", () => {
      // If we never connect to a server, getComponentURL will fail:
      let serverURI: URL | undefined
      const endpoint = new DefaultStreamlitEndpoints({
        getServerUri: () => serverURI,
        csrfEnabled: true,
        sendClientError: vi.fn(),
      })
      expect(() => endpoint.buildComponentURL("foo", "index.html")).toThrow()
    })

    it("uses current or cached serverURI if present", () => {
      let serverURI: URL | undefined
      const endpoint = new DefaultStreamlitEndpoints({
        getServerUri: () => serverURI,
        csrfEnabled: true,
        sendClientError: vi.fn(),
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
      sendClientError: vi.fn(),
    })

    afterEach(() => {
      endpoints.setStaticConfigUrl(null)
    })

    it("builds URL correctly for streamlit-served media", () => {
      const url = endpoints.buildMediaURL("/media/1234567890.png")
      expect(url).toBe(
        "http://streamlit.mock:80/mock/base/path/media/1234567890.png"
      )
    })

    it("builds URL correctly for static-served media", () => {
      // Set staticConfigUrl & staticAppId in query params to replicate static connection
      endpoints.setStaticConfigUrl("www.example.com")
      vi.spyOn(URLSearchParams.prototype, "get").mockReturnValue("staticAppId")

      const url = endpoints.buildMediaURL("/media/1234567890.png")
      expect(url).toBe("www.example.com/staticAppId/media/1234567890.png")
    })

    it("passes through other media uris", () => {
      const uri = endpoints.buildMediaURL("http://example/blah.png")
      expect(uri).toBe("http://example/blah.png")
    })
  })

  describe("buildDownloadUrl", () => {
    const endpoints = new DefaultStreamlitEndpoints({
      getServerUri: () => MOCK_SERVER_URI,
      csrfEnabled: false,
      sendClientError: vi.fn(),
    })

    beforeEach(() => {
      // Reset window.__streamlit before each test
      window.__streamlit = undefined
    })

    it("builds URL correctly for streamlit-served media when DOWNLOAD_ASSETS_BASE_URL is not set", () => {
      const url = endpoints.buildDownloadUrl("/media/1234567890.pdf")
      expect(url).toBe(
        "http://streamlit.mock:80/mock/base/path/media/1234567890.pdf"
      )
    })

    it("builds URL correctly when DOWNLOAD_ASSETS_BASE_URL is set", () => {
      window.__streamlit = {
        DOWNLOAD_ASSETS_BASE_URL: "https://downloads.example.com/assets",
      }
      const url = endpoints.buildDownloadUrl("/media/1234567890.pdf")
      expect(url).toBe(
        "https://downloads.example.com/assets/media/1234567890.pdf"
      )
    })

    it("passes through non-media URLs unchanged", () => {
      const url = endpoints.buildDownloadUrl("https://example.com/file.pdf")
      expect(url).toBe("https://example.com/file.pdf")
    })
  })

  describe("buildFileUploadURL", () => {
    const endpoints = new DefaultStreamlitEndpoints({
      getServerUri: () => MOCK_SERVER_URI,
      csrfEnabled: false,
      sendClientError: vi.fn(),
    })

    it("builds URL correctly for files being uploaded to the tornado server", () => {
      const url = endpoints.buildFileUploadURL("/_stcore/upload_file/file_1")
      expect(url).toBe(
        "http://streamlit.mock:80/mock/base/path/_stcore/upload_file/file_1"
      )
    })

    it("passes through other file upload URLs unchanged", () => {
      const uri = endpoints.buildFileUploadURL(
        "http://example.com/upload_file/file_2"
      )
      expect(uri).toBe("http://example.com/upload_file/file_2")
    })

    it("respects URL prefix from fileUploadClientConfig", () => {
      endpoints.setFileUploadClientConfig({
        prefix: "https://someprefix.com/somepath/",
        headers: {},
      })

      const uri = endpoints.buildFileUploadURL("/upload_file/file_2")
      expect(uri).toBe("https://someprefix.com/somepath/upload_file/file_2")
    })
  })

  describe("buildAppPageURL", () => {
    const endpoints = new DefaultStreamlitEndpoints({
      getServerUri: () => MOCK_SERVER_URI,
      csrfEnabled: false,
      sendClientError: vi.fn(),
    })

    const appPages = [
      {
        pageScriptHash: "main_page_hash",
        pageName: "streamlit app",
        urlPathname: "streamlit_app",
        isDefault: true,
      },
      {
        pageScriptHash: "other_page_hash",
        pageName: "my other page",
        urlPathname: "my_other_page",
      },
    ]

    it("uses window.location.port", () => {
      window.location.port = "3000"
      expect(endpoints.buildAppPageURL("", appPages[0])).toBe(
        "http://streamlit.mock:3000/mock/base/path/"
      )
      expect(endpoints.buildAppPageURL("", appPages[1])).toBe(
        "http://streamlit.mock:3000/mock/base/path/my_other_page"
      )
    })

    it("is built using pageLinkBaseURL if set", () => {
      window.location.port = "3000"
      const pageLinkBaseURL = "https://share.streamlit.io/vdonato/foo/bar"
      expect(endpoints.buildAppPageURL(pageLinkBaseURL, appPages[0])).toBe(
        "https://share.streamlit.io/vdonato/foo/bar/"
      )
      expect(endpoints.buildAppPageURL(pageLinkBaseURL, appPages[1])).toBe(
        "https://share.streamlit.io/vdonato/foo/bar/my_other_page"
      )
    })
  })

  describe("uploadFileUploaderFile()", () => {
    const MOCK_FILE = new File(["file1"], "file1.txt")

    let axiosMock: MockAdapter
    let endpoints: DefaultStreamlitEndpoints

    beforeEach(() => {
      axiosMock = new MockAdapter(axios)
      endpoints = new DefaultStreamlitEndpoints({
        getServerUri: () => MOCK_SERVER_URI,
        csrfEnabled: false,
        sendClientError: vi.fn(),
      })
    })

    afterEach(() => {
      axiosMock.restore()
    })

    it("properly constructs the correct endpoint when given a relative URL", async () => {
      axiosMock
        .onPut(
          "http://streamlit.mock:80/mock/base/path/_stcore/upload_file/file_1"
        )
        .reply(() => [200, 1])

      const mockOnUploadProgress = vi.fn()
      const mockAbortController = new AbortController()

      await expect(
        endpoints.uploadFileUploaderFile(
          "/_stcore/upload_file/file_1",
          MOCK_FILE,
          "mockSessionId",
          mockOnUploadProgress,
          mockAbortController.signal
        )
      ).resolves.toBeUndefined()

      expect(axiosMock.history.put.length).toBe(1)
      const actualRequestConfig = axiosMock.history.put[0]

      const expectedData = new FormData()
      expectedData.append(MOCK_FILE.name, MOCK_FILE)

      expect(actualRequestConfig.url).toBe(
        "http://streamlit.mock:80/mock/base/path/_stcore/upload_file/file_1"
      )
      // method is implied by history.put, but can be checked if present in config
      // expect(actualRequestConfig.method?.toUpperCase()).toBe("PUT");
      expect(actualRequestConfig.responseType).toBe("text")
      expect(actualRequestConfig.data).toEqual(expectedData)
      expect(actualRequestConfig.signal).toBe(mockAbortController.signal)
      expect(actualRequestConfig.onUploadProgress).toBe(mockOnUploadProgress)
    })

    it("Uses the endpoint unchanged when given an absolute url", async () => {
      axiosMock
        .onPut("http://example.com/upload_file/file_2")
        .reply(() => [200, 1])

      const mockOnUploadProgress = vi.fn()
      const mockAbortController = new AbortController()

      await expect(
        endpoints.uploadFileUploaderFile(
          "http://example.com/upload_file/file_2",
          MOCK_FILE,
          "mockSessionId",
          mockOnUploadProgress,
          mockAbortController.signal
        )
      ).resolves.toBeUndefined()

      expect(axiosMock.history.put.length).toBe(1)
      const actualRequestConfig = axiosMock.history.put[0]

      const expectedData = new FormData()
      expectedData.append(MOCK_FILE.name, MOCK_FILE)

      expect(actualRequestConfig.url).toBe(
        "http://example.com/upload_file/file_2"
      )
      expect(actualRequestConfig.responseType).toBe("text")
      expect(actualRequestConfig.data).toEqual(expectedData)
      expect(actualRequestConfig.signal).toBe(mockAbortController.signal)
      expect(actualRequestConfig.onUploadProgress).toBe(mockOnUploadProgress)
    })

    it("respects fileUploadClientConfig", async () => {
      axiosMock
        .onPut("http://example.com/someprefix/upload_file/file_2")
        .reply(() => [200, 1])

      const mockOnUploadProgress = vi.fn()
      const mockAbortController = new AbortController()

      endpoints.setFileUploadClientConfig({
        prefix: "http://example.com/someprefix/",
        headers: {
          header1: "header1value",
          header2: "header2value",
        },
      })

      await expect(
        endpoints.uploadFileUploaderFile(
          "upload_file/file_2",
          MOCK_FILE,
          "mockSessionId",
          mockOnUploadProgress,
          mockAbortController.signal
        )
      ).resolves.toBeUndefined()

      expect(axiosMock.history.put.length).toBe(1)
      const actualRequestConfig = axiosMock.history.put[0]

      const expectedData = new FormData()
      expectedData.append(MOCK_FILE.name, MOCK_FILE)

      expect(actualRequestConfig.url).toBe(
        "http://example.com/someprefix/upload_file/file_2"
      )
      expect(actualRequestConfig.responseType).toBe("text")
      expect(actualRequestConfig.data).toEqual(expectedData)
      expect(actualRequestConfig.headers).toEqual(
        new AxiosHeaders({
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/x-www-form-urlencoded",
          header1: "header1value",
          header2: "header2value",
        })
      )
      expect(actualRequestConfig.signal).toBe(mockAbortController.signal)
      expect(actualRequestConfig.onUploadProgress).toBe(mockOnUploadProgress)
    })

    it("errors on bad status", async () => {
      axiosMock
        .onPut("http://streamlit.mock:80/mock/base/path/_stcore/upload_file")
        .reply(() => [400])

      const sendClientErrorToHostSpy = vi.spyOn(
        endpoints,
        "sendClientErrorToHost"
      )

      await expect(
        endpoints.uploadFileUploaderFile(
          "/_stcore/upload_file",
          MOCK_FILE,
          "mockSessionId"
        )
      ).rejects.toThrow("Request failed with status code 400")

      expect(sendClientErrorToHostSpy).toHaveBeenCalledWith(
        "File Uploader",
        "Error uploading file",
        "Request failed with status code 400",
        "http://streamlit.mock:80/mock/base/path/_stcore/upload_file"
      )
    })
  })

  describe("deleteFileAtURL()", () => {
    let axiosMock: MockAdapter
    let endpoints: DefaultStreamlitEndpoints

    beforeEach(() => {
      axiosMock = new MockAdapter(axios)
      endpoints = new DefaultStreamlitEndpoints({
        getServerUri: () => MOCK_SERVER_URI,
        csrfEnabled: false,
        sendClientError: vi.fn(),
      })
    })

    afterEach(() => {
      axiosMock.restore()
    })

    it("delete properly constructs the correct endpoint when given a relative URL", async () => {
      axiosMock
        .onDelete(
          "http://streamlit.mock:80/mock/base/path/_stcore/upload_file/file_1"
        )
        .reply(() => [204])

      await expect(
        endpoints.deleteFileAtURL(
          "/_stcore/upload_file/file_1",
          "mockSessionId"
        )
      ).resolves.toBeUndefined()

      expect(axiosMock.history.delete.length).toBe(1)
      const actualRequestConfig = axiosMock.history.delete[0]

      expect(actualRequestConfig.url).toBe(
        "http://streamlit.mock:80/mock/base/path/_stcore/upload_file/file_1"
      )
      expect(actualRequestConfig.data).toEqual(
        JSON.stringify({ sessionId: "mockSessionId" })
      ) // Axios stringifies DELETE body by default
    })

    it("respects fileUploadClientConfig", async () => {
      axiosMock
        .onDelete("http://example.com/someprefix/upload_file/file_1")
        .reply(() => [204])

      endpoints.setFileUploadClientConfig({
        prefix: "http://example.com/someprefix/",
        headers: new AxiosHeaders({
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/x-www-form-urlencoded",
          header1: "header1value",
          header2: "header2value",
        }),
      })

      await expect(
        endpoints.deleteFileAtURL("upload_file/file_1", "mockSessionId")
      ).resolves.toBeUndefined()

      expect(axiosMock.history.delete.length).toBe(1)
      const actualRequestConfig = axiosMock.history.delete[0]

      expect(actualRequestConfig.url).toBe(
        "http://example.com/someprefix/upload_file/file_1"
      )
      expect(actualRequestConfig.headers).toEqual(
        new AxiosHeaders({
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/x-www-form-urlencoded",
          header1: "header1value",
          header2: "header2value",
        })
      )
      expect(actualRequestConfig.data).toEqual("sessionId=mockSessionId") // Axios stringifies DELETE body by default
    })

    it("errors on bad status", async () => {
      axiosMock
        .onDelete(
          "http://streamlit.mock:80/mock/base/path/_stcore/upload_file/file_1"
        )
        .reply(() => [400])

      const sendClientErrorToHostSpy = vi.spyOn(
        endpoints,
        "sendClientErrorToHost"
      )

      await expect(
        endpoints.deleteFileAtURL(
          "/_stcore/upload_file/file_1",
          "mockSessionId"
        )
      ).rejects.toThrow("Request failed with status code 400")

      expect(sendClientErrorToHostSpy).toHaveBeenCalledWith(
        "File Uploader",
        "Error deleting file",
        "Request failed with status code 400",
        "http://streamlit.mock:80/mock/base/path/_stcore/upload_file/file_1"
      )
    })
  })

  // Test our private csrfRequest() API, which is responsible for setting
  // the "X-Xsrftoken" header.
  describe("csrfRequest()", () => {
    const spyRequest = vi.spyOn(axios, "request")
    let prevDocumentCookie: string

    beforeEach(() => {
      prevDocumentCookie = document.cookie
      document.cookie = "_streamlit_xsrf=mockXsrfCookie;"
    })

    afterEach(() => {
      document.cookie = prevDocumentCookie
    })

    it("sets token when csrfEnabled: true", () => {
      const endpoints = new DefaultStreamlitEndpoints({
        getServerUri: () => MOCK_SERVER_URI,
        csrfEnabled: true,
        sendClientError: vi.fn(),
      })

      const url = buildHttpUri(MOCK_SERVER_URI, "mockUrl")
      // @ts-expect-error
      void endpoints.csrfRequest(url, {})

      expect(spyRequest).toHaveBeenCalledWith({
        headers: { "X-Xsrftoken": "mockXsrfCookie" },
        withCredentials: true,
        url,
      })
    })

    it("omits token when csrfEnabled: false", () => {
      const endpoints = new DefaultStreamlitEndpoints({
        getServerUri: () => MOCK_SERVER_URI,
        csrfEnabled: false,
        sendClientError: vi.fn(),
      })

      const url = buildHttpUri(MOCK_SERVER_URI, "mockUrl")
      // @ts-expect-error
      void endpoints.csrfRequest(url, {})

      expect(spyRequest).toHaveBeenCalledWith({
        url,
      })
    })
  })

  describe("checkSourceUrlResponse", () => {
    it("sends error to host if error on response", async () => {
      // Mock fetch for checkSourceUrlResponse - response is not ok
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: "Not Found",
        } as Response)
      )
      const endpoints = new DefaultStreamlitEndpoints({
        getServerUri: () => MOCK_SERVER_URI,
        csrfEnabled: false,
        sendClientError: vi.fn(),
      })

      const url = buildHttpUri(MOCK_SERVER_URI, "mockUrl")
      const sendClientErrorToHostSpy = vi.spyOn(
        endpoints,
        "sendClientErrorToHost"
      )
      await endpoints.checkSourceUrlResponse(
        url,
        "Custom Component",
        "mockComponent"
      )

      expect(fetch).toHaveBeenCalledWith(url)

      expect(sendClientErrorToHostSpy).toHaveBeenCalledWith(
        "Custom Component",
        404,
        "Not Found",
        url,
        "mockComponent"
      )
    })

    it("sends error to host if fetch fails", async () => {
      const endpoints = new DefaultStreamlitEndpoints({
        getServerUri: () => MOCK_SERVER_URI,
        csrfEnabled: false,
        sendClientError: vi.fn(),
      })

      // Mock fetch for checkSourceUrlResponse - fetch fails
      global.fetch = vi.fn(() => Promise.reject(new Error("mockError")))

      const sendClientErrorToHostSpy = vi.spyOn(
        endpoints,
        "sendClientErrorToHost"
      )
      const url = buildHttpUri(MOCK_SERVER_URI, "mockUrl")
      await endpoints.checkSourceUrlResponse(
        url,
        "Custom Component",
        "mockComponent"
      )

      expect(fetch).toHaveBeenCalledWith(url)

      expect(sendClientErrorToHostSpy).toHaveBeenCalledWith(
        "Custom Component",
        "Error fetching source",
        "mockError",
        url,
        "mockComponent"
      )
    })
  })
})
