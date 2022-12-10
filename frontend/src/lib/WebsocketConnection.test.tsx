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
import WS from "jest-websocket-mock"
import { zip } from "lodash"
import React, { Fragment } from "react"

import { BackMsg } from "src/autogen/proto"
import { ConnectionState } from "src/lib/ConnectionState"
import { SessionInfo } from "src/lib/SessionInfo"
import {
  CORS_ERROR_MESSAGE_DOCUMENTATION_LINK,
  StyledBashCode,
  WebsocketConnection,
  doInitPings,
} from "src/lib/WebsocketConnection"

const MOCK_ALLOWED_ORIGINS_RESPONSE = {
  data: {
    allowedOrigins: ["list", "of", "allowed", "origins"],
    useExternalAuthToken: false,
  },
}

const MOCK_HEALTH_RESPONSE = { status: "ok" }

describe("doInitPings", () => {
  const MOCK_PING_DATA = {
    uri: [
      { host: "not.a.real.host", port: 3000, basePath: "/" },
      { host: "not.a.real.host", port: 3001, basePath: "/" },
    ],
    timeoutMs: 10,
    maxTimeoutMs: 100,
    retryCallback: jest.fn(),
    setAllowedOriginsResp: jest.fn(),
    userCommandLine: "streamlit run not-a-real-script.py",
  }

  let originalAxiosGet: any
  let originalPromiseAll: any

  beforeEach(() => {
    originalAxiosGet = axios.get
    axios.get = jest.fn()
    MOCK_PING_DATA.retryCallback = jest.fn()
    MOCK_PING_DATA.setAllowedOriginsResp = jest.fn()
    originalPromiseAll = Promise.all
  })

  afterEach(() => {
    axios.get = originalAxiosGet
    Promise.all = originalPromiseAll
  })

  it("does call the /_stcore/health endpoint when pinging server", async () => {
    axios.get = jest.fn().mockImplementation(url => {
      if (url.endsWith("_stcore/health")) {
        return MOCK_HEALTH_RESPONSE
      }
      if (url.endsWith("_stcore/allowed-message-origins")) {
        return MOCK_ALLOWED_ORIGINS_RESPONSE
      }
      return {}
    })

    const uriIndex = await doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.setAllowedOriginsResp,
      MOCK_PING_DATA.userCommandLine
    )
    expect(uriIndex).toEqual(0)
    expect(MOCK_PING_DATA.setAllowedOriginsResp).toHaveBeenCalledWith(
      MOCK_ALLOWED_ORIGINS_RESPONSE.data
    )
  })

  it("returns the uri index and sets allowedOrigins for the first successful ping (0)", async () => {
    Promise.all = jest
      .fn()
      .mockResolvedValueOnce(["", MOCK_ALLOWED_ORIGINS_RESPONSE])

    const uriIndex = await doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.setAllowedOriginsResp,
      MOCK_PING_DATA.userCommandLine
    )
    expect(uriIndex).toEqual(0)
    expect(MOCK_PING_DATA.setAllowedOriginsResp).toHaveBeenCalledWith(
      MOCK_ALLOWED_ORIGINS_RESPONSE.data
    )
  })

  it("returns the uri index and sets allowedOrigins for the first successful ping (1)", async () => {
    Promise.all = jest
      .fn()
      .mockRejectedValueOnce(new Error(""))
      .mockResolvedValueOnce(["", MOCK_ALLOWED_ORIGINS_RESPONSE])

    const uriIndex = await doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.setAllowedOriginsResp,
      MOCK_PING_DATA.userCommandLine
    )
    expect(uriIndex).toEqual(1)
    expect(MOCK_PING_DATA.setAllowedOriginsResp).toHaveBeenCalledWith(
      MOCK_ALLOWED_ORIGINS_RESPONSE.data
    )
  })

  it("calls retry with the corresponding error message if there was an error", async () => {
    const TEST_ERROR_MESSAGE = "ERROR_MESSAGE"

    Promise.all = jest
      .fn()
      .mockRejectedValueOnce(new Error(TEST_ERROR_MESSAGE))
      // The promise should be resolved to avoid an infinite loop.
      .mockResolvedValueOnce(["", MOCK_ALLOWED_ORIGINS_RESPONSE])

    await doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.setAllowedOriginsResp,
      MOCK_PING_DATA.userCommandLine
    )

    expect(MOCK_PING_DATA.retryCallback).toHaveBeenCalledWith(
      1,
      TEST_ERROR_MESSAGE,
      expect.anything()
    )
  })

  it("calls retry with 'Connection timed out.' when the error code is `ECONNABORTED`", async () => {
    const TEST_ERROR = { code: "ECONNABORTED" }

    Promise.all = jest
      .fn()
      .mockRejectedValueOnce(TEST_ERROR)
      // The promise should be resolved to avoid an infinite loop.
      .mockResolvedValueOnce(["", MOCK_ALLOWED_ORIGINS_RESPONSE])

    await doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.setAllowedOriginsResp,
      MOCK_PING_DATA.userCommandLine
    )

    expect(MOCK_PING_DATA.retryCallback).toHaveBeenCalledWith(
      1,
      "Connection timed out.",
      expect.anything()
    )
  })

  it("calls retry with 'Connection failed with status 0.' when there is no response", async () => {
    const TEST_ERROR = {
      response: {
        status: 0,
      },
    }

    Promise.all = jest
      .fn()
      .mockRejectedValueOnce(TEST_ERROR)
      // The promise should be resolved to avoid an infinite loop.
      .mockResolvedValueOnce(["", MOCK_ALLOWED_ORIGINS_RESPONSE])

    await doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.setAllowedOriginsResp,
      MOCK_PING_DATA.userCommandLine
    )

    expect(MOCK_PING_DATA.retryCallback).toHaveBeenCalledWith(
      1,
      "Connection failed with status 0.",
      expect.anything()
    )
  })

  it("calls retry with 'Connection failed with status 0.' when the request was made but no response was received", async () => {
    const TEST_ERROR = {
      request: {},
    }

    Promise.all = jest
      .fn()
      .mockRejectedValueOnce(TEST_ERROR)
      // The promise should be resolved to avoid an infinite loop.
      .mockResolvedValueOnce(["", MOCK_ALLOWED_ORIGINS_RESPONSE])

    await doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.setAllowedOriginsResp,
      MOCK_PING_DATA.userCommandLine
    )

    expect(MOCK_PING_DATA.retryCallback).toHaveBeenCalledWith(
      1,
      "Connection failed with status 0.",
      expect.anything()
    )
  })

  it("calls retry with corresponding fragment when there is no response from localhost", async () => {
    const MOCK_PING_DATA_LOCALHOST = {
      ...MOCK_PING_DATA,
      uri: [
        { host: "localhost", port: 3000, basePath: "/" },
        { host: "localhost", port: 3001, basePath: "/" },
      ],
    }

    const TEST_ERROR = {
      response: {
        status: 0,
      },
    }

    const NoResponse = (
      <Fragment>
        <p>
          Is Streamlit still running? If you accidentally stopped Streamlit,
          just restart it in your terminal:
        </p>
        <pre>
          <StyledBashCode>
            {MOCK_PING_DATA_LOCALHOST.userCommandLine}
          </StyledBashCode>
        </pre>
      </Fragment>
    )

    Promise.all = jest
      .fn()
      .mockRejectedValueOnce(TEST_ERROR)
      // The promise should be resolved to avoid an infinite loop.
      .mockResolvedValueOnce(["", MOCK_ALLOWED_ORIGINS_RESPONSE])

    await doInitPings(
      MOCK_PING_DATA_LOCALHOST.uri,
      MOCK_PING_DATA_LOCALHOST.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      MOCK_PING_DATA_LOCALHOST.retryCallback,
      MOCK_PING_DATA_LOCALHOST.setAllowedOriginsResp,
      MOCK_PING_DATA_LOCALHOST.userCommandLine
    )

    expect(MOCK_PING_DATA_LOCALHOST.retryCallback).toHaveBeenCalledWith(
      1,
      NoResponse,
      expect.anything()
    )
  })

  it("calls retry with corresponding fragment when the status is 403 (forbidden)", async () => {
    const TEST_ERROR = {
      response: {
        status: 403,
      },
    }

    const Forbidden = (
      <Fragment>
        <p>Cannot connect to Streamlit (HTTP status: 403).</p>
        <p>
          If you are trying to access a Streamlit app running on another
          server, this could be due to the app's{" "}
          <a href={CORS_ERROR_MESSAGE_DOCUMENTATION_LINK}>CORS</a> settings.
        </p>
      </Fragment>
    )

    Promise.all = jest
      .fn()
      .mockRejectedValueOnce(TEST_ERROR)
      // The promise should be resolved to avoid an infinite loop.
      .mockResolvedValueOnce(["", MOCK_ALLOWED_ORIGINS_RESPONSE])

    await doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.setAllowedOriginsResp,
      MOCK_PING_DATA.userCommandLine
    )

    expect(MOCK_PING_DATA.retryCallback).toHaveBeenCalledWith(
      1,
      Forbidden,
      expect.anything()
    )
  })

  it("calls retry with 'Connection failed with status ...' for any status code other than 0, 403, and 2xx", async () => {
    const TEST_ERROR = {
      response: {
        status: 500,
        data: "TEST_DATA",
      },
    }

    Promise.all = jest
      .fn()
      .mockRejectedValueOnce(TEST_ERROR)
      // The promise should be resolved to avoid an infinite loop.
      .mockResolvedValueOnce(["", MOCK_ALLOWED_ORIGINS_RESPONSE])

    await doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.setAllowedOriginsResp,
      MOCK_PING_DATA.userCommandLine
    )

    expect(MOCK_PING_DATA.retryCallback).toHaveBeenCalledWith(
      1,
      `Connection failed with status ${TEST_ERROR.response.status}, and response "${TEST_ERROR.response.data}".`,
      expect.anything()
    )
  })

  it("calls retry with correct total tries", async () => {
    const TEST_ERROR_MESSAGE = "TEST_ERROR_MESSAGE"

    Promise.all = jest
      .fn()
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      // The promise should be resolved to avoid an infinite loop.
      .mockResolvedValueOnce(["", MOCK_ALLOWED_ORIGINS_RESPONSE])

    await doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.setAllowedOriginsResp,
      MOCK_PING_DATA.userCommandLine
    )

    expect(MOCK_PING_DATA.retryCallback).toHaveBeenCalledTimes(5)
  })

  it("has increasing but capped retry backoff", async () => {
    const TEST_ERROR_MESSAGE = "TEST_ERROR_MESSAGE"

    Promise.all = jest
      .fn()
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      // The promise should be resolved to avoid an infinite loop.
      .mockResolvedValueOnce(["", MOCK_ALLOWED_ORIGINS_RESPONSE])

    const timeouts: number[] = []
    const callback = (
      _times: number,
      _errorNode: React.ReactNode,
      timeout: number
    ): void => {
      timeouts.push(timeout)
    }

    await doInitPings(
      [{ host: "not.a.real.host", port: 3000, basePath: "/" }],
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      callback,
      MOCK_PING_DATA.setAllowedOriginsResp,
      MOCK_PING_DATA.userCommandLine
    )

    expect(timeouts.length).toEqual(5)
    expect(timeouts[0]).toEqual(10)
    expect(timeouts[4]).toEqual(100)
    // timeouts should be monotonically increasing until they hit the cap
    expect(
      zip(timeouts.slice(0, -1), timeouts.slice(1)).every(
        // @ts-ignore
        timePair => timePair[0] < timePair[1] || timePair[0] === 100
      )
    )
  })

  it("backs off independently for each target url", async () => {
    const TEST_ERROR_MESSAGE = "TEST_ERROR_MESSAGE"

    Promise.all = jest
      .fn()
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      // The promise should be resolved to avoid an infinite loop.
      .mockResolvedValueOnce(["", MOCK_ALLOWED_ORIGINS_RESPONSE])

    const timeouts: number[] = []
    const callback = (
      _times: number,
      _errorNode: React.ReactNode,
      timeout: number
    ): void => {
      timeouts.push(timeout)
    }

    await doInitPings(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      callback,
      MOCK_PING_DATA.setAllowedOriginsResp,
      MOCK_PING_DATA.userCommandLine
    )

    expect(timeouts.length).toEqual(5)
    expect(timeouts[0]).toEqual(10)
    expect(timeouts[1]).toEqual(10)
    expect(timeouts[2]).toBeGreaterThan(timeouts[0])
    expect(timeouts[3]).toBeGreaterThan(timeouts[1])
  })

  it("resets timeout each ping call", async () => {
    const TEST_ERROR_MESSAGE = "TEST_ERROR_MESSAGE"

    Promise.all = jest
      .fn()
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      // Reset after second doInitPings call
      .mockResolvedValueOnce(["", MOCK_ALLOWED_ORIGINS_RESPONSE])
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      // The promise should be resolved to avoid an infinite loop.
      .mockResolvedValueOnce(["", MOCK_ALLOWED_ORIGINS_RESPONSE])

    const timeouts: number[] = []
    const callback = (
      _times: number,
      _errorNode: React.ReactNode,
      timeout: number
    ): void => {
      timeouts.push(timeout)
    }

    await doInitPings(
      [{ host: "not.a.real.host", port: 3000, basePath: "/" }],
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      callback,
      MOCK_PING_DATA.setAllowedOriginsResp,
      MOCK_PING_DATA.userCommandLine
    )

    const timeouts2: number[] = []
    const callback2 = (
      _times: number,
      _errorNode: React.ReactNode,
      timeout: number
    ): void => {
      timeouts2.push(timeout)
    }

    await doInitPings(
      [{ host: "not.a.real.host", port: 3000, basePath: "/" }],
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.maxTimeoutMs,
      callback2,
      MOCK_PING_DATA.setAllowedOriginsResp,
      MOCK_PING_DATA.userCommandLine
    )

    expect(timeouts[0]).toEqual(10)
    expect(timeouts[1]).toBeGreaterThan(timeouts[0])
    expect(timeouts2[0]).toEqual(10)
  })
})

