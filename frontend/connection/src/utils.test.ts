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

import { buildHttpUri } from "@streamlit/utils"

import {
  buildWsUri,
  FetchError,
  fetchWithTimeout,
  getPossibleBaseUris,
  isHostConfigBypassEnabled,
  parseUriIntoBaseParts,
  serializeForDisplay,
} from "./utils"

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

describe("parseUriIntoBaseParts", () => {
  const location: Partial<Location> = {}
  const { location: originalLocation } = window

  beforeEach(() => {
    Object.defineProperty(window, "location", { value: location })
  })

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    })
  })

  it("gets all window URI parts", () => {
    location.href = "https://the_host:9988/foo"

    expect(parseUriIntoBaseParts()).toMatchObject({
      protocol: "https:",
      hostname: "the_host",
      port: "9988",
      pathname: "/foo",
    })
  })

  it("gets window URI parts without basePath", () => {
    location.href = "https://the_host:9988"

    expect(parseUriIntoBaseParts()).toMatchObject({
      protocol: "https:",
      hostname: "the_host",
      port: "9988",
      pathname: "/",
    })
  })

  it("gets window URI parts with long basePath", () => {
    location.href = "https://the_host:9988/foo/bar"

    expect(parseUriIntoBaseParts()).toMatchObject({
      protocol: "https:",
      hostname: "the_host",
      port: "9988",
      pathname: "/foo/bar",
    })
  })

  it("gets window URI parts with weird basePath", () => {
    location.href = "https://the_host:9988///foo/bar//"

    expect(parseUriIntoBaseParts()).toMatchObject({
      protocol: "https:",
      hostname: "the_host",
      port: "9988",
      pathname: "/foo/bar",
    })
  })
})

it("Uses provided URL instead of window.location.href to get URI parts if provided", () => {
  location.href = "https://the_host:9988/foo/bar"

  expect(
    parseUriIntoBaseParts("https://the_other_host:9999/foo/bar/baz")
  ).toMatchObject({
    protocol: "https:",
    hostname: "the_other_host",
    port: "9999",
    pathname: "/foo/bar/baz",
  })
})

it("builds HTTP URI correctly", () => {
  location.href = "http://something"
  const uri = buildHttpUri(
    {
      protocol: "http:",
      hostname: "the_host",
      port: "9988",
      pathname: "foo/bar",
    } as URL,
    "baz"
  )
  expect(uri).toBe("http://the_host:9988/foo/bar/baz")
})

it("builds HTTPS URI correctly", () => {
  location.href = "https://something"
  const uri = buildHttpUri(
    {
      protocol: "https:",
      hostname: "the_host",
      port: "9988",
      pathname: "foo/bar",
    } as URL,
    "baz"
  )
  expect(uri).toBe("https://the_host:9988/foo/bar/baz")
})

it("builds HTTP URI with no base path", () => {
  location.href = "http://something"
  const uri = buildHttpUri(
    {
      protocol: "http:",
      hostname: "the_host",
      port: "9988",
      pathname: "",
    } as URL,
    "baz"
  )
  expect(uri).toBe("http://the_host:9988/baz")
})

it("builds WS URI correctly", () => {
  location.href = "http://something"
  const uri = buildWsUri(
    {
      protocol: "http:",
      hostname: "the_host",
      port: "9988",
      pathname: "foo/bar",
    } as URL,
    "baz"
  )
  expect(uri).toBe("ws://the_host:9988/foo/bar/baz")
})

it("builds WSS URI correctly", () => {
  const uri = buildWsUri(
    {
      protocol: "https:",
      hostname: "the_host",
      port: "9988",
      pathname: "foo/bar",
    } as URL,
    "baz"
  )
  expect(uri).toBe("wss://the_host:9988/foo/bar/baz")
})

it("builds WS URI with no base path", () => {
  location.href = "http://something"
  const uri = buildWsUri(
    {
      protocol: "http:",
      hostname: "the_host",
      port: "9988",
      pathname: "",
    } as URL,
    "baz"
  )
  expect(uri).toBe("ws://the_host:9988/baz")
})

