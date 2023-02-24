/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
  LabelVisibilityMessage as LabelVisibilityMessageProto,
  Element,
} from "src/autogen/proto"
import _ from "lodash"
import xxhash from "xxhashjs"

/**
 * Wraps a function to allow it to be called, at most, once per interval
 * (specified in milliseconds). If the wrapper function is called N times
 * within that interval, only the Nth call will go through. The function
 * will only be called after the full interval has elapsed since the last
 * call.
 */
export function debounce(delay: number, fn: any): any {
  let timerId: any

  return (...args: any[]) => {
    if (timerId) {
      clearTimeout(timerId)
    }

    timerId = setTimeout(() => {
      fn(...args)
      timerId = null
    }, delay)
  }
}

/**
 * Embed query param values, which can be set in ?embed={value}, all should be lowercase
 */
export const EMBED_QUERY_PARAM_KEY = "embed"
export const EMBED_OPTIONS_QUERY_PARAM_KEY = "embed_options"
export const EMBED_SHOW_COLORED_LINE = "show_colored_line"
export const EMBED_SHOW_TOOLBAR = "show_toolbar"
export const EMBED_SHOW_PADDING = "show_padding"
export const EMBED_DISABLE_SCROLLING = "disable_scrolling"
export const EMBED_SHOW_FOOTER = "show_footer"
export const EMBED_LIGHT_THEME = "light_theme"
export const EMBED_DARK_THEME = "dark_theme"
export const EMBED_TRUE = "true"
export const EMBED_QUERY_PARAM_VALUES = [
  EMBED_SHOW_COLORED_LINE,
  EMBED_SHOW_TOOLBAR,
  EMBED_SHOW_PADDING,
  EMBED_DISABLE_SCROLLING,
  EMBED_SHOW_FOOTER,
  EMBED_LIGHT_THEME,
  EMBED_DARK_THEME,
  EMBED_TRUE,
]

/**
 * Returns list of defined in EMBED_QUERY_PARAM_VALUES url params of given key
 * (EMBED_QUERY_PARAM_KEY, EMBED_OPTIONS_QUERY_PARAM_KEY). Is case insensitive.
 */
