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

import styled from "@emotion/styled"
import axios from "axios"

import { BackMsg, ForwardMsg, IBackMsg } from "src/autogen/proto"
import { IAllowedMessageOriginsResponse } from "src/hocs/withHostCommunication/types"
import { ConnectionState } from "src/app/connection/ConnectionState"
import { ForwardMsgCache } from "src/lib/ForwardMessageCache"
import { logError, logMessage, logWarning } from "src/lib/log"
import { PerformanceEvents } from "src/lib/profiler/PerformanceEvents"
import Resolver from "src/lib/Resolver"
import { SessionInfo } from "src/lib/SessionInfo"
import { BaseUriParts, buildHttpUri, buildWsUri } from "src/lib/UriUtil"
import React, { Fragment } from "react"
import { StreamlitEndpoints } from "../../lib/StreamlitEndpoints"

/**
 * Name of the logger.
 */
const LOG = "WebsocketConnection"

/**
 * The path where we should ping (via HTTP) to see if the server is up.
 */
const SERVER_PING_PATH = "_stcore/health"

/**
 * The path to fetch the whitelist for accepting cross-origin messages.
 */
const ALLOWED_ORIGINS_PATH = "_stcore/allowed-message-origins"

/**
 * The path of the server's websocket endpoint.
 */
const WEBSOCKET_STREAM_PATH = "_stcore/stream"

/**
 * Min and max wait time between pings in millis.
 */
const PING_MINIMUM_RETRY_PERIOD_MS = 500
const PING_MAXIMUM_RETRY_PERIOD_MS = 1000 * 60

/**
 * Ping timeout in millis.
 */
const PING_TIMEOUT_MS = 15 * 1000

/**
 * Timeout when attempting to connect to a websocket, in millis.
 */
const WEBSOCKET_TIMEOUT_MS = 15 * 1000

/**
 * If the ping retrieves a 403 status code a message will be displayed.
 * This constant is the link to the documentation.
 */
export const CORS_ERROR_MESSAGE_DOCUMENTATION_LINK =
  "https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS"

type OnMessage = (ForwardMsg: any) => void
type OnConnectionStateChange = (
  connectionState: ConnectionState,
  errMsg?: string
) => void
type OnRetry = (
  totalTries: number,
  errorNode: React.ReactNode,
  retryTimeout: number
) => void

export interface Args {
  /** The application's SessionInfo instance */
  sessionInfo: SessionInfo

  endpoints: StreamlitEndpoints

  /**
   * List of URLs to connect to. We'll try the first, then the second, etc. If
   * all fail, we'll retry from the top. The number of retries depends on
   * whether this is a local connection.
   */
  baseUriPartsList: BaseUriParts[]

  /**
   * Function called when our ConnectionState changes.
   * If the new ConnectionState is ERROR, errMsg will be defined.
   */
  onConnectionStateChange: OnConnectionStateChange

  /**
   * Function called every time we ping the server for sign of life.
   */
  onRetry: OnRetry

  /**
   * Function called when we receive a new message.
   */
  onMessage: OnMessage

  /**
   * Function to get the auth token set by the host of this app (if in a
   * relevant deployment scenario).
   */
  claimHostAuthToken: () => Promise<string | undefined>

  /**
   * Function to clear the withHostCommunication hoc's auth token. This should
   * be called after the promise returned by claimHostAuthToken successfully
   * resolves.
   */
  resetHostAuthToken: () => void

  /**
   * Function to set the list of origins that this app should accept
   * cross-origin messages from (if in a relevant deployment scenario).
   */
  setAllowedOriginsResp: (resp: IAllowedMessageOriginsResponse) => void
}

interface MessageQueue {
  [index: number]: any
}

/**
 * Events of the WebsocketConnection state machine. Here's what the FSM looks
 * like:
 *
 *   INITIAL
 *     │
 *     │               on ping succeed
 *     v               :
 *   PINGING_SERVER ───────────────> CONNECTING
 *     ^  ^                            │  │
 *     │  │:on timeout/error/closed    │  │
 *     │  └────────────────────────────┘  │
 *     │                                  │
 *     │:on error/closed                  │:on conn succeed
 *   CONNECTED<───────────────────────────┘
 *
 *
 *                    on fatal error or call to .disconnect()
 *                    :
 *   <ANY_STATE> ──────────────> DISCONNECTED_FOREVER
 */