describe("getPossibleBaseUris", () => {
  let originalPathName = ""
  const { location: originalLocation } = window

  beforeEach(() => {
    originalPathName = window.location.pathname
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: {
        ...originalLocation,
        origin: "https://app.example.com:8080",
      },
    })
  })

  afterEach(() => {
    globalThis.__mockStreamlitConfig = {}
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, pathname: originalPathName },
      writable: true,
      configurable: true,
    })
  })

  const testCases = [
    {
      description: "empty pathnames",
      pathname: "/",
      expectedBasePaths: ["/"],
    },
    {
      description: "pathnames with a single part",
      pathname: "/foo",
      expectedBasePaths: ["/foo", "/"],
    },
    {
      description: "pathnames with two parts",
      pathname: "/foo/bar",
      expectedBasePaths: ["/foo/bar", "/foo"],
    },
    {
      description: "pathnames with more than two parts",
      pathname: "/foo/bar/baz/qux",
      expectedBasePaths: ["/foo/bar/baz/qux", "/foo/bar/baz"],
    },
  ]

  testCases.forEach(({ description, pathname, expectedBasePaths }) => {
    it(`handles ${description}`, () => {
      window.location.href = `https://not_a_host:80${pathname}`

      expect(getPossibleBaseUris().map(b => b.pathname)).toEqual(
        expectedBasePaths
      )
    })
  })

  it("Calculates possibleBaseUris with StreamlitConfig.BACKEND_BASE_URL if set", () => {
    globalThis.__mockStreamlitConfig.BACKEND_BASE_URL =
      "https://used_host:443/foo/bar"
    window.location.href = "https://unused_host:443/foo/bar"

    const possibleBaseUris = getPossibleBaseUris()
    expect(possibleBaseUris[0]).toMatchObject({
      protocol: "https:",
      hostname: "used_host",
      pathname: "/foo/bar",
    })

    expect(possibleBaseUris[1]).toMatchObject({
      protocol: "https:",
      hostname: "used_host",
      pathname: "/foo",
    })
  })
})

describe("serializeForDisplay", () => {
  it("returns undefined for null", () => {
    expect(serializeForDisplay(null)).toBeUndefined()
  })

  it("returns undefined for undefined", () => {
    expect(serializeForDisplay(undefined)).toBeUndefined()
  })

  it("returns string as-is", () => {
    expect(serializeForDisplay("hello")).toBe("hello")
  })

  it("converts number to string", () => {
    expect(serializeForDisplay(42)).toBe("42")
  })

  it("converts boolean to string", () => {
    expect(serializeForDisplay(true)).toBe("true")
    expect(serializeForDisplay(false)).toBe("false")
  })

  it("pretty-prints object as JSON", () => {
    expect(serializeForDisplay({ foo: "bar" })).toBe('{\n  "foo": "bar"\n}')
  })

  it("pretty-prints array as JSON", () => {
    expect(serializeForDisplay([1, 2, 3])).toBe("[\n  1,\n  2,\n  3\n]")
  })

  it("returns undefined for function", () => {
    expect(serializeForDisplay(() => {})).toBeUndefined()
  })

  it("returns undefined for symbol", () => {
    expect(serializeForDisplay(Symbol("test"))).toBeUndefined()
  })
})

describe("FetchError", () => {
  it("creates error with message and url", () => {
    const error = new FetchError("Test error", "http://example.com")

    expect(error.message).toBe("Test error")
    expect(error.url).toBe("http://example.com")
    expect(error.name).toBe("FetchError")
    expect(error.isTimeout).toBe(false)
    expect(error.isNetworkError).toBe(false)
    expect(error.response).toBeUndefined()
  })

  it("creates timeout error", () => {
    const error = new FetchError("Timeout", "http://example.com", {
      isTimeout: true,
    })

    expect(error.isTimeout).toBe(true)
    expect(error.isNetworkError).toBe(false)
  })

  it("creates network error", () => {
    const error = new FetchError("Network failed", "http://example.com", {
      isNetworkError: true,
    })

    expect(error.isNetworkError).toBe(true)
    expect(error.isTimeout).toBe(false)
  })

  it("creates error with response", () => {
    const error = new FetchError("Server error", "http://example.com", {
      response: {
        status: 500,
        statusText: "Internal Server Error",
        data: { error: "Something went wrong" },
      },
    })

    expect(error.response).toEqual({
      status: 500,
      statusText: "Internal Server Error",
      data: { error: "Something went wrong" },
    })
  })

  it("is an instance of Error", () => {
    const error = new FetchError("Test", "http://example.com")
    expect(error instanceof Error).toBe(true)
    expect(error instanceof FetchError).toBe(true)
  })
})

