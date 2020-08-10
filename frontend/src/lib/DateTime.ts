/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

import moment from "moment-timezone"
import { Datetime } from "autogen/proto"

class DateTimeHandler {
  static moment(date: any, timezone?: string): moment.Moment {
    const nanos = date.datetime || (date.get && date.get("datetime"))
    let datetime = moment(nanos ? this.nanosToMilli(nanos) : date)
    const datetimeTimezone =
      timezone || date.timezone || (date.get && date.get("timezone"))
    return datetimeTimezone
      ? datetime.tz(datetimeTimezone)
      : datetime.tz("UTC").tz(moment.tz.guess(), true)
  }

  static nanosToMilli(nanos: number): number {
    return nanos / 1e6
  }

  static nanosToDuration(nanos: number): Duration {
    return new Duration(nanos / 1e6)
  }

  static dateToString(date: any): string {
    date = this.moment(date)
    let format = "lll z"
    if (date.hour() === 0 && date.minute() === 0 && date.second() === 0) {
      format = "ll z"
    }

    return date.format(format)
  }
}

class Duration {
  private readonly millis: number

  constructor(millis: number) {
    this.millis = millis
  }

  getTime(): number {
    return this.millis
  }
}

export { DateTimeHandler, Duration }
