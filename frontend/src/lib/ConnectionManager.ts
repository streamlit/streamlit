/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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

import url from "url"

import { ConnectionState } from "./ConnectionState"
import { ForwardMsg } from "autogen/proto"
import { IS_SHARED_REPORT } from "./baseconsts"
import { ReactNode } from "react"
import { StaticConnection } from "./StaticConnection"
import { WebsocketConnection } from "./WebsocketConnection"
import { configureCredentials, getObject } from "./s3helper"
import { logError } from "./log"
import { getWindowBaseUriParts } from "lib/UriUtil"

/**
 * When the websocket connection retries this many times, we show a dialog
 * letting the user know we're having problems connecting.
 */
const RETRY_COUNT_FOR_WARNING = 30 // around 15s

interface Props {
  /**
   * Function that shows the user a login box and returns a promise which
   * gets resolved when the user goes through the login flow.
   */
  getUserLogin: () => Promise<string>

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

  public constructor(props: Props) {
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

  public sendMessage(obj: any): void {
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
      onConnectionStateChange: s => this.setConnectionState(s),
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
    const manifest = await this.fetchManifestWithPossibleLogin(reportId)

    return manifest.serverStatus === "running"
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
    } = manifest

    const baseUriPartsList = configuredServerAddress
      ? [{ host: configuredServerAddress, port: serverPort }]
      : [
          { host: externalServerIP, port: serverPort },
          { host: internalServerIP, port: serverPort },
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
    manifest: any
  ): StaticConnection {
    return new StaticConnection({
      manifest,
      reportId,
      onMessage: this.props.onMessage,
      onConnectionStateChange: s => this.setConnectionState(s),
    })
  }

  private async fetchManifestWithPossibleLogin(
    reportId: string
  ): Promise<any> {
    let manifest
    let permissionError = false

    try {
      manifest = await fetchManifest(reportId)
    } catch (err) {
      if (err.message === "PermissionError") {
        permissionError = true
      } else {
        logError(err)
        throw new Error("Unable to fetch app.")
      }
    }

    if (permissionError) {
      const idToken = await this.props.getUserLogin()
      try {
        await configureCredentials(idToken)
        manifest = await fetchManifest(reportId)
      } catch (err) {
        logError(err)
        throw new Error("Unable to log in.")
      }
    }

    if (!manifest) {
      throw new Error("Unknown error fetching app.")
    }

    return manifest
  }
}

async function fetchManifest(reportId: string): Promise<any> {
  const { hostname, pathname } = url.parse(window.location.href, true)
  if (pathname == null) {
    throw new Error(`No pathname in URL ${window.location.href}`)
  }

  // IMPORTANT: The bucket name must match the host name!
  const bucket = hostname
  const version = pathname.split("/")[1]
  const manifestKey = `${version}/reports/${reportId}/manifest.json`
  const data = await getObject({ Bucket: bucket, Key: manifestKey })
  return data.json()
}