describe("WebsocketConnection", () => {
  const MOCK_SOCKET_DATA = {
    baseUriPartsList: [
      {
        host: "localhost",
        port: 1234,
        basePath: "/",
      },
    ],
    onMessage: jest.fn(),
    onConnectionStateChange: jest.fn(),
    onRetry: jest.fn(),
    claimHostAuthToken: () => Promise.resolve(undefined),
    resetHostAuthToken: jest.fn(),
    setAllowedOriginsResp: jest.fn(),
  }

  let client: WebsocketConnection
  let server: WS

  let originalAxiosGet: any
  let originalPromiseAll: any

  beforeEach(() => {
    server = new WS("localhost:1234")

    originalAxiosGet = axios.get
    axios.get = jest.fn()

    originalPromiseAll = Promise.all
    Promise.all = jest
      .fn()
      .mockResolvedValueOnce(["", MOCK_ALLOWED_ORIGINS_RESPONSE])

    client = new WebsocketConnection(MOCK_SOCKET_DATA)
  })

  afterEach(() => {
    axios.get = originalAxiosGet
    Promise.all = originalPromiseAll

    // @ts-ignore
    if (client.websocket) {
      // @ts-ignore
      client.websocket.close()
    }
    server.close()
  })

  it("disconnect closes connection and sets state to DISCONNECTED_FOREVER", () => {
    client.disconnect()

    // @ts-ignore
    expect(client.state).toBe(ConnectionState.DISCONNECTED_FOREVER)
    // @ts-ignore
    expect(client.websocket).toBe(undefined)
  })

  it("increments message cache run count", () => {
    const incrementRunCountSpy = jest.spyOn(
      // @ts-ignore
      client.cache,
      "incrementRunCount"
    )

    const TEST_MAX_MESSAGE_AGE = 10
    client.incrementMessageCacheRunCount(TEST_MAX_MESSAGE_AGE)

    expect(incrementRunCountSpy).toHaveBeenCalledWith(TEST_MAX_MESSAGE_AGE)
  })

  it("sends message with correct arguments", () => {
    // @ts-ignore
    const sendSpy = jest.spyOn(client.websocket, "send")

    const TEST_BACK_MSG = {}
    client.sendMessage(TEST_BACK_MSG)

    const msg = BackMsg.create(TEST_BACK_MSG)
    const buffer = BackMsg.encode(msg).finish()

    expect(sendSpy).toHaveBeenCalledWith(buffer)
  })

  describe("getBaseUriParts", () => {
    it("returns correct base uri parts when ConnectionState == Connected", () => {
      // @ts-ignore
      client.state = ConnectionState.CONNECTED

      expect(client.getBaseUriParts()).toEqual(
        MOCK_SOCKET_DATA.baseUriPartsList[0]
      )
    })

    it("returns undefined when ConnectionState != Connected", () => {
      expect(client.getBaseUriParts()).toBeUndefined()
    })
  })
})

