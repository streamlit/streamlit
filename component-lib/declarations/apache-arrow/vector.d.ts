import { Data } from "./data";
import { DataType } from "./type";
import { Chunked } from "./vector/chunked";
/** @ignore */
export interface Clonable<R extends AbstractVector> {
  clone(...args: any[]): R;
}
/** @ignore */
export interface Sliceable<R extends AbstractVector> {
  slice(begin?: number, end?: number): R;
}
/** @ignore */
export interface Applicative<T extends DataType, R extends Chunked> {
  concat(...others: Vector<T>[]): R;
  readonly [Symbol.isConcatSpreadable]: boolean;
}
export interface AbstractVector<T extends DataType = any>
  extends Clonable<Vector<T>>,
    Sliceable<Vector<T>>,
    Applicative<T, Chunked<T>> {
  readonly TType: T["TType"];
  readonly TArray: T["TArray"];
  readonly TValue: T["TValue"];
}
export declare abstract class AbstractVector<T extends DataType = any>
  implements Iterable<T["TValue"] | null> {
  abstract readonly data: Data<T>;
  abstract readonly type: T;
  abstract readonly typeId: T["TType"];
  abstract readonly length: number;
  abstract readonly stride: number;
  abstract readonly nullCount: number;
  abstract readonly byteLength: number;
  abstract readonly numChildren: number;
  abstract readonly ArrayType: T["ArrayType"];
  abstract isValid(index: number): boolean;
  abstract get(index: number): T["TValue"] | null;
  abstract set(index: number, value: T["TValue"] | null): void;
  abstract indexOf(value: T["TValue"] | null, fromIndex?: number): number;
  abstract [Symbol.iterator](): IterableIterator<T["TValue"] | null>;
  abstract toArray(): T["TArray"];
  abstract getChildAt<R extends DataType = any>(
    index: number
  ): Vector<R> | null;
}
export { AbstractVector as Vector };
