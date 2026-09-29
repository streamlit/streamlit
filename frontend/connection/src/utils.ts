/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import {
  isValidAllowedOrigins,
  makePath,
  StreamlitConfig,
} from "@streamlit/utils"

const FINAL_SLASH_RE = /\/+$/
const INITIAL_SLASH_RE = /^\/+/

/**
 * Returns true when host has provided sufficient config properties for establishing the
 * initial websocket connection without waiting for the host-config endpoint response.
 *
 * This bypass relies on minimal host configuration provided via window.__streamlit (StreamlitConfig)
 *
 * Required fields:
 * - BACKEND_BASE_URL: string
 * - HOST_CONFIG.allowedOrigins: non-empty array of non-empty strings
 * - HOST_CONFIG.useExternalAuthToken: boolean (true or false)
 *
 * NOTE: changes to this function must be reflected in the mock in App.test.tsx
 */
export function isHostConfigBypassEnabled(): boolean {
  const initialHostConfig = StreamlitConfig.HOST_CONFIG

  if (!initialHostConfig) {
    return false
  }

  const { allowedOrigins, useExternalAuthToken } = initialHostConfig

  // Validate required fields using shared validation logic
  const hasValidBackendBaseUrl = Boolean(StreamlitConfig.BACKEND_BASE_URL)
  const hasValidAllowedOrigins = isValidAllowedOrigins(allowedOrigins)
  const hasValidUseExternalAuthToken =
    typeof useExternalAuthToken === "boolean"

  return (
    hasValidBackendBaseUrl &&
    hasValidAllowedOrigins &&
    hasValidUseExternalAuthToken
  )
}

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

  /**
   * True when the request was aborted via a caller-supplied external signal
   * (e.g. a cancelled ping loop) rather than the internal timeout. Lets callers
   * distinguish an intentional cancellation from a genuine timeout.
   */
  isAborted: boolean

  constructor(
    message: string,
    url: string,
    options: {
      isTimeout?: boolean
      isNetworkError?: boolean
      isAborted?: boolean
      response?: { status: number; statusText: string; data: unknown }
    } = {}
  ) {
    super(message)
    this.name = "FetchError"
    this.url = url
    this.isTimeout = options.isTimeout ?? false
    this.isNetworkError = options.isNetworkError ?? false
    this.isAborted = options.isAborted ?? false
    this.response = options.response
  }
}

/**
 * Fetch with timeout support using AbortController.
 * Normalizes different error types (timeout, network, HTTP errors) into FetchError.
 *
 * An optional `externalSignal` allows callers to abort the in-flight request
 * (e.g. when a ping loop is cancelled on reconnect) in addition to the internal
 * timeout, so we don't leave orphaned requests running against the server.
 */
export async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<{ data: unknown; url: string }> {
  const controller = new AbortController()
  // eslint-disable-next-line no-restricted-globals -- Network timeout utility runs outside React and cannot use hooks.
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const onExternalAbort = (): void => controller.abort()
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      externalSignal.addEventListener("abort", onExternalAbort)
    }
  }

  const cleanup = (): void => {
    clearTimeout(timeoutId)
    externalSignal?.removeEventListener("abort", onExternalAbort)
  }

  try {
    const response = await fetch(url, { signal: controller.signal })
    cleanup()

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
    cleanup()

    // Re-throw FetchError as-is
    if (error instanceof FetchError) {
      throw error
    }

    // Handle AbortController abort. This fires for both the internal timeout and
    // a caller-supplied external signal, which produce the same AbortError. We
    // check the external signal first so a caller-initiated cancellation is
    // reported as an abort rather than being misclassified as a timeout.
    if (error instanceof DOMException && error.name === "AbortError") {
      if (externalSignal?.aborted) {
        throw new FetchError("Request aborted", url, { isAborted: true })
      }
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
