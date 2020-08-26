import { DateUnit } from "../enum";
import { Chunked } from "./chunked";
import { BaseVector } from "./base";
import { VectorType as V } from "../interfaces";
import { VectorBuilderOptions } from "./index";
import { VectorBuilderOptionsAsync } from "./index";
import { Date_, DateDay, DateMillisecond } from "../type";
/** @ignore */
declare type FromArgs<T extends Date_> = [Iterable<Date>, T["unit"]];
/** @ignore */
export declare class DateVector<T extends Date_ = Date_> extends BaseVector<
  T
> {
  static from<T extends DateUnit.DAY>(...args: FromArgs<DateDay>): V<DateDay>;
  static from<T extends DateUnit.MILLISECOND>(
    ...args: FromArgs<DateMillisecond>
  ): V<DateMillisecond>;
  static from<T extends Date_, TNull = any>(
    input: Iterable<Date | TNull>
  ): V<T>;
  static from<T extends Date_, TNull = any>(
    input: AsyncIterable<Date | TNull>
  ): Promise<V<T>>;
  static from<T extends Date_, TNull = any>(
    input: VectorBuilderOptions<T, TNull>
  ): Chunked<T>;
  static from<T extends Date_, TNull = any>(
    input: VectorBuilderOptionsAsync<T, TNull>
  ): Promise<Chunked<T>>;
}
/** @ignore */
export declare class DateDayVector extends DateVector<DateDay> {}
/** @ignore */
export declare class DateMillisecondVector extends DateVector<
  DateMillisecond
> {}
export {};
