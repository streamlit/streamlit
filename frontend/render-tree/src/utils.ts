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

import {
  Alert as AlertProto,
  Element,
  Skeleton as SkeletonProto,
} from "@streamlit/protobuf"

/**
 * Embed query param values, which can be set in ?embed={value}, all should be lowercase
 */
export const EMBED_QUERY_PARAM_KEY = "embed"
export const EMBED_OPTIONS_QUERY_PARAM_KEY = "embed_options"
export const EMBED_HIDE_LOADING_SCREEN = "hide_loading_screen"
export const EMBED_SHOW_LOADING_SCREEN_V1 = "show_loading_screen_v1"
export const EMBED_SHOW_LOADING_SCREEN_V2 = "show_loading_screen_v2"
export const EMBED_TRUE = "true"
export const EMBED_SHOW_TOOLBAR = "show_toolbar"
export const EMBED_SHOW_PADDING = "show_padding"
export const EMBED_DISABLE_SCROLLING = "disable_scrolling"
export const EMBED_LIGHT_THEME = "light_theme"
export const EMBED_DARK_THEME = "dark_theme"

export const EMBED_QUERY_PARAM_VALUES = [
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

export enum LoadingScreenType {
  NONE,
  V1,
  V2,
}

/**
 * Returns list of defined in EMBED_QUERY_PARAM_VALUES url params of given key
 * (EMBED_QUERY_PARAM_KEY, EMBED_OPTIONS_QUERY_PARAM_KEY). Is case insensitive.
 */
export function getEmbedUrlParams(embedKey: string): Set<string> {
  const embedUrlParams = new Set<string>()

  // Check if window is defined (for SSR/Node environments)
  if (typeof window === "undefined") {
    return embedUrlParams
  }

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
 * Returns a string with the type of loading screen to use while the app is
 * waiting for the backend to send displayable protos.
 */
export function getLoadingScreenType(): LoadingScreenType {
  const params = getEmbedUrlParams(EMBED_OPTIONS_QUERY_PARAM_KEY)

  return params.has(EMBED_HIDE_LOADING_SCREEN)
    ? LoadingScreenType.NONE
    : params.has(EMBED_SHOW_LOADING_SCREEN_V1)
      ? LoadingScreenType.V1
      : LoadingScreenType.V2
}

/** Return an info Element protobuf with the given text. */
export function makeElementWithInfoText(text: string): Element {
  return new Element({
    alert: {
      body: text,
      format: AlertProto.Format.INFO,
    },
  })
}

/** Return an error Element protobuf with the given text. */
export function makeElementWithErrorText(text: string): Element {
  return new Element({
    alert: {
      body: text,
      format: AlertProto.Format.ERROR,
    },
  })
}

/** Return a special internal-only Element showing an app "skeleton". */
export function makeAppSkeletonElement(): Element {
  return new Element({
    skeleton: { style: SkeletonProto.SkeletonStyle.APP },
  })
}

/**
 * Ensures that an unknown error value is converted to an Error instance.
 */
export function ensureError(err: unknown): Error {
  if (err instanceof Error) {
    return err
  }

  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  return new Error(`${err}`)
}
