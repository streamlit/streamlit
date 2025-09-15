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

import { makePath } from "@streamlit/utils"

const FINAL_SLASH_RE = /\/+$/
const INITIAL_SLASH_RE = /^\/+/

/**
 * Return the BaseUriParts for either the given url or the global window
 */
export function parseUriIntoBaseParts(url?: string): URL {
  const currentUrl = new URL(url ?? window.location.href)

  currentUrl.pathname = currentUrl.pathname
    .replace(FINAL_SLASH_RE, "")
    .replace(INITIAL_SLASH_RE, "")

  return currentUrl
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
export function getPossibleBaseUris(): Array<URL> {
  const baseUriParts = parseUriIntoBaseParts(
    window.__streamlit?.BACKEND_BASE_URL
  )
  const { pathname } = baseUriParts

  if (pathname === "/") {
    return [baseUriParts]
  }

  const parts = pathname.split("/")
  const possibleBaseUris: Array<URL> = []

  while (parts.length > 0) {
    const newURL = new URL(baseUriParts)
    newURL.pathname = parts.join("/")
    possibleBaseUris.push(newURL)
    parts.pop()
  }

  if (possibleBaseUris.length <= 2) {
    return possibleBaseUris
  }

  return possibleBaseUris.slice(0, 2)
}

/**
 * Create a ws:// or wss:// URI for the given path.
 */
export function buildWsUri(
  { hostname, port, pathname, protocol }: URL,
  path: string
): string {
  const wsProtocol = protocol === "https:" ? "wss" : "ws"
  const fullPath = makePath(pathname, path)
  return `${wsProtocol}://${hostname}:${port}/${fullPath}`
}
