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

import type { IHostConfigResponse } from "@streamlit/connection"
import { isHostConfigBypassEnabled } from "@streamlit/connection"
import type { MinimalHostConfig } from "@streamlit/utils"

/**
 * Helper function to prefer window.__streamlit values over endpoint values
 * when both are present. This ensures that configuration provided via the
 * window object takes precedence for the fast-path connection.
 *
 * @param windowValue - Value from window.__streamlit (StreamlitConfig)
 * @param endpointValue - Value from the host-config endpoint response
 * @returns The window value if defined, otherwise the endpoint value
 */
export function preferWindowValue<T>(
  windowValue: T | undefined,
  endpointValue: T
): T {
  return windowValue !== undefined ? windowValue : endpointValue
}

/**
 * Reconciles the minimal host config values from window.__streamlit with
 * the full host config response from the endpoint.
 *
 * For the three minimal config fields (allowedOrigins, useExternalAuthToken,
 * metricsUrl), window values take precedence over endpoint values when bypass mode
 * is enabled .
 * All other fields from the endpoint response are preserved as-is.
 *
 * @param initialHostConfig - Minimal config from window.__streamlit.HOST_CONFIG
 * @param endpointConfig - Full config from the host-config endpoint
 * @returns Merged config with window values taking precedence for minimal fields
 *          only when bypass mode is eligible, otherwise returns endpoint config
 */
export function reconcileHostConfigValues(
  initialHostConfig: MinimalHostConfig | undefined,
  endpointConfig: IHostConfigResponse
): IHostConfigResponse {
  // Only apply window config precedence when bypass mode is eligible.
  // isHostConfigBypassEnabled() validates that HOST_CONFIG exists and is valid,
  // preventing invalid configs (e.g., empty allowedOrigins) from overriding
  // valid endpoint values. We also check initialHostConfig (redundant) to avoid
  // typescript errors below.
  if (!isHostConfigBypassEnabled() || !initialHostConfig) {
    return endpointConfig
  }

  return {
    ...endpointConfig,
    allowedOrigins: preferWindowValue(
      initialHostConfig.allowedOrigins,
      endpointConfig.allowedOrigins
    ),
    useExternalAuthToken: preferWindowValue(
      initialHostConfig.useExternalAuthToken,
      endpointConfig.useExternalAuthToken
    ),
    metricsUrl: preferWindowValue(
      initialHostConfig.metricsUrl,
      endpointConfig.metricsUrl
    ),
  }
}
