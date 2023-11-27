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
import { createNanoEvents } from "nanoevents"
import type { Emitter } from "nanoevents"
import { type ConnectionState } from "../stores/ConnectionContext"
import { BackMsg, type IBackMsg } from "../../../proto"
import { LOG } from "./log"
import type { State } from "./states"
import { Initial } from "./states"
import { executeWithRetry } from "./executeWithRetry"
import {
  type BaseUriParts,
  buildHttpUri,
  buildWsUri,
  getPossibleBaseUrisForConnection,
} from "../../../util/UriUtil"

export interface StreamlitEndpoints {
  ws: string
  http: string
}

/**
 * The path where we should ping (via HTTP) to see if the server is up.
 */
const SERVER_PING_PATH = "_stcore/health"

/**
 * The path to fetch the host configuration and allowed-message-origins.
 */
const HOST_CONFIG_PATH = "_stcore/host-config"

/**
 * The path of the server's websocket endpoint.
 */
const WEBSOCKET_STREAM_PATH = "_stcore/stream"

/**
 * Ping timeout in millis.
 */
const PING_TIMEOUT_MS = 15 * 1000

/**
 * Min and max wait time between pings in millis.
 */
const PING_MINIMUM_RETRY_PERIOD_MS = 500
const PING_MAXIMUM_RETRY_PERIOD_MS = 1000 * 60

/**
 * Timeout when attempting to connect to a websocket, in millis.
 */
const WEBSOCKET_TIMEOUT_MS = 15 * 1000

interface Events {
  connectionStateChanged: (
    nextState: ConnectionState,
    prevState: ConnectionState,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO
    data?: any
  ) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO
  connectionRetry: (error: any) => void
  message: (encodedMsg: Uint8Array) => void
  connectionEndpointIdentified: (endpoint: BaseUriParts) => void
}

export class ConnectionManager {
  private connectionState: State

  private endpoint: string

  private events: Emitter<Events>

  private websocket?: WebSocket

  private wsConnectionTimeoutId?: number

  private workingEndpoint?: BaseUriParts

  constructor(endpoint: string) {
    this.connectionState = new Initial(this)
    this.endpoint = endpoint
    this.events = createNanoEvents<Events>()
  }

  on(event: keyof Events, callback: Events[keyof Events]): () => void {
    return this.events.on(event, callback)
  }

