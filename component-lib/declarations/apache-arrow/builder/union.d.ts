import { DataBufferBuilder } from "./buffer";
import { Builder, BuilderOptions } from "../builder";
import { Union, SparseUnion, DenseUnion } from "../type";
export interface UnionBuilderOptions<T extends Union = any, TNull = any>
  extends BuilderOptions<T, TNull> {
  valueToChildTypeId?: (
    builder: UnionBuilder<T, TNull>,
    value: any,
    offset: number
  ) => number;
}
/** @ignore */
export declare abstract class UnionBuilder<
  T extends Union,
  TNull = any
> extends Builder<T, TNull> {
  protected _typeIds: DataBufferBuilder<Int8Array>;
  constructor(options: UnionBuilderOptions<T, TNull>);
  readonly typeIdToChildIndex: {
    [key: number]: number;
  };
  append(value: T["TValue"] | TNull, childTypeId?: number): this;
  set(index: number, value: T["TValue"] | TNull, childTypeId?: number): this;
  setValue(index: number, value: T["TValue"], childTypeId?: number): void;
  addChild(child: Builder, name?: string): number;
  /** @ignore */
  protected _valueToChildTypeId(
    builder: UnionBuilder<T, TNull>,
    value: any,
    offset: number
  ): number;
}
/** @ignore */
export declare class SparseUnionBuilder<
  T extends SparseUnion,
  TNull = any
> extends UnionBuilder<T, TNull> {}
/** @ignore */
export declare class DenseUnionBuilder<
  T extends DenseUnion,
  TNull = any
> extends UnionBuilder<T, TNull> {
  protected _offsets: DataBufferBuilder<Int32Array>;
  constructor(options: UnionBuilderOptions<T, TNull>);
  /** @ignore */
  setValue(index: number, value: T["TValue"], childTypeId?: number): void;
}
