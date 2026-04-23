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

/**
 * Attempts to connect to the URIs in uriList (in round-robin fashion) and
 * retries forever until one of the URIs responds with 'ok'.
 * Returns a promise with the index of the URI that worked.
 */

import { getLogger } from "loglevel"

// Note we expect the polyfill to load from this import
import {
  buildHttpUri,
  notNullOrUndefined,
  StreamlitConfig,
} from "@streamlit/utils"

import {
  CORS_ERROR_MESSAGE_DOCUMENTATION_LINK,
  HOST_CONFIG_PATH,
  MAX_RETRIES_BEFORE_CLIENT_ERROR,
  PING_TIMEOUT_MS,
  SERVER_PING_PATH,
} from "./constants"
import { ErrorDetails, IHostConfigProperties, OnRetry } from "./types"
import {
  FetchError,
  fetchWithTimeout,
  parseUriIntoBaseParts,
  serializeForDisplay,
} from "./utils"

const LOG = getLogger("DoInitPings")

export class PingCancelledError extends Error {
  constructor() {
    super("Ping cancelled")
  }
}

export interface AsyncPingRequest {
  promise: Promise<number>
  cancel: () => void
}

export function doInitPings(
  uriPartsList: URL[],
  minimumTimeoutMs: number,
  maximumTimeoutMs: number,
  retryCallback: OnRetry,
  sendClientError: (
    error: string | number,
    message: string,
    source: string
  ) => void,
  onHostConfigResp: (resp: IHostConfigProperties) => void
): AsyncPingRequest {
  const { promise, resolve, reject } = Promise.withResolvers<number>()
  let totalTries = 0
  let uriNumber = 0
  let timeout: ReturnType<typeof setTimeout> | undefined

  // Hoist the connect() declaration.
  let connect = (): void => {}

  const retryImmediately = (): void => {
    uriNumber++
    if (uriNumber >= uriPartsList.length) {
      uriNumber = 0
    }

    connect()
  }

  const retry = (errorDetails: ErrorDetails): void => {
    // Adjust retry time by +- 20% to spread out load
    const jitter = Math.random() * 0.4 - 0.2
    // Exponential backoff to reduce load from health pings when experiencing
    // persistent failure. Starts at minimumTimeoutMs.
    const timeoutMs =
      totalTries === 1
        ? minimumTimeoutMs
        : minimumTimeoutMs * 2 ** (totalTries - 1) * (1 + jitter)
    const retryTimeout = Math.min(maximumTimeoutMs, timeoutMs)

    retryCallback(totalTries, errorDetails, retryTimeout)

    if (typeof window === "undefined") {
      // There seems to be a race condition when tearing down test env
      // that can lead to some flakiness in the tests.
      // If the test environment is torn down, we don't need to
      // schedule another retry.
      return
    }
    // Use globalThis to ensure timers can be cleared even if window is undefined later
    // eslint-disable-next-line no-restricted-properties -- Ping retry scheduler requires a raw timer outside React.
    timeout = globalThis.setTimeout(retryImmediately, retryTimeout)
  }

  const retryWhenTheresNoResponse = (): void => {
    const uriParts = uriPartsList[uriNumber]
    const uri = new URL(buildHttpUri(uriParts, ""))

    if (uri.hostname === "localhost") {
      retry({
        message:
          "Is Streamlit still running? If you accidentally stopped Streamlit, just restart it in your terminal:",
        codeBlock: "streamlit run yourscript.py",
      })
    } else {
      retry({
        message:
          "Streamlit server is not responding. Are you connected to the internet?",
      })
    }
  }

  const retryWhenIsForbidden = (): void => {
    retry({
      message: `Cannot connect to Streamlit (HTTP status: 403).

If you are trying to access a Streamlit app running on another server, this could be due to the app's [CORS](${CORS_ERROR_MESSAGE_DOCUMENTATION_LINK}) settings.`,
    })
  }

  // Handle retrieving the source URL, otherwise fallback to "DoInitPings"
  const determineUrlSource = (url: string | undefined): string => {
    let source = "DoInitPings"

    if (url) {
      try {
        source = new URL(url).pathname
      } catch {
        LOG.error(`unrecognized url: ${url}`)
      }
    }

    return source
  }

  connect = () => {
    const uriParts = uriPartsList[uriNumber]
    const healthzUri = buildHttpUri(uriParts, SERVER_PING_PATH)

    // Use the securely captured config value
    const hostConfigBaseUrl = StreamlitConfig.HOST_CONFIG_BASE_URL
    const hostConfigServerUriParts = hostConfigBaseUrl
      ? parseUriIntoBaseParts(hostConfigBaseUrl)
      : uriParts

    const hostConfigUri = buildHttpUri(
      hostConfigServerUriParts,
      HOST_CONFIG_PATH
    )

    LOG.info(`Attempting to connect to ${healthzUri}.`)

    if (uriNumber === 0) {
      totalTries++
    }

    // We fire off requests to the server's healthz and host-config
    // endpoints in parallel to avoid having to wait on too many sequential
    // round trip network requests before we can try to establish a WebSocket
    // connection. Technically, it would have been possible to implement a
    // single "get server health and origins whitelist" endpoint, but we chose
    // not to do so as it's semantically cleaner to not give the healthcheck
    // endpoint additional responsibilities.
    Promise.all([
      fetchWithTimeout(healthzUri, PING_TIMEOUT_MS),
      fetchWithTimeout(hostConfigUri, PING_TIMEOUT_MS),
    ])
      .then(([_, hostConfigResp]) => {
        onHostConfigResp(hostConfigResp.data as IHostConfigProperties)
        resolve(uriNumber)
      })
      .catch((error: FetchError) => {
        // If its our 6th try (retry count at which we show connection error dialog), send a client error
        // to inform the host of connection error
        const tooManyRetries = totalTries >= MAX_RETRIES_BEFORE_CLIENT_ERROR

        if (error.isTimeout) {
          if (tooManyRetries) {
            // Handle retrieving the source URL from the error (health or host-config endpoint)
            const source = determineUrlSource(error.url)
            LOG.error("Client error: DoInitPings timed out")
            sendClientError(
              "DoInitPings timed out",
              "Connection timed out - ECONNABORTED",
              source
            )
          }
          return retry({ message: "Connection timed out." })
        }

        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx

          const { data, status, statusText } = error.response
          // Handle retrieving the source URL from the error (health or host-config endpoint)
          const source = determineUrlSource(error.url)

          if (status === /* NO RESPONSE */ 0) {
            if (tooManyRetries) {
              LOG.error(
                `Client Error: response received with status ${status} when attempting to reach ${source}`
              )
              sendClientError(
                `Response received with status ${status}`,
                statusText,
                source
              )
            }
            return retryWhenTheresNoResponse()
          }

          if (status === 403) {
            if (tooManyRetries) {
              LOG.error(
                `Client Error: response received with status ${status} when attempting to reach ${source}`
              )
              sendClientError(status, statusText, source)
            }
            return retryWhenIsForbidden()
          }

          if (tooManyRetries) {
            LOG.error(
              `Client Error: response received with status ${status} when attempting to reach ${source}`
            )
            sendClientError(status, statusText, source)
          }

          const responseDataStr = serializeForDisplay(data)
          return retry({
            message: `Connection failed with status ${status}${responseDataStr ? ", and response:" : "."}`,
            ...(responseDataStr && { codeBlock: responseDataStr }),
          })
        }

        if (error.isNetworkError) {
          // The request was made but no response was received

          if (tooManyRetries) {
            // Handle retrieving the source URL from the error (health or host-config endpoint)
            const source = determineUrlSource(error.url)
            LOG.error(
              `Client Error in reaching server endpoint - No response received when attempting to reach ${source}`
            )
            sendClientError(
              "No response received from server",
              "Network error",
              source
            )
          }
          return retryWhenTheresNoResponse()
        }

        // Something happened in setting up the request that triggered an Error
        if (tooManyRetries) {
          // Handle retrieving the source URL from the error (health or host-config endpoint)
          const source = determineUrlSource(error.url)
          LOG.error(
            `Client Error in reaching server endpoint - error in setting up request when attempting to reach ${source}`
          )
          sendClientError(
            "Error setting up request to server",
            error.message ?? "",
            source
          )
        }
        return retry({ message: error.message })
      })
  }

  connect()

  const cancel = (): void => {
    if (notNullOrUndefined(timeout)) {
      // Use globalThis to clear timers safely without relying on window
      globalThis.clearTimeout(timeout)
    }
    reject(new PingCancelledError())
  }

  return {
    promise,
    cancel,
  }
}
