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

import { zip } from "lodash-es"
import { default as WS } from "vitest-websocket-mock"

import { BackMsg } from "@streamlit/protobuf"

import { ConnectionState } from "./ConnectionState"
import {
  CORS_ERROR_MESSAGE_DOCUMENTATION_LINK,
  MAX_RETRIES_BEFORE_CLIENT_ERROR,
  PING_MINIMUM_RETRY_PERIOD_MS,
} from "./constants"
import { doInitPings } from "./DoInitPings"
import { mockEndpoints } from "./testUtils"
import { ErrorDetails, OnRetry } from "./types"
import { Args, WebsocketConnection } from "./WebsocketConnection"

const MOCK_ALLOWED_ORIGINS_CONFIG = {
  allowedOrigins: ["list", "of", "allowed", "origins"],
  useExternalAuthToken: false,
}

const MOCK_HOST_CONFIG_RESPONSE = MOCK_ALLOWED_ORIGINS_CONFIG

const MOCK_HEALTH_RESPONSE = { status: "ok" }

/**
 * Helper to create a successful fetch Response
 */
function createSuccessResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    statusText: "OK",
    headers: { "Content-Type": "application/json" },
  })
}

/**
 * Helper to create an error fetch Response (non-2xx status)
 */
function createErrorResponse(
  status: number,
  statusText: string,
  data?: unknown
): Response {
  return new Response(data ? JSON.stringify(data) : "", {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  })
}

/**
 * Helper to create an AbortError (simulates timeout)
 */
function createAbortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError")
}

/**
 * Helper to create a network error (TypeError from fetch)
 */
function createNetworkError(message = "Failed to fetch"): TypeError {
  return new TypeError(message)
}

// Sets up fetch mock to fail a specific number of times before succeeding
function setupFetchMockWithFailures(
  retryCount: number,
  errorType: "response" | "network" | "timeout",
  responseOptions?: { status: number; statusText: string; data?: unknown }
): typeof fetch {
  const mock = vi.fn()

  // Each "totalTries" increment involves cycling through all URIs
  // Each URI requires 2 fetch calls (health + config)
  // So total failed calls needed = retryCount * numUris * 2
  const totalFailedCalls = retryCount * 2 * 2

  // Setup all the rejected/error calls
  for (let i = 0; i < totalFailedCalls; i++) {
    if (errorType === "timeout") {
      ;(mock as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        createAbortError()
      )
    } else if (errorType === "network") {
      ;(mock as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        createNetworkError()
      )
    } else if (errorType === "response" && responseOptions) {
      ;(mock as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createErrorResponse(
          responseOptions.status,
          responseOptions.statusText,
          responseOptions.data
        )
      )
    }
  }

  // Add final successful calls to break the loop
  ;(mock as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
    createSuccessResponse(MOCK_HEALTH_RESPONSE)
  ) // healthzUri success
  ;(mock as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
    createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE)
  ) // hostConfigUri success

  return mock
}

/** Create mock WebsocketConnection arguments */
function createMockArgs(overrides?: Partial<Args>): Args {
  return {
    getLastSessionId: () => undefined,
    endpoints: mockEndpoints(),
    baseUriPartsList: [
      {
        protocol: "http:",
        hostname: "localhost",
        port: "1234",
        pathname: "/",
      } as URL,
    ],
    onMessage: vi.fn(),
    onConnectionStateChange: vi.fn(),
    onRetry: vi.fn(),
    claimHostAuthToken: () => Promise.resolve(undefined),
    resetHostAuthToken: vi.fn(),
    sendClientError: vi.fn(),
    onHostConfigResp: vi.fn(),
    ...overrides,
  }
}

/** Create a robust fetch mock that handles any number of HTTP requests */
function createFetchMock(): typeof fetch {
  let callCount = 0
  const mock = vi
    .fn<typeof fetch>()
    .mockImplementation(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        callCount++
        // Alternate between health check (empty string) and host config responses
        return Promise.resolve(
          callCount % 2 === 1
            ? createSuccessResponse({})
            : createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE)
        )
      }
    )
  return mock
}

