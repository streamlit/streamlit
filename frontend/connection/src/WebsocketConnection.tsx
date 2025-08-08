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

import { getLogger } from "loglevel"

import { BackMsg, ForwardMsg, IBackMsg } from "@streamlit/protobuf"
import {
  getCookie,
  isNullOrUndefined,
  notNullOrUndefined,
} from "@streamlit/utils"

import { ConnectionState } from "./ConnectionState"
import {
  PING_MAXIMUM_RETRY_PERIOD_MS,
  PING_MINIMUM_RETRY_PERIOD_MS,
  WEBSOCKET_STREAM_PATH,
  WEBSOCKET_TIMEOUT_MS,
} from "./constants"
import {
  AsyncPingRequest,
  doInitPings,
  PingCancelledError,
} from "./DoInitPings"
import { ForwardMsgCache } from "./ForwardMessageCache"
import {
  Event,
  IHostConfigResponse,
  OnConnectionStateChange,
  OnMessage,
  OnRetry,
  StreamlitEndpoints,
} from "./types"
import { buildWsUri } from "./utils"

export interface Args {
  /** The application's SessionInfo instance */
  getLastSessionId: () => string | undefined

  endpoints: StreamlitEndpoints

  /**
   * List of URLs to connect to. We'll try the first, then the second, etc. If
   * all fail, we'll retry from the top. The number of retries depends on
   * whether this is a local connection.
   */
  baseUriPartsList: URL[]

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
   * Sends message to host when websocket connection errors encountered to
   * inform where/why the error occurred.
   */
  sendClientError: (
    error: string | number,
    message: string,
    source: string
  ) => void

  /**
   * Function to set the host config and allowed-message-origins for this app (if in a relevant deployment
   * scenario).
   */
  onHostConfigResp: (resp: IHostConfigResponse) => void
}

interface MessageQueue {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  [index: number]: any
}

