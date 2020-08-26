// @ts-nocheck

/// <reference types="node" />
import { Vector } from "../vector";
import { DataType } from "../type";
import { MessageHeader } from "../enum";
import { Footer } from "./metadata/file";
import { Schema, Field } from "../schema";
import { Message } from "./metadata/message";
import * as metadata from "./metadata/message";
import { ArrayBufferViewInput } from "../util/buffer";
import { ByteStream, AsyncByteStream } from "../io/stream";
import { RandomAccessFile, AsyncRandomAccessFile } from "../io/file";
import { RecordBatch } from "../recordbatch";
import { FileHandle, ArrowJSONLike, ReadableInterop } from "../io/interfaces";
import { MessageReader, AsyncMessageReader } from "./message";
/** @ignore */ export declare type FromArg0 = ArrowJSONLike;
/** @ignore */ export declare type FromArg1 = PromiseLike<ArrowJSONLike>;
/** @ignore */ export declare type FromArg2 =
  | Iterable<ArrayBufferViewInput>
  | ArrayBufferViewInput;
/** @ignore */ export declare type FromArg3 = PromiseLike<
  Iterable<ArrayBufferViewInput> | ArrayBufferViewInput
>;
/** @ignore */ export declare type FromArg4 =
  | Response
  | NodeJS.ReadableStream
  | ReadableStream<ArrayBufferViewInput>
  | AsyncIterable<ArrayBufferViewInput>;
/** @ignore */ export declare type FromArg5 =
  | FileHandle
  | PromiseLike<FileHandle>
  | PromiseLike<FromArg4>;
/** @ignore */ export declare type FromArgs =
  | FromArg0
  | FromArg1
  | FromArg2
  | FromArg3
  | FromArg4
  | FromArg5;
/** @ignore */ declare type OpenOptions = {
  autoDestroy?: boolean;
};
/** @ignore */ declare type RecordBatchReaders<
  T extends {
    [key: string]: DataType;
  } = any
> = RecordBatchFileReader<T> | RecordBatchStreamReader<T>;
/** @ignore */ declare type AsyncRecordBatchReaders<
  T extends {
    [key: string]: DataType;
  } = any
> = AsyncRecordBatchFileReader<T> | AsyncRecordBatchStreamReader<T>;
/** @ignore */ declare type RecordBatchFileReaders<
  T extends {
    [key: string]: DataType;
  } = any
> = RecordBatchFileReader<T> | AsyncRecordBatchFileReader<T>;
/** @ignore */ declare type RecordBatchStreamReaders<
  T extends {
    [key: string]: DataType;
  } = any
> = RecordBatchStreamReader<T> | AsyncRecordBatchStreamReader<T>;
export declare class RecordBatchReader<
  T extends {
    [key: string]: DataType;
  } = any