describe("doInitPings", () => {
  const MOCK_PING_DATA = {
    uri: [
      {
        protocol: "http:",
        hostname: "not.a.real.host",
        port: "3000",
        pathname: "/",
      },
      {
        protocol: "http:",
        hostname: "not.a.real.host",
        port: "3001",
        pathname: "/",
      },
    ] as URL[],
    timeoutMs: 10,
    maxTimeoutMs: 100,
    retryCallback: vi.fn(),
    sendClientError: vi.fn(),
    setAllowedOrigins: vi.fn(),
  }

  let originalFetch: typeof globalThis.fetch

  // Helper function to create retry callbacks that advance timers
  const createTimerAdvancingRetryCallback = (
    originalCallback?: typeof MOCK_PING_DATA.retryCallback
  ): OnRetry => {
    const callback: OnRetry = (totalTries, errorDetails, retryTimeout) => {
      if (originalCallback) {
        originalCallback(totalTries, errorDetails, retryTimeout)
      }
      vi.advanceTimersByTime(retryTimeout)
    }
    return vi.fn(callback)
  }

  beforeEach(() => {
    vi.useFakeTimers()
    originalFetch = globalThis.fetch
    MOCK_PING_DATA.retryCallback = vi.fn()
    MOCK_PING_DATA.setAllowedOrigins = vi.fn()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    globalThis.fetch = originalFetch
    globalThis.__mockStreamlitConfig = {}
  })

  it("uses fast-path to connect immediately when enableBypass is true", () => {
    const fetchMock = createFetchMock()
    globalThis.fetch = fetchMock

    const args = createMockArgs({ enableBypass: true })
    const ws = new WebsocketConnection(args)

    // Bypass should transition directly to CONNECTING and attempt to
    // create the websocket without waiting for SERVER_PING_SUCCEEDED.
    expect(
      args.onConnectionStateChange as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledWith(ConnectionState.CONNECTING, undefined)

    ws.disconnect()
  })

  it("calls the /_stcore/health endpoint when pinging server", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HEALTH_RESPONSE))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))

    const { promise } = doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.sendClientError,
      MOCK_PING_DATA.setAllowedOrigins
    )
    const uriIndex = await promise
    expect(uriIndex).toEqual(0)
    expect(MOCK_PING_DATA.setAllowedOrigins).toHaveBeenCalledWith(
      MOCK_ALLOWED_ORIGINS_CONFIG
    )
  })

  it("makes the host config call using StreamlitConfig.HOST_CONFIG_BASE_URL if set", async () => {
    globalThis.__mockStreamlitConfig.HOST_CONFIG_BASE_URL =
      "https://example.com:1234"
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HEALTH_RESPONSE))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))

    const { promise } = doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.sendClientError,
      MOCK_PING_DATA.setAllowedOrigins
    )
    const uriIndex = await promise
    expect(uriIndex).toEqual(0)
    expect(MOCK_PING_DATA.setAllowedOrigins).toHaveBeenCalledWith(
      MOCK_ALLOWED_ORIGINS_CONFIG
    )
    // Verify the second call was to the custom host config URL
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://example.com:1234/_stcore/host-config",
      expect.any(Object)
    )
  })

  it("returns the uri index and sets hostConfig for the first successful ping (0)", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(createSuccessResponse({}))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))

    const { promise } = doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.sendClientError,
      MOCK_PING_DATA.setAllowedOrigins
    )
    const uriIndex = await promise
    expect(uriIndex).toEqual(0)
    expect(MOCK_PING_DATA.setAllowedOrigins).toHaveBeenCalledWith(
      MOCK_ALLOWED_ORIGINS_CONFIG
    )
  })

  it("returns the uri index and sets hostConfig for the first successful ping (1)", async () => {
    globalThis.fetch = vi
      .fn()
      // First Connection attempt - network error
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Second Connection attempt - success
      .mockResolvedValueOnce(createSuccessResponse({}))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))

    const retryCallback = createTimerAdvancingRetryCallback()

    const { promise } = doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      retryCallback,
      MOCK_PING_DATA.sendClientError,
      MOCK_PING_DATA.setAllowedOrigins
    )

    // Run any remaining timers to complete the ping process
    await vi.runAllTimersAsync()
    const uriIndex = await promise

    expect(uriIndex).toEqual(1)
    expect(MOCK_PING_DATA.setAllowedOrigins).toHaveBeenCalledWith(
      MOCK_ALLOWED_ORIGINS_CONFIG
    )
  })

  it("calls retry with the corresponding error message if there was an error", async () => {
    const TEST_ERROR_MESSAGE = "ERROR_MESSAGE"

    globalThis.fetch = vi
      .fn()
      // First Connection attempt - network error with message
      .mockRejectedValueOnce(createNetworkError(TEST_ERROR_MESSAGE))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Second Connection attempt - success
      .mockResolvedValueOnce(createSuccessResponse({}))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))

    const retryCallback = createTimerAdvancingRetryCallback(
      MOCK_PING_DATA.retryCallback
    )

    const { promise } = doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      retryCallback,
      MOCK_PING_DATA.sendClientError,
      MOCK_PING_DATA.setAllowedOrigins
    )

    // Run any remaining timers to complete the ping process
    await vi.runAllTimersAsync()
    await promise

    expect(MOCK_PING_DATA.retryCallback).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        message: expect.stringContaining("Streamlit server is not responding"),
      }),
      expect.anything()
    )
  })

  it("calls retry with 'Connection timed out.' when fetch times out (AbortError)", async () => {
    globalThis.fetch = vi
      .fn()
      // First Connection attempt - timeout
      .mockRejectedValueOnce(createAbortError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Second Connection attempt - success
      .mockResolvedValueOnce(createSuccessResponse({}))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))

    const retryCallback = createTimerAdvancingRetryCallback(
      MOCK_PING_DATA.retryCallback
    )

    const { promise } = doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      retryCallback,
      MOCK_PING_DATA.sendClientError,
      MOCK_PING_DATA.setAllowedOrigins
    )

    // Run any remaining timers to complete the ping process
    await vi.runAllTimersAsync()
    await promise

    expect(MOCK_PING_DATA.retryCallback).toHaveBeenCalledWith(
      1,
      { message: "Connection timed out." },
      expect.anything()
    )
  })

  it("calls retry with 'Streamlit server is not responding. Are you connected to the internet?' when there is a network error", async () => {
    globalThis.fetch = vi
      .fn()
      // First Connection attempt - network error
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Second Connection attempt - success
      .mockResolvedValueOnce(createSuccessResponse({}))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))

    const retryCallback = createTimerAdvancingRetryCallback(
      MOCK_PING_DATA.retryCallback
    )

    const { promise } = doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      retryCallback,
      MOCK_PING_DATA.sendClientError,
      MOCK_PING_DATA.setAllowedOrigins
    )

    // Run any remaining timers to complete the ping process
    await vi.runAllTimersAsync()
    await promise

    expect(MOCK_PING_DATA.retryCallback).toHaveBeenCalledWith(
      1,
      {
        message:
          "Streamlit server is not responding. Are you connected to the internet?",
      },
      expect.anything()
    )
  })

  it("calls retry with corresponding fragment when there is no response from localhost", async () => {
    const MOCK_PING_DATA_LOCALHOST = {
      ...MOCK_PING_DATA,
      uri: [
        {
          protocol: "http:",
          hostname: "localhost",
          port: "3000",
          pathname: "/",
        },
        {
          protocol: "http:",
          hostname: "localhost",
          port: "3001",
          pathname: "/",
        },
      ] as URL[],
    }

    globalThis.fetch = vi
      .fn()
      // First Connection attempt - network error
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Second Connection attempt - success
      .mockResolvedValueOnce(createSuccessResponse({}))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))

    const retryCallback = createTimerAdvancingRetryCallback(
      MOCK_PING_DATA_LOCALHOST.retryCallback
    )

    const { promise } = doInitPings(
      MOCK_PING_DATA_LOCALHOST.uri,
      MOCK_PING_DATA_LOCALHOST.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      retryCallback,
      MOCK_PING_DATA.sendClientError,
      MOCK_PING_DATA.setAllowedOrigins
    )

    // Run any remaining timers to complete the ping process
    await vi.runAllTimersAsync()
    await promise

    expect(MOCK_PING_DATA_LOCALHOST.retryCallback).toHaveBeenCalledWith(
      1,
      expect.anything(),
      expect.anything()
    )
  })

  it("calls retry with corresponding fragment when the status is 403 (forbidden)", async () => {
    const forbiddenMarkdown = `Cannot connect to Streamlit (HTTP status: 403).

If you are trying to access a Streamlit app running on another server, this could be due to the app's [CORS](${CORS_ERROR_MESSAGE_DOCUMENTATION_LINK}) settings.`

    globalThis.fetch = vi
      .fn()
      // First Connection attempt - 403 error
      .mockResolvedValueOnce(createErrorResponse(403, "Forbidden"))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Second Connection attempt - success
      .mockResolvedValueOnce(createSuccessResponse({}))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))

    const retryCallback = createTimerAdvancingRetryCallback(
      MOCK_PING_DATA.retryCallback
    )

    const { promise } = doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      retryCallback,
      MOCK_PING_DATA.sendClientError,
      MOCK_PING_DATA.setAllowedOrigins
    )

    // Run any remaining timers to complete the ping process
    await vi.runAllTimersAsync()
    await promise

    expect(MOCK_PING_DATA.retryCallback).toHaveBeenCalledWith(
      1,
      { message: forbiddenMarkdown },
      expect.anything()
    )
  })

  it("calls retry with 'Connection failed with status ...' for any status code other than 0, 403, and 2xx", async () => {
    globalThis.fetch = vi
      .fn()
      // First Connection attempt - 500 error
      .mockResolvedValueOnce(
        createErrorResponse(500, "Internal Server Error", "TEST_DATA")
      )
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Second Connection attempt - success
      .mockResolvedValueOnce(createSuccessResponse({}))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))

    const retryCallback = createTimerAdvancingRetryCallback(
      MOCK_PING_DATA.retryCallback
    )

    const { promise } = doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      retryCallback,
      MOCK_PING_DATA.sendClientError,
      MOCK_PING_DATA.setAllowedOrigins
    )

    // Run any remaining timers to complete the ping process
    await vi.runAllTimersAsync()
    await promise

    expect(MOCK_PING_DATA.retryCallback).toHaveBeenCalledWith(
      1,
      {
        message: "Connection failed with status 500, and response:",
        codeBlock: "TEST_DATA",
      },
      expect.anything()
    )
  })

  it("calls retry with 'Connection failed with status ...' for any status code other than 0, 403, and 2xx with an object response", async () => {
    const TEST_DATA = { message: "TEST_DATA" }

    globalThis.fetch = vi
      .fn()
      // First Connection attempt - 500 error with object data
      .mockResolvedValueOnce(
        createErrorResponse(500, "Internal Server Error", TEST_DATA)
      )
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Second Connection attempt - success
      .mockResolvedValueOnce(createSuccessResponse({}))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))

    const retryCallback = createTimerAdvancingRetryCallback(
      MOCK_PING_DATA.retryCallback
    )

    const { promise } = doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      retryCallback,
      MOCK_PING_DATA.sendClientError,
      MOCK_PING_DATA.setAllowedOrigins
    )

    // Run any remaining timers to complete the ping process
    await vi.runAllTimersAsync()
    await promise

    expect(MOCK_PING_DATA.retryCallback).toHaveBeenCalledWith(
      1,
      {
        message: "Connection failed with status 500, and response:",
        codeBlock: JSON.stringify(TEST_DATA, null, 2),
      },
      expect.anything()
    )
  })

  it("calls retry with correct total tries", async () => {
    globalThis.fetch = vi
      .fn()
      // First Connection attempt
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Second Connection attempt
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Third Connection attempt
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Fourth Connection attempt
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Fifth Connection attempt
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Final Attempt (to avoid infinite loop)
      .mockResolvedValueOnce(createSuccessResponse({}))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))

    const retryCallback = createTimerAdvancingRetryCallback(
      MOCK_PING_DATA.retryCallback
    )

    const { promise } = doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      retryCallback,
      MOCK_PING_DATA.sendClientError,
      MOCK_PING_DATA.setAllowedOrigins
    )

    // Run any remaining timers to complete the ping process
    await vi.runAllTimersAsync()
    await promise

    expect(MOCK_PING_DATA.retryCallback).toHaveBeenCalledTimes(5)
  })

  it("has increasing but capped retry backoff", async () => {
    globalThis.fetch = vi
      .fn()
      // First Connection attempt
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Second Connection attempt
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Third Connection attempt
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Fourth Connection attempt
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Fifth Connection attempt
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Final Attempt (to avoid infinite loop)
      .mockResolvedValueOnce(createSuccessResponse({}))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))

    const timeouts: number[] = []
    const retryCallback = (
      _times: number,
      _errorDetails: ErrorDetails,
      timeout: number
    ): void => {
      timeouts.push(timeout)
      // Advance timers to allow the next retry to execute
      vi.advanceTimersByTime(timeout)
    }

    const { promise } = doInitPings(
      [
        {
          protocol: "http:",
          hostname: "not.a.real.host",
          port: "3000",
          pathname: "/",
        } as URL,
      ],
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      retryCallback,
      MOCK_PING_DATA.sendClientError,
      MOCK_PING_DATA.setAllowedOrigins
    )

    // Run any remaining timers to complete the ping process
    await vi.runAllTimersAsync()
    await promise

    expect(timeouts.length).toEqual(5)
    expect(timeouts[0]).toEqual(10)
    expect(timeouts[4]).toEqual(100)
    // timeouts should be monotonically increasing until they hit the cap
    expect(
      zip(timeouts.slice(0, -1), timeouts.slice(1)).every(
        // @ts-expect-error
        timePair => timePair[0] < timePair[1] || timePair[0] === 100
      )
    ).toEqual(true)
  })

  it("backs off independently for each target url", async () => {
    globalThis.fetch = vi
      .fn()
      // First Connection attempt
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Second Connection attempt
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Third Connection attempt
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Fourth Connection attempt
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Fifth Connection attempt
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Final Attempt (to avoid infinite loop)
      .mockResolvedValueOnce(createSuccessResponse({}))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))

    const timeouts: number[] = []
    const retryCallback = (
      _times: number,
      _errorDetails: ErrorDetails,
      timeout: number
    ): void => {
      timeouts.push(timeout)
      // Advance timers to allow the next retry to execute
      vi.advanceTimersByTime(timeout)
    }

    const { promise } = doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      retryCallback,
      MOCK_PING_DATA.sendClientError,
      MOCK_PING_DATA.setAllowedOrigins
    )

    // Run any remaining timers to complete the ping process
    await vi.runAllTimersAsync()
    await promise

    expect(timeouts.length).toEqual(5)
    expect(timeouts[0]).toEqual(10)
    expect(timeouts[1]).toEqual(10)
    expect(timeouts[2]).toBeGreaterThan(timeouts[0])
    expect(timeouts[3]).toBeGreaterThan(timeouts[1])
  })

  it("resets timeout each ping call", async () => {
    globalThis.fetch = vi
      .fn()
      // First Connection attempt
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Second Connection attempt
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Third Connection attempt (successful)
      .mockResolvedValueOnce(createSuccessResponse({}))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Fourth Connection attempt
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Fifth Connection attempt
      .mockRejectedValueOnce(createNetworkError())
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))
      // Final Attempt (to avoid infinite loop)
      .mockResolvedValueOnce(createSuccessResponse({}))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))

    const timeouts: number[] = []
    const retryCallback = (
      _times: number,
      _errorDetails: ErrorDetails,
      timeout: number
    ): void => {
      timeouts.push(timeout)
      // Advance timers to allow the next retry to execute
      vi.advanceTimersByTime(timeout)
    }

    const { promise: promise1 } = doInitPings(
      [
        {
          protocol: "http:",
          hostname: "not.a.real.host",
          port: "3000",
          pathname: "/",
        } as URL,
      ],
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      retryCallback,
      MOCK_PING_DATA.sendClientError,
      MOCK_PING_DATA.setAllowedOrigins
    )

    // Run any remaining timers to complete the ping process
    await vi.runAllTimersAsync()
    await promise1

    const timeouts2: number[] = []
    const retryCallback2 = (
      _times: number,
      _errorDetails: ErrorDetails,
      timeout: number
    ): void => {
      timeouts2.push(timeout)
      // Advance timers to allow the next retry to execute
      vi.advanceTimersByTime(timeout)
    }

    const { promise: promise2 } = doInitPings(
      [
        {
          protocol: "http:",
          hostname: "not.a.real.host",
          port: "3000",
          pathname: "/",
        } as URL,
      ],
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      retryCallback2,
      MOCK_PING_DATA.sendClientError,
      MOCK_PING_DATA.setAllowedOrigins
    )

    // Run any remaining timers to complete the ping process
    await vi.runAllTimersAsync()
    await promise2

    expect(timeouts[0]).toEqual(10)
    expect(timeouts[1]).toBeGreaterThan(timeouts[0])
    expect(timeouts2[0]).toEqual(10)
  })

  describe("calls sendClientError when we've reached connection error threshold", () => {
    it("with status = 403 response", async () => {
      const sendClientErrorSpy = vi.fn()

      // We need to mock fetch to simulate connection error threshold
      globalThis.fetch = setupFetchMockWithFailures(
        MAX_RETRIES_BEFORE_CLIENT_ERROR,
        "response",
        { status: 403, statusText: "Forbidden" }
      )

      const retryCallback = createTimerAdvancingRetryCallback()

      const { promise } = doInitPings(
        MOCK_PING_DATA.uri,
        MOCK_PING_DATA.timeoutMs,
        MOCK_PING_DATA.maxTimeoutMs,
        retryCallback,
        sendClientErrorSpy,
        MOCK_PING_DATA.setAllowedOrigins
      )

      // Run any remaining timers to complete the ping process
      await vi.runAllTimersAsync()
      await promise

      expect(sendClientErrorSpy).toHaveBeenCalledWith(
        403,
        "Forbidden",
        expect.any(String)
      )
    })

    it("with status = 500 response", async () => {
      const sendClientErrorSpy = vi.fn()

      // We need to mock fetch to simulate connection error threshold
      globalThis.fetch = setupFetchMockWithFailures(
        MAX_RETRIES_BEFORE_CLIENT_ERROR,
        "response",
        { status: 500, statusText: "Internal Server Error" }
      )

      const retryCallback = createTimerAdvancingRetryCallback()

      const { promise } = doInitPings(
        MOCK_PING_DATA.uri,
        MOCK_PING_DATA.timeoutMs,
        MOCK_PING_DATA.maxTimeoutMs,
        retryCallback,
        sendClientErrorSpy,
        MOCK_PING_DATA.setAllowedOrigins
      )

      // Run any remaining timers to complete the ping process
      await vi.runAllTimersAsync()
      await promise

      expect(sendClientErrorSpy).toHaveBeenCalledWith(
        500,
        "Internal Server Error",
        expect.any(String)
      )
    })

    it("with network error", async () => {
      const sendClientErrorSpy = vi.fn()

      // We need to mock fetch to simulate connection error threshold
      globalThis.fetch = setupFetchMockWithFailures(
        MAX_RETRIES_BEFORE_CLIENT_ERROR,
        "network",
        undefined
      )

      const retryCallback = createTimerAdvancingRetryCallback()

      const { promise } = doInitPings(
        MOCK_PING_DATA.uri,
        MOCK_PING_DATA.timeoutMs,
        MOCK_PING_DATA.maxTimeoutMs,
        retryCallback,
        sendClientErrorSpy,
        MOCK_PING_DATA.setAllowedOrigins
      )

      // Run any remaining timers to complete the ping process
      await vi.runAllTimersAsync()
      await promise

      expect(sendClientErrorSpy).toHaveBeenCalledWith(
        "No response received from server",
        "Network error",
        expect.any(String)
      )
    })
  })
})