const LOG = getLogger("WebsocketConnection")

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
   * The AsyncPingRequest returned by doInitPings.
   */
  private pingRequest?: AsyncPingRequest

  /**
   * WebSocket objects don't support retries, so we have to implement them
   * ourselves. We use setTimeout to wait for a connection and retry once the
   * timeout fires. This field stores the timer ID from setTimeout, so we can
   * cancel it if needed.
   */
  private wsConnectionTimeout?: NodeJS.Timeout | number

  constructor(props: Args) {
    this.args = props
    this.cache = new ForwardMsgCache()
    this.stepFsm("INITIALIZED")
  }

  /**
   * Return the BaseUriParts for the server we're connected to,
   * if we are connected to a server.
   */
  public getBaseUriParts(): URL | undefined {
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
    LOG.info(`New state: ${state}`)
    this.state = state

    // Perform pre-callback actions when entering certain states.
    switch (this.state) {
      case ConnectionState.PINGING_SERVER:
        // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
        this.pingServer()
        break

      default:
        break
    }

    this.args.onConnectionStateChange(state, errMsg)

    // Perform post-callback actions when entering certain states.
    switch (this.state) {
      case ConnectionState.CONNECTING:
        // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
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
    LOG.info(`State: ${this.state}; Event: ${event}`)

    if (
      event === "FATAL_ERROR" &&
      this.state !== ConnectionState.DISCONNECTED_FOREVER
    ) {
      LOG.error(
        `Client Error: Websocket connection encountered fatal error - ${errMsg}`
      )
      this.args.sendClientError(
        "Websocket connection fatal error encountered",
        // @ts-expect-error - errMsg always passed with FATAL_ERROR event
        errMsg,
        "Websocket Connection"
      )
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
        LOG.warn(
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

  private async pingServer(): Promise<void> {
    this.pingRequest = doInitPings(
      this.args.baseUriPartsList,
      PING_MINIMUM_RETRY_PERIOD_MS,
      PING_MAXIMUM_RETRY_PERIOD_MS,
      this.args.onRetry,
      this.args.sendClientError,
      this.args.onHostConfigResp
    )

    try {
      this.uriIndex = await this.pingRequest.promise
      this.pingRequest = undefined
      this.stepFsm("SERVER_PING_SUCCEEDED")
    } catch (e) {
      if (e instanceof PingCancelledError) {
        // This is an expected error when the connection is cancelled.
        // We don't need to do anything here.
        LOG.info("Ping cancelled")
      } else {
        // This is an unexpected error.
        this.stepFsm("FATAL_ERROR", e instanceof Error ? e.message : String(e))
      }
    } finally {
      // Reset the ping request to avoid memory leaks
      this.pingRequest = undefined
    }
  }

  /**
   * Get the session tokens to use to initialize a WebSocket connection.
   *
   * This method returns an array containing either one or two elements:
   *   1. The first element contains an auth token to be used in environments
   *      where the parent frame of this app needs to pass down an external
   *      auth token. If no token is provided, a placeholder is used.
   *   2. The second element is the session ID to attempt to reconnect to if
   *      one is available (that is, if this websocket has disconnected and is
   *      reconnecting). On the initial connection attempt, this is unset and
   *      the return value of this method is a singleton array.
   */
  private async getSessionTokens(): Promise<Array<string>> {
    const hostAuthToken = await this.args.claimHostAuthToken()
    const xsrfCookie = getCookie("_streamlit_xsrf")
    this.args.resetHostAuthToken()
    const lastSessionId = this.args.getLastSessionId()
    return [
      // NOTE: We have to set the auth token to some arbitrary placeholder if
      // not provided since the empty string is an invalid protocol option.
      hostAuthToken ?? xsrfCookie ?? "PLACEHOLDER_AUTH_TOKEN",
      ...(lastSessionId ? [lastSessionId] : []),
    ]
  }

  private async connectToWebSocket(): Promise<void> {
    const uri = buildWsUri(
      this.args.baseUriPartsList[this.uriIndex],
      WEBSOCKET_STREAM_PATH
    )

    if (notNullOrUndefined(this.websocket)) {
      // This should never happen. We set the websocket to null in both FSM
      // nodes that lead to this one.
      throw new Error("Websocket already exists")
    }

    LOG.info("creating WebSocket")

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
    const sessionTokens = await this.getSessionTokens()
    this.websocket = new WebSocket(uri, ["streamlit", ...sessionTokens])
    this.websocket.binaryType = "arraybuffer"

    this.setConnectionTimeout(uri)

    const localWebsocket = this.websocket
    const checkWebsocket = (): boolean => localWebsocket === this.websocket

    this.websocket.addEventListener("message", (event: MessageEvent) => {
      if (checkWebsocket()) {
        this.handleMessage(event.data).catch(reason => {
          const err = `Failed to process a Websocket message. ${reason}`
          LOG.error(err)
          this.stepFsm("FATAL_ERROR", err)
        })
      }
    })

    this.websocket.addEventListener("open", () => {
      if (checkWebsocket()) {
        LOG.info("WebSocket onopen")
        this.stepFsm("CONNECTION_SUCCEEDED")
      }
    })

    this.websocket.addEventListener("close", () => {
      if (checkWebsocket()) {
        LOG.warn("WebSocket onclose")
        this.closeConnection()
        this.stepFsm("CONNECTION_CLOSED")
      }
    })

    this.websocket.addEventListener("error", (event: unknown) => {
      if (checkWebsocket()) {
        LOG.error("Client Error: WebSocket onerror")
        this.args.sendClientError(
          "Websocket connection onerror triggered",
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- TODO: Fix this
          `Error: ${event}`,
          "Websocket Connection"
        )
        this.closeConnection()
        this.stepFsm("CONNECTION_ERROR")
      }
    })
  }

  private setConnectionTimeout(uri: string): void {
    if (notNullOrUndefined(this.wsConnectionTimeout)) {
      // This should never happen. We set the timeout ID to null in both FSM
      // nodes that lead to this one.
      throw new Error("WS timeout is already set")
    }

    const localWebsocket = this.websocket

    this.wsConnectionTimeout = globalThis.setTimeout(() => {
      if (localWebsocket !== this.websocket) {
        return
      }

      if (isNullOrUndefined(this.wsConnectionTimeout)) {
        // Sometimes the clearTimeout doesn't work. No idea why :-/
        LOG.warn("Timeout fired after cancellation")
        return
      }

      if (isNullOrUndefined(this.websocket)) {
        // This should never happen! The only place we call
        // setConnectionTimeout() should be immediately before setting
        // this.websocket.
        this.closeConnection()
        this.stepFsm("FATAL_ERROR", "Null Websocket in setConnectionTimeout")
        return
      }

      if (this.websocket.readyState === 0 /* CONNECTING */) {
        LOG.info(`Client error: ${uri} timed out`)
        this.args.sendClientError(
          "Websocket connection timed out",
          `${uri} timed out`,
          "Websocket Connection"
        )
        this.closeConnection()
        this.stepFsm("CONNECTION_TIMED_OUT")
      }
    }, WEBSOCKET_TIMEOUT_MS)
    LOG.info(`Set WS timeout ${Number(this.wsConnectionTimeout)}`)
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

    if (notNullOrUndefined(this.wsConnectionTimeout)) {
      LOG.info(`Clearing WS timeout ${Number(this.wsConnectionTimeout)}`)
      globalThis.clearTimeout(this.wsConnectionTimeout)
      this.wsConnectionTimeout = undefined
    }

    if (this.pingRequest) {
      this.pingRequest.cancel()
      this.pingRequest = undefined
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
  public incrementMessageCacheRunCount(
    maxMessageAge: number,
    fragmentIdsThisRun: string[]
  ): void {
    this.cache.incrementRunCount(maxMessageAge, fragmentIdsThisRun)
  }

  /**
   * Return a list of all the hashes of messages currently in the cache.
   */
  public getCachedMessageHashes(): string[] {
    return this.cache.getCachedMessageHashes()
  }

  private async handleMessage(data: ArrayBuffer): Promise<void> {
    // Assign this message an index.
    const messageIndex = this.nextMessageIndex
    this.nextMessageIndex += 1

    const encodedMsg = new Uint8Array(data)
    const msg = ForwardMsg.decode(encodedMsg)

    this.messageQueue[messageIndex] = await this.cache.processMessagePayload(
      msg,
      encodedMsg
    )

    // Dispatch any pending messages in the queue. This may *not* result
    // in our just-decoded message being dispatched: if there are other
    // messages that were received earlier than this one but are being
    // downloaded, our message won't be sent until they're done.
    while (this.lastDispatchedMessageIndex + 1 in this.messageQueue) {
      const dispatchMessageIndex = this.lastDispatchedMessageIndex + 1
      this.args.onMessage(this.messageQueue[dispatchMessageIndex])

      delete this.messageQueue[dispatchMessageIndex]
      this.lastDispatchedMessageIndex = dispatchMessageIndex
    }
  }
}
