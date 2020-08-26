import {
  TypedArray,
  TypedArrayConstructor,
  BigIntArray,
  BigIntArrayConstructor
} from "../interfaces";
/** @ignore */ declare type DataValue<T> = T extends TypedArray
  ? number
  : T extends BigIntArray
  ? WideValue<T>
  : T;
/** @ignore */ declare type WideValue<
  T extends BigIntArray
> = T extends BigIntArray ? bigint | Int32Array | Uint32Array : never;
/** @ignore */ declare type ArrayCtor<
  T extends TypedArray | BigIntArray
> = T extends TypedArray
  ? TypedArrayConstructor<T>
  : T extends BigIntArray
  ? BigIntArrayConstructor<T>
  : any;
/** @ignore */
export interface BufferBuilder<
  T extends TypedArray | BigIntArray = any,
  TValue = DataValue<T>
> {
  readonly offset: number;
}
/** @ignore */
export declare class BufferBuilder<
  T extends TypedArray | BigIntArray = any,
  TValue = DataValue<T>
> {
  constructor(buffer: T, stride?: number);
  buffer: T;
  length: number;
  readonly stride: number;
  readonly ArrayType: ArrayCtor<T>;
  readonly BYTES_PER_ELEMENT: number;
  readonly byteLength: number;
  readonly reservedLength: number;
  readonly reservedByteLength: number;
  set(index: number, value: TValue): this;
  append(value: TValue): this;
  reserve(extra: number): this;
  flush(length?: number): T;
  clear(): this;
  protected _resize(newLength: number): T;
}
/** @ignore */
export declare class DataBufferBuilder<
  T extends TypedArray
> extends BufferBuilder<T, number> {
  last(): number;
  get(index: number): number;
  set(index: number, value: number): this;
}
/** @ignore */
export declare class BitmapBufferBuilder extends DataBufferBuilder<
  Uint8Array
> {
  constructor(data?: Uint8Array);
  numValid: number;
  readonly numInvalid: number;
  get(idx: number): number;
  set(idx: number, val: number): this;
  clear(): this;
}
/** @ignore */
export declare class OffsetsBufferBuilder extends DataBufferBuilder<
  Int32Array
> {
  constructor(data?: Int32Array);
  append(value: number): this;
  set(index: number, value: number): this;
  flush(length?: number): Int32Array;
}
/** @ignore */
export declare class WideBufferBuilder<
  T extends TypedArray,
  R extends BigIntArray
> extends BufferBuilder<T, DataValue<T>> {
  buffer64: R;
  protected _ArrayType64: BigIntArrayConstructor<R>;
  readonly ArrayType64: BigIntArrayConstructor<R>;
  set(index: number, value: DataValue<T>): this;
  protected _resize(newLength: number): T;
}
export {};
