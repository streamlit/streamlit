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
  static moment(
    date: Date | string | number,
    timezone?: string
  ): moment.Moment {
    const displayTimezone = timezone || moment.tz.guess()
    return moment(date).tz(displayTimezone)
  }

  static protoToDate(dateProto: Datetime): moment.Moment {
    const datejson = dateProto.toJSON()
    return this.moment(this.nanosToDate(datejson.datetime), datejson.timezone)
  }

  static nanosToDate(nanos: any): Date {
    return new Date(nanos / 1e6)
  }

  static nanosToDuration(nanos: number): Duration {
    return new Duration(nanos / 1e6)
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
