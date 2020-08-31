import { Run } from "./run";
import { DataType, List } from "../type";
import { OffsetsBufferBuilder } from "./buffer";
import { Builder, BuilderOptions, VariableWidthBuilder } from "../builder";
/** @ignore */
export declare class ListBuilder<
  T extends DataType = any,
  TNull = any
> extends VariableWidthBuilder<List<T>, TNull> {
  protected _run: Run<T, TNull>;
  protected _offsets: OffsetsBufferBuilder;
  constructor(opts: BuilderOptions<List<T>, TNull>);
  addChild(child: Builder<T>, name?: string): number;
  clear(): this;
  protected _flushPending(pending: Map<number, T["TValue"] | undefined>): void;
}