type Event =
  | "INITIALIZED"
  | "CONNECTION_CLOSED"
  | "CONNECTION_ERROR"
  | "CONNECTION_SUCCEEDED"
  | "CONNECTION_TIMED_OUT"
  | "SERVER_PING_SUCCEEDED"
  | "FATAL_ERROR" // Unrecoverable error. This should never happen!

/**
 * This class connects to the server and gets deltas over a websocket connection.
 *
 */
export class WebsocketConnection {
  private readonly args: Args

  /**
   * ForwardMessages get passed through this cache. This gets initialized
   * once we connect to the server.
   */
  private readonly cache: ForwardMsgCache

  /**
   * Index to the URI in uriList that we're going to try to connect to.
   */
  private uriIndex = 0

  /**
   * To guarantee packet transmission order, this is the index of the last
   * dispatched incoming message.
   */
  private lastDispatchedMessageIndex = -1

  /**
   * And this is the index of the next message we receive.
   */
  private nextMessageIndex = 0

  /**
   * This dictionary stores received messages that we haven't sent out yet
   * (because we're still decoding previous messages)
   */
  private readonly messageQueue: MessageQueue = {}

  /**
   * The current state of this object's state machine.
   */
  private state = ConnectionState.INITIAL

  /**
   * The WebSocket object we're connecting with.
   */
  private websocket?: WebSocket

  /**
   * WebSocket objects don't support retries, so we have to implement them
   * ourselves. We use setTimeout to wait for a connection and retry once the
   * timeout fires. This field stores the timer ID from setTimeout, so we can
   * cancel it if needed.
   */
  private wsConnectionTimeoutId?: number

  constructor(props: Args) {
    this.args = props
    this.cache = new ForwardMsgCache(props.endpoints)
    this.stepFsm("INITIALIZED")
  }

  /**
   * Return the BaseUriParts for the server we're connected to,
   * if we are connected to a server.
   */
  public getBaseUriParts(): BaseUriParts | undefined {
    if (this.state === ConnectionState.CONNECTED) {
      return this.args.baseUriPartsList[this.uriIndex]
    }
    return undefined
  }

  public disconnect(): void {
    this.setFsmState(ConnectionState.DISCONNECTED_FOREVER)
  }

  // This should only be called inside stepFsm().
  private setFsmState(state: ConnectionState, errMsg?: string): void {
    logMessage(LOG, `New state: ${state}`)
    this.state = state

    // Perform pre-callback actions when entering certain states.
    switch (this.state) {
      case ConnectionState.PINGING_SERVER:
        this.pingServer(
          this.args.sessionInfo.isSet
            ? this.args.sessionInfo.current.commandLine
            : undefined
        )
        break

      default:
        break
    }

    this.args.onConnectionStateChange(state, errMsg)

    // Perform post-callback actions when entering certain states.
    switch (this.state) {
      case ConnectionState.CONNECTING:
        this.connectToWebSocket()
        break

      case ConnectionState.DISCONNECTED_FOREVER:
        this.closeConnection()
        break

      default:
        break
    }
  }

  /**
   * Process an event in our FSM.
   *
   * @param event The event to process.
   * @param errMsg an optional error message to send to the OnStateChanged
   * callback. This is meaningful only for the FATAL_ERROR event. The message
   * will be displayed to the user in a "Connection Error" dialog.
   */
  private stepFsm(event: Event, errMsg?: string): void {
    logMessage(LOG, `State: ${this.state}; Event: ${event}`)

    if (
      event === "FATAL_ERROR" &&
      this.state !== ConnectionState.DISCONNECTED_FOREVER
    ) {
      // If we get a fatal error, we transition to DISCONNECTED_FOREVER
      // regardless of our current state.
      this.setFsmState(ConnectionState.DISCONNECTED_FOREVER, errMsg)
      return
    }

    // Any combination of state+event that is not explicitly called out
    // below is illegal and raises an error.

    switch (this.state) {
      case ConnectionState.INITIAL:
        if (event === "INITIALIZED") {
          this.setFsmState(ConnectionState.PINGING_SERVER)
          return
        }
        break

      case ConnectionState.CONNECTING:
        if (event === "CONNECTION_SUCCEEDED") {
          this.setFsmState(ConnectionState.CONNECTED)
          return
        }
        if (
          event === "CONNECTION_TIMED_OUT" ||
          event === "CONNECTION_ERROR" ||
          event === "CONNECTION_CLOSED"
        ) {
          this.setFsmState(ConnectionState.PINGING_SERVER)
          return
        }
        break

      case ConnectionState.CONNECTED:
        if (event === "CONNECTION_CLOSED" || event === "CONNECTION_ERROR") {
          this.setFsmState(ConnectionState.PINGING_SERVER)
          return
        }
        break

      case ConnectionState.PINGING_SERVER:
        if (event === "SERVER_PING_SUCCEEDED") {
          this.setFsmState(ConnectionState.CONNECTING)
          return
        }
        break

      case ConnectionState.DISCONNECTED_FOREVER:
        // If we're in the DISCONNECTED_FOREVER state, we can't reasonably
        // process any events, and it's possible we're in this state because
        // of a fatal error. Just log these events rather than throwing more
        // exceptions.
        logWarning(
          LOG,
          `Discarding ${event} while in ${ConnectionState.DISCONNECTED_FOREVER}`
        )
        return

      default:
        break
    }

    throw new Error(
      "Unsupported state transition.\n" +
        `State: ${this.state}\n` +
        `Event: ${event}`
    )
  }

