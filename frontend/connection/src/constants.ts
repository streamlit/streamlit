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
 */
export const PING_MINIMUM_RETRY_PERIOD_MS = 100
export const PING_MAXIMUM_RETRY_PERIOD_MS = 2000

/**
 * Max number of times we retry pinging the server before we show an error.
 */
export const MAX_RETRIES_BEFORE_CLIENT_ERROR = 6

/**
 * Timeout when attempting to connect to a websocket, in millis.
 */
export const WEBSOCKET_TIMEOUT_MS = 15 * 1000

/**
 * Ping timeout in millis.
 */
export const PING_TIMEOUT_MS = 15 * 1000

/**
 * True when in development mode. We disable if we are testing to ensure
 * production conditions.
 */
export const IS_DEV_ENV = process.env.NODE_ENV === "development"
