/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { useCallback, useEffect, useState } from "react"
import { AppConfig } from "@streamlit/lib"

/**
 * Embed query param values, which can be set in ?embed={value}, all should be lowercase
 */
export const EMBED_QUERY_PARAM_KEY = "embed"
export const EMBED_OPTIONS_QUERY_PARAM_KEY = "embed_options"
export const EMBED_SHOW_COLORED_LINE = "show_colored_line"
export const EMBED_SHOW_TOOLBAR = "show_toolbar"
export const EMBED_SHOW_PADDING = "show_padding"
export const EMBED_DISABLE_SCROLLING = "disable_scrolling"
export const EMBED_LIGHT_THEME = "light_theme"
export const EMBED_DARK_THEME = "dark_theme"
export const EMBED_TRUE = "true"
export const EMBED_HIDE_LOADING_SCREEN = "hide_loading_screen"
export const EMBED_SHOW_LOADING_SCREEN_V1 = "show_loading_screen_v1"
export const EMBED_SHOW_LOADING_SCREEN_V2 = "show_loading_screen_v2"
export const EMBED_QUERY_PARAM_VALUES = [
  EMBED_SHOW_COLORED_LINE,
  EMBED_SHOW_TOOLBAR,
  EMBED_SHOW_PADDING,
  EMBED_DISABLE_SCROLLING,
  EMBED_LIGHT_THEME,
  EMBED_DARK_THEME,
  EMBED_HIDE_LOADING_SCREEN,
  EMBED_SHOW_LOADING_SCREEN_V1,
  EMBED_SHOW_LOADING_SCREEN_V2,
  EMBED_TRUE,
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

function hasEmbedOptionsQueryParam(): boolean {
  return new URLSearchParams(window.location.search).has(
    EMBED_OPTIONS_QUERY_PARAM_KEY
  )
}

/**
 * Returns "embed" and "embed_options" query param options in the url. Returns empty string if not embedded.
 * Example:
 *  returns "embed=true&embed_options=show_loading_screen_v2" if the url is
 *  http://localhost:3000/test?embed=true&embed_options=show_loading_screen_v2
 */
export function preserveEmbedQueryParams(): string {
  const embedOptionsValues = new URLSearchParams(
    window.location.search
  ).getAll(EMBED_OPTIONS_QUERY_PARAM_KEY)

  // instantiate multiple key values with an array of string pairs
  // https://stackoverflow.com/questions/72571132/urlsearchparams-with-multiple-values
  const embedUrlMap: string[][] = []
  embedUrlMap.push([EMBED_QUERY_PARAM_KEY, EMBED_TRUE])
  embedOptionsValues.forEach((embedValue: string) => {
    embedUrlMap.push([EMBED_OPTIONS_QUERY_PARAM_KEY, embedValue])
  })
  return new URLSearchParams(embedUrlMap).toString()
}

export enum LoadingScreenType {
  NONE,
  V1,
  V2,
}

export interface EmbedOptions {
  embedQueryParams: string
  embedded: boolean
  showColoredLine: boolean
  showToolbar: boolean
  showPadding: boolean
  disableScrolling: boolean
  lightTheme: boolean
  darkTheme: boolean
  hideLoadingScreen: boolean
  showLoadingScreen: LoadingScreenType
}

export function useEmbedOptions(appConfig: AppConfig): EmbedOptions {
  const embedOptions = hasEmbedOptionsQueryParam()
    ? getEmbedUrlParams(EMBED_OPTIONS_QUERY_PARAM_KEY)
    : appConfig.embedOptions ?? new Set<string>()
  const embedQueryParams = preserveEmbedQueryParams()

  const embedded = getEmbedUrlParams(EMBED_QUERY_PARAM_KEY).has(EMBED_TRUE)
  const showColoredLine = embedOptions.has(EMBED_SHOW_COLORED_LINE)
  const showToolbar = embedOptions.has(EMBED_SHOW_TOOLBAR)
  const showPadding = embedOptions.has(EMBED_SHOW_PADDING)
  const disableScrolling = embedOptions.has(EMBED_DISABLE_SCROLLING)
  const lightTheme = embedOptions.has(EMBED_LIGHT_THEME)
  const darkTheme = embedOptions.has(EMBED_DARK_THEME)
  const hideLoadingScreen = embedOptions.has(EMBED_HIDE_LOADING_SCREEN)
  const showLoadingScreen = hideLoadingScreen
    ? LoadingScreenType.NONE
    : embedOptions.has(EMBED_SHOW_LOADING_SCREEN_V1)
    ? LoadingScreenType.V1
    : LoadingScreenType.V2

  return {
    embedQueryParams,
    embedded,
    showColoredLine,
    showToolbar,
    showPadding,
    disableScrolling,
    lightTheme,
    darkTheme,
    hideLoadingScreen,
    showLoadingScreen,
  }
}