describe("fetchWithTimeout", () => {
  const mockUrl = "http://example.com/api"

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns data on successful JSON fetch", async () => {
    const mockData = { success: true }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockData)),
    })

    const result = await fetchWithTimeout(mockUrl, 5000)
    expect(result).toEqual({ data: mockData, url: mockUrl })
  })

  it("returns plain text when response is not JSON (e.g., healthz returns 'ok')", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("ok"),
    })

    const result = await fetchWithTimeout(mockUrl, 5000)
    expect(result).toEqual({ data: "ok", url: mockUrl })
  })

  it("throws FetchError with response on HTTP error", async () => {
    const errorData = { error: "Not found" }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: () => Promise.resolve(errorData),
    })

    await expect(fetchWithTimeout(mockUrl, 5000)).rejects.toMatchObject({
      name: "FetchError",
      response: {
        status: 404,
        statusText: "Not Found",
        data: errorData,
      },
    })
  })

  it("correctly passes status 403 for CORS/forbidden errors", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      json: () => Promise.resolve({ message: "Access denied" }),
    })

    await expect(fetchWithTimeout(mockUrl, 5000)).rejects.toMatchObject({
      name: "FetchError",
      response: {
        status: 403,
        statusText: "Forbidden",
        data: { message: "Access denied" },
      },
    })
  })

  it("correctly passes status 0 for no-response scenarios", async () => {
    // Status 0 typically indicates the request was blocked (CORS) or couldn't complete
    // With native fetch this is rare (usually throws TypeError), but we handle it for completeness
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 0,
      statusText: "",
      json: () => Promise.reject(new Error("No body")),
      text: () => Promise.reject(new Error("No body")),
    })

    await expect(fetchWithTimeout(mockUrl, 5000)).rejects.toMatchObject({
      name: "FetchError",
      response: {
        status: 0,
        statusText: "",
        data: null,
      },
    })
  })

  it("falls back to text when JSON parsing fails on error response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("Invalid JSON")),
      text: () => Promise.resolve("Plain text error"),
    })

    await expect(fetchWithTimeout(mockUrl, 5000)).rejects.toMatchObject({
      name: "FetchError",
      response: { data: "Plain text error" },
    })
  })

  it("sets data to null when both JSON and text parsing fail", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("Invalid JSON")),
      text: () => Promise.reject(new Error("Text failed")),
    })

    await expect(fetchWithTimeout(mockUrl, 5000)).rejects.toMatchObject({
      name: "FetchError",
      response: { data: null },
    })
  })

  it("throws FetchError with isTimeout on abort", async () => {
    // Mock fetch to never resolve, forcing the timeout to trigger
    globalThis.fetch = vi.fn().mockImplementation((_url, options) => {
      return new Promise((_, reject) => {
        // Listen to the abort signal and reject when aborted
        options?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"))
        })
      })
    })

    // Use a very short timeout
    await expect(fetchWithTimeout(mockUrl, 10)).rejects.toMatchObject({
      name: "FetchError",
      isTimeout: true,
      message: "Connection timed out",
    })
  })

  it("throws FetchError with isNetworkError on TypeError", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"))

    await expect(fetchWithTimeout(mockUrl, 5000)).rejects.toMatchObject({
      name: "FetchError",
      isNetworkError: true,
      message: "Failed to fetch",
    })
  })

  it("throws FetchError with generic message on unknown error", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error("Something went wrong"))

    await expect(fetchWithTimeout(mockUrl, 5000)).rejects.toMatchObject({
      name: "FetchError",
      message: "Something went wrong",
      isTimeout: false,
      isNetworkError: false,
    })
  })

  it("handles non-Error thrown values", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue("string error")

    await expect(fetchWithTimeout(mockUrl, 5000)).rejects.toMatchObject({
      name: "FetchError",
      message: "Unknown error",
    })
  })

  it("preserves the original url in all error types", async () => {
    const testUrl = "http://test-server.com/healthz"

    // Test HTTP error
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Server Error",
      json: () => Promise.resolve({}),
    })
    await expect(fetchWithTimeout(testUrl, 5000)).rejects.toMatchObject({
      url: testUrl,
    })

    // Test network error
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"))
    await expect(fetchWithTimeout(testUrl, 5000)).rejects.toMatchObject({
      url: testUrl,
    })
  })

  it("clears timeout on successful response", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout")
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ status: "ok" })),
    })

    await fetchWithTimeout(mockUrl, 5000)
    expect(clearTimeoutSpy).toHaveBeenCalled()
  })

  it("clears timeout on error response", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout")
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"))

    await expect(fetchWithTimeout(mockUrl, 5000)).rejects.toThrow()
    expect(clearTimeoutSpy).toHaveBeenCalled()
  })
})

