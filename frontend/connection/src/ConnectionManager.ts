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

import { BackMsg, ForwardMsg } from "@streamlit/protobuf"

import { ConnectionState } from "./ConnectionState"
import { MAX_RETRIES_BEFORE_CLIENT_ERROR } from "./constants"
import { establishStaticConnection } from "./StaticConnection"
import { IHostConfigResponse, StreamlitEndpoints } from "./types"
import { getPossibleBaseUris } from "./utils"
import { WebsocketConnection } from "./WebsocketConnection"

const LOG = getLogger("ConnectionManager")

interface Props {
  /** The app's SessionInfo instance */
  getLastSessionId: () => string | undefined

  /** The app's StreamlitEndpoints instance */
  endpoints: StreamlitEndpoints

  /**
   * Function to be called when we receive a message from the server.
   */
  onMessage: (message: ForwardMsg) => void

  /**
   * Function to be called when the connection errors out.
   */
  onConnectionError: (errNode: string) => void

  /**
   * Called when our ConnectionState is changed.
   */
  connectionStateChanged: (connectionState: ConnectionState) => void

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
   * Function to set the host config for this app (if in a relevant deployment
   * scenario).
   */
  onHostConfigResp: (resp: IHostConfigResponse) => void
}

/**
 * Manages our connection to the Server.
 */
export class ConnectionManager {
  private readonly props: Props

  private websocketConnection?: WebsocketConnection | null

  private connectionState: ConnectionState = ConnectionState.INITIAL

  constructor(props: Props) {
    this.props = props

    // This method returns a promise, but we don't care about its result.
    void this.connect()
  }

  /**
   * Indicates whether we're connected to the server.
   */
  public isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED
  }

  /**
   * Return the BaseUriParts for the server we're connected to,
   * if we are connected to a server.
   */
  public getBaseUriParts(): URL | undefined {
    if (this.websocketConnection instanceof WebsocketConnection) {
      return this.websocketConnection.getBaseUriParts()
    }
    return undefined
  }

  public sendMessage(obj: BackMsg): void {
    if (
      this.websocketConnection instanceof WebsocketConnection &&
      this.isConnected()
    ) {
      this.websocketConnection.sendMessage(obj)
    } else {
      // Don't need to make a big deal out of this. Just print to console.
      // eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions -- TODO: Fix this
      LOG.error(`Cannot send message when server is disconnected: ${obj}`)
    }
  }

  /**
   * Increment the runCount on our message cache, and clear entries
   * whose age is greater than the max.
   */
  public incrementMessageCacheRunCount(
    maxMessageAge: number,
    fragmentIdsThisRun: string[]
  ): void {
    // StaticConnection does not use a MessageCache.
    if (this.websocketConnection instanceof WebsocketConnection) {
      this.websocketConnection.incrementMessageCacheRunCount(
        maxMessageAge,
        fragmentIdsThisRun
      )
    }
  }

  public getCachedMessageHashes(): string[] {
    // StaticConnection does not use a MessageCache.
    if (this.websocketConnection instanceof WebsocketConnection) {
      return this.websocketConnection?.getCachedMessageHashes() ?? []
    }
    return []
  }

  /**
   * Checks query params to determine if static notebook Id has been passed.
   * If so, returns the Id.
   */
  private checkStaticConnection(): string | null {
    const queryParams = new URLSearchParams(document.location.search)
    return queryParams.get("staticAppId")
  }

  /**
   * Establish either a WebsocketConnection or StaticConnection
   * based on query params.
   */
  private async connect(): Promise<void> {
    const staticAppId = this.checkStaticConnection()

    if (staticAppId) {
      // Establish a static connection
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
      establishStaticConnection(
        staticAppId,
        this.setConnectionState,
        this.props.onMessage,
        this.props.onConnectionError,
        this.props.endpoints
      )
      // Static apps are not connected to server, so saving the
      // connection is unnecessary.
      this.websocketConnection = null
    } else {
      // Establish a websocket connection
      try {
        // eslint-disable-next-line @typescript-eslint/await-thenable -- TODO: Fix this
        this.websocketConnection = await this.connectToRunningServer()
      } catch (e) {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- TODO: Fix this
        const err = e instanceof Error ? e : new Error(`${e}`)
        LOG.error(`Client Error: Websocket connection - ${err.message}`)
        this.props.sendClientError(
          "Failed to establish websocket connection",
          err.message,
          "Connection Manager"
        )
        this.setConnectionState(
          ConnectionState.DISCONNECTED_FOREVER,
          err.message
        )
      }
    }
  }

  disconnect(): void {
    this.websocketConnection?.disconnect()
  }

  private setConnectionState = (
    connectionState: ConnectionState,
    errMsg?: string
  ): void => {
    if (this.connectionState !== connectionState) {
      this.connectionState = connectionState
      this.props.connectionStateChanged(connectionState)
    }

    if (errMsg) {
      this.props.onConnectionError(errMsg)
    }
  }

  private showRetryError = (
    totalRetries: number,
    latestError: string,
    // The last argument of this function is unused and exists because the
    // WebsocketConnection.OnRetry type allows a third argument to be set to be
    // used in tests.
    _retryTimeout: number
  ): void => {
    if (totalRetries >= MAX_RETRIES_BEFORE_CLIENT_ERROR) {
      this.props.onConnectionError(latestError)
    }
  }

  private connectToRunningServer(): WebsocketConnection {
    const baseUriPartsList = getPossibleBaseUris()
    return new WebsocketConnection({
      getLastSessionId: this.props.getLastSessionId,
      endpoints: this.props.endpoints,
      baseUriPartsList,
      onMessage: this.props.onMessage,
      onConnectionStateChange: this.setConnectionState,
      onRetry: this.showRetryError,
      claimHostAuthToken: this.props.claimHostAuthToken,
      resetHostAuthToken: this.props.resetHostAuthToken,
      sendClientError: this.props.sendClientError,
      onHostConfigResp: this.props.onHostConfigResp,
    })
  }
}
