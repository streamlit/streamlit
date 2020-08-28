import { Data } from "../data";
import { Vector } from "../vector";
import { BaseVector } from "./base";
import { VectorType as V } from "../interfaces";
import { VectorBuilderOptions } from "./index";
import { VectorBuilderOptionsAsync } from "./index";
import { DataType, Dictionary, TKeys } from "../type";
/** @ignore */
declare type FromArgs<T extends DataType = any, TKey extends TKeys = TKeys> = [
  Vector<T>,
  TKey,
  ArrayLike<number> | TKey["TArray"]
];
/** @ignore */
export declare class DictionaryVector<
  T extends DataType = any,
  TKey extends TKeys = TKeys
> extends BaseVector<Dictionary<T, TKey>> {
  static from<T extends DataType = any, TKey extends TKeys = TKeys>(
    ...args: FromArgs<T, TKey>
  ): V<Dictionary<T, TKey>>;
  static from<T extends DataType = any, TKey extends TKeys = TKeys>(
    input: VectorBuilderOptions<Dictionary<T, TKey>>
  ): Vector<Dictionary<T, TKey>>;
  static from<T extends DataType = any, TKey extends TKeys = TKeys>(
    input: VectorBuilderOptionsAsync<Dictionary<T, TKey>>
  ): Promise<Vector<Dictionary<T, TKey>>>;
  constructor(data: Data<Dictionary<T, TKey>>);
  readonly indices: V<TKey>;
  readonly dictionary: Vector<T>;
  reverseLookup(value: T): number;
  getKey(idx: number): TKey["TValue"] | null;
  getValue(key: number): T["TValue"] | null;
  setKey(idx: number, key: TKey["TValue"] | null): void;
  setValue(key: number, value: T["TValue"] | null): void;
}
export {};
