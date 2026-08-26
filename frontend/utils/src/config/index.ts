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

import { ICustomThemeConfig } from "@streamlit/protobuf"

/**
 * The lib config contains various configurations that the host platform can
 * use to configure streamlit-lib frontend behavior. This should be treated as part of the public
 * API, and changes need to be backwards-compatible meaning that an old host configuration
 * should still work with a new frontend versions.
 */
export type LibConfig = {
  /**
   * The mapbox token that can be configured by a platform.
   */
  mapboxToken?: string

  /**
   * Whether to disable the full screen mode for all elements / widgets.
   */
  disableFullscreenMode?: boolean

  /**
   * Whether to force file downloads initiated by the app to open in a new browser tab.
   */
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
 * App-specific configuration options that can be set by the host platform.
 * These control app behavior and host communication.
 * This should be treated as part of the public API, and changes need to be
 * backwards-compatible meaning that an old host configuration should still
 * work with new frontend versions.
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

/**
 * Metrics configuration options that control where and how metrics are sent.
 */
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
 * Combined host configuration properties from all config categories.
 * This represents the complete set of host-configurable options.
 */
export type IHostConfigProperties = LibConfig & AppConfig & MetricsConfig

/**
 * Host configuration that can be provided via window.__streamlit.HOST_CONFIG
 * which take precedence over the values from the /_stcore/host-config endpoint.
 *
 * All fields are optional. The deprecated setAnonymousCrossOriginPropertyOnMediaElements
 * field is excluded - use resourceCrossOriginMode instead.
 *
 * Note: Bypass mode (fast-path WebSocket connection) only activates when BACKEND_BASE_URL
 * and minimal required fields (allowedOrigins, useExternalAuthToken) are provided and valid.
 * Other fields can be provided but don't enable bypass on their own.
 */
export type HostWindowConfig = Partial<
  Omit<IHostConfigProperties, "setAnonymousCrossOriginPropertyOnMediaElements">
>

/**
 * Validates that allowedOrigins is a non-empty array of non-empty strings.
 * This ensures consistency between bypass validation and config reconciliation.
 *
 * @param allowedOrigins - The allowedOrigins value to validate
 * @returns true if valid, false otherwise
 */
export function isValidAllowedOrigins(
  allowedOrigins: unknown
): allowedOrigins is string[] {
  return (
    Array.isArray(allowedOrigins) &&
    allowedOrigins.length > 0 &&
    allowedOrigins.every(
      origin => typeof origin === "string" && origin.trim().length > 0
    )
  )
}

/**
 * Configuration object that can be set on window.__streamlit by the host
 * before the Streamlit bundle loads. These values are captured and frozen
 * at module initialization time for security.
 */
interface StreamlitWindowConfig {
  // URL pointing to where the Streamlit server is running.
  BACKEND_BASE_URL?: string
  // URL pointing to where the _stcore/host-config endpoint is being served.
  HOST_CONFIG_BASE_URL?: string
  // URL pointing to where the /media assets are being served from for download only.
  DOWNLOAD_ASSETS_BASE_URL?: string
  // URL pointing to the main page of this Streamlit app.
  MAIN_PAGE_BASE_URL?: string
  // Service Worker clientId for custom components in embedded contexts.
  CUSTOM_COMPONENT_CLIENT_ID?: string
  // Theme related settings.
  LIGHT_THEME?: ICustomThemeConfig
  DARK_THEME?: ICustomThemeConfig
  // Other options.
  ENABLE_RELOAD_BASED_ON_HARDCODED_STREAMLIT_VERSION?: boolean
  // Host configuration (including enabling bypass mode for fast-path websocket connection).
  HOST_CONFIG?: HostWindowConfig
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    __streamlit?: StreamlitWindowConfig
  }
}

/**
 * Deep clones an object using structuredClone if available, otherwise falls back
 * to JSON parse/stringify for older environments.
 *
 * Note: The JSON fallback will omit properties with undefined values. This is acceptable
 * because the application treats undefined properties the same as missing properties.
 */
function deepClone<T>(obj: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(obj)
  }
  // Fallback for environments without structuredClone
  // Note: This will omit undefined values, which is fine for our use case
  return JSON.parse(JSON.stringify(obj)) as T
}

/**
 * Recursively freezes an object and all nested objects/arrays.
 */
function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.freeze(obj)

  // For arrays, iterate through elements
  if (Array.isArray(obj)) {
    obj.forEach(item => {
      if (
        item !== null &&
        typeof item === "object" &&
        !Object.isFrozen(item)
      ) {
        deepFreeze(item)
      }
    })
  } else {
    // For objects, iterate through property values
    Object.values(obj).forEach(value => {
      if (
        value !== null &&
        typeof value === "object" &&
        !Object.isFrozen(value)
      ) {
        deepFreeze(value)
      }
    })
  }

  return obj
}

/**
 * Captures and freezes the window.__streamlit configuration at module load time.
 * This ensures the values cannot be modified after the initial capture.
 *
 * The capture happens during bundle initialization (before any user code can run),
 * providing protection against runtime tampering via DevTools or injected scripts.
 */
const capturedConfig: Readonly<StreamlitWindowConfig> | undefined = (() => {
  const windowConfig = window.__streamlit
  if (!windowConfig) {
    return undefined
  }

  // Deep clone to prevent modifications to the original object from affecting our copy
  const cloned = deepClone(windowConfig)

  // Deep freeze to prevent any modifications to our captured copy
  return deepFreeze(cloned)
})()

/**
 * Returns the captured and frozen Streamlit window configuration.
 *
 * This function provides read-only access to the configuration values that were
 * set on window.__streamlit before the bundle loaded. The values are captured
 * once during module initialization and cannot be modified afterward.
 *
 * @returns The frozen configuration object, or undefined if window.__streamlit was not set
 *
 * @example
 * const config = getStreamlitConfig()
 * const backendUrl = config?.BACKEND_BASE_URL
 */
export function getStreamlitConfig():
  | Readonly<StreamlitWindowConfig>
  | undefined {
  return capturedConfig
}

/**
 * Individual property accessors for convenience.
 * These provide type-safe access to specific configuration values.
 */
export const StreamlitConfig = {
  get BACKEND_BASE_URL(): string | undefined {
    return capturedConfig?.BACKEND_BASE_URL
  },
  get HOST_CONFIG_BASE_URL(): string | undefined {
    return capturedConfig?.HOST_CONFIG_BASE_URL
  },
  get DOWNLOAD_ASSETS_BASE_URL(): string | undefined {
    return capturedConfig?.DOWNLOAD_ASSETS_BASE_URL
  },
  get MAIN_PAGE_BASE_URL(): string | undefined {
    return capturedConfig?.MAIN_PAGE_BASE_URL
  },
  get CUSTOM_COMPONENT_CLIENT_ID(): string | undefined {
    return capturedConfig?.CUSTOM_COMPONENT_CLIENT_ID
  },
  get LIGHT_THEME(): ICustomThemeConfig | undefined {
    return capturedConfig?.LIGHT_THEME
  },
  get DARK_THEME(): ICustomThemeConfig | undefined {
    return capturedConfig?.DARK_THEME
  },
  get ENABLE_RELOAD_BASED_ON_HARDCODED_STREAMLIT_VERSION():
    | boolean
    | undefined {
    return capturedConfig?.ENABLE_RELOAD_BASED_ON_HARDCODED_STREAMLIT_VERSION
  },
  get HOST_CONFIG(): HostWindowConfig | undefined {
    return capturedConfig?.HOST_CONFIG
  },
} as const
