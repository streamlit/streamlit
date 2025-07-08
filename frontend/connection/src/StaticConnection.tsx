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

import { ForwardMsgList } from "@streamlit/protobuf"
import { localStorageAvailable } from "@streamlit/utils"

import { ConnectionState } from "./ConnectionState"
import { StreamlitEndpoints } from "./types"

// TODO: Change this to a stable location and eventually make it configurable
// Holds url for static asset location
export const STATIC_ASSET_CONFIG = "https://data.streamlit.io/static.json"
export const LOG = getLogger("StaticConnection")

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
type OnMessage = (ForwardMsg: any) => void
type OnConnectionStateChange = (
  connectionState: ConnectionState,
  errMsg?: string
) => void

// Fetches the static asset url from the config file
export async function getStaticConfig(): Promise<string> {
  const isLocalStoreAvailable = localStorageAvailable()
  let staticConfigUrl = ""

  // Pull static asset url from localStorage if available
  if (isLocalStoreAvailable) {
    const cachedStaticConfigUrl =
      window.localStorage.getItem("stStaticAssetUrl")
    if (cachedStaticConfigUrl) {
      return cachedStaticConfigUrl
    }
  }

  // Otherwise, fetch url from config file
  try {
    const response = await fetch(STATIC_ASSET_CONFIG, {
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      LOG.error("Failed to fetch static config url: ", response.status)
    } else {
      const config = await response.json()
      staticConfigUrl = config.static_url ?? undefined

      // Set in localStorage
      if (isLocalStoreAvailable && staticConfigUrl) {
        window.localStorage.setItem("stStaticAssetUrl", staticConfigUrl)
      }
    }
  } catch (err) {
    LOG.error("Failed to fetch static config url:", err)
  }

  return staticConfigUrl
}

// Fetches FowardMsg protos from S3 for static streamlit apps
// First, gets the location of the static assets from url in the config
// Then fetches the protos from that location
export async function getProtoResponse(
  staticAppId: string,
  staticConfigUrl: string
): Promise<null | ArrayBuffer> {
  // Fetch the static app's protos with the given url
  const path = `${staticConfigUrl}/${staticAppId}/protos.pb`
  const response = await fetch(path, {
    signal: AbortSignal.timeout(5000),
  })

  if (!response.ok) {
    LOG.error(
      `Failed to fetch static app protos for id: ${staticAppId}`,
      response.status
    )
  } else {
    return response.arrayBuffer()
  }

  return null
}

// Triggers fetch of static app assets and dispatches ForwardMsgs to be handled
// by App.tsx's handleMessage, replicating the app
export async function dispatchAppForwardMessages(
  staticAppId: string,
  staticConfigUrl: string,
  onMessage: OnMessage,
  onConnectionError: (message: string) => void
): Promise<void> {
  const arrayBuffer = await getProtoResponse(staticAppId, staticConfigUrl)

  if (!arrayBuffer) {
    LOG.error("Failed to retrieve static app protos")
    onConnectionError(
      `Failed to retrieve static app protos. Please confirm the id is correct and try again. Given static app id: ${staticAppId}`
    )
    return
  }

  // Transforms our arrayBuffer response into ForwardMsgList protos
  const forwardMsgList = ForwardMsgList.decode(new Uint8Array(arrayBuffer))

  // Dispatches each ForwardMsg to be handled by App.tsx's handleMessage
  forwardMsgList.messages.forEach(msg => {
    onMessage(msg)
  })
}

export async function establishStaticConnection(
  staticAppId: string,
  onConnectionStateChange: OnConnectionStateChange,
  onMessage: OnMessage,
  onConnectionError: (message: string) => void,
  endpoints: StreamlitEndpoints
): Promise<void> {
  // Static notebooks are not connected to a server - put into connecting
  // state until assets fetched/loaded from S3
  onConnectionStateChange(ConnectionState.STATIC_CONNECTING)

  // Fetch and set the static config url used for media
  const staticConfigUrl = await getStaticConfig()
  endpoints.setStaticConfigUrl(staticConfigUrl)

  // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
  dispatchAppForwardMessages(
    staticAppId,
    staticConfigUrl,
    onMessage,
    onConnectionError
  )

  // Once protos are fetched & dispatched, we are connected
  onConnectionStateChange(ConnectionState.STATIC_CONNECTED)
}

export default establishStaticConnection
