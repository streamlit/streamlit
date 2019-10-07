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

import { IS_DEV_ENV, WEBSOCKET_PORT_DEV } from "lib/baseconsts"

/**
 * host:port tuple
 */
export interface BaseUriParts {
  host: string
  port: number
}

/**
 * Return the BaseUriParts for the global window
 */
export function getWindowBaseUriParts(): BaseUriParts {
  // If dev, always connect to 8501, since window.location.port is the Node
  // server's port 3000.
  // If changed, also change config.py
  const host = window.location.hostname
  const port = IS_DEV_ENV
    ? WEBSOCKET_PORT_DEV
    : window.location.port
    ? Number(window.location.port)
    : isHttps()
    ? 443
    : 80
  return { host, port }
}

/**
 * Create a ws:// or wss:// URI for the given path.
 */
export function buildWsUri(
  { host, port }: BaseUriParts,
  path: string
): string {
  const protocol = isHttps() ? "wss" : "ws"
  return `${protocol}://${host}:${port}/${path}`
}

/**
 * Create an HTTP URI for the given path.
 */
export function buildHttpUri(
  { host, port }: BaseUriParts,
  path: string
): string {
  const protocol = isHttps() ? "https" : "http"
  return `${protocol}://${host}:${port}/${path}`
}

/**
 * True if we're connected to the host via HTTPS.
 */
function isHttps(): boolean {
  return window.location.href.startsWith("https://")
}