export function getEmbedUrlParams(embedKey: string): Set<string> {
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
 * Returns true if the URL parameters contain ?embed=true (case insensitive).
 */
export function isEmbed(): boolean {
  return getEmbedUrlParams(EMBED_QUERY_PARAM_KEY).has(EMBED_TRUE)
}

/**
 * Returns true if the URL parameters contain ?embed=true&embed_options=show_colored_line (case insensitive).
 */
export function isColoredLineDisplayed(): boolean {
  return (
    isEmbed() &&
    getEmbedUrlParams(EMBED_OPTIONS_QUERY_PARAM_KEY).has(
      EMBED_SHOW_COLORED_LINE
    )
  )
}

/**
 * Returns true if the URL parameters contain ?embed=true&embed_options=show_toolbar (case insensitive).
 */
export function isToolbarDisplayed(): boolean {
  return (
    isEmbed() &&
    getEmbedUrlParams(EMBED_OPTIONS_QUERY_PARAM_KEY).has(EMBED_SHOW_TOOLBAR)
  )
}

/**
 * Returns true if the URL parameters contain ?embed=true&embed_options=disable_scrolling (case insensitive).
 */
export function isScrollingHidden(): boolean {
  return getEmbedUrlParams(EMBED_OPTIONS_QUERY_PARAM_KEY).has(
    EMBED_DISABLE_SCROLLING
  )
}

/**
 * Returns true if the URL parameters contain ?embed=true&embed_options=show_footer (case insensitive).
 */
export function isFooterDisplayed(): boolean {
  return (
    isEmbed() &&
    getEmbedUrlParams(EMBED_OPTIONS_QUERY_PARAM_KEY).has(EMBED_SHOW_FOOTER)
  )
}

/**
 * Returns true if the URL parameters contain ?embed=true&embed_options=show_padding (case insensitive).
 */
export function isPaddingDisplayed(): boolean {
  return (
    isEmbed() &&
    getEmbedUrlParams(EMBED_OPTIONS_QUERY_PARAM_KEY).has(EMBED_SHOW_PADDING)
  )
}

/**
 * Returns true if the URL parameters contain ?embed_options=light_theme (case insensitive).
 */
export function isLightTheme(): boolean {
  return getEmbedUrlParams(EMBED_OPTIONS_QUERY_PARAM_KEY).has(
    EMBED_LIGHT_THEME
  )
}

/**
 * Returns true if the URL parameters contain ?embed_options=dark_theme (case insensitive).
 */
export function isDarkTheme(): boolean {
  return getEmbedUrlParams(EMBED_OPTIONS_QUERY_PARAM_KEY).has(EMBED_DARK_THEME)
}

/**
 * Returns true if the parent parameter indicates that we're in an iframe.
 */
export function isInChildFrame(): boolean {
  return window.parent !== window
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

/**
 * A helper function to hash a string using xxHash32 algorithm.
 * Seed used: 0xDEADBEEF
 */
export function hashString(s: string): string {
  return xxhash.h32(s, 0xdeadbeef).toString(16)
}

/**
 * Coerces a possibly-null value into a non-null value, throwing an error
 * if the value is null or undefined.
 */
export function requireNonNull<T>(obj: T | null | undefined): T {
  if (obj == null) {
    throw new Error("value is null")
  }
  return obj
}

/**
 * A type predicate that is true if the given value is not undefined.
 */
export function notUndefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

/**
 * A type predicate that is true if the given value is not null.
 */
export function notNull<T>(value: T | null): value is T {
  return value != null
}

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
 * A promise that would be resolved after certain time
 * @param ms number
 */
export function timeout(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Tests if the app is running from a Mac
 */
export function isFromMac(): boolean {
  return /Mac/i.test(navigator.platform)
}

/**
 * Tests if the app is running from a Windows
 */
export function isFromWindows(): boolean {
  return /^Win/i.test(navigator.platform)
}

/**
 * Returns cookie value
 */
export function getCookie(name: string): string | undefined {
  const r = document.cookie.match(`\\b${name}=([^;]*)\\b`)
  return r ? r[1] : undefined
}

/**
 * Sets cookie value
 */
export function setCookie(
  name: string,
  value?: string,
  expiration?: Date
): void {
  const expirationDate = value ? expiration : new Date()
  const expirationStr: string = expirationDate
    ? `expires=${expirationDate.toUTCString()};`
    : ""
  document.cookie = `${name}=${value};${expirationStr}path=/`
}

/** Return an Element's widget ID if it's a widget, and undefined otherwise. */
export function getElementWidgetID(element: Element): string | undefined {
  return _.get(element as any, [requireNonNull(element.type), "id"])
}

/** True if the given form ID is non-null and non-empty. */
export function isValidFormId(formId?: string): formId is string {
  return formId != null && formId.length > 0
}

/** True if the given widget element is part of a form. */
export function isInForm(widget: { formId?: string }): boolean {
  return isValidFormId(widget.formId)
}

export enum LabelVisibilityOptions {
  Visible,
  Hidden,
  Collapsed,
}

export function labelVisibilityProtoValueToEnum(
  value: LabelVisibilityMessageProto.LabelVisibilityOptions | null | undefined
): LabelVisibilityOptions {
  switch (value) {
    case LabelVisibilityMessageProto.LabelVisibilityOptions.VISIBLE:
      return LabelVisibilityOptions.Visible
    case LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN:
      return LabelVisibilityOptions.Hidden
    case LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED:
      return LabelVisibilityOptions.Collapsed
    default:
      return LabelVisibilityOptions.Visible
  }
}

/**
 * Looks for an IFrame with given className inside given querySet
 */
export function findAnIFrameWithClassName(
  qs: NodeListOf<HTMLIFrameElement> | HTMLCollectionOf<HTMLIFrameElement>,
  className: string
): HTMLIFrameElement | null {
  for (let i = 0; i < qs.length; i++) {
    const cd = qs[i].contentDocument
    if (cd && cd.getElementsByClassName(className).length > 0) {
      return qs[i]
    }
  }
  return null
}

/**
 * Returns True if IFrame can be accessed otherwise returns False
 */
export function canAccessIFrame(iframe: HTMLIFrameElement): boolean {
  try {
    if (iframe.contentWindow === null) return false
    const doc = iframe.contentDocument || iframe.contentWindow.document
    const html = doc.body.innerHTML
    return html !== null && html !== ""
  } catch (err) {
    return false
  }
}

/**
 * Tries to get an IFrame in which Streamlit app is embedded on Cloud deployments.
 * It assumes iframe has title="streamlitApp", iterates over IFrames,
 * and looks which IFrame contains div with stAppId value, otherwise returns first found iFrame or null.
 */
export function getIFrameEnclosingApp(
  embeddingId: string
): HTMLIFrameElement | null {
  if (!isInChildFrame()) {
    return null
  }
  const embeddingIdClassName = getEmbeddingIdClassName(embeddingId)
  const qsStreamlitAppStr = 'iframe[title="streamlitApp"]'
  let qs = window.document.querySelectorAll(
    qsStreamlitAppStr
  ) as NodeListOf<HTMLIFrameElement>
  let foundIFrame = findAnIFrameWithClassName(qs, embeddingIdClassName)
  if (foundIFrame && !canAccessIFrame(foundIFrame)) {
    return null
  }
  if (foundIFrame) {
    return foundIFrame
  }
  if (window.parent) {
    qs = window.parent.document.querySelectorAll(qsStreamlitAppStr)
  }
  foundIFrame = findAnIFrameWithClassName(qs, embeddingIdClassName)
  if (foundIFrame && !canAccessIFrame(foundIFrame)) {
    return null
  }
  if (foundIFrame) {
    return foundIFrame
  }
  let htmlCollection = window.document.getElementsByTagName(
    "iframe"
  ) as HTMLCollectionOf<HTMLIFrameElement>
  foundIFrame = findAnIFrameWithClassName(htmlCollection, embeddingIdClassName)
  if (foundIFrame && !canAccessIFrame(foundIFrame)) {
    return null
  }
  if (foundIFrame) {
    return foundIFrame
  }
  if (window.parent) {
    htmlCollection = window.parent.document.getElementsByTagName("iframe")
  }
  foundIFrame = findAnIFrameWithClassName(htmlCollection, embeddingIdClassName)
  if (foundIFrame && !canAccessIFrame(foundIFrame)) {
    return null
  }
  return foundIFrame
}

/**
 * Returns UID generated based on current date and Math.random module
 */
export function generateUID(): string {
  return (
    Math.floor(Date.now() / 1000).toString(36) +
    Math.random().toString(36).slice(-6)
  )
}

/**
 * Returns stAppEmbeddingId-${this.embeddingId} string,
 * which is used as class to detect iFrame when printing
 */
export function getEmbeddingIdClassName(embeddingId: string): string {
  return `stAppEmbeddingId-${embeddingId}`
}