  public isConnected(): boolean {
    return this.connectionState.isConnected()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO
  public setConnectionState(state: State, data?: any): void {
    const prevState = this.connectionState.literal
    const newState = state.literal

    if (newState !== prevState) {
      this.connectionState = state
      this.events.emit("connectionStateChanged", newState, prevState, data)
    }
  }

  public connect(): void {
    this.connectionState.initialize()
  }

  public async pingServer(): Promise<void> {
    const uriParts: BaseUriParts[] = getPossibleBaseUrisForConnection(
      this.endpoint
    )
    let index = 0

    const [, hostConfigResp] = await executeWithRetry(
      () => {
        const healthzUri: string = buildHttpUri(
          uriParts[index],
          SERVER_PING_PATH
        )
        const hostConfigUri: string = buildHttpUri(
          uriParts[index],
          HOST_CONFIG_PATH
        )

        return Promise.all([
          axios.get(healthzUri, { timeout: PING_TIMEOUT_MS }),
          axios.get(hostConfigUri, { timeout: PING_TIMEOUT_MS }),
        ])
      },
      PING_MINIMUM_RETRY_PERIOD_MS,
      PING_MAXIMUM_RETRY_PERIOD_MS,
      error => {
        this.events.emit("connectionRetry", error)

        index += 1
      }
    )

    this.workingEndpoint = uriParts[index]
    this.events.emit("connectionEndpointIdentified", this.workingEndpoint)
    this.connectionState.serverPingSucceeded(hostConfigResp.data)
  }

  public connectToWebSocket(): void {
    if (!this.workingEndpoint) {
      throw new Error("No working endpoint")
    }

    const uri = buildWsUri(this.workingEndpoint, WEBSOCKET_STREAM_PATH)

    // eslint-disable-next-line no-console -- TODO
    console.debug("Connecting to WebSocket")

    // NOTE: We repurpose the Sec-WebSocket-Protocol header (set via the second
    // parameter to the WebSocket constructor) here in a slightly unfortunate
    // but necessary way. The browser WebSocket API doesn't allow us to set
    // arbitrary HTTP headers, and this header is the only one where we have
    // the ability to set it to arbitrary values. Thus, we use it to pass auth
    // and session tokens from client to server as the second/third values in
    // the list.
    //
    // The reason why these tokens are set as the second/third values is that,
    // when Sec-WebSocket-Protocol is set, many clients expect the server to
    // respond with a selected subprotocol to use. We don't want that reply to
    // contain sensitive data, so we just hard-code it to "streamlit".
    // const sessionTokens = await this.getSessionTokens(); TODO
    const sessionTokens: string[] = []
    this.websocket = new WebSocket(uri, ["streamlit", ...sessionTokens])
    this.websocket.binaryType = "arraybuffer"

    if (!this.wsConnectionTimeoutId) {
      // This should never happen. We set the timeout ID to null in both FSM
      // nodes that lead to this one.
      throw new Error("WS timeout is already set")
    }

    const localWebsocket = this.websocket
    const hasWebSocketChanged = (): boolean =>
      localWebsocket !== this.websocket

    this.wsConnectionTimeoutId = window.setTimeout(() => {
      if (hasWebSocketChanged()) {
        return
      }

      if (this.wsConnectionTimeoutId) {
        // Sometimes the clearTimeout doesn't work. No idea why :-/
        LOG.warn("Timeout fired after cancellation")
        return
      }

      if (this.websocket === undefined) {
        // This should never happen! The only place we call
        // setConnectionTimeout() should be immediately before setting
        // this.websocket.
        this.closeConnection()
        this.connectionState.fatalError(
          "Null Websocket in setConnectionTimeout"
        )
        return
      }

      if (this.websocket.readyState === 0 /* CONNECTING */) {
        // eslint-disable-next-line testing-library/no-debugging-utils
        LOG.debug(() => `${uri} timed out`)
        this.closeConnection()
        this.connectionState.connectionTimedOut()
      }
    }, WEBSOCKET_TIMEOUT_MS)
    // eslint-disable-next-line testing-library/no-debugging-utils
    LOG.debug(() => `Set WS timeout ${this.wsConnectionTimeoutId}"}`)

    this.websocket.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (!hasWebSocketChanged()) {
        // PerformanceEvents.record({ name: "BeginHandleMessage", messageIndex });

        const encodedMsg = new Uint8Array(event.data)
        this.events.emit("message", encodedMsg)

        // PerformanceEvents.record({
        //   name: "DecodedMessage",
        //   messageIndex,
        //   messageType: msg.type,
        //   len: messageData.byteLength,
        // });
      }
    }

    this.websocket.onopen = () => {
      if (!hasWebSocketChanged()) {
        // eslint-disable-next-line testing-library/no-debugging-utils
        LOG.debug("WebSocket onopen")
        this.connectionState.connectionSucceeded()
      }
    }

    this.websocket.onclose = () => {
      if (!hasWebSocketChanged()) {
        LOG.warn("WebSocket onclose")
        this.closeConnection()
        this.connectionState.connectionClosed()
      }
    }

    this.websocket.onerror = () => {
      if (!hasWebSocketChanged()) {
        LOG.error("WebSocket onerror")
        this.closeConnection()
        this.connectionState.connectionError()
      }
    }
  }

  closeConnection(): void {
    // Need to make sure the websocket is closed in the same function that
    // cancels the connection timer. Otherwise, due to javascript's concurrency
    // model, when the onclose event fires it can get handled in between the
    // two functions, causing two events to be sent to the FSM: a
    // CONNECTION_TIMED_OUT and a CONNECTION_ERROR.

    if (this.websocket) {
      this.websocket.close()
      this.websocket = undefined
    }

    if (this.wsConnectionTimeoutId) {
      // eslint-disable-next-line testing-library/no-debugging-utils
      LOG.debug(() => `Clearing WS timeout ${this.wsConnectionTimeoutId}`)
      window.clearTimeout(this.wsConnectionTimeoutId)
      this.wsConnectionTimeoutId = undefined
    }
  }

  handleFatalError(errorMsg: string): void {
    this.connectionState.fatalError(errorMsg)
  }

  public sendBackMessage(obj: IBackMsg): void {
    if (!this.isConnected() || !this.websocket) {
      LOG.error("Attempted to send message while disconnected")
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- Todo
    this.websocket.send(BackMsg.encode(BackMsg.create(obj)).finish())
  }
}