describe("WebsocketConnection auth token handling", () => {
  const MOCK_SOCKET_DATA = {
    baseUriPartsList: [
      {
        host: "localhost",
        port: 1234,
        basePath: "/",
      },
    ],
    onMessage: jest.fn(),
    onConnectionStateChange: jest.fn(),
    onRetry: jest.fn(),
    claimHostAuthToken: () => Promise.resolve(undefined),
    resetHostAuthToken: jest.fn(),
    setAllowedOriginsResp: jest.fn(),
  }

  let originalAxiosGet: any
  let websocketSpy: any

  beforeEach(() => {
    websocketSpy = jest.spyOn(window, "WebSocket")

    originalAxiosGet = axios.get
    axios.get = jest.fn()
  })

  afterEach(() => {
    axios.get = originalAxiosGet

    SessionInfo.lastSessionInfo = undefined
  })

  it("always sets first Sec-WebSocket-Protocol option to 'streamlit'", async () => {
    const resetHostAuthToken = jest.fn()
    const ws = new WebsocketConnection({
      ...MOCK_SOCKET_DATA,
      resetHostAuthToken,
    })
    // @ts-ignore
    await ws.connectToWebSocket()

    expect(websocketSpy).toHaveBeenCalledWith(
      "ws://localhost:1234/_stcore/stream",
      ["streamlit"]
    )
    expect(resetHostAuthToken).toHaveBeenCalledTimes(1)
  })

  it("sets second Sec-WebSocket-Protocol option to value from claimHostAuthToken", async () => {
    const resetHostAuthToken = jest.fn()
    const ws = new WebsocketConnection({
      ...MOCK_SOCKET_DATA,
      claimHostAuthToken: () => Promise.resolve("iAmAnAuthToken"),
      resetHostAuthToken,
    })

    // @ts-ignore
    await ws.connectToWebSocket()

    expect(websocketSpy).toHaveBeenCalledWith("ws://localhost:1234/stream", [
      "streamlit",
      "iAmAnAuthToken",
    ])
  })

  it("sets second Sec-WebSocket-Protocol option to lastSessionId", async () => {
    // @ts-ignore
    SessionInfo.lastSessionInfo = { sessionId: "sessionId" }

    const ws = new WebsocketConnection(MOCK_SOCKET_DATA)

    // @ts-ignore
    await ws.connectToWebSocket()

    expect(websocketSpy).toHaveBeenCalledWith("ws://localhost:1234/stream", [
      "streamlit",
      "sessionId",
    ])
  })

  it("prioritizes host provided auth token over lastSessionId if both set", async () => {
    // @ts-ignore
    SessionInfo.lastSessionInfo = { sessionId: "sessionId" }

    const resetHostAuthToken = jest.fn()
    const ws = new WebsocketConnection({
      ...MOCK_SOCKET_DATA,
      claimHostAuthToken: () => Promise.resolve("iAmAnAuthToken"),
      resetHostAuthToken,
    })

    // @ts-ignore
    await ws.connectToWebSocket()

    expect(websocketSpy).toHaveBeenCalledWith(
      "ws://localhost:1234/_stcore/stream",
      ["streamlit", "iAmAnAuthToken"]
    )
    expect(resetHostAuthToken).toHaveBeenCalledTimes(1)
  })
})
