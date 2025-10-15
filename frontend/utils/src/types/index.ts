import { ICustomThemeConfig } from "@streamlit/protobuf"
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
 * A type predicate that is true if the given value is neither undefined
 * nor null.
 */
export function notNullOrUndefined<T>(
  value: T | null | undefined
): value is T {
  return <T>value !== null && <T>value !== undefined
}
/**
 * A type predicate that is true if the given value is either undefined
 * or null.
 */
export function isNullOrUndefined<T>(
  value: T | null | undefined
): value is null | undefined {
  return <T>value === null || <T>value === undefined
}

/**
 * The lib config contains various configurations that the host platform can
 * use to configure streamlit-lib frontend behavior. This should to be treated as part of the public
 * API, and changes need to be backwards-compatible meaning that an old host configuration
 * should still work with a new frontend versions.
 */
export type LibConfig = {
  /**
   * The mapbox token that can be configured by a platform.
   */
  mapboxToken?: string

  /**
   * Whether to disable the full screen mode all elements / widgets.
   */
  disableFullscreenMode?: boolean

  enforceDownloadInNewTab?: boolean

  /**
   * Whether and which value to set the `crossOrigin` property on media elements (img, video, audio).
   * If it is set to undefined, the `crossOrigin` property will not be set on media elements at all.
   * For img elements, see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/crossOrigin
   */
  resourceCrossOriginMode?: undefined | "anonymous" | "use-credentials"

  /** Deprecated. Use resourceCrossOriginMode instead. If set to true, the value of resourceCrossOriginMode will be "anonymous". */
  setAnonymousCrossOriginPropertyOnMediaElements?: boolean
}

/**
 * The app config contains various configurations that the host platform can
 * use to configure streamlit-app frontend behavior. This should to be treated as part of the public
 * API, and changes need to be backwards-compatible meaning that an old host configuration
 * should still work with a new frontend versions.
 *
 * TODO(lukasmasuch): Potentially refactor HostCommunicationManager and move this type
 * to AppContext.tsx.
 */
export type AppConfig = {
  /**
   * A list of origins that we're allowed to receive cross-iframe messages
   * from via the browser's window.postMessage API.
   */
  allowedOrigins?: string[]
  /**
   * Whether to wait until we've received a SET_AUTH_TOKEN message before
   * resolving deferredAuthToken.promise. The WebsocketConnection class waits
   * for this promise to resolve before attempting to establish a connection
   * with the Streamlit server.
   */
  useExternalAuthToken?: boolean
  /**
   * Enables custom string messages to be sent to the host
   */
  enableCustomParentMessages?: boolean
  /**
   * Whether host wants to block error dialogs. If true, blocks error dialogs
   * from being shown to the user, sends error info to host via postMessage
   */
  blockErrorDialogs?: boolean
}

export type MetricsConfig = {
  /**
   * URL to send metrics data to via POST request.
   * Setting to "postMessage" sends metrics events via postMessage to host.
   * Setting to "off" disables metrics collection.
   * If undefined, metricsUrl requested from centralized config file.
   */
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  metricsUrl?: string | "postMessage" | "off"
}

/**
 * The response structure of the `_stcore/host-config` endpoint.
 * This combines streamlit-lib specific configuration options with
 * streamlit-app specific options (e.g. allowed message origins).
 */
export type IHostConfigResponse = LibConfig & AppConfig & MetricsConfig

export interface StreamlitWindowObject {
  // URL pointing to where the Streamlit server is running. This is useful in
  // deployments of Streamlit where the server is running on a different origin
  // from where index.html is served.
  BACKEND_BASE_URL?: string
  // URL pointing to where the _stcore/host-config endpoint is being served.
  HOST_CONFIG_BASE_URL?: string
  // URL pointing to where the /media assets are being served from for download only.
  DOWNLOAD_ASSETS_BASE_URL?: string
  // URL pointing to the main page of this Streamlit app. Setting this is needed
  // when setting BACKEND_BASE_URL so that handling page URLs in multipage apps
  // works.
  MAIN_PAGE_BASE_URL?: string

  // When our Streamlit app is embedded in an iframe, this can be set by the
  // parent frame of the app so that the Streamlit app is aware of its own
  // Service Worker clientId. This has to be done when using Custom Components
  // in an app deployed in a context where we use a Service Worker as `fetch`
  // requests sent from the component iframe set `resultingClientId` but not
  // `replacesClientId`, which means that without this we would be unable to
  // associate a `fetch` request from a custom component iframe with its parent
  // frame.
  CUSTOM_COMPONENT_CLIENT_ID?: string

  // Theme related settings.
  LIGHT_THEME?: ICustomThemeConfig
  DARK_THEME?: ICustomThemeConfig

  // Other options.
  ENABLE_RELOAD_BASED_ON_HARDCODED_STREAMLIT_VERSION?: boolean

  HOST_CONFIG?: IHostConfigResponse
}
