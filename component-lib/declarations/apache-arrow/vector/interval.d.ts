import { BaseVector } from "./base";
import { Interval, IntervalDayTime, IntervalYearMonth } from "../type";
/** @ignore */
export declare class IntervalVector<
  T extends Interval = Interval
> extends BaseVector<T> {}
/** @ignore */
export declare class IntervalDayTimeVector extends IntervalVector<
  IntervalDayTime
> {}
/** @ignore */
export declare class IntervalYearMonthVector extends IntervalVector<
  IntervalYearMonth
> {}
