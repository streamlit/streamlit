import { BaseVector } from "./base";
import {
  Timestamp,
  TimestampSecond,
  TimestampMillisecond,
  TimestampMicrosecond,
  TimestampNanosecond
} from "../type";
/** @ignore */
export declare class TimestampVector<
  T extends Timestamp = Timestamp
> extends BaseVector<T> {}
/** @ignore */
export declare class TimestampSecondVector extends TimestampVector<
  TimestampSecond
> {}
/** @ignore */
export declare class TimestampMillisecondVector extends TimestampVector<
  TimestampMillisecond
> {}
/** @ignore */
export declare class TimestampMicrosecondVector extends TimestampVector<
  TimestampMicrosecond
> {}
/** @ignore */
export declare class TimestampNanosecondVector extends TimestampVector<
  TimestampNanosecond
> {}
