import { Chunked } from "./chunked";
import { BaseVector } from "./base";
import { VectorBuilderOptions } from "./index";
import { VectorBuilderOptionsAsync } from "./index";
import {
  Int,
  Uint8,
  Uint16,
  Uint32,
  Uint64,
  Int8,
  Int16,
  Int32,
  Int64,
  IntArray
} from "../type";
import { VectorType as V, BigIntArray } from "../interfaces";
/** @ignore */
declare type FromInput<T extends Int, TNull = any> =
  | IntArray
  | BigIntArray
  | Iterable<T["TValue"] | TNull>
  | AsyncIterable<T["TValue"] | TNull>
  | VectorBuilderOptions<T, TNull>
  | VectorBuilderOptionsAsync<T, TNull>;
/** @ignore */
export declare class IntVector<T extends Int = Int> extends BaseVector<T> {
  static from(this: typeof IntVector, input: Int8Array): Int8Vector;
  static from(this: typeof IntVector, input: Int16Array): Int16Vector;
  static from(this: typeof IntVector, input: Int32Array): Int32Vector;
  static from(this: typeof IntVector, input: BigInt64Array): Int64Vector;
  static from(
    this: typeof IntVector,
    input: Int32Array,
    is64bit: true
  ): Int64Vector;
  static from(this: typeof IntVector, input: Uint8Array): Uint8Vector;
  static from(this: typeof IntVector, input: Uint16Array): Uint16Vector;
  static from(this: typeof IntVector, input: Uint32Array): Uint32Vector;
  static from(this: typeof IntVector, input: BigUint64Array): Uint64Vector;
  static from(
    this: typeof IntVector,
    input: Uint32Array,
    is64bit: true
  ): Uint64Vector;
  static from<TNull = any>(
    this: typeof Int8Vector,
    input: FromInput<Int8, TNull>
  ): Int8Vector;
  static from<TNull = any>(
    this: typeof Int16Vector,
    input: FromInput<Int16, TNull>
  ): Int16Vector;
  static from<TNull = any>(
    this: typeof Int32Vector,
    input: FromInput<Int32, TNull>
  ): Int32Vector;
  static from<TNull = any>(
    this: typeof Int64Vector,
    input: FromInput<Int64, TNull>
  ): Int64Vector;
  static from<TNull = any>(
    this: typeof Uint8Vector,
    input: FromInput<Uint8, TNull>
  ): Uint8Vector;
  static from<TNull = any>(
    this: typeof Uint16Vector,
    input: FromInput<Uint16, TNull>
  ): Uint16Vector;
  static from<TNull = any>(
    this: typeof Uint32Vector,
    input: FromInput<Uint32, TNull>
  ): Uint32Vector;
  static from<TNull = any>(
    this: typeof Uint64Vector,
    input: FromInput<Uint64, TNull>
  ): Uint64Vector;
  static from<T extends Int, TNull = any>(
    this: typeof IntVector,
    input: Iterable<T["TValue"] | TNull>
  ): V<T>;
  static from<T extends Int, TNull = any>(
    this: typeof IntVector,
    input: AsyncIterable<T["TValue"] | TNull>
  ): Promise<V<T>>;
  static from<T extends Int, TNull = any>(
    this: typeof IntVector,
    input: VectorBuilderOptions<T, TNull>
  ): Chunked<T>;
  static from<T extends Int, TNull = any>(
    this: typeof IntVector,
    input: VectorBuilderOptionsAsync<T, TNull>
  ): Promise<Chunked<T>>;
}
/** @ignore */
export declare class Int8Vector extends IntVector<Int8> {}
/** @ignore */
export declare class Int16Vector extends IntVector<Int16> {}
/** @ignore */
export declare class Int32Vector extends IntVector<Int32> {}
/** @ignore */
export declare class Int64Vector extends IntVector<Int64> {
  toBigInt64Array(): BigInt64Array;
  private _values64;
  readonly values64: BigInt64Array;
}
/** @ignore */
export declare class Uint8Vector extends IntVector<Uint8> {}
/** @ignore */
export declare class Uint16Vector extends IntVector<Uint16> {}
/** @ignore */
export declare class Uint32Vector extends IntVector<Uint32> {}
/** @ignore */
export declare class Uint64Vector extends IntVector<Uint64> {
  toBigUint64Array(): BigUint64Array;
  private _values64;
  readonly values64: BigUint64Array;
}
export {};
