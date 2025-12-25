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

import type { IHostConfigProperties } from "@streamlit/connection"
import { type HostWindowConfig, isValidAllowedOrigins } from "@streamlit/utils"

/**
 * Helper to conditionally include object properties only if they are defined.
 * This prevents polluting config objects with explicit undefined values.
 *
 * Note: This intentionally keeps null values, as null represents an explicit
 * value (e.g., "no token configured") whereas undefined means "not provided".
 *
 * @param obj - Partial object with potentially undefined values
 * @returns Object with only the defined properties (null values are kept)
 */
export function includeIfDefined<T extends Record<string, unknown>>(
  obj: Partial<T>
): Partial<T> {
  return Object.entries(obj).reduce<Partial<T>>((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key as keyof T] = value
    }
    return acc
  }, {})
}

/**
 * Helper function to prefer window.__streamlit values over endpoint values
 * when both are present. This ensures that configuration provided via the
 * window object takes precedence for the fast-path connection.
 *
 * Note: null and undefined are treated as "not provided" and will not override
 * the endpoint value, as they are not valid configuration values.
 *
 * @param windowValue - Value from window.__streamlit (StreamlitConfig)
 * @param endpointValue - Value from the host-config endpoint response
 * @returns The window value if defined and not null, otherwise the endpoint value
 */
export function preferWindowValue<T>(
  windowValue: T | undefined | null,
  endpointValue: T
): T {
  return windowValue !== undefined && windowValue !== null
    ? windowValue
    : endpointValue
}

/**
 * Reconciles host config values from window.__streamlit with
 * the full host config response from the endpoint.
 *
 * ALL provided window config values take precedence over endpoint values,
 * with validation for allowedOrigins (must be non-empty array of non-empty strings).
 *
 * This ensures that configuration provided via window.__streamlit.HOST_CONFIG
 * takes precedence for the fast-path connection while still allowing the
 * endpoint to provide fallback values for unprovided fields.
 *
 * @param windowConfig - Config from window.__streamlit.HOST_CONFIG
 * @param endpointConfig - Full config from the host-config endpoint
 * @returns Merged config with window values taking precedence when provided
 */
export function reconcileHostConfigValues(
  windowConfig: HostWindowConfig | undefined,
  endpointConfig: IHostConfigProperties
): IHostConfigProperties {
  if (!windowConfig) {
    return endpointConfig
  }

  // Validate allowedOrigins using shared validation logic
  const validAllowedOrigins = isValidAllowedOrigins(
    windowConfig.allowedOrigins
  )
    ? windowConfig.allowedOrigins
    : undefined

  return {
    ...endpointConfig,
    // AppConfig fields
    allowedOrigins: preferWindowValue(
      validAllowedOrigins,
      endpointConfig.allowedOrigins
    ),
    useExternalAuthToken: preferWindowValue(
      windowConfig.useExternalAuthToken,
      endpointConfig.useExternalAuthToken
    ),
    enableCustomParentMessages: preferWindowValue(
      windowConfig.enableCustomParentMessages,
      endpointConfig.enableCustomParentMessages
    ),
    blockErrorDialogs: preferWindowValue(
      windowConfig.blockErrorDialogs,
      endpointConfig.blockErrorDialogs
    ),
    // LibConfig fields
    mapboxToken: preferWindowValue(
      windowConfig.mapboxToken,
      endpointConfig.mapboxToken
    ),
    disableFullscreenMode: preferWindowValue(
      windowConfig.disableFullscreenMode,
      endpointConfig.disableFullscreenMode
    ),
    enforceDownloadInNewTab: preferWindowValue(
      windowConfig.enforceDownloadInNewTab,
      endpointConfig.enforceDownloadInNewTab
    ),
    resourceCrossOriginMode: preferWindowValue(
      windowConfig.resourceCrossOriginMode,
      endpointConfig.resourceCrossOriginMode
    ),
    // Deprecated field - preserve from endpoint (not overridable via window)
    // This is used as a fallback for resourceCrossOriginMode in App.tsx
    setAnonymousCrossOriginPropertyOnMediaElements:
      endpointConfig.setAnonymousCrossOriginPropertyOnMediaElements,
    // MetricsConfig fields
    metricsUrl: preferWindowValue(
      windowConfig.metricsUrl,
      endpointConfig.metricsUrl
    ),
  }
}
