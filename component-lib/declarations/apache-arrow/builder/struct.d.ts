import { Builder } from "../builder";
import { DataType, Struct } from "../type";
/** @ignore */
export declare class StructBuilder<
  T extends {
    [key: string]: DataType;
  } = any,
  TNull = any
> extends Builder<Struct<T>, TNull> {
  addChild(child: Builder, name?: string): number;
}