  private async pingServer(userCommandLine?: string): Promise<void> {
    this.uriIndex = await doInitPings(
      this.args.baseUriPartsList,
      PING_MINIMUM_RETRY_PERIOD_MS,
      PING_MAXIMUM_RETRY_PERIOD_MS,
      this.args.onRetry,
      this.args.setAllowedOriginsResp,
      userCommandLine
    )

    this.stepFsm("SERVER_PING_SUCCEEDED")
  }

  /**
   * Get the session token to use to initialize a WebSocket connection.
   *
   * There are two scenarios that are considered here:
   *   1. If this Streamlit is embedded in a page that will be passing an
   *      external, opaque auth token to it, we get it using claimHostAuthToken
   *      and return it. This only occurs in deployment environments where
   *      we're not connecting to the usual Tornado server, so we don't have to
   *      worry about what this token actually is/does.
   *   2. Otherwise, claimHostAuthToken will resolve immediately to undefined,
   *      in which case we return the sessionId of the last session this
   *      browser tab connected to (or undefined if this is the first time this
   *      tab has connected to the Streamlit server). This sessionId is used to
   *      attempt to reconnect to an existing session to handle transient
   *      disconnects.
   */
  private async getSessionToken(): Promise<string | undefined> {
    const hostAuthToken = await this.args.claimHostAuthToken()
    this.args.resetHostAuthToken()
    return hostAuthToken || this.args.sessionInfo.last?.sessionId
  }

  private async connectToWebSocket(): Promise<void> {
    const uri = buildWsUri(
      this.args.baseUriPartsList[this.uriIndex],
      WEBSOCKET_STREAM_PATH
    )

    if (this.websocket != null) {
      // This should never happen. We set the websocket to null in both FSM
      // nodes that lead to this one.
      throw new Error("Websocket already exists")
    }

    logMessage(LOG, "creating WebSocket")

    // NOTE: We repurpose the Sec-WebSocket-Protocol header (set via the second
    // parameter to the WebSocket constructor) here in a slightly unfortunate
    // but necessary way. The browser WebSocket API doesn't allow us to set
    // arbitrary HTTP headers, and this header is the only one where we have
    // the ability to set it to arbitrary values. Thus, we use it to pass an
    // auth token from client to server as the *second* value in the list.
    //
    // The reason why the auth token is set as the second value is that, when
    // Sec-WebSocket-Protocol is set, many clients expect the server to respond
    // with a selected subprotocol to use. We don't want that reply to be the
    // auth token, so we just hard-code it to "streamlit".
    const sessionToken = await this.getSessionToken()
    this.websocket = new WebSocket(uri, [
      "streamlit",
      ...(sessionToken ? [sessionToken] : []),
    ])
    this.websocket.binaryType = "arraybuffer"

    this.setConnectionTimeout(uri)

    const localWebsocket = this.websocket
    const checkWebsocket = (): boolean => localWebsocket === this.websocket

    this.websocket.onmessage = (event: MessageEvent) => {
      if (checkWebsocket()) {
        this.handleMessage(event.data).catch(reason => {
          const err = `Failed to process a Websocket message (${reason})`
          logError(LOG, err)
          this.stepFsm("FATAL_ERROR", err)
        })
      }
    }

    this.websocket.onopen = () => {
      if (checkWebsocket()) {
        logMessage(LOG, "WebSocket onopen")
        this.stepFsm("CONNECTION_SUCCEEDED")
      }
    }

    this.websocket.onclose = () => {
      if (checkWebsocket()) {
        logWarning(LOG, "WebSocket onclose")
        this.closeConnection()
        this.stepFsm("CONNECTION_CLOSED")
      }
    }

    this.websocket.onerror = () => {
      if (checkWebsocket()) {
        logError(LOG, "WebSocket onerror")
        this.closeConnection()
        this.stepFsm("CONNECTION_ERROR")
      }
    }
  }

