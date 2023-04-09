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

import { take } from "lodash"

import { IS_DEV_ENV, WEBSOCKET_PORT_DEV } from "src/lib/baseconsts"
import DOMPurify from "dompurify"

/**
 * host:port tuple
 */
export interface BaseUriParts {
  host: string
  port: number
  basePath: string
}

const FINAL_SLASH_RE = /\/+$/
const INITIAL_SLASH_RE = /^\/+/
export const SVG_PREFIX = "data:image/svg+xml,"

/**
 * Return the BaseUriParts for the global window
 */
export function getWindowBaseUriParts(): BaseUriParts {
  // If dev, always connect to 8501, since window.location.port is the Node
  // server's port 3000.
  // If changed, also change config.py
  const host = window.location.hostname

  let port
  if (IS_DEV_ENV) {
    port = WEBSOCKET_PORT_DEV
  } else if (window.location.port) {
    port = Number(window.location.port)
  } else {
    port = isHttps() ? 443 : 80
  }

  const basePath = window.location.pathname
    .replace(FINAL_SLASH_RE, "")
    .replace(INITIAL_SLASH_RE, "")

  return { host, port, basePath }
}

// NOTE: In the multipage apps world, there is some ambiguity around whether a
// path like "foo/bar" means
//   * the page "/" at baseUrlPath "foo/bar", or
//   * the page "/bar" at baseUrlPath "foo".
// To resolve this, we just try both possibilities for now, but this leads to
// the unfortunate consequence of the initial page load when navigating directly
// to a non-main page of an app being slower than navigating to the main page
// (as the first attempt at connecting to the server fails the healthcheck).
//
// We'll want to improve this situation in the near future, but figuring out
// the best path forward may be tricky as I wasn't able to come up with an
// easy solution covering every deployment scenario.
export function getPossibleBaseUris(): Array<BaseUriParts> {
  const baseUriParts = getWindowBaseUriParts()
  const { basePath } = baseUriParts

  if (!basePath) {
    return [baseUriParts]
  }

  const parts = basePath.split("/")
  const possibleBaseUris: Array<BaseUriParts> = []

  while (parts.length > 0) {
    possibleBaseUris.push({
      ...baseUriParts,
      basePath: parts.join("/"),
    })
    parts.pop()
  }

  possibleBaseUris.push({
    ...baseUriParts,
    basePath: "",
  })

  return take(possibleBaseUris, 2)
}

/**
 * Create a ws:// or wss:// URI for the given path.
 */
export function buildWsUri(
  { host, port, basePath }: BaseUriParts,
  path: string
): string {
  const protocol = isHttps() ? "wss" : "ws"
  const fullPath = makePath(basePath, path)
  return `${protocol}://${host}:${port}/${fullPath}`
}

/**
 * Create an HTTP URI for the given path.
 */
export function buildHttpUri(
  { host, port, basePath }: BaseUriParts,
  path: string
): string {
  const protocol = isHttps() ? "https" : "http"
  const fullPath = makePath(basePath, path)
  return `${protocol}://${host}:${port}/${fullPath}`
}

function makePath(basePath: string, subPath: string): string {
  basePath = basePath.replace(FINAL_SLASH_RE, "").replace(INITIAL_SLASH_RE, "")
  subPath = subPath.replace(FINAL_SLASH_RE, "").replace(INITIAL_SLASH_RE, "")

  if (basePath.length === 0) {
    return subPath
  }

  return `${basePath}/${subPath}`
}

/**
 * True if we're connected to the host via HTTPS.
 */
function isHttps(): boolean {
  return window.location.href.startsWith("https://")
}

/**
 * Run SVG strings through DOMPurify to prevent Javascript execution
 */
export function xssSanitizeSvg(uri: string): string {
  const SVG_PREFIX = "data:image/svg+xml,"
  const unsafe = uri.substring(SVG_PREFIX.length)
  return DOMPurify.sanitize(unsafe, {})
}

/**
 * Check if the given origin follows the allowed origin pattern, which could
 * include wildcards.
 *
 * This function is used to check whether cross-origin messages received by the
 * withHostCommunication component come from an origin that we've listed as
 * trusted. If this function returns false against the origin being tested for
 * all trusted origins in our whitelist, the cross-origin message should be
 * ignored.
 */
export function isValidOrigin(
  allowedOrigin: string,
  testOrigin: string
): boolean {
  let allowedUrl: URL
  let testUrl: URL

  try {
    allowedUrl = new URL(allowedOrigin)
    testUrl = new URL(testOrigin)
  } catch {
    return false
  }

  if (
    allowedUrl.protocol !== testUrl.protocol ||
    allowedUrl.port !== testUrl.port
  ) {
    return false
  }

  const { hostname: pattern } = allowedUrl
  const { hostname } = testUrl

  if (pattern === hostname) return true

  // Web browsers will encode the wildcard character in the pattern being
  // tested into %2A when parsing allowedOrigin into a URL, so we either have
  // to convert it back here or test against "%2A" below. There's unfortunately
  // no great way to write a unit test for this because the behavior differs
  // between nodejs test environments and a real browser :(
  const splitPattern = pattern.replace(/%2A/g, "*").split(".")
  const splitHostname = hostname.split(".")

  if (splitPattern.length !== splitHostname.length) return false

  return splitPattern.every((el, index) => {
    if (el === "*") {
      return true
    }

    return el === splitHostname[index]
  })
}
