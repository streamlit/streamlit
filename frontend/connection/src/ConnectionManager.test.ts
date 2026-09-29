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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BackMsg } from "@streamlit/protobuf"

// We need to test the ConnectionManager class directly, but it starts connecting
// immediately in the constructor. We'll mock the WebsocketConnection to prevent
// actual connections.
vi.mock("./WebsocketConnection", () => {
  return {
    WebsocketConnection: class MockWebsocketConnection {
      disconnect = vi.fn()
      reconnect = vi.fn()
      sendMessage = vi.fn()
      getBaseUriParts = vi.fn()
      incrementMessageCacheRunCount = vi.fn()
      getCachedMessageHashes = vi.fn().mockReturnValue([])
    },
  }
})

vi.mock("./StaticConnection", () => ({
  establishStaticConnection: vi.fn(),
}))

// Import after mocks are set up
import { ConnectionManager } from "./ConnectionManager"
import { ConnectionState } from "./ConnectionState"
import { MAX_RETRIES_BEFORE_CLIENT_ERROR } from "./constants"
import { establishStaticConnection } from "./StaticConnection"
import { mockEndpoints } from "./testUtils"
import { ErrorDetails } from "./types"
import { WebsocketConnection } from "./WebsocketConnection"

/**
 * Test timeout for heartbeat acknowledgment in milliseconds.
 * This simulates a typical timeout that a host might configure via the
 * ackTimeoutMilliseconds field in the SEND_APP_HEARTBEAT message.
 */
const TEST_HEARTBEAT_ACK_TIMEOUT_MS = 59 * 1000

