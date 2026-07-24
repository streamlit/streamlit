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

import { getWeekInfoForLocale } from "./weekInfo"

/** React Aria's `Calendar`/`RangeCalendar` `firstDayOfWeek` prop shape. */
export type RACFirstDayOfWeek =
  | "sun"
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"

// Intl's getWeekInfo() numbers days 1 (Monday) through 7 (Sunday).
const ISO_DAY_TO_RAC: Record<number, RACFirstDayOfWeek> = {
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
  7: "sun",
}

/**
 * Returns the first day of the week for `locale`, in the shape React Aria's
 * `Calendar`/`RangeCalendar` `firstDayOfWeek` prop expects. Falls back to
 * `"sun"` (matching `en-US`) if the locale is invalid or the browser doesn't
 * support `Intl.Locale.getWeekInfo()` (e.g. Firefox) — the same fallback
 * `useIntlLocale.tsx` uses for BaseWeb's `DateTimeInput`, via the shared
 * `getWeekInfoForLocale` helper.
 */
export function useFirstDayOfWeek(locale: string): RACFirstDayOfWeek {
  return useMemo(() => {
    const weekInfo = getWeekInfoForLocale(locale)
    if (!weekInfo) return "sun"
    return ISO_DAY_TO_RAC[weekInfo.firstDay] ?? "sun"
  }, [locale])
}