  private setConnectionTimeout(uri: string): void {
    if (this.wsConnectionTimeoutId != null) {
      // This should never happen. We set the timeout ID to null in both FSM
      // nodes that lead to this one.
      throw new Error("WS timeout is already set")
    }

    const localWebsocket = this.websocket

    this.wsConnectionTimeoutId = window.setTimeout(() => {
      if (localWebsocket !== this.websocket) {
        return
      }

      if (this.wsConnectionTimeoutId == null) {
        // Sometimes the clearTimeout doesn't work. No idea why :-/
        logWarning(LOG, "Timeout fired after cancellation")
        return
      }

      if (this.websocket == null) {
        // This should never happen! The only place we call
        // setConnectionTimeout() should be immediately before setting
        // this.websocket.
        this.closeConnection()
        this.stepFsm("FATAL_ERROR", "Null Websocket in setConnectionTimeout")
        return
      }

      if (this.websocket.readyState === 0 /* CONNECTING */) {
        logMessage(LOG, `${uri} timed out`)
        this.closeConnection()
        this.stepFsm("CONNECTION_TIMED_OUT")
      }
    }, WEBSOCKET_TIMEOUT_MS)
    logMessage(LOG, `Set WS timeout ${this.wsConnectionTimeoutId}`)
  }

  private closeConnection(): void {
    // Need to make sure the websocket is closed in the same function that
    // cancels the connection timer. Otherwise, due to javascript's concurrency
    // model, when the onclose event fires it can get handled in between the
    // two functions, causing two events to be sent to the FSM: a
    // CONNECTION_TIMED_OUT and a CONNECTION_ERROR.

    if (this.websocket) {
      this.websocket.close()
      this.websocket = undefined
    }

    if (this.wsConnectionTimeoutId != null) {
      logMessage(LOG, `Clearing WS timeout ${this.wsConnectionTimeoutId}`)
      window.clearTimeout(this.wsConnectionTimeoutId)
      this.wsConnectionTimeoutId = undefined
    }
  }

  /**
   * Encodes the message with the outgoingMessageType and sends it over the
   * wire.
   */
  public sendMessage(obj: IBackMsg): void {
    if (!this.websocket) {
      return
    }

    const msg = BackMsg.create(obj)
    const buffer = BackMsg.encode(msg).finish()
    this.websocket.send(buffer)
  }

  /**
   * Called when our script has finished running. Calls through
   * to the ForwardMsgCache, to handle cached entry expiry.
   */
  public incrementMessageCacheRunCount(maxMessageAge: number): void {
    this.cache.incrementRunCount(maxMessageAge)
  }

  private async handleMessage(data: ArrayBuffer): Promise<void> {
    // Assign this message an index.
    const messageIndex = this.nextMessageIndex
    this.nextMessageIndex += 1

    PerformanceEvents.record({ name: "BeginHandleMessage", messageIndex })

    const encodedMsg = new Uint8Array(data)
    const msg = ForwardMsg.decode(encodedMsg)

    PerformanceEvents.record({
      name: "DecodedMessage",
      messageIndex,
      messageType: msg.type,
      len: data.byteLength,
    })

    this.messageQueue[messageIndex] = await this.cache.processMessagePayload(
      msg,
      encodedMsg
    )

    PerformanceEvents.record({ name: "GotCachedPayload", messageIndex })

    // Dispatch any pending messages in the queue. This may *not* result
    // in our just-decoded message being dispatched: if there are other
    // messages that were received earlier than this one but are being
    // downloaded, our message won't be sent until they're done.
    while (this.lastDispatchedMessageIndex + 1 in this.messageQueue) {
      const dispatchMessageIndex = this.lastDispatchedMessageIndex + 1
      this.args.onMessage(this.messageQueue[dispatchMessageIndex])
      PerformanceEvents.record({
        name: "DispatchedMessage",
        messageIndex: dispatchMessageIndex,
        messageType: this.messageQueue[dispatchMessageIndex].type,
      })
      delete this.messageQueue[dispatchMessageIndex]
      this.lastDispatchedMessageIndex = dispatchMessageIndex
    }
  }
}

export const StyledBashCode = styled.code({
  "&::before": {
    content: '"$"',
    marginRight: "1ex",
  },
})

