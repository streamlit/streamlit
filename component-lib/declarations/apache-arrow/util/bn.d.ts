import { ArrayBufferViewInput } from "./buffer";
import { TypedArray, TypedArrayConstructor } from "../interfaces";
import { BigIntArray, BigIntArrayConstructor } from "../interfaces";
/** @ignore */
export declare const isArrowBigNumSymbol: unique symbol;
/** @ignore */ declare type BigNumArray = IntArray | UintArray;
/** @ignore */ declare type IntArray = Int8Array | Int16Array | Int32Array;
/** @ignore */ declare type UintArray =
  | Uint8Array
  | Uint16Array
  | Uint32Array
  | Uint8ClampedArray;
/** @ignore */
export declare let bignumToString: {
  <T extends BN<BigNumArray>>(a: T): string;
};
/** @ignore */
export declare let bignumToBigInt: {
  <T extends BN<BigNumArray>>(a: T): bigint;
};
/** @ignore */
export declare class BN<T extends BigNumArray> {
  /** @nocollapse */
  static new<T extends BigNumArray>(num: T, isSigned?: boolean): T & BN<T>;
  /** @nocollapse */
  static signed<T extends IntArray>(num: T): T & BN<T>;
  /** @nocollapse */
  static unsigned<T extends UintArray>(num: T): T & BN<T>;
  /** @nocollapse */
  static decimal<T extends UintArray>(num: T): T & BN<T>;
  constructor(num: T, isSigned?: boolean);
}
/** @ignore */
export interface BN<T extends BigNumArray> extends TypedArrayLike<T> {
  new <T extends ArrayBufferViewInput>(buffer: T, signed?: boolean): T;
  readonly signed: boolean;
  readonly TypedArray: TypedArrayConstructor<TypedArray>;
  readonly BigIntArray: BigIntArrayConstructor<BigIntArray>;
  [Symbol.toStringTag]:
    | "Int8Array"
    | "Int16Array"
    | "Int32Array"
    | "Uint8Array"
    | "Uint16Array"
    | "Uint32Array"
    | "Uint8ClampedArray";
  /**
   * Convert the bytes to their (positive) decimal representation for printing
   */
  toString(): string;
  /**
   * Down-convert the bytes to a 53-bit precision integer. Invoked by JS for
   * arithmetic operators, like `+`. Easy (and unsafe) way to convert BN to
   * number via `+bn_inst`
   */
  valueOf(): number;
  /**
   * Return the JSON representation of the bytes. Must be wrapped in double-quotes,
   * so it's compatible with JSON.stringify().
   */
  toJSON(): string;
  [Symbol.toPrimitive](hint?: any): number | string | bigint;
}
/** @ignore */
interface TypedArrayLike<T extends BigNumArray> {
  readonly length: number;
  readonly buffer: ArrayBuffer;
  readonly byteLength: number;
  readonly byteOffset: number;
  readonly BYTES_PER_ELEMENT: number;
  includes(searchElement: number, fromIndex?: number | undefined): boolean;
  copyWithin(target: number, start: number, end?: number | undefined): this;
  every(
    callbackfn: (value: number, index: number, array: T) => boolean,
    thisArg?: any
  ): boolean;
  fill(
    value: number,
    start?: number | undefined,
    end?: number | undefined
  ): this;
  filter(
    callbackfn: (value: number, index: number, array: T) => boolean,
    thisArg?: any
  ): T;
  find(
    predicate: (value: number, index: number, obj: T) => boolean,
    thisArg?: any
  ): number | undefined;
  findIndex(
    predicate: (value: number, index: number, obj: T) => boolean,
    thisArg?: any
  ): number;
  forEach(
    callbackfn: (value: number, index: number, array: T) => void,
    thisArg?: any
  ): void;
  indexOf(searchElement: number, fromIndex?: number | undefined): number;
  join(separator?: string | undefined): string;
  lastIndexOf(searchElement: number, fromIndex?: number | undefined): number;
  map(
    callbackfn: (value: number, index: number, array: T) => number,
    thisArg?: any
  ): T;
  reduce(
    callbackfn: (
      previousValue: number,
      currentValue: number,
      currentIndex: number,
      array: T
    ) => number
  ): number;
  reduce(
    callbackfn: (
      previousValue: number,
      currentValue: number,
      currentIndex: number,
      array: T
    ) => number,
    initialValue: number
  ): number;
  reduce<U>(
    callbackfn: (
      previousValue: U,
      currentValue: number,
      currentIndex: number,
      array: T
    ) => U,
    initialValue: U
  ): U;
  reduceRight(
    callbackfn: (
      previousValue: number,
      currentValue: number,
      currentIndex: number,
      array: T
    ) => number
  ): number;
  reduceRight(
    callbackfn: (
      previousValue: number,
      currentValue: number,
      currentIndex: number,
      array: T
    ) => number,
    initialValue: number
  ): number;
  reduceRight<U>(
    callbackfn: (
      previousValue: U,
      currentValue: number,
      currentIndex: number,
      array: T
    ) => U,
    initialValue: U
  ): U;
  reverse(): T;
  set(array: ArrayLike<number>, offset?: number | undefined): void;
  slice(start?: number | undefined, end?: number | undefined): T;
  some(
    callbackfn: (value: number, index: number, array: T) => boolean,
    thisArg?: any
  ): boolean;
  sort(compareFn?: ((a: number, b: number) => number) | undefined): this;
  subarray(begin: number, end?: number | undefined): T;
  toLocaleString(): string;
  entries(): IterableIterator<[number, number]>;
  keys(): IterableIterator<number>;
  values(): IterableIterator<number>;
}
export {};
