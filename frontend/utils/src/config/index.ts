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

import { ICustomThemeConfig } from "@streamlit/protobuf"

/**
 * Minimal host configuration for websocket connection and host communication
 * without waiting for the health and host-config endpoint responses.
 *
 * All fields are optional in the type because host can provide incomplete or no config
 * via window.__streamlit.HOST_CONFIG. Use isHostConfigBypassEnabled() to validate that
 * required fields (useExternalAuthToken, allowedOrigins) are present.
 *
 * Required for bypass:
 * - useExternalAuthToken (boolean)
 * - allowedOrigins (non-empty array)
 *
 * Optional:
 * - metricsUrl
 *
 *  Note: The full host config (IHostConfigResponse) includes additional fields
 */
export interface MinimalHostConfig {
  /**
   * Whether to wait for external auth token via postMessage before connecting.
   */
  useExternalAuthToken?: boolean
  /**
   * List of allowed origins for postMessage communication with the host.
   */
  allowedOrigins?: string[]
  /**
   * Where to send metrics data. Can be a URL, "postMessage", or "off".
   */
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  metricsUrl?: string | "postMessage" | "off"
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
  // Minimal host configuration for fast-path websocket connection.
  HOST_CONFIG?: MinimalHostConfig
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

  return obj as Readonly<T>
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
  get HOST_CONFIG(): MinimalHostConfig | undefined {
    return capturedConfig?.HOST_CONFIG
  },
} as const
