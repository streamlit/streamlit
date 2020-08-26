import { BaseVector } from "./base";
import { DataType, Struct } from "../type";
/** @ignore */
export declare class StructVector<
  T extends {
    [key: string]: DataType;
  } = any
> extends BaseVector<Struct<T>> {
  private _row;
  bind(index: number): Struct<T>["TValue"];
}