describe("isHostConfigBypassEnabled", () => {
  afterEach(() => {
    globalThis.__mockStreamlitConfig = {}
  })

  it("returns false when StreamlitConfig is empty", () => {
    globalThis.__mockStreamlitConfig = {}
    expect(isHostConfigBypassEnabled()).toBe(false)
  })

  it("returns false when BACKEND_BASE_URL is missing", () => {
    globalThis.__mockStreamlitConfig = {
      HOST_CONFIG: {
        allowedOrigins: ["https://example.com"],
        useExternalAuthToken: true,
      },
    }
    expect(isHostConfigBypassEnabled()).toBe(false)
  })

  it("returns false when HOST_CONFIG is missing", () => {
    globalThis.__mockStreamlitConfig = {
      BACKEND_BASE_URL: "https://backend.example.com",
    }
    expect(isHostConfigBypassEnabled()).toBe(false)
  })

  it("returns false when allowedOrigins is missing", () => {
    globalThis.__mockStreamlitConfig = {
      BACKEND_BASE_URL: "https://backend.example.com",
      HOST_CONFIG: {
        useExternalAuthToken: true,
      },
    }
    expect(isHostConfigBypassEnabled()).toBe(false)
  })

  it("returns false when allowedOrigins is empty array", () => {
    globalThis.__mockStreamlitConfig = {
      BACKEND_BASE_URL: "https://backend.example.com",
      HOST_CONFIG: {
        allowedOrigins: [],
        useExternalAuthToken: true,
      },
    }
    expect(isHostConfigBypassEnabled()).toBe(false)
  })

  it("returns false when allowedOrigins is not an array", () => {
    globalThis.__mockStreamlitConfig = {
      BACKEND_BASE_URL: "https://backend.example.com",
      HOST_CONFIG: {
        // @ts-expect-error - Testing invalid type
        allowedOrigins: "https://example.com",
        useExternalAuthToken: true,
      },
    }
    expect(isHostConfigBypassEnabled()).toBe(false)
  })

  it("returns false when allowedOrigins contains non-string values", () => {
    globalThis.__mockStreamlitConfig = {
      BACKEND_BASE_URL: "https://backend.example.com",
      HOST_CONFIG: {
        // @ts-expect-error - Testing invalid type
        allowedOrigins: ["https://valid.com", 123, null],
        useExternalAuthToken: true,
      },
    }
    expect(isHostConfigBypassEnabled()).toBe(false)
  })

  it("returns false when allowedOrigins contains empty strings", () => {
    globalThis.__mockStreamlitConfig = {
      BACKEND_BASE_URL: "https://backend.example.com",
      HOST_CONFIG: {
        allowedOrigins: ["https://valid.com", ""],
        useExternalAuthToken: true,
      },
    }
    expect(isHostConfigBypassEnabled()).toBe(false)
  })

  it("returns false when allowedOrigins contains only empty strings", () => {
    globalThis.__mockStreamlitConfig = {
      BACKEND_BASE_URL: "https://backend.example.com",
      HOST_CONFIG: {
        allowedOrigins: ["", ""],
        useExternalAuthToken: true,
      },
    }
    expect(isHostConfigBypassEnabled()).toBe(false)
  })

  it("returns false when useExternalAuthToken is missing", () => {
    globalThis.__mockStreamlitConfig = {
      BACKEND_BASE_URL: "https://backend.example.com",
      HOST_CONFIG: {
        allowedOrigins: ["https://example.com"],
      },
    }
    expect(isHostConfigBypassEnabled()).toBe(false)
  })

  it("returns true when all required fields are present with useExternalAuthToken=true", () => {
    globalThis.__mockStreamlitConfig = {
      BACKEND_BASE_URL: "https://backend.example.com",
      HOST_CONFIG: {
        allowedOrigins: ["https://example.com"],
        useExternalAuthToken: true,
      },
    }
    expect(isHostConfigBypassEnabled()).toBe(true)
  })

  it("returns true when all required fields are present with useExternalAuthToken=false", () => {
    globalThis.__mockStreamlitConfig = {
      BACKEND_BASE_URL: "https://backend.example.com",
      HOST_CONFIG: {
        allowedOrigins: ["https://example.com"],
        useExternalAuthToken: false,
      },
    }
    expect(isHostConfigBypassEnabled()).toBe(true)
  })

  it("returns true with multiple allowed origins", () => {
    globalThis.__mockStreamlitConfig = {
      BACKEND_BASE_URL: "https://backend.example.com",
      HOST_CONFIG: {
        allowedOrigins: ["https://example.com", "https://other.example.com"],
        useExternalAuthToken: true,
      },
    }
    expect(isHostConfigBypassEnabled()).toBe(true)
  })

  it("returns true when additional HOST_CONFIG fields are present", () => {
    globalThis.__mockStreamlitConfig = {
      BACKEND_BASE_URL: "https://backend.example.com",
      HOST_CONFIG: {
        allowedOrigins: ["https://example.com"],
        useExternalAuthToken: true,
        metricsUrl: "postMessage",
      },
    }
    expect(isHostConfigBypassEnabled()).toBe(true)
  })
})