describe("ConnectionManager heartbeat functionality", () => {
  let connectionManager: ConnectionManager

  beforeEach(() => {
    vi.useFakeTimers()

    connectionManager = new ConnectionManager({
      getLastSessionId: () => undefined,
      endpoints: mockEndpoints(),
      onMessage: vi.fn(),
      onConnectionError: vi.fn(),
      connectionStateChanged: vi.fn(),
      claimHostAuthToken: () => Promise.resolve(undefined),
      resetHostAuthToken: vi.fn(),
      sendClientError: vi.fn(),
      onHostConfigResp: vi.fn(),
    })

    // Simulate that the connection is established
    // Access private property via type casting for testing
    ;(
      connectionManager as unknown as { connectionState: ConnectionState }
    ).connectionState = ConnectionState.CONNECTED
  })

  afterEach(() => {
    connectionManager.disconnect()
    vi.clearAllTimers()
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  /**
   * Helper to get the mock WebsocketConnection instance from the ConnectionManager.
   */
  function getMockWebsocketConnection(): WebsocketConnection {
    return (
      connectionManager as unknown as {
        websocketConnection: WebsocketConnection
      }
    ).websocketConnection
  }

  describe("onHeartbeatSent", () => {
    it("starts a timeout when heartbeat is sent with ackTimeoutMilliseconds > 0", () => {
      const wsConnection = getMockWebsocketConnection()
      const timerCountBefore = vi.getTimerCount()

      connectionManager.onHeartbeatSent(TEST_HEARTBEAT_ACK_TIMEOUT_MS)

      expect(vi.getTimerCount()).toBe(timerCountBefore + 1)
      expect(wsConnection.reconnect).not.toHaveBeenCalled()

      // Advance time but not past the timeout
      vi.advanceTimersByTime(TEST_HEARTBEAT_ACK_TIMEOUT_MS - 1000)
      expect(wsConnection.reconnect).not.toHaveBeenCalled()
    })

    it("does not start a timeout when heartbeat is sent with ackTimeoutMilliseconds=0", () => {
      const wsConnection = getMockWebsocketConnection()
      const timerCountBefore = vi.getTimerCount()

      connectionManager.onHeartbeatSent(0)

      expect(vi.getTimerCount()).toBe(timerCountBefore)

      // Advance past the timeout duration and verify that reconnect wasn't called anyway.
      vi.advanceTimersByTime(TEST_HEARTBEAT_ACK_TIMEOUT_MS + 1000)
      expect(wsConnection.reconnect).not.toHaveBeenCalled()
    })

    it("attempts reconnect when heartbeat ack is not received within timeout", () => {
      const wsConnection = getMockWebsocketConnection()
      connectionManager.onHeartbeatSent(TEST_HEARTBEAT_ACK_TIMEOUT_MS)

      vi.advanceTimersByTime(TEST_HEARTBEAT_ACK_TIMEOUT_MS + 100)
      expect(wsConnection.reconnect).toHaveBeenCalledTimes(1)
    })

    it("clears previous timeout when new heartbeat is sent", () => {
      const wsConnection = getMockWebsocketConnection()

      // Send first heartbeat
      connectionManager.onHeartbeatSent(TEST_HEARTBEAT_ACK_TIMEOUT_MS)

      // Advance time but not past the timeout
      vi.advanceTimersByTime(TEST_HEARTBEAT_ACK_TIMEOUT_MS - 5000)

      // Send second heartbeat (should reset the timer)
      connectionManager.onHeartbeatSent(TEST_HEARTBEAT_ACK_TIMEOUT_MS)

      // Advance time past the original timeout but not the new one
      vi.advanceTimersByTime(10000)

      // Should NOT have attempted reconnect yet
      expect(wsConnection.reconnect).not.toHaveBeenCalled()

      // Advance time past the new timeout
      vi.advanceTimersByTime(TEST_HEARTBEAT_ACK_TIMEOUT_MS)

      // Now should have attempted reconnect
      expect(wsConnection.reconnect).toHaveBeenCalledTimes(1)
    })
  })

  describe("onHeartbeatAckReceived", () => {
    it("clears the timeout when ack is received", () => {
      const wsConnection = getMockWebsocketConnection()

      connectionManager.onHeartbeatSent(TEST_HEARTBEAT_ACK_TIMEOUT_MS)

      // Receive ack before timeout
      vi.advanceTimersByTime(5000)
      connectionManager.onHeartbeatAckReceived()

      // Advance past the original timeout
      vi.advanceTimersByTime(TEST_HEARTBEAT_ACK_TIMEOUT_MS)

      // Should NOT have attempted reconnect
      expect(wsConnection.reconnect).not.toHaveBeenCalled()
    })

    it("does not error when ack is received without pending heartbeat", () => {
      const wsConnection = getMockWebsocketConnection()

      // Calling onHeartbeatAckReceived without onHeartbeatSent should not throw
      expect(() => connectionManager.onHeartbeatAckReceived()).not.toThrow()
      expect(wsConnection.reconnect).not.toHaveBeenCalled()
    })
  })

  describe("disconnect", () => {
    it("clears heartbeat timeout on disconnect", () => {
      const wsConnection = getMockWebsocketConnection()

      connectionManager.onHeartbeatSent(TEST_HEARTBEAT_ACK_TIMEOUT_MS)

      // Disconnect before timeout
      connectionManager.disconnect()

      // Advance past the timeout
      vi.advanceTimersByTime(TEST_HEARTBEAT_ACK_TIMEOUT_MS + 1000)

      // Should NOT have attempted reconnect (timeout was cleared by disconnect)
      expect(wsConnection.reconnect).not.toHaveBeenCalled()
    })
  })

  describe("connection state handling", () => {
    it("does not attempt reconnect if already disconnected", () => {
      const wsConnection = getMockWebsocketConnection()

      // Set connection state to disconnected
      ;(
        connectionManager as unknown as { connectionState: ConnectionState }
      ).connectionState = ConnectionState.DISCONNECTED_FOREVER

      connectionManager.onHeartbeatSent(TEST_HEARTBEAT_ACK_TIMEOUT_MS)

      // Advance past the timeout
      vi.advanceTimersByTime(TEST_HEARTBEAT_ACK_TIMEOUT_MS + 100)

      // Should NOT have attempted reconnect (already disconnected)
      expect(wsConnection.reconnect).not.toHaveBeenCalled()
    })

    it("clears heartbeat timeout when leaving CONNECTED state", () => {
      const wsConnection = getMockWebsocketConnection()

      // Send a heartbeat while connected
      connectionManager.onHeartbeatSent(TEST_HEARTBEAT_ACK_TIMEOUT_MS)

      // Get access to setConnectionState via the private property
      const setConnectionState = (
        connectionManager as unknown as {
          setConnectionState: (state: ConnectionState) => void
        }
      ).setConnectionState

      // Transition away from CONNECTED (e.g., to PINGING_SERVER during reconnect)
      setConnectionState(ConnectionState.PINGING_SERVER)

      // Advance past the timeout
      vi.advanceTimersByTime(TEST_HEARTBEAT_ACK_TIMEOUT_MS + 1000)

      // Should NOT have attempted reconnect (timeout was cleared by state transition)
      expect(wsConnection.reconnect).not.toHaveBeenCalled()
    })
  })
})

type CMProps = ConstructorParameters<typeof ConnectionManager>[0]

/** Stub every required prop so a ConnectionManager can be constructed. */
function buildProps(overrides: Partial<CMProps> = {}): CMProps {
  return {
    getLastSessionId: () => undefined,
    endpoints: mockEndpoints(),
    onMessage: vi.fn(),
    onConnectionError: vi.fn(),
    connectionStateChanged: vi.fn(),
    claimHostAuthToken: () => Promise.resolve(undefined),
    resetHostAuthToken: vi.fn(),
    sendClientError: vi.fn(),
    onHostConfigResp: vi.fn(),
    ...overrides,
  }
}

/**
 * Typed view onto a ConnectionManager's private members so individual tests
 * don't have to repeat the `as unknown as { ... }` cast.
 */
interface CMInternals {
  websocketConnection: WebsocketConnection | null
  connectionState: ConnectionState
  setConnectionState: (state: ConnectionState, err?: ErrorDetails) => void
  showRetryError: (
    totalRetries: number,
    latestError: ErrorDetails,
    retryTimeout: number
  ) => void
}

const internals = (cm: ConnectionManager): CMInternals =>
  cm as unknown as CMInternals

/** Read the underlying mocked WebsocketConnection (asserts it is set). */
const getWs = (cm: ConnectionManager): WebsocketConnection =>
  internals(cm).websocketConnection as WebsocketConnection

describe("ConnectionManager websocket delegation", () => {
  let connectionManager: ConnectionManager

  beforeEach(async () => {
    connectionManager = new ConnectionManager(buildProps())
    /** connect() awaits connectToRunningServer; flush the microtask so
     * websocketConnection is assigned before tests read it. */
    await Promise.resolve()
  })

  afterEach(() => {
    connectionManager.disconnect()
    vi.clearAllMocks()
  })

  describe("getBaseUriParts", () => {
    it("returns baseUriParts from the underlying WebsocketConnection", () => {
      const ws = getWs(connectionManager)
      const fakeUrl = new URL("http://example.com:8501/")
      vi.mocked(ws.getBaseUriParts).mockReturnValue(fakeUrl)

      expect(connectionManager.getBaseUriParts()).toBe(fakeUrl)
      expect(ws.getBaseUriParts).toHaveBeenCalledTimes(1)
    })

    it("returns undefined when there is no WebsocketConnection (e.g. static)", () => {
      internals(connectionManager).websocketConnection = null

      expect(connectionManager.getBaseUriParts()).toBeUndefined()
    })
  })

  describe("sendMessage", () => {
    const msg = new BackMsg({ stopScript: true })

    it("forwards the message to the WebsocketConnection when connected", () => {
      const ws = getWs(connectionManager)
      internals(connectionManager).connectionState = ConnectionState.CONNECTED

      connectionManager.sendMessage(msg)

      expect(ws.sendMessage).toHaveBeenCalledTimes(1)
      expect(ws.sendMessage).toHaveBeenCalledWith(msg)
    })

    it("does not forward the message when disconnected", () => {
      const ws = getWs(connectionManager)
      internals(connectionManager).connectionState =
        ConnectionState.DISCONNECTED_FOREVER

      connectionManager.sendMessage(msg)

      expect(ws.sendMessage).not.toHaveBeenCalled()
    })

    it("does not forward the message when there is no WebsocketConnection", () => {
      const ws = getWs(connectionManager)
      internals(connectionManager).websocketConnection = null
      internals(connectionManager).connectionState = ConnectionState.CONNECTED

      connectionManager.sendMessage(msg)

      expect(ws.sendMessage).not.toHaveBeenCalled()
    })
  })

  describe("incrementMessageCacheRunCount", () => {
    it("forwards to the WebsocketConnection when connected via websocket", () => {
      const ws = getWs(connectionManager)

      connectionManager.incrementMessageCacheRunCount(123, [
        "frag-1",
        "frag-2",
      ])

      expect(ws.incrementMessageCacheRunCount).toHaveBeenCalledTimes(1)
      expect(ws.incrementMessageCacheRunCount).toHaveBeenCalledWith(123, [
        "frag-1",
        "frag-2",
      ])
    })

    it("is a no-op when not connected via websocket (e.g. static)", () => {
      const ws = getWs(connectionManager)
      internals(connectionManager).websocketConnection = null

      expect(() =>
        connectionManager.incrementMessageCacheRunCount(50, [])
      ).not.toThrow()
      expect(ws.incrementMessageCacheRunCount).not.toHaveBeenCalled()
    })
  })

  describe("getCachedMessageHashes", () => {
    it("returns hashes from the WebsocketConnection cache", () => {
      const ws = getWs(connectionManager)
      vi.mocked(ws.getCachedMessageHashes).mockReturnValue([
        "hash-1",
        "hash-2",
      ])

      expect(connectionManager.getCachedMessageHashes()).toEqual([
        "hash-1",
        "hash-2",
      ])
      expect(ws.getCachedMessageHashes).toHaveBeenCalledTimes(1)
    })

    it("returns an empty array when not connected via websocket (e.g. static)", () => {
      const ws = getWs(connectionManager)
      internals(connectionManager).websocketConnection = null

      expect(connectionManager.getCachedMessageHashes()).toEqual([])
      expect(ws.getCachedMessageHashes).not.toHaveBeenCalled()
    })
  })
})

describe("ConnectionManager static connection path", () => {
  let checkStaticConnectionSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Spy on the private method to simulate a `?staticAppId=abc` query param.
    // Mutating window.location is brittle since document.location is read
    // inside checkStaticConnection.
    checkStaticConnectionSpy = vi
      .spyOn(
        ConnectionManager.prototype as unknown as {
          checkStaticConnection: () => string | null
        },
        "checkStaticConnection"
      )
      .mockReturnValue("abc")
    vi.mocked(establishStaticConnection).mockReset()
  })

  afterEach(() => {
    checkStaticConnectionSpy.mockRestore()
    vi.clearAllMocks()
  })

  it("calls establishStaticConnection and leaves websocketConnection null", async () => {
    const onMessage = vi.fn()
    const onConnectionError = vi.fn()
    const endpoints = mockEndpoints()

    const connectionManager = new ConnectionManager(
      buildProps({ onMessage, onConnectionError, endpoints })
    )

    // Flush microtasks queued by the async connect() so the static branch settles.
    await Promise.resolve()

    expect(establishStaticConnection).toHaveBeenCalledTimes(1)
    expect(establishStaticConnection).toHaveBeenCalledWith(
      "abc",
      expect.any(Function),
      onMessage,
      onConnectionError,
      endpoints
    )
    expect(internals(connectionManager).websocketConnection).toBeNull()
    expect(connectionManager.getBaseUriParts()).toBeUndefined()
  })
})

