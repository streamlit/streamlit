import { WideBufferBuilder } from "./buffer";
import { FixedWidthBuilder, BuilderOptions } from "../builder";
import {
  Int,
  Int8,
  Int16,
  Int32,
  Int64,
  Uint8,
  Uint16,
  Uint32,
  Uint64
} from "../type";
/** @ignore */
export declare class IntBuilder<
  T extends Int = Int,
  TNull = any
> extends FixedWidthBuilder<T, TNull> {
  setValue(index: number, value: T["TValue"]): void;
}
/** @ignore */
export declare class Int8Builder<TNull = any> extends IntBuilder<
  Int8,
  TNull
> {}
/** @ignore */
export declare class Int16Builder<TNull = any> extends IntBuilder<
  Int16,
  TNull
> {}
/** @ignore */
export declare class Int32Builder<TNull = any> extends IntBuilder<
  Int32,
  TNull
> {}
/** @ignore */
export declare class Int64Builder<TNull = any> extends IntBuilder<
  Int64,
  TNull
> {
  protected _values: WideBufferBuilder<Int32Array, BigInt64Array>;
  constructor(options: BuilderOptions<Int64, TNull>);
  readonly values64: BigInt64Array;
  isValid(value: Int32Array | bigint | TNull): boolean;
}
/** @ignore */
export declare class Uint8Builder<TNull = any> extends IntBuilder<
  Uint8,
  TNull
> {}
/** @ignore */
export declare class Uint16Builder<TNull = any> extends IntBuilder<
  Uint16,
  TNull
> {}
/** @ignore */
export declare class Uint32Builder<TNull = any> extends IntBuilder<
  Uint32,
  TNull
> {}
/** @ignore */
export declare class Uint64Builder<TNull = any> extends IntBuilder<
  Uint64,
  TNull
> {
  protected _values: WideBufferBuilder<Uint32Array, BigUint64Array>;
  constructor(options: BuilderOptions<Uint64, TNull>);
  readonly values64: BigUint64Array;
  isValid(value: Uint32Array | bigint | TNull): boolean;
}
