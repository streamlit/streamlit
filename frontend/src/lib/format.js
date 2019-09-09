/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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
import momentDurationFormat from "moment-duration-format"
import numeral from "numeral"
momentDurationFormat(moment)

class Duration {
  constructor(millis) {
    this.millis = millis
  }

  getTime() {
    return this.millis
  }
}

class Format {
  nanosToDate(nanos) {
    return new Date(nanos / 1e6)
  }

  nanosToDuration(nanos) {
    return new Duration(nanos / 1e6)
  }

  dateToString(date) {
    const m = moment(date)
    let format = "lll"
    if (m.hour() === 0 && m.minute() === 0 && m.second() === 0) {
      format = "ll"
    }
    return m.format(format)
  }

  durationToString(duration) {
    return moment.duration(duration.getTime()).format()
  }
}

const format = new Format()

/**
 * Formats the string nicely if it's a floating point, number, date or duration.
 */
function toFormattedString(x) {
  if (isFloat(x)) {
    return numeral(x).format("0,0.0000")
  } else if (x instanceof Date) {
    return format.dateToString(x)
  } else if (x instanceof Duration) {
    return format.durationToString(x)
  } else {
    return x.toString()
  }
}

/**
 * Returns true if this number is a float.
 */
function isFloat(n) {
  return Number(n) === n && n % 1 !== 0
}

export { Duration, format, toFormattedString }
