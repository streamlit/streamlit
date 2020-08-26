/// <reference types="flatbuffers" />
export {
  ArrowType,
  DateUnit,
  IntervalUnit,
  MessageHeader,
  MetadataVersion,
  Precision,
  TimeUnit,
  Type,
  UnionMode,
  BufferType
} from "./enum";
export { Data } from "./data";
export {
  DataType,
  Null,
  Bool,
  Int,
  Int8,
  Int16,
  Int32,
  Int64,
  Uint8,
  Uint16,
  Uint32,
  Uint64,
  Float,
  Float16,
  Float32,
  Float64,
  Utf8,
  Binary,
  FixedSizeBinary,
  Date_,
  DateDay,
  DateMillisecond,
  Timestamp,
  TimestampSecond,
  TimestampMillisecond,
  TimestampMicrosecond,
  TimestampNanosecond,
  Time,
  TimeSecond,
  TimeMillisecond,
  TimeMicrosecond,
  TimeNanosecond,
  Decimal,
  List,
  Struct,
  Union,
  DenseUnion,
  SparseUnion,
  Dictionary,
  Interval,
  IntervalDayTime,
  IntervalYearMonth,
  FixedSizeList,
  Map_
} from "./type";
export { Table } from "./table";
export { Column } from "./column";
export { Visitor } from "./visitor";
export { Schema, Field } from "./schema";
export {
  Vector,
  BaseVector,
  BinaryVector,
  BoolVector,
  Chunked,
  DateVector,
  DateDayVector,
  DateMillisecondVector,
  DecimalVector,
  DictionaryVector,
  FixedSizeBinaryVector,
  FixedSizeListVector,
  FloatVector,
  Float16Vector,
  Float32Vector,
  Float64Vector,
  IntervalVector,
  IntervalDayTimeVector,
  IntervalYearMonthVector,
  IntVector,
  Int8Vector,
  Int16Vector,
  Int32Vector,
  Int64Vector,
  Uint8Vector,
  Uint16Vector,
  Uint32Vector,
  Uint64Vector,
  ListVector,
  MapVector,
  NullVector,
  StructVector,
  TimestampVector,
  TimestampSecondVector,
  TimestampMillisecondVector,
  TimestampMicrosecondVector,
  TimestampNanosecondVector,
  TimeVector,
  TimeSecondVector,
  TimeMillisecondVector,
  TimeMicrosecondVector,
  TimeNanosecondVector,
  UnionVector,
  DenseUnionVector,
  SparseUnionVector,
  Utf8Vector
} from "./vector/index";
export {
  Builder,
  BinaryBuilder,
  BoolBuilder,
  DateBuilder,
  DateDayBuilder,
  DateMillisecondBuilder,
  DecimalBuilder,
  DictionaryBuilder,
  FixedSizeBinaryBuilder,
  FixedSizeListBuilder,
  FloatBuilder,
  Float16Builder,
  Float32Builder,
  Float64Builder,
  IntervalBuilder,
  IntervalDayTimeBuilder,
  IntervalYearMonthBuilder,
  IntBuilder,
  Int8Builder,
  Int16Builder,
  Int32Builder,
  Int64Builder,
  Uint8Builder,
  Uint16Builder,
  Uint32Builder,
  Uint64Builder,
  ListBuilder,
  MapBuilder,
  NullBuilder,
  StructBuilder,
  TimestampBuilder,
  TimestampSecondBuilder,
  TimestampMillisecondBuilder,
  TimestampMicrosecondBuilder,
  TimestampNanosecondBuilder,
  TimeBuilder,
  TimeSecondBuilder,
  TimeMillisecondBuilder,
  TimeMicrosecondBuilder,
  TimeNanosecondBuilder,
  UnionBuilder,
  DenseUnionBuilder,
  SparseUnionBuilder,
  Utf8Builder
} from "./builder/index";
export {
  ByteStream,
  AsyncByteStream,
  AsyncByteQueue,
  ReadableSource,
  WritableSink
} from "./io/stream";
export {
  RecordBatchReader,
  RecordBatchFileReader,
  RecordBatchStreamReader,
  AsyncRecordBatchFileReader,
  AsyncRecordBatchStreamReader
} from "./ipc/reader";
export {
  RecordBatchWriter,
  RecordBatchFileWriter,
  RecordBatchStreamWriter,
  RecordBatchJSONWriter
} from "./ipc/writer";
export {
  MessageReader,
  AsyncMessageReader,
  JSONMessageReader
} from "./ipc/message";
export { Message } from "./ipc/metadata/message";
export { RecordBatch } from "./recordbatch";
export {
  ArrowJSONLike,
  FileHandle,
  Readable,
  Writable,
  ReadableWritable,
  ReadableDOMStreamOptions
} from "./io/interfaces";
export {
  DataFrame,
  FilteredDataFrame,
  CountByResult,
  BindFunc,
  NextFunc
} from "./compute/dataframe";
import * as util_bn_ from "./util/bn";
import * as util_int_ from "./util/int";
import * as util_buffer_ from "./util/buffer";
import * as predicate from "./compute/predicate";
export { predicate };
/** @ignore */
export declare const util: {
  clampIndex<
    T extends {
      length: number;
      stride?: number | undefined;
    }
  >(
    source: T,
    index: number
  ): number;
  clampIndex<
    T extends {
      length: number;
      stride?: number | undefined;
    },
    N extends (source: T, index: number) => any = (
      source: T,
      index: number
    ) => any
  >(
    source: T,
    index: number,
    then: N
  ): ReturnType<N>;
  clampRange<
    T extends {
      length: number;
      stride?: number | undefined;
    }
  >(
    source: T,
    begin: number | undefined,
    end: number | undefined
  ): [number, number];
  clampRange<
    T extends {
      length: number;
      stride?: number | undefined;
    },
    N extends (source: T, offset: number, length: number) => any = (
      source: T,
      offset: number,
      length: number
    ) => any
  >(
    source: T,
    begin: number | undefined,
    end: number | undefined,
    then: N
  ): ReturnType<N>;
  createElementComparator(search: any): (value: any) => boolean;
  memcpy<TTarget extends ArrayBufferView, TSource extends ArrayBufferView>(
    target: TTarget,
    source: TSource,
    targetByteOffset?: number,
    sourceByteLength?: number
  ): TTarget;
  joinUint8Arrays(
    chunks: Uint8Array[],
    size?: number | null | undefined
  ): [Uint8Array, Uint8Array[], number];
  toArrayBufferView<T extends import("./interfaces").TypedArray>(
    ArrayBufferViewCtor: import("./interfaces").TypedArrayConstructor<T>,
    input: util_buffer_.ArrayBufferViewInput
  ): T;
  toArrayBufferView<T extends import("./interfaces").BigIntArray>(
    ArrayBufferViewCtor: import("./interfaces").BigIntArrayConstructor<T>,
    input: util_buffer_.ArrayBufferViewInput
  ): T;
  toArrayBufferViewIterator<T extends import("./interfaces").TypedArray>(
    ArrayCtor: import("./interfaces").TypedArrayConstructor<T>,
    source:
      | string
      | ArrayBuffer
      | SharedArrayBuffer
      | ArrayBufferView
      | ArrayLike<number>
      | Iterable<number>
      | flatbuffers.ByteBuffer
      | IteratorResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | ReadableStreamReadResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | Iterable<util_buffer_.ArrayBufferViewInput>
      | null
      | undefined
  ): IterableIterator<T>;
  toArrayBufferViewAsyncIterator<T extends import("./interfaces").TypedArray>(
    ArrayCtor: import("./interfaces").TypedArrayConstructor<T>,
    source:
      | string
      | ArrayBuffer
      | SharedArrayBuffer
      | ArrayBufferView
      | ArrayLike<number>
      | Iterable<number>
      | flatbuffers.ByteBuffer
      | IteratorResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | ReadableStreamReadResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | Iterable<util_buffer_.ArrayBufferViewInput>
      | PromiseLike<util_buffer_.ArrayBufferViewInput>
      | AsyncIterable<util_buffer_.ArrayBufferViewInput>
      | null
      | undefined
  ): AsyncIterableIterator<T>;
  rebaseValueOffsets(
    offset: number,
    length: number,
    valueOffsets: Int32Array
  ): Int32Array;
  compareArrayLike<T extends ArrayLike<any>>(a: T, b: T): boolean;
  toInt8Array: (input: util_buffer_.ArrayBufferViewInput) => Int8Array;
  toInt16Array: (input: util_buffer_.ArrayBufferViewInput) => Int16Array;
  toInt32Array: (input: util_buffer_.ArrayBufferViewInput) => Int32Array;
  toBigInt64Array: (input: util_buffer_.ArrayBufferViewInput) => BigInt64Array;
  toUint8Array: (input: util_buffer_.ArrayBufferViewInput) => Uint8Array;
  toUint16Array: (input: util_buffer_.ArrayBufferViewInput) => Uint16Array;
  toUint32Array: (input: util_buffer_.ArrayBufferViewInput) => Uint32Array;
  toBigUint64Array: (
    input: util_buffer_.ArrayBufferViewInput
  ) => BigUint64Array;
  toFloat32Array: (input: util_buffer_.ArrayBufferViewInput) => Float32Array;
  toFloat64Array: (input: util_buffer_.ArrayBufferViewInput) => Float64Array;
  toUint8ClampedArray: (
    input: util_buffer_.ArrayBufferViewInput
  ) => Uint8ClampedArray;
  toInt8ArrayIterator: (
    input:
      | string
      | ArrayBuffer
      | SharedArrayBuffer
      | ArrayBufferView
      | ArrayLike<number>
      | Iterable<number>
      | flatbuffers.ByteBuffer
      | IteratorResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | ReadableStreamReadResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | Iterable<util_buffer_.ArrayBufferViewInput>
      | null
      | undefined
  ) => IterableIterator<Int8Array>;
  toInt16ArrayIterator: (
    input:
      | string
      | ArrayBuffer
      | SharedArrayBuffer
      | ArrayBufferView
      | ArrayLike<number>
      | Iterable<number>
      | flatbuffers.ByteBuffer
      | IteratorResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | ReadableStreamReadResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | Iterable<util_buffer_.ArrayBufferViewInput>
      | null
      | undefined
  ) => IterableIterator<Int16Array>;
  toInt32ArrayIterator: (
    input:
      | string
      | ArrayBuffer
      | SharedArrayBuffer
      | ArrayBufferView
      | ArrayLike<number>
      | Iterable<number>
      | flatbuffers.ByteBuffer
      | IteratorResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | ReadableStreamReadResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | Iterable<util_buffer_.ArrayBufferViewInput>
      | null
      | undefined
  ) => IterableIterator<Int32Array>;
  toUint8ArrayIterator: (
    input:
      | string
      | ArrayBuffer
      | SharedArrayBuffer
      | ArrayBufferView
      | ArrayLike<number>
      | Iterable<number>
      | flatbuffers.ByteBuffer
      | IteratorResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | ReadableStreamReadResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | Iterable<util_buffer_.ArrayBufferViewInput>
      | null
      | undefined
  ) => IterableIterator<Uint8Array>;
  toUint16ArrayIterator: (
    input:
      | string
      | ArrayBuffer
      | SharedArrayBuffer
      | ArrayBufferView
      | ArrayLike<number>
      | Iterable<number>
      | flatbuffers.ByteBuffer
      | IteratorResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | ReadableStreamReadResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | Iterable<util_buffer_.ArrayBufferViewInput>
      | null
      | undefined
  ) => IterableIterator<Uint16Array>;
  toUint32ArrayIterator: (
    input:
      | string
      | ArrayBuffer
      | SharedArrayBuffer
      | ArrayBufferView
      | ArrayLike<number>
      | Iterable<number>
      | flatbuffers.ByteBuffer
      | IteratorResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | ReadableStreamReadResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | Iterable<util_buffer_.ArrayBufferViewInput>
      | null
      | undefined
  ) => IterableIterator<Uint32Array>;
  toFloat32ArrayIterator: (
    input:
      | string
      | ArrayBuffer
      | SharedArrayBuffer
      | ArrayBufferView
      | ArrayLike<number>
      | Iterable<number>
      | flatbuffers.ByteBuffer
      | IteratorResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | ReadableStreamReadResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | Iterable<util_buffer_.ArrayBufferViewInput>
      | null
      | undefined
  ) => IterableIterator<Float32Array>;
  toFloat64ArrayIterator: (
    input:
      | string
      | ArrayBuffer
      | SharedArrayBuffer
      | ArrayBufferView
      | ArrayLike<number>
      | Iterable<number>
      | flatbuffers.ByteBuffer
      | IteratorResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | ReadableStreamReadResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | Iterable<util_buffer_.ArrayBufferViewInput>
      | null
      | undefined
  ) => IterableIterator<Float64Array>;
  toUint8ClampedArrayIterator: (
    input:
      | string
      | ArrayBuffer
      | SharedArrayBuffer
      | ArrayBufferView
      | ArrayLike<number>
      | Iterable<number>
      | flatbuffers.ByteBuffer
      | IteratorResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | ReadableStreamReadResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | Iterable<util_buffer_.ArrayBufferViewInput>
      | null
      | undefined
  ) => IterableIterator<Uint8ClampedArray>;
  toInt8ArrayAsyncIterator: (
    input:
      | string
      | ArrayBuffer
      | SharedArrayBuffer
      | ArrayBufferView
      | ArrayLike<number>
      | Iterable<number>
      | flatbuffers.ByteBuffer
      | IteratorResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | ReadableStreamReadResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | Iterable<util_buffer_.ArrayBufferViewInput>
      | PromiseLike<util_buffer_.ArrayBufferViewInput>
      | AsyncIterable<util_buffer_.ArrayBufferViewInput>
      | null
      | undefined
  ) => AsyncIterableIterator<Int8Array>;
  toInt16ArrayAsyncIterator: (
    input:
      | string
      | ArrayBuffer
      | SharedArrayBuffer
      | ArrayBufferView
      | ArrayLike<number>
      | Iterable<number>
      | flatbuffers.ByteBuffer
      | IteratorResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | ReadableStreamReadResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | Iterable<util_buffer_.ArrayBufferViewInput>
      | PromiseLike<util_buffer_.ArrayBufferViewInput>
      | AsyncIterable<util_buffer_.ArrayBufferViewInput>
      | null
      | undefined
  ) => AsyncIterableIterator<Int16Array>;
  toInt32ArrayAsyncIterator: (
    input:
      | string
      | ArrayBuffer
      | SharedArrayBuffer
      | ArrayBufferView
      | ArrayLike<number>
      | Iterable<number>
      | flatbuffers.ByteBuffer
      | IteratorResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | ReadableStreamReadResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | Iterable<util_buffer_.ArrayBufferViewInput>
      | PromiseLike<util_buffer_.ArrayBufferViewInput>
      | AsyncIterable<util_buffer_.ArrayBufferViewInput>
      | null
      | undefined
  ) => AsyncIterableIterator<Int32Array>;
  toUint8ArrayAsyncIterator: (
    input:
      | string
      | ArrayBuffer
      | SharedArrayBuffer
      | ArrayBufferView
      | ArrayLike<number>
      | Iterable<number>
      | flatbuffers.ByteBuffer
      | IteratorResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | ReadableStreamReadResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | Iterable<util_buffer_.ArrayBufferViewInput>
      | PromiseLike<util_buffer_.ArrayBufferViewInput>
      | AsyncIterable<util_buffer_.ArrayBufferViewInput>
      | null
      | undefined
  ) => AsyncIterableIterator<Uint8Array>;
  toUint16ArrayAsyncIterator: (
    input:
      | string
      | ArrayBuffer
      | SharedArrayBuffer
      | ArrayBufferView
      | ArrayLike<number>
      | Iterable<number>
      | flatbuffers.ByteBuffer
      | IteratorResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | ReadableStreamReadResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | Iterable<util_buffer_.ArrayBufferViewInput>
      | PromiseLike<util_buffer_.ArrayBufferViewInput>
      | AsyncIterable<util_buffer_.ArrayBufferViewInput>
      | null
      | undefined
  ) => AsyncIterableIterator<Uint16Array>;
  toUint32ArrayAsyncIterator: (
    input:
      | string
      | ArrayBuffer
      | SharedArrayBuffer
      | ArrayBufferView
      | ArrayLike<number>
      | Iterable<number>
      | flatbuffers.ByteBuffer
      | IteratorResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | ReadableStreamReadResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | Iterable<util_buffer_.ArrayBufferViewInput>
      | PromiseLike<util_buffer_.ArrayBufferViewInput>
      | AsyncIterable<util_buffer_.ArrayBufferViewInput>
      | null
      | undefined
  ) => AsyncIterableIterator<Uint32Array>;
  toFloat32ArrayAsyncIterator: (
    input:
      | string
      | ArrayBuffer
      | SharedArrayBuffer
      | ArrayBufferView
      | ArrayLike<number>
      | Iterable<number>
      | flatbuffers.ByteBuffer
      | IteratorResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | ReadableStreamReadResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | Iterable<util_buffer_.ArrayBufferViewInput>
      | PromiseLike<util_buffer_.ArrayBufferViewInput>
      | AsyncIterable<util_buffer_.ArrayBufferViewInput>
      | null
      | undefined
  ) => AsyncIterableIterator<Float32Array>;
  toFloat64ArrayAsyncIterator: (
    input:
      | string
      | ArrayBuffer
      | SharedArrayBuffer
      | ArrayBufferView
      | ArrayLike<number>
      | Iterable<number>
      | flatbuffers.ByteBuffer
      | IteratorResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | ReadableStreamReadResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | Iterable<util_buffer_.ArrayBufferViewInput>
      | PromiseLike<util_buffer_.ArrayBufferViewInput>
      | AsyncIterable<util_buffer_.ArrayBufferViewInput>
      | null
      | undefined
  ) => AsyncIterableIterator<Float64Array>;
  toUint8ClampedArrayAsyncIterator: (
    input:
      | string
      | ArrayBuffer
      | SharedArrayBuffer
      | ArrayBufferView
      | ArrayLike<number>
      | Iterable<number>
      | flatbuffers.ByteBuffer
      | IteratorResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | ReadableStreamReadResult<
          | string
          | ArrayBuffer
          | SharedArrayBuffer
          | ArrayBufferView
          | ArrayLike<number>
          | Iterable<number>
          | flatbuffers.ByteBuffer
          | null
          | undefined
        >
      | Iterable<util_buffer_.ArrayBufferViewInput>
      | PromiseLike<util_buffer_.ArrayBufferViewInput>
      | AsyncIterable<util_buffer_.ArrayBufferViewInput>
      | null
      | undefined
  ) => AsyncIterableIterator<Uint8ClampedArray>;
  uint16ToFloat64(h: number): number;
  float64ToUint16(d: number): number;
  getBool(_data: any, _index: number, byte: number, bit: number): boolean;
  getBit(_data: any, _index: number, byte: number, bit: number): 0 | 1;
  setBool(bytes: Uint8Array, index: number, value: any): boolean;
  truncateBitmap(
    offset: number,
    length: number,
    bitmap: Uint8Array
  ): Uint8Array;
  packBools(values: Iterable<any>): Uint8Array;
  iterateBits<T>(
    bytes: Uint8Array,
    begin: number,
    length: number,
    context: any,
    get: (context: any, index: number, byte: number, bit: number) => T
  ): IterableIterator<T>;
  popcnt_bit_range(data: Uint8Array, lhs: number, rhs: number): number;
  popcnt_array(
    arr: ArrayBufferView,
    byteOffset?: number | undefined,
    byteLength?: number | undefined
  ): number;
  popcnt_uint32(uint32: number): number;
  BaseInt64: typeof util_int_.BaseInt64;
  Uint64: typeof util_int_.Uint64;
  Int64: typeof util_int_.Int64;
  Int128: typeof util_int_.Int128;
  isArrowBigNumSymbol: typeof util_bn_.isArrowBigNumSymbol;
  bignumToString: <
    T extends util_bn_.BN<
      | Int8Array
      | Uint8Array
      | Uint8ClampedArray
      | Int16Array
      | Uint16Array
      | Int32Array
      | Uint32Array
    >
  >(
    a: T
  ) => string;
  bignumToBigInt: <
    T extends util_bn_.BN<
      | Int8Array
      | Uint8Array
      | Uint8ClampedArray
      | Int16Array
      | Uint16Array
      | Int32Array
      | Uint32Array
    >
  >(
    a: T
  ) => bigint;
  BN: typeof util_bn_.BN;
};