> extends ReadableInterop<RecordBatch<T>> {
  protected _impl: RecordBatchReaderImpls<T>;
  protected constructor(impl: RecordBatchReaderImpls<T>);
  readonly closed: boolean;
  readonly schema: Schema<T>;
  readonly autoDestroy: boolean;
  readonly dictionaries: Map<number, Vector<any>>;
  readonly numDictionaries: number;
  readonly numRecordBatches: number;
  readonly footer: Footer | null;
  isSync(): this is RecordBatchReaders<T>;
  isAsync(): this is AsyncRecordBatchReaders<T>;
  isFile(): this is RecordBatchFileReaders<T>;
  isStream(): this is RecordBatchStreamReaders<T>;
  next():
    | IteratorResult<RecordBatch<T>>
    | Promise<IteratorResult<RecordBatch<T>>>;
  throw(value?: any): IteratorResult<any> | Promise<IteratorResult<any>>;
  return(value?: any): IteratorResult<any> | Promise<IteratorResult<any>>;
  cancel(): void | Promise<void>;
  reset(schema?: Schema<T> | null): this;
  open(options?: OpenOptions): this | Promise<this>;
  readRecordBatch(
    index: number
  ): RecordBatch<T> | null | Promise<RecordBatch<T> | null>;
  [Symbol.iterator](): IterableIterator<RecordBatch<T>>;
  [Symbol.asyncIterator](): AsyncIterableIterator<RecordBatch<T>>;
  toDOMStream(): ReadableStream<RecordBatch<T>>;
  toNodeStream(): import("stream").Readable;
  /** @nocollapse */
  static throughNode(
    options?: import("stream").DuplexOptions & {
      autoDestroy: boolean;
    }
  ): import("stream").Duplex;
  /** @nocollapse */
  static throughDOM<
    T extends {
      [key: string]: DataType;
    }
  >(
    writableStrategy?: ByteLengthQueuingStrategy,
    readableStrategy?: {
      autoDestroy: boolean;
    }
  ): {
    writable: WritableStream<Uint8Array>;
    readable: ReadableStream<RecordBatch<T>>;
  };
  static from<T extends RecordBatchReader>(source: T): T;
  static from<
    T extends {
      [key: string]: DataType;
    } = any
  >(source: FromArg0): RecordBatchStreamReader<T>;
  static from<
    T extends {
      [key: string]: DataType;
    } = any
  >(source: FromArg1): Promise<RecordBatchStreamReader<T>>;
  static from<
    T extends {
      [key: string]: DataType;
    } = any
  >(source: FromArg2): RecordBatchFileReader<T> | RecordBatchStreamReader<T>;
  static from<
    T extends {
      [key: string]: DataType;
    } = any
  >(
    source: FromArg3
  ): Promise<RecordBatchFileReader<T> | RecordBatchStreamReader<T>>;
  static from<
    T extends {
      [key: string]: DataType;
    } = any
  >(
    source: FromArg4
  ): Promise<RecordBatchFileReader<T> | AsyncRecordBatchReaders<T>>;
  static from<
    T extends {
      [key: string]: DataType;
    } = any
  >(
    source: FromArg5
  ): Promise<AsyncRecordBatchFileReader<T> | AsyncRecordBatchStreamReader<T>>;
  static readAll<T extends RecordBatchReader>(
    source: T
  ): T extends RecordBatchReaders
    ? IterableIterator<T>
    : AsyncIterableIterator<T>;
  static readAll<
    T extends {
      [key: string]: DataType;
    } = any
  >(source: FromArg0): IterableIterator<RecordBatchStreamReader<T>>;
  static readAll<
    T extends {
      [key: string]: DataType;
    } = any
  >(source: FromArg1): AsyncIterableIterator<RecordBatchStreamReader<T>>;
  static readAll<
    T extends {
      [key: string]: DataType;
    } = any
  >(
    source: FromArg2
  ): IterableIterator<RecordBatchFileReader<T> | RecordBatchStreamReader<T>>;
  static readAll<
    T extends {
      [key: string]: DataType;
    } = any
  >(
    source: FromArg3
  ): AsyncIterableIterator<
    RecordBatchFileReader<T> | RecordBatchStreamReader<T>
  >;
  static readAll<
    T extends {
      [key: string]: DataType;
    } = any
  >(
    source: FromArg4
  ): AsyncIterableIterator<
    RecordBatchFileReader<T> | AsyncRecordBatchReaders<T>
  >;
  static readAll<
    T extends {
      [key: string]: DataType;
    } = any
  >(
    source: FromArg5
  ): AsyncIterableIterator<
    AsyncRecordBatchFileReader<T> | AsyncRecordBatchStreamReader<T>
  >;
}
/** @ignore */
export declare class RecordBatchStreamReader<
  T extends {
    [key: string]: DataType;
  } = any
> extends RecordBatchReader<T> {
  protected _impl: RecordBatchStreamReaderImpl<T>;
  constructor(_impl: RecordBatchStreamReaderImpl<T>);
  [Symbol.iterator](): IterableIterator<RecordBatch<T>>;
  [Symbol.asyncIterator](): AsyncIterableIterator<RecordBatch<T>>;
}
/** @ignore */
export declare class AsyncRecordBatchStreamReader<
  T extends {
    [key: string]: DataType;
  } = any
> extends RecordBatchReader<T> {
  protected _impl: AsyncRecordBatchStreamReaderImpl<T>;
  constructor(_impl: AsyncRecordBatchStreamReaderImpl<T>);
  [Symbol.iterator](): IterableIterator<RecordBatch<T>>;
  [Symbol.asyncIterator](): AsyncIterableIterator<RecordBatch<T>>;
}
/** @ignore */
export declare class RecordBatchFileReader<
  T extends {
    [key: string]: DataType;
  } = any
> extends RecordBatchStreamReader<T> {
  protected _impl: RecordBatchFileReaderImpl<T>;
  constructor(_impl: RecordBatchFileReaderImpl<T>);
}
/** @ignore */
export declare class AsyncRecordBatchFileReader<
  T extends {
    [key: string]: DataType;
  } = any
