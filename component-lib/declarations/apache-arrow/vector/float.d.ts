import { Chunked } from "./chunked";
import { BaseVector } from "./base";
import { VectorBuilderOptions } from "./index";
import { VectorBuilderOptionsAsync } from "./index";
import { Float, Float16, Float32, Float64, FloatArray } from "../type";
import { VectorType as V } from "../interfaces";
/** @ignore */
declare type FromInput<T extends Float, TNull = any> =
  | FloatArray
  | Iterable<T["TValue"] | TNull>
  | AsyncIterable<T["TValue"] | TNull>
  | VectorBuilderOptions<T, TNull>
  | VectorBuilderOptionsAsync<T, TNull>;
/** @ignore */
export declare class FloatVector<T extends Float = Float> extends BaseVector<
  T
> {
  static from(this: typeof FloatVector, input: Uint16Array): Float16Vector;
  static from(this: typeof FloatVector, input: Float32Array): Float32Vector;
  static from(this: typeof FloatVector, input: Float64Array): Float64Vector;
  static from<TNull = any>(
    this: typeof Float16Vector,
    input: FromInput<Float16, TNull>
  ): Float16Vector;
  static from<TNull = any>(
    this: typeof Float32Vector,
    input: FromInput<Float32, TNull>
  ): Float32Vector;
  static from<TNull = any>(
    this: typeof Float64Vector,
    input: FromInput<Float64, TNull>
  ): Float64Vector;
  static from<T extends Float, TNull = any>(
    this: typeof FloatVector,
    input: Iterable<T["TValue"] | TNull>
  ): V<T>;
  static from<T extends Float, TNull = any>(
    this: typeof FloatVector,
    input: AsyncIterable<T["TValue"] | TNull>
  ): Promise<V<T>>;
  static from<T extends Float, TNull = any>(
    this: typeof FloatVector,
    input: VectorBuilderOptions<T, TNull>
  ): Chunked<T>;
  static from<T extends Float, TNull = any>(
    this: typeof FloatVector,
    input: VectorBuilderOptionsAsync<T, TNull>
  ): Promise<Chunked<T>>;
}
/** @ignore */
export declare class Float16Vector extends FloatVector<Float16> {
  toFloat32Array(): Float32Array;
  toFloat64Array(): Float64Array;
}
/** @ignore */
export declare class Float32Vector extends FloatVector<Float32> {}
/** @ignore */
export declare class Float64Vector extends FloatVector<Float64> {}
export {};
