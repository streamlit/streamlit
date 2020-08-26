import { BaseVector } from "./base";
import { DataType, Map_, Struct } from "../type";
/** @ignore */
export declare class MapVector<
  K extends DataType = any,
  V extends DataType = any
> extends BaseVector<Map_<K, V>> {
  asList(): import("./list").ListVector<
    Struct<{
      key: K;
      value: V;
    }>
  >;
  bind(index: number): Map_<K, V>["TValue"];
}
