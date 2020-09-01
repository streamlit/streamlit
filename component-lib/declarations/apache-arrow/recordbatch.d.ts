// @ts-nocheck
import { Data } from "./data";
import { Table } from "./table";
import { Vector } from "./vector";
import { Schema, Field } from "./schema";
import { DataType, Struct } from "./type";
import { Clonable, Sliceable, Applicative } from "./vector";
import {
  StructVector,
  VectorBuilderOptions,
  VectorBuilderOptionsAsync
} from "./vector/index";
declare type VectorMap = {
  [key: string]: Vector;
};
declare type Fields<
  T extends {
    [key: string]: DataType;
  }
> = (keyof T)[] | Field<T[keyof T]>[];
declare type ChildData<
  T extends {
    [key: string]: DataType;
  }
> = (Data<T[keyof T]> | Vector<T[keyof T]>)[];
export interface RecordBatch<
  T extends {
    [key: string]: DataType;
  } = any
> {
  concat(...others: Vector<Struct<T>>[]): Table<T>;
  slice(begin?: number, end?: number): RecordBatch<T>;
  clone(data: Data<Struct<T>>, children?: Vector[]): RecordBatch<T>;
}
export declare class RecordBatch<
  T extends {
    [key: string]: DataType;
  } = any
> extends StructVector<T>
  implements
    Clonable<RecordBatch<T>>,
    Sliceable<RecordBatch<T>>,
    Applicative<Struct<T>, Table<T>> {
  static from<
    T extends {
      [key: string]: DataType;
    } = any,
    TNull = any
  >(options: VectorBuilderOptions<Struct<T>, TNull>): Table<T>;
  static from<
    T extends {
      [key: string]: DataType;
    } = any,
    TNull = any
  >(options: VectorBuilderOptionsAsync<Struct<T>, TNull>): Promise<Table<T>>;
  static new<T extends VectorMap = any>(
    children: T
  ): RecordBatch<
    {
      [P in keyof T]: T[P]["type"];
    }
  >;
  static new<
    T extends {
      [key: string]: DataType;
    } = any
  >(children: ChildData<T>, fields?: Fields<T>): RecordBatch<T>;
  protected _schema: Schema;
  protected _dictionaries?: Map<number, Vector>;
  constructor(schema: Schema<T>, length: number, children: (Data | Vector)[]);
  constructor(schema: Schema<T>, data: Data<Struct<T>>, children?: Vector[]);
  readonly schema: Schema<any>;
  readonly numCols: number;
  readonly dictionaries: Map<number, Vector<any>>;
  select<K extends keyof T = any>(
    ...columnNames: K[]
  ): RecordBatch<{
    [key: string]: any;
  }>;
  selectAt<K extends T[keyof T] = any>(
    ...columnIndices: number[]
  ): RecordBatch<{
    [key: string]: K;
  }>;
}
/**
 * An internal class used by the `RecordBatchReader` and `RecordBatchWriter`
 * implementations to differentiate between a stream with valid zero-length
 * RecordBatches, and a stream with a Schema message, but no RecordBatches.
 * @see https://github.com/apache/arrow/pull/4373
 * @ignore
 * @private
 */
export declare class _InternalEmptyPlaceholderRecordBatch<
  T extends {
    [key: string]: DataType;
  } = any
> extends RecordBatch<T> {
  constructor(schema: Schema<T>);
}
export {};
