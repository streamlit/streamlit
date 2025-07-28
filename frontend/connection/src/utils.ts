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

  if (!currentUrl.port) {
    currentUrl.port = currentUrl.protocol === "https:" ? "443" : "80"
  }

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

/**
 * Return the crossorigin attribute value for the given resourceCrossOriginMode and given url.
 *
 * Returns the configured resourceCrossOriginMode if the URL is a full URL (not just a path) and is equal to window.__streamlit.BACKEND_BASE_URL,
 * as it points to the same origin as the backend server or if the URL is relative and, thus, also points to the backend server.
 * Note that window.__streamlit.BACKEND_BASE_URL is used to configure the backend base URL when the Streamlit app origin is different from the backend server origin!
 * This can happen when the Streamlit app is loaded in an iframe or loaded via a proxy. In this case, the request to window.__streamlit?.BACKEND_BASE_URL is a
 * cross-origin request and the crossorigin attribute is required to avoid CORS errors.
 * If window.__streamlit.BACKEND_BASE_URL is set to the same origin as the Streamlit app origin, the request is a same-origin request and the crossorigin attribute is ignored by the browser so it can be omitted.
 *
 * Returns undefined if the URL is a full URL (not just a path) and is not equal to window.__streamlit.BACKEND_BASE_URL, as it
 * likely points to an external server in this case, where the crossOrigin attribute might lead to CORS errors depending on the external server configuration.
 *
 * If the URL is not a valid URL, e.g. it's relative, it returns the resourceCrossOriginMode if window.__streamlit.BACKEND_BASE_URL is set,
 * otherwise it returns undefined (in this case, the request would go against the window's origin and is a same-origin request anyways).
 */
export function getCrossOriginAttributeValue(
  resourceCrossOriginMode: undefined | "anonymous" | "use-credentials",
  url?: string
): undefined | "anonymous" | "use-credentials" {
  if (!url) {
    return undefined
  }

  try {
    const parsedUrl = new URL(url)

    // The passed URL is absolute and it's pointing to the same origin as the backend server,
    // so we should use the configured resourceCrossOriginMode. We don't check for requests going to the same
    // origin as window.location.origin because that's a same-origin request where the crossorigin attribute is ignored anyways.
    if (
      window.__streamlit?.BACKEND_BASE_URL &&
      parsedUrl.origin === new URL(window.__streamlit?.BACKEND_BASE_URL).origin
    ) {
      return resourceCrossOriginMode
    }

    return undefined
  } catch {
    // If the URL is not a full URL, it likely is a relative URL.
    // If window.__streamlit?.BACKEND_BASE_URL is set, return the resourceCrossOriginMode.
    // If it is not set, the request would go against the window's origin and is a same-origin request.
    // The browser would ignore the crossorigin attribute in this case, but to make it more explicit, we return undefined.
    // Note that www.example.com/some-image.png would also return the resourceCrossOriginMode as it is not a valid URL without the scheme.
    return window.__streamlit?.BACKEND_BASE_URL
      ? resourceCrossOriginMode
      : undefined
  }
}
