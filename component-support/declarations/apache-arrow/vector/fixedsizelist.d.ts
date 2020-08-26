import { BaseVector } from "./base";
import { DataType, FixedSizeList } from "../type";
/** @ignore */
export declare class FixedSizeListVector<
  T extends DataType = any
> extends BaseVector<FixedSizeList<T>> {}