describe("ConnectionManager websocket error path", () => {
  let connectToRunningServerSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    connectToRunningServerSpy = vi
      .spyOn(
        ConnectionManager.prototype as unknown as {
          connectToRunningServer: () => WebsocketConnection
        },
        "connectToRunningServer"
      )
      .mockImplementation(() => {
        throw new Error("ws boom")
      })
  })

  afterEach(() => {
    connectToRunningServerSpy.mockRestore()
    vi.clearAllMocks()
  })

  it("reports the failure via sendClientError and DISCONNECTED_FOREVER", async () => {
    const sendClientError = vi.fn()
    const onConnectionError = vi.fn()
    const connectionStateChanged = vi.fn()

    new ConnectionManager(
      buildProps({
        sendClientError,
        onConnectionError,
        connectionStateChanged,
      })
    )

    await Promise.resolve()

    expect(sendClientError).toHaveBeenCalledWith(
      "Failed to establish websocket connection",
      "ws boom",
      "Connection Manager"
    )
    expect(onConnectionError).toHaveBeenCalledWith({ message: "ws boom" })
    expect(connectionStateChanged).toHaveBeenCalledWith(
      ConnectionState.DISCONNECTED_FOREVER
    )
    expect(establishStaticConnection).not.toHaveBeenCalled()
  })

  it("wraps non-Error throws into an Error before reporting", async () => {
    connectToRunningServerSpy.mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw "string-failure"
    })
    const sendClientError = vi.fn()
    const onConnectionError = vi.fn()

    new ConnectionManager(buildProps({ sendClientError, onConnectionError }))

    await Promise.resolve()

    expect(sendClientError).toHaveBeenCalledWith(
      "Failed to establish websocket connection",
      "string-failure",
      "Connection Manager"
    )
    expect(onConnectionError).toHaveBeenCalledWith({
      message: "string-failure",
    })
  })
})

