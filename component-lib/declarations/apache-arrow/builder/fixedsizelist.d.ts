import { Run } from "./run";
import { Builder } from "../builder";
import { DataType, FixedSizeList } from "../type";
/** @ignore */
export declare class FixedSizeListBuilder<
  T extends DataType = any,
  TNull = any
> extends Builder<FixedSizeList<T>, TNull> {
  protected _run: Run<T, TNull>;
  setValue(index: number, value: T["TValue"]): void;
  addChild(child: Builder<T>, name?: string): number;
  clear(): this;
}
