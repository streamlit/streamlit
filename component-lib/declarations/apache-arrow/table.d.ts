import { Data } from "./data";
import { Column } from "./column";
import { Schema, Field } from "./schema";
import { RecordBatch } from "./recordbatch";
import { DataFrame } from "./compute/dataframe";
import { RecordBatchReader } from "./ipc/reader";
import { DataType, RowLike, Struct } from "./type";
import { Clonable, Sliceable, Applicative } from "./vector";
import {
  Vector,
  Chunked,
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
> = Data<T[keyof T]>[] | Vector<T[keyof T]>[];
declare type Columns<
  T extends {
    [key: string]: DataType;
  }
> = Column<T[keyof T]>[] | Column<T[keyof T]>[][];
export interface Table<
  T extends {
    [key: string]: DataType;
  } = any
> {
  get(index: number): Struct<T>["TValue"];
  [Symbol.iterator](): IterableIterator<RowLike<T>>;
  slice(begin?: number, end?: number): Table<T>;
  concat(...others: Vector<Struct<T>>[]): Table<T>;
  clone(chunks?: RecordBatch<T>[], offsets?: Uint32Array): Table<T>;
  scan(
    next: import("./compute/dataframe").NextFunc,
    bind?: import("./compute/dataframe").BindFunc
  ): void;
  scanReverse(
    next: import("./compute/dataframe").NextFunc,
    bind?: import("./compute/dataframe").BindFunc
  ): void;
  countBy(
    name: import("./compute/predicate").Col | string
  ): import("./compute/dataframe").CountByResult;
  filter(
    predicate: import("./compute/predicate").Predicate
  ): import("./compute/dataframe").FilteredDataFrame<T>;
}
export declare class Table<
  T extends {
    [key: string]: DataType;
  } = any
> extends Chunked<Struct<T>>
  implements
    DataFrame<T>,
    Clonable<Table<T>>,
    Sliceable<Table<T>>,
    Applicative<Struct<T>, Table<T>> {
  /** @nocollapse */
  static empty<
    T extends {
      [key: string]: DataType;
    } = {}
  >(schema?: Schema<T>): Table<T>;
  static from(): Table<{}>;
  static from<
    T extends {
      [key: string]: DataType;
    } = any
  >(source: RecordBatchReader<T>): Table<T>;
  static from<
    T extends {
      [key: string]: DataType;
    } = any
  >(source: import("./ipc/reader").FromArg0): Table<T>;
  static from<
    T extends {
      [key: string]: DataType;
    } = any
  >(source: import("./ipc/reader").FromArg2): Table<T>;
  static from<
    T extends {
      [key: string]: DataType;
    } = any
  >(source: import("./ipc/reader").FromArg1): Promise<Table<T>>;
  static from<
    T extends {
      [key: string]: DataType;
    } = any
  >(source: import("./ipc/reader").FromArg3): Promise<Table<T>>;
  static from<
    T extends {
      [key: string]: DataType;
    } = any
  >(source: import("./ipc/reader").FromArg4): Promise<Table<T>>;
  static from<
    T extends {
      [key: string]: DataType;
    } = any
  >(source: import("./ipc/reader").FromArg5): Promise<Table<T>>;
  static from<
    T extends {
      [key: string]: DataType;
    } = any
  >(source: PromiseLike<RecordBatchReader<T>>): Promise<Table<T>>;
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
  /** @nocollapse */
  static fromAsync<
    T extends {
      [key: string]: DataType;
    } = any
  >(source: import("./ipc/reader").FromArgs): Promise<Table<T>>;
  /** @nocollapse */
  static fromStruct<
    T extends {
      [key: string]: DataType;
    } = any
  >(vector: Vector<Struct<T>>): Table<T>;
  /**
   * @summary Create a new Table from a collection of Columns or Vectors,
   * with an optional list of names or Fields.
   *
   *
   * `Table.new` accepts an Object of
   * Columns or Vectors, where the keys will be used as the field names
   * for the Schema:
   * ```ts
   * const i32s = Int32Vector.from([1, 2, 3]);
   * const f32s = Float32Vector.from([.1, .2, .3]);
   * const table = Table.new({ i32: i32s, f32: f32s });
   * assert(table.schema.fields[0].name === 'i32');
   * ```
   *
   * It also accepts a a list of Vectors with an optional list of names or
   * Fields for the resulting Schema. If the list is omitted or a name is
   * missing, the numeric index of each Vector will be used as the name:
   * ```ts
   * const i32s = Int32Vector.from([1, 2, 3]);
   * const f32s = Float32Vector.from([.1, .2, .3]);
   * const table = Table.new([i32s, f32s], ['i32']);
   * assert(table.schema.fields[0].name === 'i32');
   * assert(table.schema.fields[1].name === '1');
   * ```
   *
   * If the supplied arguments are Columns, `Table.new` will infer the Schema
   * from the Columns:
   * ```ts
   * const i32s = Column.new('i32', Int32Vector.from([1, 2, 3]));
   * const f32s = Column.new('f32', Float32Vector.from([.1, .2, .3]));
   * const table = Table.new(i32s, f32s);
   * assert(table.schema.fields[0].name === 'i32');
   * assert(table.schema.fields[1].name === 'f32');
   * ```
   *
   * If the supplied Vector or Column lengths are unequal, `Table.new` will
   * extend the lengths of the shorter Columns, allocating additional bytes
   * to represent the additional null slots. The memory required to allocate
   * these additional bitmaps can be computed as:
   * ```ts
   * let additionalBytes = 0;
   * for (let vec in shorter_vectors) {
   *     additionalBytes += (((longestLength - vec.length) + 63) & ~63) >> 3;
   * }
   * ```
   *
   * For example, an additional null bitmap for one million null values would require
   * 125,000 bytes (`((1e6 + 63) & ~63) >> 3`), or approx. `0.11MiB`
   */
  static new<
    T extends {
      [key: string]: DataType;
    } = any
  >(...columns: Columns<T>): Table<T>;
  static new<T extends VectorMap = any>(
    children: T
  ): Table<
    {
      [P in keyof T]: T[P]["type"];
    }
  >;
  static new<
    T extends {
      [key: string]: DataType;
    } = any
  >(children: ChildData<T>, fields?: Fields<T>): Table<T>;
  constructor(batches: RecordBatch<T>[]);
  constructor(...batches: RecordBatch<T>[]);
  constructor(schema: Schema<T>, batches: RecordBatch<T>[]);
  constructor(schema: Schema<T>, ...batches: RecordBatch<T>[]);
  protected _schema: Schema<T>;
  protected _chunks: RecordBatch<T>[];
  protected _children?: Column<T[keyof T]>[];
  readonly schema: Schema<T>;
  readonly length: number;
  readonly chunks: RecordBatch<T>[];
  readonly numCols: number;
  getColumn<R extends keyof T>(name: R): Column<T[R]>;
  getColumnAt<R extends DataType = any>(index: number): Column<R> | null;
  getColumnIndex<R extends keyof T>(name: R): number;
  getChildAt<R extends DataType = any>(index: number): Column<R> | null;
  serialize(encoding?: string, stream?: boolean): any;
  count(): number;
  select<K extends keyof T = any>(
    ...columnNames: K[]
  ): Table<{
    [key: string]: any;
  }>;
  selectAt<K extends T[keyof T] = any>(
    ...columnIndices: number[]
  ): Table<{
    [key: string]: K;
  }>;
  assign<
    R extends {
      [key: string]: DataType;
    } = any
  >(other: Table<R>): Table<T & R>;
}
export {};
