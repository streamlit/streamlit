/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

import { BackMsg, ForwardMsg, StaticManifest } from "autogen/proto"
import { BaseUriParts, getWindowBaseUriParts } from "lib/UriUtil"
import { ReactNode } from "react"
import url from "url"
import { IS_SHARED_REPORT } from "./baseconsts"

import { ConnectionState } from "./ConnectionState"
import { logError } from "./log"
import { getReportObject } from "./s3helper"
import { StaticConnection } from "./StaticConnection"
import { WebsocketConnection } from "./WebsocketConnection"

/**
 * When the websocket connection retries this many times, we show a dialog
 * letting the user know we're having problems connecting.
 */
const RETRY_COUNT_FOR_WARNING = 30 // around 15s

interface Props {
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
}

/**
 * Manages our connection to the Server.
 */
export class ConnectionManager {
  private readonly props: Props
  private connection?: WebsocketConnection | StaticConnection
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

  // A "static" connection is the one that runs in S3
  public isStaticConnection(): boolean {
    return this.connectionState === ConnectionState.STATIC
  }

  /**
   * Return the BaseUriParts for the server we're connected to,
   * if we are connected to a server.
   */
  public getBaseUriParts(): BaseUriParts | undefined {
    if (this.connection instanceof WebsocketConnection) {
      return this.connection.getBaseUriParts()
    } else {
      return undefined
    }
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
      if (IS_SHARED_REPORT) {
        const { query } = url.parse(window.location.href, true)
        const reportId = query.id as string
        this.connection = await this.connectBasedOnManifest(reportId)
      } else {
        this.connection = await this.connectToRunningServer()
      }
    } catch (err) {
      logError(err.message)
      this.setConnectionState(
        ConnectionState.DISCONNECTED_FOREVER,
        err.message
      )
    }
  }

  private setConnectionState = (
    connectionState: ConnectionState,
    errMsg?: string
  ): void => {
    if (this.connectionState !== connectionState) {
      this.connectionState = connectionState
      this.props.connectionStateChanged(connectionState)
    }

    if (errMsg || connectionState === ConnectionState.DISCONNECTED_FOREVER) {
      this.props.onConnectionError(errMsg || "unknown")
    }
  }

  private showRetryError = (
    totalRetries: number,
    latestError: ReactNode
  ): void => {
    if (totalRetries === RETRY_COUNT_FOR_WARNING) {
      this.props.onConnectionError(latestError)
    }
  }

  private connectToRunningServer(): WebsocketConnection {
    const baseUriParts = getWindowBaseUriParts()

    return new WebsocketConnection({
      baseUriPartsList: [baseUriParts],
      onMessage: this.props.onMessage,
      onConnectionStateChange: this.setConnectionState,
      onRetry: this.showRetryError,
    })
  }

  /**
   * Opens either a static connection or a websocket connection, based on what
   * the manifest says.
   */
  private async connectBasedOnManifest(
    reportId: string
  ): Promise<WebsocketConnection | StaticConnection> {
    const manifest = await ConnectionManager.fetchManifest(reportId)

    return manifest.serverStatus === StaticManifest.ServerStatus.RUNNING
      ? this.connectToRunningServerFromManifest(manifest)
      : this.connectToStaticReportFromManifest(reportId, manifest)
  }

  private connectToRunningServerFromManifest(
    manifest: any
  ): WebsocketConnection {
    const {
      configuredServerAddress,
      internalServerIP,
      externalServerIP,
      serverPort,
      serverBasePath,
    } = manifest

    const parts = { port: serverPort, basePath: serverBasePath }

    const baseUriPartsList = configuredServerAddress
      ? [{ ...parts, host: configuredServerAddress }]
      : [
          { ...parts, host: externalServerIP },
          { ...parts, host: internalServerIP },
        ]

    return new WebsocketConnection({
      baseUriPartsList,
      onMessage: this.props.onMessage,
      onConnectionStateChange: s => this.setConnectionState(s),
      onRetry: this.showRetryError,
    })
  }

  private connectToStaticReportFromManifest(
    reportId: string,
    manifest: StaticManifest
  ): StaticConnection {
    return new StaticConnection({
      manifest,
      reportId,
      onMessage: this.props.onMessage,
      onConnectionStateChange: s => this.setConnectionState(s),
    })
  }

  private static async fetchManifest(
    reportId: string
  ): Promise<StaticManifest> {
    try {
      const data = await getReportObject(reportId, "manifest.pb")
      const arrayBuffer = await data.arrayBuffer()

      return StaticManifest.decode(new Uint8Array(arrayBuffer))
    } catch (err) {
      logError(err)
      throw new Error("Unable to fetch data.")
    }
  }
}
