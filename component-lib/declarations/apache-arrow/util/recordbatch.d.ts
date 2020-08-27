import { Column } from "../column";
import { Vector } from "../vector";
import { DataType } from "../type";
import { Data } from "../data";
import { Schema } from "../schema";
import { Chunked } from "../vector/chunked";
import { RecordBatch } from "../recordbatch";
/** @ignore */
export declare function ensureSameLengthData<
  T extends {
    [key: string]: DataType;
  } = any
>(
  schema: Schema<T>,
  chunks: Data<T[keyof T]>[],
  batchLength?: number
): [Schema<T>, number, Data<T[keyof T]>[]];
/** @ignore */
export declare function distributeColumnsIntoRecordBatches<
  T extends {
    [key: string]: DataType;
  } = any
>(columns: Column<T[keyof T]>[]): [Schema<T>, RecordBatch<T>[]];
/** @ignore */
export declare function distributeVectorsIntoRecordBatches<
  T extends {
    [key: string]: DataType;
  } = any
>(
  schema: Schema<T>,
  vecs: (Vector<T[keyof T]> | Chunked<T[keyof T]>)[]
): [Schema<T>, RecordBatch<T>[]];
