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
}
