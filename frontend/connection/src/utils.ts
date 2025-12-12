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

import { makePath, StreamlitConfig } from "@streamlit/utils"

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
  const baseUriParts = parseUriIntoBaseParts(StreamlitConfig.BACKEND_BASE_URL)
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
 * Serialize data for display in error messages.
 * Objects are pretty-printed as JSON, primitives are converted to strings.
 * Returns undefined for null, undefined, or non-serializable types.
 */
export function serializeForDisplay(data: unknown): string | undefined {
  if (data === null || data === undefined) {
    return undefined
  }

  switch (typeof data) {
    case "object":
      return JSON.stringify(data, null, 2)
    case "string":
    case "number":
    case "boolean":
      return String(data)
    default:
      return undefined
  }
}

/**
 * Custom error class to normalize fetch errors into a consistent structure.
 * This mimics axios error patterns for compatibility with previous error handling logic.
 */
export class FetchError extends Error {
  url: string

  isTimeout: boolean

  response?: {
    status: number
    statusText: string
    data: unknown
  }

  isNetworkError: boolean

  constructor(
    message: string,
    url: string,
    options: {
      isTimeout?: boolean
      isNetworkError?: boolean
      response?: { status: number; statusText: string; data: unknown }
    } = {}
  ) {
    super(message)
    this.name = "FetchError"
    this.url = url
    this.isTimeout = options.isTimeout ?? false
    this.isNetworkError = options.isNetworkError ?? false
    this.response = options.response
  }
}

/**
 * Fetch with timeout support using AbortController.
 * Normalizes different error types (timeout, network, HTTP errors) into FetchError.
 */
export async function fetchWithTimeout(
  url: string,
  timeoutMs: number
): Promise<{ data: unknown; url: string }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      // Server responded with error status
      let data: unknown
      try {
        data = await response.json()
      } catch {
        try {
          data = await response.text()
        } catch {
          data = null
        }
      }

      throw new FetchError(
        `Request failed with status ${response.status}`,
        url,
        {
          response: {
            status: response.status,
            statusText: response.statusText,
            data,
          },
        }
      )
    }

    // Try JSON first, fall back to text (healthz returns string, host-config returns JSON)
    // We don't rely on Content-Type since proxies/CDNs may not preserve headers correctly
    const text = await response.text()
    try {
      return { data: JSON.parse(text), url }
    } catch {
      return { data: text, url }
    }
  } catch (error) {
    clearTimeout(timeoutId)

    // Re-throw FetchError as-is
    if (error instanceof FetchError) {
      throw error
    }

    // Handle AbortController timeout
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new FetchError("Connection timed out", url, { isTimeout: true })
    }

    // Handle network errors (TypeError from fetch when network fails)
    if (error instanceof TypeError) {
      throw new FetchError(error.message || "Network error", url, {
        isNetworkError: true,
      })
    }

    // Generic error
    throw new FetchError(
      error instanceof Error ? error.message : "Unknown error",
      url
    )
  }
}
