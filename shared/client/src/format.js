/**
 * Text formatting utilities
 */

import moment from 'moment';
import momentDurationFormat from 'moment-duration-format';
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
    return new Date(nanos / 1e6);
  }

  nanosToDuration(nanos) {
    return new Duration(nanos / 1e6);
  }

  dateToString(date) {
    const m = moment(date);
    let format = 'lll';
    if (m.hour() === 0 && m.minute() === 0 && m.second() === 0) {
      format = 'll';
    }
    return m.format(format);
  }

  durationToString(duration) {
    return moment.duration(duration.getTime()).format();
  }
};

const format = new Format();
export { Duration, format }
