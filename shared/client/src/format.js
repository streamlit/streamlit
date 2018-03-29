/**
 * Text formatting utilities
 */

import moment from 'moment';

class Format {
  nanosToDate(nanos) {
    return new Date(nanos / 1e6);
  }

  dateToString(date) {
    const m = moment(date);
    let format = 'lll';
    if (m.hour() === 0 && m.minute() === 0 && m.second() === 0) {
      format = 'll';
    }
    return m.format(format);
  }
};

const format = new Format();
export default format;
