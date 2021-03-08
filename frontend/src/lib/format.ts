/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Text formatting utilities
 */
import moment from "moment"
import "moment-duration-format"
import numbro from "numbro"

class Duration {
  private readonly millis: number

  constructor(millis: number) {
    this.millis = millis
  }

  getTime(): number {
    return this.millis
  }
}

class Format {
  static nanosToDate(nanos: number): Date {
    return new Date(nanos / 1e6)
  }

  static iso8601ContainsTimezone(iso: string): boolean {
    // https://en.wikipedia.org/wiki/ISO_8601#Time_zone_designators
    const regexes = [/[+-]\d\d\d\d$/, /[+-]\d\d$/, /[+-]\d\d:\d\d$/, /Z$/]
    return regexes.some(it => it.test(iso))
  }

  static iso8601ToMoment(iso: string): moment.Moment {
    return Format.iso8601ContainsTimezone(iso)
      ? moment.parseZone(iso)
      : moment(iso)
  }

  static nanosToDuration(nanos: number): Duration {
    return new Duration(nanos / 1e6)
  }

  static dateToString(date: Date): string {
    const m = moment(date)
    let format = "lll"
    if (m.hour() === 0 && m.minute() === 0 && m.second() === 0) {
      format = "ll"
    }
    return m.format(format)
  }

  static durationToString(duration: Duration): string {
    const ms = moment.duration(duration.getTime()).asMilliseconds()
    return moment.utc(ms).format()
  }
}

/**
 * Formats the string nicely if it's a floating point, number, date or duration.
 */
function toFormattedString(x: any): string {
  if (moment.isMoment(x)) {
    return x.format()
  }
  if (isFloat(x)) {
    return numbro(x).format("0,0.0000")
  }
  if (x instanceof Date) {
    return Format.dateToString(x)
  }
  if (x instanceof Duration) {
    return Format.durationToString(x)
  }
  return x.toString()
}

/**
 * Returns true if this number is a float.
 */
function isFloat(n: any): boolean {
  return Number(n) === n && n % 1 !== 0
}

export { Duration, Format, toFormattedString }
