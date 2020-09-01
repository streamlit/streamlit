import { Vector } from "../vector";
import { StructVector } from "./struct";
import { DataType, Struct } from "../type";
/** @ignore */ declare const kParent: unique symbol;
/** @ignore */ declare const kRowIndex: unique symbol;
/** @ignore */ declare const kKeyToIdx: unique symbol;
/** @ignore */ declare const kIdxToVal: unique symbol;
/** @ignore */ declare const kCustomInspect: unique symbol;
declare abstract class Row<K extends PropertyKey = any, V = any>
  implements Map<K, V> {
  readonly size: number;
  readonly [Symbol.toStringTag]: string;
  protected [kRowIndex]: number;
  protected [kParent]: Vector<Struct>;
  protected [kKeyToIdx]: Map<K, number>;
  protected [kIdxToVal]: V[];
  constructor(parent: Vector<Struct>, numKeys: number);
  abstract keys(): IterableIterator<K>;
  abstract values(): IterableIterator<V>;
  abstract getKey(idx: number): K;
  abstract getIndex(key: K): number;
  abstract getValue(idx: number): V;
  abstract setValue(idx: number, val: V): void;
  entries(): IterableIterator<[K, V]>;
  has(key: K): boolean;
  get(key: K): V | undefined;
  set(key: K, val: V): this;
  clear(): void;
  delete(_: K): boolean;
  [Symbol.iterator](): IterableIterator<[K, V]>;
  forEach(
    callbackfn: (value: V, key: K, map: Map<K, V>) => void,
    thisArg?: any
  ): void;
  toArray(): V[];
  toJSON(): any;
  inspect(): string;
  [kCustomInspect](): string;
  toString(): string;
  protected static [Symbol.toStringTag]: string;
}
export declare class MapRow<
  K extends DataType = any,
  V extends DataType = any
> extends Row<K["TValue"], V["TValue"] | null> {
  constructor(
    slice: Vector<
      Struct<{
        key: K;
        value: V;
      }>
    >
  );
  keys(): IterableIterator<any>;
  values(): IterableIterator<any>;
  getKey(idx: number): K["TValue"];
  getIndex(key: K["TValue"]): number;
  getValue(index: number): V["TValue"] | null;
  setValue(index: number, value: V["TValue"] | null): void;
}
export declare class StructRow<
  T extends {
    [key: string]: DataType;
  } = any
> extends Row<keyof T, T[keyof T]["TValue"] | null> {
  constructor(parent: StructVector<T>);
  keys(): IterableIterator<keyof T>;
  values(): IterableIterator<T[string]["TValue"] | null>;
  getKey(idx: number): keyof T;
  getIndex(key: keyof T): number;
  getValue(index: number): T[keyof T]["TValue"] | null;
  setValue(index: number, value: T[keyof T]["TValue"] | null): void;
}
export {};