> extends AsyncRecordBatchStreamReader<T> {
  protected _impl: AsyncRecordBatchFileReaderImpl<T>;
  constructor(_impl: AsyncRecordBatchFileReaderImpl<T>);
}
/** @ignore */
export interface RecordBatchStreamReader<
  T extends {
    [key: string]: DataType;
  } = any
> extends RecordBatchReader<T> {
  open(options?: OpenOptions | undefined): this;
  cancel(): void;
  throw(value?: any): IteratorResult<any>;
  return(value?: any): IteratorResult<any>;
  next(value?: any): IteratorResult<RecordBatch<T>>;
}
/** @ignore */
export interface AsyncRecordBatchStreamReader<
  T extends {
    [key: string]: DataType;
  } = any
> extends RecordBatchReader<T> {
  open(options?: OpenOptions | undefined): Promise<this>;
  cancel(): Promise<void>;
  throw(value?: any): Promise<IteratorResult<any>>;
  return(value?: any): Promise<IteratorResult<any>>;
  next(value?: any): Promise<IteratorResult<RecordBatch<T>>>;
}
/** @ignore */
export interface RecordBatchFileReader<
  T extends {
    [key: string]: DataType;
  } = any
> extends RecordBatchStreamReader<T> {
  footer: Footer;
  readRecordBatch(index: number): RecordBatch<T> | null;
}
/** @ignore */
export interface AsyncRecordBatchFileReader<
  T extends {
    [key: string]: DataType;
  } = any
> extends AsyncRecordBatchStreamReader<T> {
  footer: Footer;
  readRecordBatch(index: number): Promise<RecordBatch<T> | null>;
}
/** @ignore */
declare type RecordBatchReaderImpls<
  T extends {
    [key: string]: DataType;
  } = any
> =
  | RecordBatchJSONReaderImpl<T>
  | RecordBatchFileReaderImpl<T>
  | RecordBatchStreamReaderImpl<T>
  | AsyncRecordBatchFileReaderImpl<T>
  | AsyncRecordBatchStreamReaderImpl<T>;
/** @ignore */
interface RecordBatchReaderImpl<
  T extends {
    [key: string]: DataType;
  } = any
> {
  closed: boolean;
  schema: Schema<T>;
  autoDestroy: boolean;
  dictionaries: Map<number, Vector>;
  isFile(): this is RecordBatchFileReaders<T>;
  isStream(): this is RecordBatchStreamReaders<T>;
  isSync(): this is RecordBatchReaders<T>;
  isAsync(): this is AsyncRecordBatchReaders<T>;
  reset(schema?: Schema<T> | null): this;
}
/** @ignore */
interface RecordBatchStreamReaderImpl<
  T extends {
    [key: string]: DataType;
  } = any
> extends RecordBatchReaderImpl<T> {
  open(options?: OpenOptions): this;
  cancel(): void;
  throw(value?: any): IteratorResult<any>;
  return(value?: any): IteratorResult<any>;
  next(value?: any): IteratorResult<RecordBatch<T>>;
  [Symbol.iterator](): IterableIterator<RecordBatch<T>>;
}
/** @ignore */
interface AsyncRecordBatchStreamReaderImpl<
  T extends {
    [key: string]: DataType;
  } = any
> extends RecordBatchReaderImpl<T> {
  open(options?: OpenOptions): Promise<this>;
  cancel(): Promise<void>;
  throw(value?: any): Promise<IteratorResult<any>>;
  return(value?: any): Promise<IteratorResult<any>>;
  next(value?: any): Promise<IteratorResult<RecordBatch<T>>>;
  [Symbol.asyncIterator](): AsyncIterableIterator<RecordBatch<T>>;
}
/** @ignore */
interface RecordBatchFileReaderImpl<
  T extends {
    [key: string]: DataType;
  } = any
> extends RecordBatchStreamReaderImpl<T> {
  readRecordBatch(index: number): RecordBatch<T> | null;
}
/** @ignore */
interface AsyncRecordBatchFileReaderImpl<
  T extends {
    [key: string]: DataType;
  } = any
> extends AsyncRecordBatchStreamReaderImpl<T> {
  readRecordBatch(index: number): Promise<RecordBatch<T> | null>;
}
/** @ignore */
declare abstract class RecordBatchReaderImpl<
  T extends {
    [key: string]: DataType;
  } = any
