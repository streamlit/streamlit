import { DataType } from "../../type";
import { RecordBatch } from "../../recordbatch";
/** @ignore */
export declare function recordBatchReaderThroughDOMStream<
  T extends {
    [key: string]: DataType;
  } = any
>(
  writableStrategy?: ByteLengthQueuingStrategy,
  readableStrategy?: {
    autoDestroy: boolean;
  }
): {
  writable: WritableStream<ArrayBufferView>;
  readable: ReadableStream<RecordBatch<T>>;
};
