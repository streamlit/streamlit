import { BaseVector } from "./base";
import { DataType, List } from "../type";
/** @ignore */
export declare class ListVector<T extends DataType = any> extends BaseVector<
  List<T>
> {}
