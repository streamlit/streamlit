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

/** Locale helpers: validate BCP-47 tags for the calendar and read week-start
 *  info for the date-fns-backed range path. */

export interface IntlWeekInfo {
  firstDay: number
  weekend: number[]
  minimalDays?: number
}

/** Extended Intl.Locale with weekInfo support (not yet in all TS lib versions). */
type IntlLocaleWithWeekInfo = Intl.Locale & {
  getWeekInfo?: () => IntlWeekInfo
  weekInfo?: IntlWeekInfo
}

/**
 * Retrieves the week information for a given `Intl.Locale`.
 * Note: Firefox does not yet support the `weekInfo` property/`getWeekInfo`
 * function on `Intl.Locale`.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/getWeekInfo
 */
function getIntlWeekInfo(intlLocale: Intl.Locale): IntlWeekInfo | null {
  const locale = intlLocale as IntlLocaleWithWeekInfo
  return locale?.getWeekInfo?.() ?? locale?.weekInfo ?? null
}

/**
 * Parses `locale` into an `Intl.Locale` and retrieves its week info,
 * falling back to `en-US` if the locale string is invalid (e.g. from a
 * malformed `navigator.language`).
 */
export function getWeekInfoForLocale(locale: string): IntlWeekInfo | null {
  try {
    return getIntlWeekInfo(new Intl.Locale(locale))
  } catch {
    return getIntlWeekInfo(new Intl.Locale("en-US"))
  }
}

/**
 * Validates `locale` as a well-formed BCP-47 tag, falling back to `en-US`.
 * `Intl.Locale`/`Intl.DateTimeFormat` throw a `RangeError` (not a silent
 * fallback) for malformed tags — e.g. `does-not-exist` — so React Aria's
 * `I18nProvider` must never receive a raw, unvalidated locale string
 * directly, or the calendar popover crashes on render.
 */
export function getSafeLocale(locale: string): string {
  try {
    return new Intl.Locale(locale).toString()
  } catch {
    return "en-US"
  }
}
