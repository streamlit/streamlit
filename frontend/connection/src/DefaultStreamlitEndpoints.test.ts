/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

// Mock StreamlitConfig using global mock state (see vitest.setup.ts)
vi.mock("@streamlit/utils", async () => {
  const actual = await vi.importActual("@streamlit/utils")
  return {
    ...actual,
    get StreamlitConfig() {
      return globalThis.__mockStreamlitConfig
    },
  }
})

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
      globalThis.__mockStreamlitConfig = {}
    })

    it("builds URL correctly for streamlit-served media when DOWNLOAD_ASSETS_BASE_URL is not set", () => {
      const url = endpoints.buildDownloadUrl("/media/1234567890.pdf")
      expect(url).toBe(
        "http://streamlit.mock:80/mock/base/path/media/1234567890.pdf"
      )
    })

    it("builds URL correctly when DOWNLOAD_ASSETS_BASE_URL is set", () => {
      globalThis.__mockStreamlitConfig.DOWNLOAD_ASSETS_BASE_URL =
        "https://downloads.example.com/assets"
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

    let endpoints: DefaultStreamlitEndpoints
    const originalXMLHttpRequest = globalThis.XMLHttpRequest

    class MockXMLHttpRequest {
      public static instances: MockXMLHttpRequest[] = []

      public static onSend?: (request: MockXMLHttpRequest) => void

      public status = 0

      public withCredentials = false

      public method = ""

      public url = ""

      public body: Document | XMLHttpRequestBodyInit | null = null

      public headers: Record<string, string> = {}

      public upload = {
        onprogress: null as ((event: ProgressEvent) => void) | null,
      }

      public onload: (() => void) | null = null

      public onerror: (() => void) | null = null

      public onabort: (() => void) | null = null

      public onloadend: (() => void) | null = null

      public constructor() {
        MockXMLHttpRequest.instances.push(this)
      }

      public static reset(): void {
        MockXMLHttpRequest.instances = []
        MockXMLHttpRequest.onSend = undefined
      }

      public open(method: string, url: string): void {
        this.method = method
        this.url = url
      }

      public setRequestHeader(name: string, value: string): void {
        this.headers[name] = value
      }

      public send(body: Document | XMLHttpRequestBodyInit | null): void {
        this.body = body
        MockXMLHttpRequest.onSend?.(this)
      }

      public abort(): void {
        this.onabort?.()
        this.onloadend?.()
      }

      public respond(status: number): void {
        this.status = status
        this.onload?.()
        this.onloadend?.()
      }

      public emitUploadProgress(loaded: number, total: number): void {
        this.upload.onprogress?.({ loaded, total } as ProgressEvent)
      }
    }

    const setXMLHttpRequest = (
      value: typeof globalThis.XMLHttpRequest | typeof MockXMLHttpRequest
    ): void => {
      Object.defineProperty(globalThis, "XMLHttpRequest", {
        value,
        configurable: true,
        writable: true,
      })
    }

    const getOnlyUploadRequest = (): MockXMLHttpRequest => {
      expect(MockXMLHttpRequest.instances).toHaveLength(1)
      return MockXMLHttpRequest.instances[0]
    }

    const createExpectedUploadBody = (): FormData => {
      const expectedData = new FormData()
      expectedData.append(MOCK_FILE.name, MOCK_FILE)
      return expectedData
    }

    beforeEach(() => {
      endpoints = new DefaultStreamlitEndpoints({
        getServerUri: () => MOCK_SERVER_URI,
        csrfEnabled: false,
        sendClientError: vi.fn(),
      })
      MockXMLHttpRequest.reset()
      setXMLHttpRequest(MockXMLHttpRequest)
      MockXMLHttpRequest.onSend = request => request.respond(200)
    })

    afterEach(() => {
      setXMLHttpRequest(originalXMLHttpRequest)
    })

    it("properly constructs the correct endpoint when given a relative URL", async () => {
      const mockOnUploadProgress = vi.fn()
      const mockAbortController = new AbortController()
      MockXMLHttpRequest.onSend = request => {
        request.emitUploadProgress(50, 100)
        request.respond(200)
      }

      await expect(
        endpoints.uploadFileUploaderFile(
          "/_stcore/upload_file/file_1",
          MOCK_FILE,
          "mockSessionId",
          mockOnUploadProgress,
          mockAbortController.signal
        )
      ).resolves.toBeUndefined()

      const request = getOnlyUploadRequest()
      const expectedData = createExpectedUploadBody()

      expect(request.url).toBe(
        "http://streamlit.mock:80/mock/base/path/_stcore/upload_file/file_1"
      )
      expect(request.method).toBe("PUT")
      expect(request.body).toEqual(expectedData)
      expect(mockOnUploadProgress).toHaveBeenCalledWith(
        expect.objectContaining({ loaded: 50, total: 100 })
      )
    })

    it("uses the endpoint unchanged when given an absolute URL", async () => {
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

      const request = getOnlyUploadRequest()
      const expectedData = createExpectedUploadBody()

      expect(request.url).toBe("http://example.com/upload_file/file_2")
      expect(request.method).toBe("PUT")
      expect(request.body).toEqual(expectedData)
    })

    it("respects fileUploadClientConfig", async () => {
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

      const request = getOnlyUploadRequest()
      const expectedData = createExpectedUploadBody()

      expect(request.url).toBe(
        "http://example.com/someprefix/upload_file/file_2"
      )
      expect(request.method).toBe("PUT")
      expect(request.body).toEqual(expectedData)
      expect(request.headers).toEqual({
        header1: "header1value",
        header2: "header2value",
      })
    })

    it("aborts upload when AbortSignal is triggered", async () => {
      const mockAbortController = new AbortController()
      MockXMLHttpRequest.onSend = () => {}

      const uploadPromise = endpoints.uploadFileUploaderFile(
        "/_stcore/upload_file/file_1",
        MOCK_FILE,
        "mockSessionId",
        undefined,
        mockAbortController.signal
      )

      mockAbortController.abort()

      await expect(uploadPromise).rejects.toThrow(/aborted/i)
    })

    it("errors on bad status", async () => {
      MockXMLHttpRequest.onSend = request => request.respond(400)

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
    let endpoints: DefaultStreamlitEndpoints
    let fetchSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      endpoints = new DefaultStreamlitEndpoints({
        getServerUri: () => MOCK_SERVER_URI,
        csrfEnabled: false,
        sendClientError: vi.fn(),
      })
      fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(null, { status: 204 }))
    })

    afterEach(() => {
      fetchSpy.mockRestore()
    })

    it("delete properly constructs the correct endpoint when given a relative URL", async () => {
      await expect(
        endpoints.deleteFileAtURL(
          "/_stcore/upload_file/file_1",
          "mockSessionId"
        )
      ).resolves.toBeUndefined()

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://streamlit.mock:80/mock/base/path/_stcore/upload_file/file_1",
        {
          body: JSON.stringify({ sessionId: "mockSessionId" }),
          credentials: undefined,
          headers: { "Content-Type": "application/json" },
          method: "DELETE",
          signal: undefined,
        }
      )
    })

    it("respects fileUploadClientConfig", async () => {
      endpoints.setFileUploadClientConfig({
        prefix: "http://example.com/someprefix/",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          header1: "header1value",
          header2: "header2value",
        },
      })

      await expect(
        endpoints.deleteFileAtURL("upload_file/file_1", "mockSessionId")
      ).resolves.toBeUndefined()

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://example.com/someprefix/upload_file/file_1",
        {
          body: "sessionId=mockSessionId",
          credentials: undefined,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            header1: "header1value",
            header2: "header2value",
          },
          method: "DELETE",
          signal: undefined,
        }
      )
    })

    it("errors on bad status", async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 400 }))

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
    let prevDocumentCookie: string
    let fetchSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      prevDocumentCookie = document.cookie
      document.cookie = "_streamlit_xsrf=mockXsrfCookie;"
      fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(null, { status: 200 }))
    })

    afterEach(() => {
      document.cookie = prevDocumentCookie
      fetchSpy.mockRestore()
    })

    it("sets token when csrfEnabled: true", async () => {
      const endpoints = new DefaultStreamlitEndpoints({
        getServerUri: () => MOCK_SERVER_URI,
        csrfEnabled: true,
        sendClientError: vi.fn(),
      })

      const url = buildHttpUri(MOCK_SERVER_URI, "mockUrl")
      // @ts-expect-error
      await endpoints.csrfRequest(url, { method: "DELETE" })

      expect(fetchSpy).toHaveBeenCalledWith(url, {
        body: undefined,
        credentials: "include",
        headers: { "X-Xsrftoken": "mockXsrfCookie" },
        method: "DELETE",
        signal: undefined,
      })
    })

    it("omits token when csrfEnabled: false", async () => {
      const endpoints = new DefaultStreamlitEndpoints({
        getServerUri: () => MOCK_SERVER_URI,
        csrfEnabled: false,
        sendClientError: vi.fn(),
      })

      const url = buildHttpUri(MOCK_SERVER_URI, "mockUrl")
      // @ts-expect-error
      await endpoints.csrfRequest(url, { method: "DELETE" })

      expect(fetchSpy).toHaveBeenCalledWith(url, {
        body: undefined,
        credentials: undefined,
        headers: {},
        method: "DELETE",
        signal: undefined,
      })
    })
  })

  describe("checkSourceUrlResponse", () => {
    it("sends error to host if error on response", async () => {
      // Mock fetch for checkSourceUrlResponse - response is not ok
      globalThis.fetch = vi.fn(() =>
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
      globalThis.fetch = vi.fn(() => Promise.reject(new Error("mockError")))

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
