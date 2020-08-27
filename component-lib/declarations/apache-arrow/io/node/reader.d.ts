/// <reference types="node" />
import { DataType } from "../../type";
import { Duplex, DuplexOptions } from "stream";
import { AsyncByteQueue } from "../../io/stream";
import { RecordBatchReader } from "../../ipc/reader";
/** @ignore */
export declare function recordBatchReaderThroughNodeStream<
  T extends {
    [key: string]: DataType;
  } = any
>(
  options?: DuplexOptions & {
    autoDestroy: boolean;
  }
): RecordBatchReaderDuplex<T>;
/** @ignore */
declare type CB = (error?: Error | null | undefined) => void;
/** @ignore */
declare class RecordBatchReaderDuplex<
  T extends {
    [key: string]: DataType;
  } = any
> extends Duplex {
  private _pulling;
  private _autoDestroy;
  private _reader;
  private _asyncQueue;
  constructor(
    options?: DuplexOptions & {
      autoDestroy: boolean;
    }
  );
  _final(cb?: CB): void;
  _write(x: any, _: string, cb: CB): boolean;
  _read(size: number): void;
  _destroy(err: Error | null, cb: (error: Error | null) => void): void;
  _open(
    source: AsyncByteQueue
  ): Promise<
    | import("../../ipc/reader").RecordBatchFileReader<T>
    | import("../../ipc/reader").AsyncRecordBatchStreamReader<T>
  >;
  _pull(size: number, reader: RecordBatchReader<T>): Promise<boolean>;
}
export {};
