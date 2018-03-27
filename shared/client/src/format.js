/**
 * Text formatting utilities
 */

class Format {
  nanosToDate(nanos) {
    return new Date(nanos / 1e6);
  }

  dateToString(date) {
    return date.toISOString().replace('.000Z', 'Z').replace('00:00:00Z', 'Z');
  }
};

const format = new Format();
export default format;
