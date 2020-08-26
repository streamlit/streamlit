import { Vector } from "../vector";
import { IntBuilder } from "./int";
import { Dictionary, DataType } from "../type";
import { Builder, BuilderOptions } from "../builder";
declare type DictionaryHashFunction = (x: any) => string | number;
export interface DictionaryBuilderOptions<
  T extends DataType = any,
  TNull = any
> extends BuilderOptions<T, TNull> {
  dictionaryHashFunction?: DictionaryHashFunction;
}
/** @ignore */
export declare class DictionaryBuilder<
  T extends Dictionary,
  TNull = any
> extends Builder<T, TNull> {
  protected _dictionaryOffset: number;
  protected _dictionary?: Vector<T["dictionary"]>;
  protected _keysToIndices: {
    [key: string]: number;
  };
  readonly indices: IntBuilder<T["indices"]>;
  readonly dictionary: Builder<T["dictionary"]>;
  constructor({
    type: type,
    nullValues: nulls,
    dictionaryHashFunction: hashFn
  }: DictionaryBuilderOptions<T, TNull>);
  readonly values: T["indices"]["TArray"];
  readonly nullCount: number;
  readonly nullBitmap: Uint8Array | null;
  readonly byteLength: number;
  readonly reservedLength: number;
  readonly reservedByteLength: number;
  isValid(value: T["TValue"] | TNull): boolean;
  setValid(index: number, valid: boolean): boolean;
  setValue(index: number, value: T["TValue"]): void;
  flush(): import("../data").Data<T>;
  finish(): this;
  clear(): this;
  valueToKey(val: any): string | number;
}
export {};
