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
 * If the ping retrieves a 403 status code a message will be displayed.
 * This constant is the link to the documentation.
 */
export const CORS_ERROR_MESSAGE_DOCUMENTATION_LINK =
  "https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS"

/**
 * The path of the server's websocket endpoint.
 */
export const WEBSOCKET_STREAM_PATH = "_stcore/stream"

/**
 * The path where we should ping (via HTTP) to see if the server is up.
 */
export const SERVER_PING_PATH = "_stcore/health"

/**
 * The path to fetch the host configuration and allowed-message-origins.
 */
export const HOST_CONFIG_PATH = "_stcore/host-config"

/**
 * Min and max wait time between pings in millis.
 *
 * The maximum caps the exponential backoff during a sustained outage. It is
 * deliberately larger than the minimum by several doublings so that clients
 * that can't reach the server quickly back off to an infrequent, low-load
 * poll rather than hammering the server every couple of seconds indefinitely.
 */
export const PING_MINIMUM_RETRY_PERIOD_MS = 100
export const PING_MAXIMUM_RETRY_PERIOD_MS = 8000

/**
 * Fractional +/- jitter applied to the (capped) retry backoff to de-synchronize
 * reconnect attempts across clients and avoid a "thundering herd" where many
 * clients retry in lockstep (e.g. 0.5 == +/-50%).
 */
export const PING_RETRY_JITTER = 0.5

/**
 * On reconnect (after having previously connected), the first health ping is
 * delayed by a uniform random amount in [0, this) to de-synchronize a fleet of
 * clients that dropped together. This is NOT applied on the initial page-load
 * connection, so first paint stays fast.
 */
export const PING_RECONNECT_INITIAL_DELAY_MAX_MS = 3000

/**
 * Max number of times we retry pinging the server before we show an error.
 */
export const MAX_RETRIES_BEFORE_CLIENT_ERROR = 6

/**
 * Detect if we're on an Android device. This is used to adjust timeouts
 * for Android Chrome where file pickers can keep the app backgrounded
 * for extended periods.
 */
const isAndroidDevice = (): boolean => {
  if (typeof navigator === "undefined") {
    return false
  }
  return /Android/i.test(navigator.userAgent)
}

/**
 * Timeout when attempting to connect to a websocket, in millis.
 * Android devices get a longer timeout (60s vs 15s) because file pickers
 * background the browser tab for extended periods, causing premature
 * connection timeouts.
 * See: https://github.com/streamlit/streamlit/issues/11419
 */
export const WEBSOCKET_TIMEOUT_MS = isAndroidDevice() ? 60 * 1000 : 15 * 1000

/**
 * Ping timeout in millis.
 */
export const PING_TIMEOUT_MS = 15 * 1000

/**
 * True when in development mode. We disable if we are testing to ensure
 * production conditions.
 */
export const IS_DEV_ENV =
  import.meta.env.DEV && import.meta.env.MODE !== "test"