/**
 * Attempts to connect to the URIs in uriList (in round-robin fashion) and
 * retries forever until one of the URIs responds with 'ok'.
 * Returns a promise with the index of the URI that worked.
 */
export function doInitPings(
  uriPartsList: BaseUriParts[],
  minimumTimeoutMs: number,
  maximumTimeoutMs: number,
  retryCallback: OnRetry,
  setAllowedOriginsResp: (resp: IAllowedMessageOriginsResponse) => void,
  userCommandLine?: string
): Promise<number> {
  const resolver = new Resolver<number>()
  let totalTries = 0
  let uriNumber = 0

  // Hoist the connect() declaration.
  let connect = (): void => {}

  const retryImmediately = (): void => {
    uriNumber++
    if (uriNumber >= uriPartsList.length) {
      uriNumber = 0
    }

    connect()
  }

  const retry = (errorNode: React.ReactNode): void => {
    // Adjust retry time by +- 20% to spread out load
    const jitter = Math.random() * 0.4 - 0.2
    // Exponential backoff to reduce load from health pings when experiencing
    // persistent failure. Starts at minimumTimeoutMs.
    const timeoutMs =
      totalTries === 1
        ? minimumTimeoutMs
        : minimumTimeoutMs * 2 ** (totalTries - 1) * (1 + jitter)
    const retryTimeout = Math.min(maximumTimeoutMs, timeoutMs)

    retryCallback(totalTries, errorNode, retryTimeout)

    window.setTimeout(retryImmediately, retryTimeout)
  }

  const retryWhenTheresNoResponse = (): void => {
    const uriParts = uriPartsList[uriNumber]
    const uri = new URL(buildHttpUri(uriParts, ""))

    if (uri.hostname === "localhost") {
      const commandLine = userCommandLine || "streamlit run yourscript.py"
      retry(
        <Fragment>
          <p>
            Is Streamlit still running? If you accidentally stopped Streamlit,
            just restart it in your terminal:
          </p>
          <pre>
            <StyledBashCode>{commandLine}</StyledBashCode>
          </pre>
        </Fragment>
      )
    } else {
      retry("Connection failed with status 0.")
    }
  }

  const retryWhenIsForbidden = (): void => {
    retry(
      <Fragment>
        <p>Cannot connect to Streamlit (HTTP status: 403).</p>
        <p>
          If you are trying to access a Streamlit app running on another
          server, this could be due to the app's{" "}
          <a href={CORS_ERROR_MESSAGE_DOCUMENTATION_LINK}>CORS</a> settings.
        </p>
      </Fragment>
    )
  }

  connect = () => {
    const uriParts = uriPartsList[uriNumber]
    const healthzUri = buildHttpUri(uriParts, SERVER_PING_PATH)
    const allowedOriginsUri = buildHttpUri(uriParts, ALLOWED_ORIGINS_PATH)

    logMessage(LOG, `Attempting to connect to ${healthzUri}.`)

    if (uriNumber === 0) {
      totalTries++
    }

    // We fire off requests to the server's healthz and allowed message origins
    // endpoints in parallel to avoid having to wait on too many sequential
    // round trip network requests before we can try to establish a WebSocket
    // connection. Technically, it would have been possible to implement a
    // single "get server health and origins whitelist" endpoint, but we chose
    // not to do so as it's semantically cleaner to not give the healthcheck
    // endpoint additional responsibilities.
    Promise.all([
      axios.get(healthzUri, { timeout: PING_TIMEOUT_MS }),
      axios.get(allowedOriginsUri, { timeout: PING_TIMEOUT_MS }),
    ])
      .then(([_, originsResp]) => {
        setAllowedOriginsResp(originsResp.data)
        resolver.resolve(uriNumber)
      })
      .catch(error => {
        if (error.code === "ECONNABORTED") {
          return retry("Connection timed out.")
        }

        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx

          const { data, status } = error.response

          if (status === /* NO RESPONSE */ 0) {
            return retryWhenTheresNoResponse()
          }
          if (status === 403) {
            return retryWhenIsForbidden()
          }
          return retry(
            `Connection failed with status ${status}, ` +
              `and response "${data}".`
          )
        }
        if (error.request) {
          // The request was made but no response was received
          // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
          // http.ClientRequest in node.js
          return retryWhenTheresNoResponse()
        }
        // Something happened in setting up the request that triggered an Error
        return retry(error.message)
      })
  }

  connect()

  return resolver.promise
}