describe("ConnectionManager setConnectionState", () => {
  let connectionManager: ConnectionManager
  const connectionStateChanged = vi.fn<(state: ConnectionState) => void>()
  const onConnectionError = vi.fn<(err: ErrorDetails) => void>()

  beforeEach(() => {
    connectionStateChanged.mockReset()
    onConnectionError.mockReset()
    connectionManager = new ConnectionManager(
      buildProps({ connectionStateChanged, onConnectionError })
    )
    // Force a known starting state and reset mocks captured during construction.
    internals(connectionManager).connectionState = ConnectionState.CONNECTED
    connectionStateChanged.mockClear()
    onConnectionError.mockClear()
  })

  afterEach(() => {
    connectionManager.disconnect()
    vi.clearAllMocks()
  })

  it("invokes onConnectionError with errMsg even when the state is unchanged", () => {
    const errMsg: ErrorDetails = { message: "transient hiccup" }
    internals(connectionManager).setConnectionState(
      ConnectionState.CONNECTED,
      errMsg
    )

    expect(onConnectionError).toHaveBeenCalledTimes(1)
    expect(onConnectionError).toHaveBeenCalledWith(errMsg)
    expect(connectionStateChanged).not.toHaveBeenCalled()
  })

  it("does not invoke onConnectionError when no errMsg is provided", () => {
    internals(connectionManager).setConnectionState(ConnectionState.CONNECTED)

    expect(onConnectionError).not.toHaveBeenCalled()
    expect(connectionStateChanged).not.toHaveBeenCalled()
    expect(internals(connectionManager).connectionState).toBe(
      ConnectionState.CONNECTED
    )
  })

  it("invokes connectionStateChanged when the state actually changes", () => {
    internals(connectionManager).setConnectionState(
      ConnectionState.PINGING_SERVER
    )

    expect(connectionStateChanged).toHaveBeenCalledTimes(1)
    expect(connectionStateChanged).toHaveBeenCalledWith(
      ConnectionState.PINGING_SERVER
    )
    expect(onConnectionError).not.toHaveBeenCalled()
  })
})

