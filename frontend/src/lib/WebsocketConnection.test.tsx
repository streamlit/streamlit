/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import axios from "axios"
import React, { Fragment } from "react"
import WS from "jest-websocket-mock"

import { BackMsg } from "src/autogen/proto"
import { ConnectionState } from "src/lib/ConnectionState"
import {
  CORS_ERROR_MESSAGE_DOCUMENTATION_LINK,
  StyledBashCode,
  WebsocketConnection,
  doHealthPing,
} from "src/lib/WebsocketConnection"

describe("doHealthPing", () => {
  const MOCK_PING_DATA = {
    uri: [
      "https://not.a.real.host:3000/healthz",
      "https://not.a.real.host:3001/healthz",
    ],
    timeoutMs: 10,
    retryCallback: () => {},
    userCommandLine: "streamlit run not-a-real-script.py",
  }

  beforeEach(() => {
    MOCK_PING_DATA.retryCallback = jest.fn()
  })

  it("returns the uri index of the first successful ping (0)", async () => {
    axios.get = jest.fn().mockResolvedValueOnce("")

    const uriIndex = await doHealthPing(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.userCommandLine
    )
    expect(uriIndex).toEqual(0)
  })

  it("returns the uri index of the first successful ping (1)", async () => {
    axios.get = jest
      .fn()
      .mockRejectedValueOnce(new Error(""))
      .mockResolvedValueOnce("")

    const uriIndex = await doHealthPing(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.userCommandLine
    )
    expect(uriIndex).toEqual(1)
  })

  it("calls retry with the corresponding error message if there was an error", async () => {
    const TEST_ERROR_MESSAGE = "ERROR_MESSAGE"

    axios.get = jest
      .fn()
      .mockRejectedValueOnce(new Error(TEST_ERROR_MESSAGE))
      // The promise should be resolved to avoid an infinite loop.
      .mockResolvedValueOnce("")

    await doHealthPing(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.userCommandLine
    )

    expect(MOCK_PING_DATA.retryCallback).toHaveBeenCalledWith(
      1,
      TEST_ERROR_MESSAGE
    )
  })

  it("calls retry with 'Connection timed out.' when the error code is `ECONNABORTED`", async () => {
    const TEST_ERROR = { code: "ECONNABORTED" }

    axios.get = jest
      .fn()
      .mockRejectedValueOnce(TEST_ERROR)
      // The promise should be resolved to avoid an infinite loop.
      .mockResolvedValueOnce("")

    await doHealthPing(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.userCommandLine
    )

    expect(MOCK_PING_DATA.retryCallback).toHaveBeenCalledWith(
      1,
      "Connection timed out."
    )
  })

  it("calls retry with 'Connection failed with status 0.' when there is no response", async () => {
    const TEST_ERROR = {
      response: {
        status: 0,
      },
    }

    axios.get = jest
      .fn()
      .mockRejectedValueOnce(TEST_ERROR)
      // The promise should be resolved to avoid an infinite loop.
      .mockResolvedValueOnce("")

    await doHealthPing(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.userCommandLine
    )

    expect(MOCK_PING_DATA.retryCallback).toHaveBeenCalledWith(
      1,
      "Connection failed with status 0."
    )
  })

  it("calls retry with 'Connection failed with status 0.' when the request was made but no response was received", async () => {
    const TEST_ERROR = {
      request: {},
    }

    axios.get = jest
      .fn()
      .mockRejectedValueOnce(TEST_ERROR)
      // The promise should be resolved to avoid an infinite loop.
      .mockResolvedValueOnce("")

    await doHealthPing(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.userCommandLine
    )

    expect(MOCK_PING_DATA.retryCallback).toHaveBeenCalledWith(
      1,
      "Connection failed with status 0."
    )
  })

  it("calls retry with corresponding fragment when there is no response from localhost", async () => {
    const MOCK_PING_DATA_LOCALHOST = {
      ...MOCK_PING_DATA,
      uri: [
        "https://localhost:3000/healthz",
        "https://localhost:3001/healthz",
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

    axios.get = jest
      .fn()
      .mockRejectedValueOnce(TEST_ERROR)
      // The promise should be resolved to avoid an infinite loop.
      .mockResolvedValueOnce("")

    await doHealthPing(
      MOCK_PING_DATA_LOCALHOST.uri,
      MOCK_PING_DATA_LOCALHOST.timeoutMs,
      MOCK_PING_DATA_LOCALHOST.retryCallback,
      MOCK_PING_DATA_LOCALHOST.userCommandLine
    )

    expect(MOCK_PING_DATA_LOCALHOST.retryCallback).toHaveBeenCalledWith(
      1,
      NoResponse
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

    axios.get = jest
      .fn()
      .mockRejectedValueOnce(TEST_ERROR)
      // The promise should be resolved to avoid an infinite loop.
      .mockResolvedValueOnce("")

    await doHealthPing(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.userCommandLine
    )

    expect(MOCK_PING_DATA.retryCallback).toHaveBeenCalledWith(1, Forbidden)
  })

  it("calls retry with 'Connection failed with status ...' for any status code other than 0, 403, and 2xx", async () => {
    const TEST_ERROR = {
      response: {
        status: 500,
        data: "TEST_DATA",
      },
    }

    axios.get = jest
      .fn()
      .mockRejectedValueOnce(TEST_ERROR)
      // The promise should be resolved to avoid an infinite loop.
      .mockResolvedValueOnce("")

    await doHealthPing(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.userCommandLine
    )

    expect(MOCK_PING_DATA.retryCallback).toHaveBeenCalledWith(
      1,
      `Connection failed with status ${TEST_ERROR.response.status}, and response "${TEST_ERROR.response.data}".`
    )
  })

  it("calls retry with correct total tries", async () => {
    const TEST_ERROR_MESSAGE = "TEST_ERROR_MESSAGE"

    axios.get = jest
      .fn()
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      .mockRejectedValueOnce(TEST_ERROR_MESSAGE)
      // The promise should be resolved to avoid an infinite loop.
      .mockResolvedValueOnce("")

    await doHealthPing(
      MOCK_PING_DATA.uri,
      MOCK_PING_DATA.timeoutMs,
      MOCK_PING_DATA.retryCallback,
      MOCK_PING_DATA.userCommandLine
    )

    expect(MOCK_PING_DATA.retryCallback).toHaveBeenCalledTimes(5)
  })
})

describe("WebsocketConnection", () => {
  const MOCK_SOCKET_DATA = {
    baseUriPartsList: [
      {
        host: "localhost",
        port: 1234,
        basePath: "",
      },
    ],
    onMessage: jest.fn(),
    onConnectionStateChange: jest.fn(),
    onRetry: jest.fn(),
  }

  let client: WebsocketConnection
  let server: WS

  beforeEach(async () => {
    server = new WS("localhost:1234")
    client = new WebsocketConnection(MOCK_SOCKET_DATA)
  })

  afterEach(async () => {
    // @ts-ignore
    client.websocket.close()
    server.close()
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
