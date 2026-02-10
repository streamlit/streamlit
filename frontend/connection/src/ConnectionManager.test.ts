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
import { mockEndpoints } from "./testUtils"
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