describe("WebsocketConnection", () => {
  let client: WebsocketConnection
  let server: WS
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    vi.useFakeTimers()
    server = new WS("ws://localhost:1234/_stcore/stream")

    originalFetch = globalThis.fetch
    globalThis.fetch = createFetchMock()

    client = new WebsocketConnection(createMockArgs())
  })

  afterEach(async () => {
    globalThis.fetch = originalFetch

    // @ts-expect-error
    if (client.websocket) {
      // @ts-expect-error
      client.websocket.close()
    }
    client.disconnect()
    server.close()
    // Drain and clear any pending timers scheduled by connection code
    // We intentionally await all timers to avoid post-teardown callbacks
    await vi.runAllTimersAsync()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it("disconnect closes connection and sets state to DISCONNECTED_FOREVER", () => {
    client.disconnect()

    // @ts-expect-error
    expect(client.state).toBe(ConnectionState.DISCONNECTED_FOREVER)
    // @ts-expect-error
    expect(client.websocket).toBe(undefined)
  })

  it("increments message cache run count", () => {
    const incrementRunCountSpy = vi.spyOn(
      // @ts-expect-error
      client.cache,
      "incrementRunCount"
    )

    const TEST_MAX_MESSAGE_AGE = 10
    client.incrementMessageCacheRunCount(TEST_MAX_MESSAGE_AGE, ["testId"])

    expect(incrementRunCountSpy).toHaveBeenCalledWith(TEST_MAX_MESSAGE_AGE, [
      "testId",
    ])
  })

  it("gets cached message hashes from cache", () => {
    const getCachedMessageHashesSpy = vi
      .spyOn(
        // @ts-expect-error
        client.cache,
        "getCachedMessageHashes"
      )
      .mockReturnValue(["hash1", "hash2"])

    const result = client.getCachedMessageHashes()

    expect(getCachedMessageHashesSpy).toHaveBeenCalledTimes(1)
    expect(result).toEqual(["hash1", "hash2"])
  })

  it("sends message with correct arguments", async () => {
    // Advance fake timers to allow connection process to complete
    await vi.runAllTimersAsync()
    await server.connected

    // @ts-expect-error
    const sendSpy = vi.spyOn(client.websocket, "send")

    const TEST_BACK_MSG = {}
    client.sendMessage(TEST_BACK_MSG)

    const msg = BackMsg.create(TEST_BACK_MSG)
    const buffer = BackMsg.encode(msg).finish()

    expect(sendSpy).toHaveBeenCalledWith(buffer)
  })

  describe("getBaseUriParts", () => {
    it("returns correct base uri parts when ConnectionState == Connected", () => {
      // @ts-expect-error
      client.state = ConnectionState.CONNECTED

      expect(client.getBaseUriParts()).toEqual(
        createMockArgs().baseUriPartsList[0]
      )
    })

    it("returns undefined when ConnectionState != Connected", () => {
      expect(client.getBaseUriParts()).toBeUndefined()
    })
  })
})

