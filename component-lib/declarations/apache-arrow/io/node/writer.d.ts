/// <reference types="node" />
import { DataType } from "../../type";
import { Duplex, DuplexOptions } from "stream";
import { AsyncByteStream } from "../../io/stream";
import { RecordBatchWriter } from "../../ipc/writer";
/** @ignore */
export declare function recordBatchWriterThroughNodeStream<
  T extends {
    [key: string]: DataType;
  } = any
>(
  this: typeof RecordBatchWriter,
  options?: DuplexOptions & {
    autoDestroy: boolean;
  }
): RecordBatchWriterDuplex<T>;
/** @ignore */
declare type CB = (error?: Error | null | undefined) => void;
/** @ignore */
declare class RecordBatchWriterDuplex<
  T extends {
    [key: string]: DataType;
  } = any
> extends Duplex {
  private _pulling;
  private _reader;
  private _writer;
  constructor(writer: RecordBatchWriter<T>, options?: DuplexOptions);
  _final(cb?: CB): void;
  _write(x: any, _: string, cb: CB): boolean;
  _read(size: number): void;
  _destroy(err: Error | null, cb: (error: Error | null) => void): void;
  _pull(size: number, reader: AsyncByteStream): Promise<boolean>;
}
export {};