describe("ConnectionManager showRetryError", () => {
  let connectionManager: ConnectionManager
  const onConnectionError = vi.fn<(err: ErrorDetails) => void>()

  beforeEach(() => {
    onConnectionError.mockReset()
    connectionManager = new ConnectionManager(
      buildProps({ onConnectionError })
    )
  })

  afterEach(() => {
    connectionManager.disconnect()
    vi.clearAllMocks()
  })

  it.each([
    ["at the threshold", MAX_RETRIES_BEFORE_CLIENT_ERROR, 0],
    ["above the threshold", MAX_RETRIES_BEFORE_CLIENT_ERROR + 5, 1000],
  ])(
    "reports the error when retries are %s",
    (_label, totalRetries, timeout) => {
      const latestError: ErrorDetails = { message: "ping failed" }
      internals(connectionManager).showRetryError(
        totalRetries,
        latestError,
        timeout
      )

      expect(onConnectionError).toHaveBeenCalledTimes(1)
      expect(onConnectionError).toHaveBeenCalledWith(latestError)
    }
  )

  it("does NOT report the error before reaching the threshold", () => {
    const latestError: ErrorDetails = { message: "still trying" }
    internals(connectionManager).showRetryError(
      MAX_RETRIES_BEFORE_CLIENT_ERROR - 1,
      latestError,
      0
    )

    expect(onConnectionError).not.toHaveBeenCalled()
  })
})
