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

import { useMemo } from "react"

import type { Locale } from "date-fns"
import { enUS } from "date-fns/locale/en-US"

/**
 * 1 = Monday, 7 = Sunday
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/getWeekInfo
 */
type IntlDayInteger = 1 | 2 | 3 | 4 | 5 | 6 | 7

type IntlWeekInfo = {
  firstDay: IntlDayInteger
  weekend: IntlDayInteger[]
  minimalDays: IntlDayInteger
}

/**
 * Retrieves the week information for a given locale.
 * Note: Firefox does not yet support the `weekInfo` property /`getWeekInfo`
 * function on `Intl.Locale`.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/getWeekInfo
 * @param {Intl.Locale} intlLocale - The locale for which to retrieve week
 * information.
 */
const getWeekInfo = (intlLocale: Intl.Locale): IntlWeekInfo | null => {
  return (
    // Casting is necessary here since the types are not yet up-to-date
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    (intlLocale as any)?.getWeekInfo?.() ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    (intlLocale as any)?.weekInfo ??
    null
  )
}

/**
 * Returns an augmented en-US locale with the weekStartsOn option set to the
 * correct value for the given locale, if the browser supports it.
 *
 * This is used as a stop-gap solution since date-fns is a large library and we
 * don't want to include all locales in the wheel file.
 *
 * @param locale  The locale for which to retrieve week information.
 * @returns The augmented locale, or en-US if the week information could not be
 * retrieved.
 */
export const useIntlLocale = (locale: string): Locale => {
  const weekInfo = useMemo(() => {
    try {
      return getWeekInfo(new Intl.Locale(locale))
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return getWeekInfo(new Intl.Locale("en-US"))
    }
  }, [locale])

  if (!weekInfo) {
    return enUS
  }

  /**
   * Customize the start of week day.
   * Intl API starts with Monday on 1, but BaseWeb starts with Sunday on 0
   * @see https://date-fns.org/v2.30.0/docs/Locale
   */
  const firstDay = weekInfo.firstDay === 7 ? 0 : weekInfo.firstDay

  return {
    ...enUS,
    options: {
      ...enUS.options,
      weekStartsOn: firstDay,
    },
  }
}
