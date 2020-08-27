import { FixedWidthBuilder } from "../builder";
import { Interval, IntervalDayTime, IntervalYearMonth } from "../type";
/** @ignore */
export declare class IntervalBuilder<
  T extends Interval = Interval,
  TNull = any
> extends FixedWidthBuilder<T, TNull> {}
/** @ignore */
export declare class IntervalDayTimeBuilder<
  TNull = any
> extends IntervalBuilder<IntervalDayTime, TNull> {}
/** @ignore */
export declare class IntervalYearMonthBuilder<
  TNull = any
> extends IntervalBuilder<IntervalYearMonth, TNull> {}
