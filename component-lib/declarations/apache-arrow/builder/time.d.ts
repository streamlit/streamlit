import { FixedWidthBuilder } from "../builder";
import {
  Time,
  TimeSecond,
  TimeMillisecond,
  TimeMicrosecond,
  TimeNanosecond
} from "../type";
/** @ignore */
export declare class TimeBuilder<
  T extends Time = Time,
  TNull = any
> extends FixedWidthBuilder<T, TNull> {}
/** @ignore */
export declare class TimeSecondBuilder<TNull = any> extends TimeBuilder<
  TimeSecond,
  TNull
> {}
/** @ignore */
export declare class TimeMillisecondBuilder<TNull = any> extends TimeBuilder<
  TimeMillisecond,
  TNull
> {}
/** @ignore */
export declare class TimeMicrosecondBuilder<TNull = any> extends TimeBuilder<
  TimeMicrosecond,
  TNull
> {}
/** @ignore */
export declare class TimeNanosecondBuilder<TNull = any> extends TimeBuilder<
  TimeNanosecond,
  TNull
> {}
