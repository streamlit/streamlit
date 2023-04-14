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
import { ReactNode } from "react"

import { BackMsg, ForwardMsg } from "src/autogen/proto"
import { IAllowedMessageOriginsResponse } from "src/hocs/withHostCommunication/types"
import { BaseUriParts, getPossibleBaseUris } from "src/lib/UriUtil"

import { ConnectionState } from "./ConnectionState"
import { logError } from "../../lib/log"
import { SessionInfo } from "../../lib/SessionInfo"
import { StreamlitEndpoints } from "../../lib/StreamlitEndpoints"
import { WebsocketConnection } from "./WebsocketConnection"
import { ensureError } from "../../lib/ErrorHandling"

/**
 * When the websocket connection retries this many times, we show a dialog
 * letting the user know we're having problems connecting. This happens
 * after about 15 seconds as, before the 6th retry, we've set timeouts for
 * a total of approximately 0.5 + 1 + 2 + 4 + 8 = 15.5 seconds (+/- some
 * due to jitter).
 */
const RETRY_COUNT_FOR_WARNING = 6

interface Props {
  /** The app's SessionInfo instance */
  sessionInfo: SessionInfo

  /** The app's StreamlitEndpoints instance */
  endpoints: StreamlitEndpoints

  /**
   * Function to be called when we receive a message from the server.
   */
  onMessage: (message: ForwardMsg) => void

  /**
   * Function to be called when the connection errors out.
   */
  onConnectionError: (errNode: ReactNode) => void

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
   * Function to set the list of origins that this app should accept
   * cross-origin messages from (if in a relevant deployment scenario).
   */
  setAllowedOriginsResp: (resp: IAllowedMessageOriginsResponse) => void
}

/**
 * Manages our connection to the Server.
 */
export class ConnectionManager {
  private readonly props: Props

  private connection?: WebsocketConnection

  private connectionState: ConnectionState = ConnectionState.INITIAL

  constructor(props: Props) {
    this.props = props

    // This method returns a promise, but we don't care about its result.
    this.connect()
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
  public getBaseUriParts(): BaseUriParts | undefined {
    if (this.connection instanceof WebsocketConnection) {
      return this.connection.getBaseUriParts()
    }
    return undefined
  }

  public sendMessage(obj: BackMsg): void {
    if (this.connection instanceof WebsocketConnection && this.isConnected()) {
      this.connection.sendMessage(obj)
    } else {
      // Don't need to make a big deal out of this. Just print to console.
      logError(`Cannot send message when server is disconnected: ${obj}`)
    }
  }

  /**
   * Increment the runCount on our message cache, and clear entries
   * whose age is greater than the max.
   */
  public incrementMessageCacheRunCount(maxMessageAge: number): void {
    // StaticConnection does not use a MessageCache.
    if (this.connection instanceof WebsocketConnection) {
      this.connection.incrementMessageCacheRunCount(maxMessageAge)
    }
  }

  private async connect(): Promise<void> {
    try {
      this.connection = await this.connectToRunningServer()
    } catch (e) {
      const err = ensureError(e)
      logError(err.message)
      this.setConnectionState(
        ConnectionState.DISCONNECTED_FOREVER,
        err.message
      )
    }
  }

  disconnect(): void {
    this.connection?.disconnect()
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
      this.props.onConnectionError(errMsg || "unknown")
    }
  }

  private showRetryError = (
    totalRetries: number,
    latestError: ReactNode,
    // The last argument of this function is unused and exists because the
    // WebsocketConnection.OnRetry type allows a third argument to be set to be
    // used in tests.
    _retryTimeout: number
  ): void => {
    if (totalRetries === RETRY_COUNT_FOR_WARNING) {
      this.props.onConnectionError(latestError)
    }
  }

  private connectToRunningServer(): WebsocketConnection {
    const baseUriPartsList = getPossibleBaseUris()

    return new WebsocketConnection({
      sessionInfo: this.props.sessionInfo,
      endpoints: this.props.endpoints,
      baseUriPartsList,
      onMessage: this.props.onMessage,
      onConnectionStateChange: this.setConnectionState,
      onRetry: this.showRetryError,
      claimHostAuthToken: this.props.claimHostAuthToken,
      resetHostAuthToken: this.props.resetHostAuthToken,
      setAllowedOriginsResp: this.props.setAllowedOriginsResp,
    })
  }
}