> implements RecordBatchReaderImpl<T> {
  schema: Schema;
  closed: boolean;
  autoDestroy: boolean;
  dictionaries: Map<number, Vector>;
  protected _dictionaryIndex: number;
  protected _recordBatchIndex: number;
  readonly numDictionaries: number;
  readonly numRecordBatches: number;
  constructor(dictionaries?: Map<number, Vector<any>>);
  protected _loadRecordBatch(
    header: metadata.RecordBatch,
    body: any
  ): RecordBatch<T>;
  protected _loadDictionaryBatch(
    header: metadata.DictionaryBatch,
    body: any
  ): Vector<any>;
  protected _loadVectors(
    header: metadata.RecordBatch,
    body: any,
    types: (Field | DataType)[]
  ): import("../data").Data<any>[];
}
/** @ignore */
declare class RecordBatchStreamReaderImpl<
  T extends {
    [key: string]: DataType;
  } = any
> extends RecordBatchReaderImpl<T>
  implements IterableIterator<RecordBatch<T>> {
  protected _reader: MessageReader;
  protected _handle: ByteStream | ArrowJSONLike;
  constructor(
    source: ByteStream | ArrowJSONLike,
    dictionaries?: Map<number, Vector>
  );
  isSync(): this is RecordBatchReaders<T>;
  isStream(): this is RecordBatchStreamReaders<T>;
  protected _readNextMessageAndValidate<T extends MessageHeader>(
    type?: T | null
  ): Message<T> | null;
}
/** @ignore */
declare class AsyncRecordBatchStreamReaderImpl<
  T extends {
    [key: string]: DataType;
  } = any
> extends RecordBatchReaderImpl<T>
  implements AsyncIterableIterator<RecordBatch<T>> {
  protected _handle: AsyncByteStream;
  protected _reader: AsyncMessageReader;
  constructor(source: AsyncByteStream, dictionaries?: Map<number, Vector>);
  isAsync(): this is AsyncRecordBatchReaders<T>;
  isStream(): this is RecordBatchStreamReaders<T>;
  protected _readNextMessageAndValidate<T extends MessageHeader>(
    type?: T | null
  ): Promise<Message<T> | null>;
}
/** @ignore */
declare class RecordBatchFileReaderImpl<
  T extends {
    [key: string]: DataType;
  } = any
> extends RecordBatchStreamReaderImpl<T> {
  protected _footer?: Footer;
  protected _handle: RandomAccessFile;
  readonly footer: Footer;
  readonly numDictionaries: number;
  readonly numRecordBatches: number;
  constructor(
    source: RandomAccessFile | ArrayBufferViewInput,
    dictionaries?: Map<number, Vector>
  );
  isSync(): this is RecordBatchReaders<T>;
  isFile(): this is RecordBatchFileReaders<T>;
  open(options?: OpenOptions): this;
  protected _readDictionaryBatch(index: number): void;
  protected _readFooter(): Footer;
  protected _readNextMessageAndValidate<T extends MessageHeader>(
    type?: T | null
  ): Message<T> | null;
}
/** @ignore */
declare class AsyncRecordBatchFileReaderImpl<
  T extends {
    [key: string]: DataType;
  } = any
> extends AsyncRecordBatchStreamReaderImpl<T>
  implements AsyncRecordBatchFileReaderImpl<T> {
  protected _footer?: Footer;
  protected _handle: AsyncRandomAccessFile;
  readonly footer: Footer;
  readonly numDictionaries: number;
  readonly numRecordBatches: number;
  constructor(
    source: FileHandle,
    byteLength?: number,
    dictionaries?: Map<number, Vector>
  );
  constructor(
    source: FileHandle | AsyncRandomAccessFile,
    dictionaries?: Map<number, Vector>
  );
  isFile(): this is RecordBatchFileReaders<T>;
  isAsync(): this is AsyncRecordBatchReaders<T>;
  open(options?: OpenOptions): Promise<this>;
  protected _readDictionaryBatch(index: number): Promise<void>;
  protected _readFooter(): Promise<Footer>;
  protected _readNextMessageAndValidate<T extends MessageHeader>(
    type?: T | null
  ): Promise<Message<T> | null>;
}
/** @ignore */
declare class RecordBatchJSONReaderImpl<
  T extends {
    [key: string]: DataType;
  } = any
> extends RecordBatchStreamReaderImpl<T> {
  constructor(source: ArrowJSONLike, dictionaries?: Map<number, Vector>);
  protected _loadVectors(
    header: metadata.RecordBatch,
    body: any,
    types: (Field | DataType)[]
  ): import("../data").Data<any>[];
}
export {};