describe("WebsocketConnection auth token handling", () => {
  let originalFetch: typeof globalThis.fetch

  let websocketSpy: (url: string, protocols?: string | string[]) => void
  let originalWebSocket: typeof WebSocket
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  let pingServerSpy: any

  class MockWebSocket {
    public url: string
    public protocols?: string | string[]
    public binaryType = "blob"
    public readyState = 0

    constructor(url: string, protocols?: string | string[]) {
      this.url = url
      this.protocols = protocols
    }

    public addEventListener(
      _type: string,
      _listener: (event: Event) => void
    ): void {
      // No-op: auth tests only care that listeners can be registered
    }

    public close(): void {
      this.readyState = 3
    }

    public send(_data: unknown): void {
      // No-op: auth tests don't assert on sent data
    }
  }

  beforeEach(() => {
    websocketSpy = vi.fn()
    originalWebSocket = globalThis.WebSocket

    // Provide a minimal WebSocket implementation for auth tests that
    // records constructor arguments and supports the methods our code uses.
    const MockWebSocketWithSpy = class extends MockWebSocket {
      constructor(url: string, protocols?: string | string[]) {
        websocketSpy(url, protocols)
        super(url, protocols)
      }
    }

    globalThis.WebSocket = MockWebSocketWithSpy as unknown as typeof WebSocket

    originalFetch = globalThis.fetch
    globalThis.fetch = createFetchMock()

    // Prevent the internal ping loop from scheduling timers or websockets
    // for these auth-only tests.
    pingServerSpy = vi
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
      .spyOn(WebsocketConnection.prototype as any, "pingServer")
      .mockResolvedValue(undefined)
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    globalThis.WebSocket = originalWebSocket
    pingServerSpy.mockRestore()
  })

  it("always sets first Sec-WebSocket-Protocol option to 'streamlit'", async () => {
    const resetHostAuthToken = vi.fn()
    const ws = new WebsocketConnection(createMockArgs({ resetHostAuthToken }))

    // Set correct state for this action
    // @ts-expect-error
    ws.state = ConnectionState.CONNECTING
    // @ts-expect-error
    await ws.connectToWebSocket()

    expect(websocketSpy).toHaveBeenCalledWith(
      "ws://localhost:1234/_stcore/stream",
      ["streamlit", "PLACEHOLDER_AUTH_TOKEN"]
    )
    expect(resetHostAuthToken).toHaveBeenCalledTimes(1)
  })

  it("sets second Sec-WebSocket-Protocol option to value from claimHostAuthToken", async () => {
    const resetHostAuthToken = vi.fn()
    const ws = new WebsocketConnection(
      createMockArgs({
        claimHostAuthToken: () => Promise.resolve("iAmAnAuthToken"),
        resetHostAuthToken,
      })
    )

    // Set correct state for this action
    // @ts-expect-error
    ws.state = ConnectionState.CONNECTING
    // @ts-expect-error
    await ws.connectToWebSocket()

    expect(websocketSpy).toHaveBeenCalledWith(
      "ws://localhost:1234/_stcore/stream",
      ["streamlit", "iAmAnAuthToken"]
    )
  })

  it("sets third Sec-WebSocket-Protocol option to lastSessionId if available", async () => {
    const ws = new WebsocketConnection(
      createMockArgs({ getLastSessionId: () => "lastSessionId" })
    )

    // Set correct state for this action
    // @ts-expect-error
    ws.state = ConnectionState.CONNECTING
    // @ts-expect-error
    await ws.connectToWebSocket()

    // "lastSessionId" should be the WebSocket's session token
    expect(websocketSpy).toHaveBeenCalledWith(
      "ws://localhost:1234/_stcore/stream",
      ["streamlit", "PLACEHOLDER_AUTH_TOKEN", "lastSessionId"]
    )
  })

  it("sets both host provided auth token and lastSessionId if both set", async () => {
    const resetHostAuthToken = vi.fn()
    const ws = new WebsocketConnection(
      createMockArgs({
        getLastSessionId: () => "lastSessionId",
        claimHostAuthToken: () => Promise.resolve("iAmAnAuthToken"),
        resetHostAuthToken,
      })
    )

    // Set correct state for this action
    // @ts-expect-error
    ws.state = ConnectionState.CONNECTING

    // @ts-expect-error
    await ws.connectToWebSocket()

    expect(websocketSpy).toHaveBeenCalledWith(
      "ws://localhost:1234/_stcore/stream",
      ["streamlit", "iAmAnAuthToken", "lastSessionId"]
    )
    expect(resetHostAuthToken).toHaveBeenCalledTimes(1)
  })
})

