import { DataType } from "../../type";
import { RecordBatch } from "../../recordbatch";
import { RecordBatchWriter } from "../../ipc/writer";
/** @ignore */
export declare function recordBatchWriterThroughDOMStream<
  T extends {
    [key: string]: DataType;
  } = any
>(
  this: typeof RecordBatchWriter,
  writableStrategy?: QueuingStrategy<RecordBatch<T>> & {
    autoDestroy: boolean;
  },
  readableStrategy?: {
    highWaterMark?: number;
    size?: any;
  }
): {
  writable: WritableStream<RecordBatch<T>>;
  readable: ReadableStream<Uint8Array>;
};
