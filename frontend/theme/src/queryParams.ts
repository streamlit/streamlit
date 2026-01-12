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
 * Embed query param values, which can be set in ?embed={value}, all should be lowercase
 */
const EMBED_OPTIONS_QUERY_PARAM_KEY = "embed_options"
const EMBED_LIGHT_THEME = "light_theme"
const EMBED_DARK_THEME = "dark_theme"

const EMBED_QUERY_PARAM_VALUES = [
  "show_toolbar",
  "show_padding",
  "disable_scrolling",
  EMBED_LIGHT_THEME,
  EMBED_DARK_THEME,
  "hide_loading_screen",
  "show_loading_screen_v1",
  "show_loading_screen_v2",
  "true",
]

/**
 * Returns list of defined in EMBED_QUERY_PARAM_VALUES url params of given key
 * (EMBED_QUERY_PARAM_KEY, EMBED_OPTIONS_QUERY_PARAM_KEY). Is case insensitive.
 */
function getEmbedUrlParams(embedKey: string): Set<string> {
  const embedUrlParams = new Set<string>()
  const urlParams = new URLSearchParams(window.location.search)
  urlParams.forEach((paramValue, paramKey) => {
    paramKey = paramKey.toString().toLowerCase()
    paramValue = paramValue.toString().toLowerCase()
    if (
      paramKey === embedKey &&
      EMBED_QUERY_PARAM_VALUES.includes(paramValue)
    ) {
      embedUrlParams.add(paramValue)
    }
  })
  return embedUrlParams
}

/**
 * Returns true if the URL parameters contain ?embed_options=light_theme (case insensitive).
 */
export function isLightThemeInQueryParams(): boolean {
  // NOTE: We don't check for ?embed=true here, because we want to allow display without any
  // other embed options (for example in our e2e tests).
  return getEmbedUrlParams(EMBED_OPTIONS_QUERY_PARAM_KEY).has(
    EMBED_LIGHT_THEME
  )
}

/**
 * Returns true if the URL parameters contain ?embed_options=dark_theme (case insensitive).
 */
export function isDarkThemeInQueryParams(): boolean {
  // NOTE: We don't check for ?embed=true here, because we want to allow display without any
  // other embed options (for example in our e2e tests).
  return getEmbedUrlParams(EMBED_OPTIONS_QUERY_PARAM_KEY).has(EMBED_DARK_THEME)
}
