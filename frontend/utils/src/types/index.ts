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
  // These window variables are used so that some deployments of Streamlit can
  // edit the index.html served to the client so that a Streamlit server at an
  // origin different from where the frontend static assets are served can be
  // set. Note that we also need to have a separate `declare global` block here
  // rather than adding to the one in App.tsx as these also need to be
  // accessible within this package when no app exists.
  BACKEND_BASE_URL?: string
  HOST_CONFIG_BASE_URL?: string

  // Theme related settings.
  LIGHT_THEME?: ICustomThemeConfig
  DARK_THEME?: ICustomThemeConfig

  // Other options.
  ENABLE_RELOAD_BASED_ON_HARDCODED_STREAMLIT_VERSION?: boolean
}
