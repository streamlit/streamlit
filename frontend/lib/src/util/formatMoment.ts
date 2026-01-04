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

import type { Moment } from "moment"

export type MomentKind = "date" | "time" | "datetime"

/**
 * Formats the given date to a string with the given format.
 *
 * @param momentDate The moment date to format.
 * @param format The format to use.
 *   If the format is `localized` the date will be formatted according to the user's locale.
 *   If the format is `distance` the date will be formatted as a relative time distance (e.g. "2 hours ago").
 *   If the format is `calendar` the date will be formatted as a calendar date (e.g. "Tomorrow 12:00").
 *   If the format is `iso8601` the date will be formatted according to ISO 8601 standard:
 *     - For date: YYYY-MM-DD
 *     - For time: HH:mm:ss.sssZ
 *     - For datetime: YYYY-MM-DDTHH:mm:ss.sssZ
 *   Otherwise, it is interpreted as momentJS format string: https://momentjs.com/docs/#/displaying/format/
 * @param momentKind The type of moment value: "date", "time", or "datetime"
 * @returns The formatted date as a string.
 */
export function formatMoment(
  momentDate: Moment,
  format: string,
  momentKind: MomentKind = "datetime"
): string {
  if (format === "localized") {
    const locales = navigator.languages
    const dateStyle = momentKind === "time" ? undefined : "medium"
    const timeStyle = momentKind === "date" ? undefined : "medium"
    try {
      return new Intl.DateTimeFormat(locales, {
        dateStyle,
        timeStyle,
      }).format(momentDate.toDate())
    } catch (error) {
      if (error instanceof RangeError) {
        return new Intl.DateTimeFormat(undefined, {
          dateStyle,
          timeStyle,
        }).format(momentDate.toDate())
      }
      throw error
    }
  } else if (format === "distance") {
    return momentDate.fromNow()
  } else if (format === "calendar") {
    return momentDate.calendar()
  } else if (format === "iso8601") {
    if (momentKind === "date") {
      return momentDate.format("YYYY-MM-DD")
    } else if (momentKind === "time") {
      return momentDate.format("HH:mm:ss.SSS[Z]")
    }
    return momentDate.toISOString()
  }
  return momentDate.format(format)
}
