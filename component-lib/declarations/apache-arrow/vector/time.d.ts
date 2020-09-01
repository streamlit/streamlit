import { BaseVector } from "./base";
import {
  Time,
  TimeSecond,
  TimeMillisecond,
  TimeMicrosecond,
  TimeNanosecond
} from "../type";
/** @ignore */
export declare class TimeVector<T extends Time = Time> extends BaseVector<T> {}
/** @ignore */
export declare class TimeSecondVector extends TimeVector<TimeSecond> {}
/** @ignore */
export declare class TimeMillisecondVector extends TimeVector<
  TimeMillisecond
> {}
/** @ignore */
export declare class TimeMicrosecondVector extends TimeVector<
  TimeMicrosecond
> {}
/** @ignore */
export declare class TimeNanosecondVector extends TimeVector<TimeNanosecond> {}
