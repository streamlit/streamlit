// @ts-nocheck

import { Data } from "./data";
import { Field } from "./schema";
import { DataType } from "./type";
import { Vector } from "./vector";
import { Clonable, Sliceable, Applicative } from "./vector";
import { VectorCtorArgs, VectorType as V } from "./interfaces";
import { Chunked } from "./vector/chunked";
export interface Column<T extends DataType = any> {
  typeId: T["TType"];
  concat(...others: Vector<T>[]): Column<T>;
  slice(begin?: number, end?: number): Column<T>;
  clone(chunks?: Vector<T>[], offsets?: Uint32Array): Column<T>;
}
export declare class Column<T extends DataType = any> extends Chunked<T>
  implements
    Clonable<Column<T>>,
    Sliceable<Column<T>>,
    Applicative<T, Column<T>> {
  static new<T extends DataType>(
    field: string | Field<T>,
    ...chunks: (Vector<T> | Vector<T>[])[]
  ): Column<T>;
  static new<T extends DataType>(
    field: string | Field<T>,
    data: Data<T>,
    ...args: VectorCtorArgs<V<T>>
  ): Column<T>;
  constructor(field: Field<T>, vectors?: Vector<T>[], offsets?: Uint32Array);
  protected _field: Field<T>;
  protected _children?: Column[];
  readonly field: Field<T>;
  readonly name: string;
  readonly nullable: boolean;
  readonly metadata: Map<string, string>;
  getChildAt<R extends DataType = any>(index: number): Column<R> | null;
}
