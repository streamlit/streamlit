import { Vector } from "../vector";
import { DataType } from "../type";
/** @ignore */
export declare class Run<T extends DataType = any, TNull = any> {
  protected _values: ArrayLike<T["TValue"] | TNull>;
  readonly length: number;
  get(index: number): TNull | T["TValue"];
  clear(): this;
  bind(values: Vector<T> | ArrayLike<T["TValue"] | TNull>): any;
}
