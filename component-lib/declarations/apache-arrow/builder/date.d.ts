import { FixedWidthBuilder } from "../builder";
import { Date_, DateDay, DateMillisecond } from "../type";
/** @ignore */
export declare class DateBuilder<
  T extends Date_ = Date_,
  TNull = any
> extends FixedWidthBuilder<T, TNull> {}
/** @ignore */
export declare class DateDayBuilder<TNull = any> extends DateBuilder<
  DateDay,
  TNull
> {}
/** @ignore */
export declare class DateMillisecondBuilder<TNull = any> extends DateBuilder<
  DateMillisecond,
  TNull
> {}
