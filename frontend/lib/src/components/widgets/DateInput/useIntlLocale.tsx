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

import { useMemo } from "react"

import type { Day, Locale } from "date-fns"
import { enUS } from "date-fns/locale/en-US"

import { getWeekInfoForLocale } from "./weekInfo"

/**
 * Returns an augmented en-US locale with the weekStartsOn option set to the
 * correct value for the given locale, if the browser supports it.
 *
 * This is used as a stop-gap solution since date-fns is a large library and we
 * don't want to include all locales in the wheel file.
 *
 * Note: this hook is consumed by `DateTimeInput.tsx` (range mode) only —
 * the single-date calendar determines week start internally via bundled CLDR data.
 *
 * @param locale  The locale for which to retrieve week information.
 * @returns The augmented locale, or en-US if the week information could not be
 * retrieved.
 */
export const useIntlLocale = (locale: string): Locale => {
  const weekInfo = useMemo(() => getWeekInfoForLocale(locale), [locale])

  if (!weekInfo) {
    return enUS
  }

  /**
   * Customize the start of week day.
   * Intl API starts with Monday on 1, but BaseWeb starts with Sunday on 0
   * @see https://date-fns.org/v2.30.0/docs/Locale
   */
  const normalizedFirstDay =
    weekInfo.firstDay >= 1 && weekInfo.firstDay <= 7 ? weekInfo.firstDay : 7
  const firstDay: Day =
    normalizedFirstDay === 7 ? 0 : (normalizedFirstDay as Day)

  return {
    ...enUS,
    options: {
      ...enUS.options,
      weekStartsOn: firstDay,
    },
  }
}