describe("WebsocketConnection FSM fast-path behavior", () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    vi.useFakeTimers()
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    globalThis.fetch = originalFetch
    globalThis.__mockStreamlitConfig = {}
  })

  it("uses default path (PINGING_SERVER) when enableBypass is false", () => {
    globalThis.fetch = createFetchMock()

    const args = createMockArgs({ enableBypass: false })
    const ws = new WebsocketConnection(args)

    // Should transition to PINGING_SERVER, not CONNECTING
    expect(
      args.onConnectionStateChange as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledWith(ConnectionState.PINGING_SERVER, undefined)

    ws.disconnect()
  })

  it("runs background pings and calls onHostConfigResp in fast-path mode", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HEALTH_RESPONSE))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))

    const args = createMockArgs({ enableBypass: true })
    const ws = new WebsocketConnection(args)

    // Bypass: should be in CONNECTING immediately
    expect(
      args.onConnectionStateChange as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledWith(ConnectionState.CONNECTING, undefined)

    // Flush the microtask queue to allow the fetch promises to resolve
    await vi.advanceTimersByTimeAsync(0)

    // onHostConfigResp should have been called by background pings
    expect(args.onHostConfigResp).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedOrigins: expect.any(Array),
      })
    )

    ws.disconnect()
  })

  it("does not transition to PINGING_SERVER in fast-path mode", () => {
    globalThis.fetch = createFetchMock()

    const args = createMockArgs({ enableBypass: true })
    const ws = new WebsocketConnection(args)

    const stateChangeCalls = (
      args.onConnectionStateChange as ReturnType<typeof vi.fn>
    ).mock.calls

    // Should NOT have called with PINGING_SERVER
    const hasPingingState = stateChangeCalls.some(
      call => call[0] === ConnectionState.PINGING_SERVER
    )
    expect(hasPingingState).toBe(false)

    ws.disconnect()
  })

  it("keeps retrying background pings on failure without disconnecting", async () => {
    // Simulate persistent network failure for pings
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("Network error"))

    const args = createMockArgs({ enableBypass: true })
    const ws = new WebsocketConnection(args)

    // Should start in CONNECTING
    expect(
      args.onConnectionStateChange as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledWith(ConnectionState.CONNECTING, undefined)

    // Allow background pings to fail and retry multiple times
    await vi.advanceTimersByTimeAsync(0)

    // Allow time for several retries
    for (let i = 0; i < MAX_RETRIES_BEFORE_CLIENT_ERROR + 2; i++) {
      await vi.advanceTimersByTimeAsync(PING_MINIMUM_RETRY_PERIOD_MS + 100)
    }

    // onRetry should have been called multiple times (background pings keep retrying)
    expect(args.onRetry).toHaveBeenCalled()

    // Should still be in CONNECTING (not disconnected)
    // Background pings retry indefinitely, they don't cause FATAL_ERROR
    const stateChangeCalls = (
      args.onConnectionStateChange as ReturnType<typeof vi.fn>
    ).mock.calls
    const hasDisconnectedState = stateChangeCalls.some(
      call => call[0] === ConnectionState.DISCONNECTED_FOREVER
    )
    expect(hasDisconnectedState).toBe(false)

    ws.disconnect()
  })

  it("calls onRetry when background pings fail and retry", async () => {
    // First call fails, subsequent calls succeed
    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Network error"))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HEALTH_RESPONSE))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))

    const args = createMockArgs({ enableBypass: true })
    const ws = new WebsocketConnection(args)

    // Allow initial failure and retry
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(PING_MINIMUM_RETRY_PERIOD_MS + 100)

    // onRetry should have been called
    expect(args.onRetry).toHaveBeenCalled()

    ws.disconnect()
  })

  it("successfully retrieves full config when background pings succeed", async () => {
    // Both endpoints succeed
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HEALTH_RESPONSE))
      .mockResolvedValueOnce(createSuccessResponse(MOCK_HOST_CONFIG_RESPONSE))

    const args = createMockArgs({ enableBypass: true })
    const ws = new WebsocketConnection(args)

    // Allow background pings to complete
    await vi.advanceTimersByTimeAsync(0)

    // onHostConfigResp should be called with config from endpoint
    expect(args.onHostConfigResp).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedOrigins: expect.any(Array),
      })
    )

    // Should stay connected since pings succeeded
    const stateChangeCalls = (
      args.onConnectionStateChange as ReturnType<typeof vi.fn>
    ).mock.calls
    const hasDisconnectedState = stateChangeCalls.some(
      call => call[0] === ConnectionState.DISCONNECTED_FOREVER
    )
    expect(hasDisconnectedState).toBe(false)

    ws.disconnect()
  })

  it("handles background ping cancellation gracefully on disconnect", async () => {
    globalThis.fetch = vi
      .fn()
      .mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () => resolve(createSuccessResponse(MOCK_HEALTH_RESPONSE)),
              1000
            )
          )
      )

    const args = createMockArgs({ enableBypass: true })
    const ws = new WebsocketConnection(args)

    // Start background pings
    await vi.advanceTimersByTimeAsync(0)

    // Disconnect before pings complete
    ws.disconnect()

    // Should transition to DISCONNECTED_FOREVER
    expect(
      args.onConnectionStateChange as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledWith(ConnectionState.DISCONNECTED_FOREVER, undefined)
  })

  it("does not orphan ping request when bypass transitions to PINGING_SERVER", async () => {
    // This test verifies the race condition fix where:
    // 1. Bypass mode starts background pings (stores ping request)
    // 2. We manually transition to PINGING_SERVER (simulating WS failure)
    // 3. New pingServer() is called (starts new ping request)
    // 4. Background ping's finally block runs but should NOT clear new ping request
    // 5. disconnect() should successfully cancel the active request

    // Mock fetch to return pending promises (never resolve)
    // This simulates slow pings that get cancelled
    const backgroundPingPromise = new Promise(() => {
      /* never resolves */
    })
    const foregroundPingPromise = new Promise(() => {
      /* never resolves */
    })

    globalThis.fetch = vi
      .fn()
      // First two calls are for background ping (health + host-config)
      .mockReturnValueOnce(backgroundPingPromise as Promise<Response>)
      .mockReturnValueOnce(backgroundPingPromise as Promise<Response>)
      // Next two calls are for foreground ping after transition
      .mockReturnValueOnce(foregroundPingPromise as Promise<Response>)
      .mockReturnValueOnce(foregroundPingPromise as Promise<Response>)

    const args = createMockArgs({ enableBypass: true })
    const ws = new WebsocketConnection(args)

    // Should start in CONNECTING (bypass mode)
    expect(
      args.onConnectionStateChange as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledWith(ConnectionState.CONNECTING, undefined)

    // Allow background pings to start
    await vi.advanceTimersByTimeAsync(0)

    // Manually trigger transition to PINGING_SERVER (simulating WS connection failure)
    // This will start a new ping request via pingServer()
    // @ts-expect-error - Accessing private method for testing
    ws.stepFsm("CONNECTION_ERROR", "Simulated connection failure")

    // Allow new ping to start
    await vi.advanceTimersByTimeAsync(0)

    // Should have transitioned to PINGING_SERVER
    const stateChangeCalls = (
      args.onConnectionStateChange as ReturnType<typeof vi.fn>
    ).mock.calls
    const hasPingingState = stateChangeCalls.some(
      call => call[0] === ConnectionState.PINGING_SERVER
    )
    expect(hasPingingState).toBe(true)

    // Now disconnect - this should successfully cancel the active ping request
    // If the race condition existed, the background ping's finally would have
    // cleared this.pingRequest, making it undefined and unable to cancel
    ws.disconnect()

    // Verify we transitioned to DISCONNECTED_FOREVER (no errors thrown)
    expect(
      args.onConnectionStateChange as ReturnType<typeof vi.fn>
    ).toHaveBeenCalledWith(ConnectionState.DISCONNECTED_FOREVER, undefined)

    // The test passing without errors verifies the fix works correctly
  })
})
