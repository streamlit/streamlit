/// <reference types="node" />
import { ArrowJSONLike } from "../io/interfaces";
/** @ignore */
export interface Subscription {
  unsubscribe: () => void;
}
/** @ignore */
export interface Observer<T> {
  closed?: boolean;
  next: (value: T) => void;
  error: (err: any) => void;
  complete: () => void;
}
/** @ignore */
export interface Observable<T> {
  subscribe: (observer: Observer<T>) => Subscription;
}
/** @ignore */
declare const BigIntCtor: BigIntConstructor, BigIntAvailable: boolean;
/** @ignore */
declare const BigInt64ArrayCtor: BigInt64ArrayConstructor,
  BigInt64ArrayAvailable: boolean;
/** @ignore */
declare const BigUint64ArrayCtor: BigUint64ArrayConstructor,
  BigUint64ArrayAvailable: boolean;
export { BigIntCtor as BigInt, BigIntAvailable };
export { BigInt64ArrayCtor as BigInt64Array, BigInt64ArrayAvailable };
export { BigUint64ArrayCtor as BigUint64Array, BigUint64ArrayAvailable };
/** @ignore */
export declare const isObject: (x: any) => x is Object;
/** @ignore */
export declare const isPromise: <T = any>(x: any) => x is PromiseLike<T>;
/** @ignore */
export declare const isObservable: <T = any>(x: any) => x is Observable<T>;
/** @ignore */
export declare const isIterable: <T = any>(x: any) => x is Iterable<T>;
/** @ignore */
export declare const isAsyncIterable: <T = any>(
  x: any
) => x is AsyncIterable<T>;
/** @ignore */
export declare const isArrowJSON: (x: any) => x is ArrowJSONLike;
/** @ignore */
export declare const isArrayLike: <T = any>(x: any) => x is ArrayLike<T>;
/** @ignore */
export declare const isIteratorResult: <T = any>(
  x: any
) => x is IteratorResult<T>;
/** @ignore */
export declare const isUnderlyingSink: <T = any>(
  x: any
) => x is UnderlyingSink<T>;
/** @ignore */
export declare const isFileHandle: (
  x: any
) => x is import("fs").promises.FileHandle;
/** @ignore */
export declare const isFSReadStream: (x: any) => x is import("fs").ReadStream;
/** @ignore */
export declare const isFetchResponse: (x: any) => x is Response;
/** @ignore */
export declare const isWritableDOMStream: <T = any>(
  x: any
) => x is WritableStream<T>;
/** @ignore */
export declare const isReadableDOMStream: <T = any>(
  x: any
) => x is ReadableStream<T>;
/** @ignore */
export declare const isWritableNodeStream: (
  x: any
) => x is NodeJS.WritableStream;
/** @ignore */
export declare const isReadableNodeStream: (
  x: any
) => x is NodeJS.ReadableStream;
