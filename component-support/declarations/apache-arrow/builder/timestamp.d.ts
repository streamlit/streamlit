import { FixedWidthBuilder } from "../builder";
import {
  Timestamp,
  TimestampSecond,
  TimestampMillisecond,
  TimestampMicrosecond,
  TimestampNanosecond
} from "../type";
/** @ignore */
export declare class TimestampBuilder<
  T extends Timestamp = Timestamp,
  TNull = any
> extends FixedWidthBuilder<T, TNull> {}
/** @ignore */
export declare class TimestampSecondBuilder<
  TNull = any
> extends TimestampBuilder<TimestampSecond, TNull> {}
/** @ignore */
export declare class TimestampMillisecondBuilder<
  TNull = any
> extends TimestampBuilder<TimestampMillisecond, TNull> {}
/** @ignore */
export declare class TimestampMicrosecondBuilder<
  TNull = any
> extends TimestampBuilder<TimestampMicrosecond, TNull> {}
/** @ignore */
export declare class TimestampNanosecondBuilder<
  TNull = any
> extends TimestampBuilder<TimestampNanosecond, TNull> {}
