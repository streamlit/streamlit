import { Data } from "./data";
import { Type } from "./enum";
import * as type from "./type";
import { DataType } from "./type";
import * as vecs from "./vector/index";
import * as builders from "./builder/index";
import { BuilderOptions } from "./builder/index";
/** @ignore */ declare type FloatArray = Float32Array | Float64Array;
/** @ignore */ declare type IntArray = Int8Array | Int16Array | Int32Array;
/** @ignore */ declare type UintArray =
  | Uint8Array
  | Uint16Array
  | Uint32Array
  | Uint8ClampedArray;
/** @ignore */
export declare type TypedArray = FloatArray | IntArray | UintArray;
/** @ignore */
export declare type BigIntArray = BigInt64Array | BigUint64Array;
/** @ignore */
export interface TypedArrayConstructor<T extends TypedArray> {
  readonly prototype: T;
  new (length?: number): T;
  new (array: Iterable<number>): T;
  new (buffer: ArrayBufferLike, byteOffset?: number, length?: number): T;
  /**
   * The size in bytes of each element in the array.
   */
  readonly BYTES_PER_ELEMENT: number;
  /**
   * Returns a new array from a set of elements.
   * @param items A set of elements to include in the new array object.
   */
  of(...items: number[]): T;
  /**
   * Creates an array from an array-like or iterable object.
   * @param arrayLike An array-like or iterable object to convert to an array.
   * @param mapfn A mapping function to call on every element of the array.
   * @param thisArg Value of 'this' used to invoke the mapfn.
   */
  from(
    arrayLike: ArrayLike<number>,
    mapfn?: (v: number, k: number) => number,
    thisArg?: any
  ): T;
  from<U>(
    arrayLike: ArrayLike<U>,
    mapfn: (v: U, k: number) => number,
    thisArg?: any
  ): T;
}
/** @ignore */
export interface BigIntArrayConstructor<T extends BigIntArray> {
  readonly prototype: T;
  new (length?: number): T;
  new (array: Iterable<bigint>): T;
  new (buffer: ArrayBufferLike, byteOffset?: number, length?: number): T;
  /**
   * The size in bytes of each element in the array.
   */
  readonly BYTES_PER_ELEMENT: number;
  /**
   * Returns a new array from a set of elements.
   * @param items A set of elements to include in the new array object.
   */
  of(...items: bigint[]): T;
  /**
   * Creates an array from an array-like or iterable object.
   * @param arrayLike An array-like or iterable object to convert to an array.
   * @param mapfn A mapping function to call on every element of the array.
   * @param thisArg Value of 'this' used to invoke the mapfn.
   */
  from(
    arrayLike: ArrayLike<bigint>,
    mapfn?: (v: bigint, k: number) => bigint,
    thisArg?: any
  ): T;
  from<U>(
    arrayLike: ArrayLike<U>,
    mapfn: (v: U, k: number) => bigint,
    thisArg?: any
  ): T;
}
/** @ignore */
export declare type VectorCtorArgs<
  T extends VectorType<R>,
  R extends DataType = any,
  TArgs extends any[] = any[],
  TCtor extends new (data: Data<R>, ...args: TArgs) => T = new (
    data: Data<R>,
    ...args: TArgs
  ) => T
> = TCtor extends new (data: Data<R>, ...args: infer TArgs) => T
  ? TArgs
  : never;
/** @ignore */
export declare type BuilderCtorArgs<
  T extends BuilderType<R, any>,
  R extends DataType = any,
  TArgs extends any[] = any[],
  TCtor extends new (type: R, ...args: TArgs) => T = new (
    type: R,
    ...args: TArgs
  ) => T
> = TCtor extends new (type: R, ...args: infer TArgs) => T ? TArgs : never;
/**
 * Obtain the constructor function of an instance type
 * @ignore
 */
export declare type ConstructorType<
  T,
  TCtor extends new (...args: any[]) => T = new (...args: any[]) => T
> = TCtor extends new (...args: any[]) => T ? TCtor : never;
/** @ignore */
export declare type VectorCtorType<
  T extends VectorType<R>,
  R extends DataType = any,
  TCtor extends new (data: Data<R>, ...args: VectorCtorArgs<T, R>) => T = new (
    data: Data<R>,
    ...args: VectorCtorArgs<T, R>
  ) => T
> = TCtor extends new (data: Data<R>, ...args: VectorCtorArgs<T, R>) => T
  ? TCtor
  : never;
/** @ignore */
export declare type BuilderCtorType<
  T extends BuilderType<R, any>,
  R extends DataType = any,
  TCtor extends new (options: BuilderOptions<R, any>) => T = new (
    options: BuilderOptions<R, any>
  ) => T
> = TCtor extends new (options: BuilderOptions<R, any>) => T ? TCtor : never;
/** @ignore */
export declare type VectorType<
  T extends Type | DataType = any
> = T extends Type
  ? TypeToVector<T>
  : T extends DataType
  ? DataTypeToVector<T>
  : vecs.BaseVector<any>;
/** @ignore */
export declare type BuilderType<
  T extends Type | DataType = any,
  TNull = any
> = T extends Type
  ? TypeToBuilder<T, TNull>
  : T extends DataType
  ? DataTypeToBuilder<T, TNull>
  : builders.Builder<any, TNull>;
/** @ignore */
export declare type VectorCtor<
  T extends Type | DataType | VectorType
> = T extends VectorType
  ? VectorCtorType<T>
  : T extends Type
  ? VectorCtorType<VectorType<T>>
  : T extends DataType
  ? VectorCtorType<VectorType<T["TType"]>>
  : VectorCtorType<vecs.BaseVector>;
/** @ignore */
export declare type BuilderCtor<
  T extends Type | DataType = any
> = T extends Type
  ? BuilderCtorType<BuilderType<T>>
  : T extends DataType
  ? BuilderCtorType<BuilderType<T>>
  : BuilderCtorType<builders.Builder>;
/** @ignore */
export declare type DataTypeCtor<
  T extends Type | DataType | VectorType = any
> = T extends DataType
  ? ConstructorType<T>
  : T extends VectorType
  ? ConstructorType<T["type"]>
  : T extends Type
  ? ConstructorType<TypeToDataType<T>>
  : never;
/** @ignore */
declare type TypeToVector<T extends Type> = {
  [key: number]: any;
  [Type.Null]: vecs.NullVector;
  [Type.Bool]: vecs.BoolVector;
  [Type.Int8]: vecs.Int8Vector;
  [Type.Int16]: vecs.Int16Vector;
  [Type.Int32]: vecs.Int32Vector;
  [Type.Int64]: vecs.Int64Vector;
  [Type.Uint8]: vecs.Uint8Vector;
  [Type.Uint16]: vecs.Uint16Vector;
  [Type.Uint32]: vecs.Uint32Vector;
  [Type.Uint64]: vecs.Uint64Vector;
  [Type.Int]: vecs.IntVector;
  [Type.Float16]: vecs.Float16Vector;
  [Type.Float32]: vecs.Float32Vector;
  [Type.Float64]: vecs.Float64Vector;
  [Type.Float]: vecs.FloatVector;
  [Type.Utf8]: vecs.Utf8Vector;
  [Type.Binary]: vecs.BinaryVector;
  [Type.FixedSizeBinary]: vecs.FixedSizeBinaryVector;
  [Type.Date]: vecs.DateVector;
  [Type.DateDay]: vecs.DateDayVector;
  [Type.DateMillisecond]: vecs.DateMillisecondVector;
  [Type.Timestamp]: vecs.TimestampVector;
  [Type.TimestampSecond]: vecs.TimestampSecondVector;
  [Type.TimestampMillisecond]: vecs.TimestampMillisecondVector;
  [Type.TimestampMicrosecond]: vecs.TimestampMicrosecondVector;
  [Type.TimestampNanosecond]: vecs.TimestampNanosecondVector;
  [Type.Time]: vecs.TimeVector;
  [Type.TimeSecond]: vecs.TimeSecondVector;
  [Type.TimeMillisecond]: vecs.TimeMillisecondVector;
  [Type.TimeMicrosecond]: vecs.TimeMicrosecondVector;
  [Type.TimeNanosecond]: vecs.TimeNanosecondVector;
  [Type.Decimal]: vecs.DecimalVector;
  [Type.Union]: vecs.UnionVector;
  [Type.DenseUnion]: vecs.DenseUnionVector;
  [Type.SparseUnion]: vecs.SparseUnionVector;
  [Type.Interval]: vecs.IntervalVector;
  [Type.IntervalDayTime]: vecs.IntervalDayTimeVector;
  [Type.IntervalYearMonth]: vecs.IntervalYearMonthVector;
  [Type.Map]: vecs.MapVector;
  [Type.List]: vecs.ListVector;
  [Type.Struct]: vecs.StructVector;
  [Type.Dictionary]: vecs.DictionaryVector;
  [Type.FixedSizeList]: vecs.FixedSizeListVector;
}[T];
/** @ignore */
declare type DataTypeToVector<T extends DataType = any> = {
  [key: number]: any;
  [Type.Null]: T extends type.Null ? vecs.NullVector : vecs.BaseVector<T>;
  [Type.Bool]: T extends type.Bool ? vecs.BoolVector : vecs.BaseVector<T>;
  [Type.Int8]: T extends type.Int8 ? vecs.Int8Vector : vecs.BaseVector<T>;
  [Type.Int16]: T extends type.Int16 ? vecs.Int16Vector : vecs.BaseVector<T>;
  [Type.Int32]: T extends type.Int32 ? vecs.Int32Vector : vecs.BaseVector<T>;
  [Type.Int64]: T extends type.Int64 ? vecs.Int64Vector : vecs.BaseVector<T>;
  [Type.Uint8]: T extends type.Uint8 ? vecs.Uint8Vector : vecs.BaseVector<T>;
  [Type.Uint16]: T extends type.Uint16
    ? vecs.Uint16Vector
    : vecs.BaseVector<T>;
  [Type.Uint32]: T extends type.Uint32
    ? vecs.Uint32Vector
    : vecs.BaseVector<T>;
  [Type.Uint64]: T extends type.Uint64
    ? vecs.Uint64Vector
    : vecs.BaseVector<T>;
  [Type.Int]: T extends type.Int ? vecs.IntVector : vecs.BaseVector<T>;
  [Type.Float16]: T extends type.Float16
    ? vecs.Float16Vector
    : vecs.BaseVector<T>;
  [Type.Float32]: T extends type.Float32
    ? vecs.Float32Vector
    : vecs.BaseVector<T>;
  [Type.Float64]: T extends type.Float64
    ? vecs.Float64Vector
    : vecs.BaseVector<T>;
  [Type.Float]: T extends type.Float ? vecs.FloatVector : vecs.BaseVector<T>;
  [Type.Utf8]: T extends type.Utf8 ? vecs.Utf8Vector : vecs.BaseVector<T>;
  [Type.Binary]: T extends type.Binary
    ? vecs.BinaryVector
    : vecs.BaseVector<T>;
  [Type.FixedSizeBinary]: T extends type.FixedSizeBinary
    ? vecs.FixedSizeBinaryVector
    : vecs.BaseVector<T>;
  [Type.Date]: T extends type.Date_ ? vecs.DateVector : vecs.BaseVector<T>;
  [Type.DateDay]: T extends type.DateDay
    ? vecs.DateDayVector
    : vecs.BaseVector<T>;
  [Type.DateMillisecond]: T extends type.DateMillisecond
    ? vecs.DateMillisecondVector
    : vecs.BaseVector<T>;
  [Type.Timestamp]: T extends type.Timestamp
    ? vecs.TimestampVector
    : vecs.BaseVector<T>;
  [Type.TimestampSecond]: T extends type.TimestampSecond
    ? vecs.TimestampSecondVector
    : vecs.BaseVector<T>;
  [Type.TimestampMillisecond]: T extends type.TimestampMillisecond
    ? vecs.TimestampMillisecondVector
    : vecs.BaseVector<T>;
  [Type.TimestampMicrosecond]: T extends type.TimestampMicrosecond
    ? vecs.TimestampMicrosecondVector
    : vecs.BaseVector<T>;
  [Type.TimestampNanosecond]: T extends type.TimestampNanosecond
    ? vecs.TimestampNanosecondVector
    : vecs.BaseVector<T>;
  [Type.Time]: T extends type.Time ? vecs.TimeVector : vecs.BaseVector<T>;
  [Type.TimeSecond]: T extends type.TimeSecond
    ? vecs.TimeSecondVector
    : vecs.BaseVector<T>;
  [Type.TimeMillisecond]: T extends type.TimeMillisecond
    ? vecs.TimeMillisecondVector
    : vecs.BaseVector<T>;
  [Type.TimeMicrosecond]: T extends type.TimeMicrosecond
    ? vecs.TimeMicrosecondVector
    : vecs.BaseVector<T>;
  [Type.TimeNanosecond]: T extends type.TimeNanosecond
    ? vecs.TimeNanosecondVector
    : vecs.BaseVector<T>;
  [Type.Decimal]: T extends type.Decimal
    ? vecs.DecimalVector
    : vecs.BaseVector<T>;
  [Type.Union]: T extends type.Union ? vecs.UnionVector : vecs.BaseVector<T>;
  [Type.DenseUnion]: T extends type.DenseUnion
    ? vecs.DenseUnionVector
    : vecs.BaseVector<T>;
  [Type.SparseUnion]: T extends type.SparseUnion
    ? vecs.SparseUnionVector
    : vecs.BaseVector<T>;
  [Type.Interval]: T extends type.Interval
    ? vecs.IntervalVector
    : vecs.BaseVector<T>;
  [Type.IntervalDayTime]: T extends type.IntervalDayTime
    ? vecs.IntervalDayTimeVector
    : vecs.BaseVector<T>;
  [Type.IntervalYearMonth]: T extends type.IntervalYearMonth
    ? vecs.IntervalYearMonthVector
    : vecs.BaseVector<T>;
  [Type.Map]: T extends type.Map_
    ? vecs.MapVector<T["keyType"], T["valueType"]>
    : vecs.BaseVector<T>;
  [Type.List]: T extends type.List
    ? vecs.ListVector<T["valueType"]>
    : vecs.BaseVector<T>;
  [Type.Struct]: T extends type.Struct
    ? vecs.StructVector<T["dataTypes"]>
    : vecs.BaseVector<T>;
  [Type.Dictionary]: T extends type.Dictionary
    ? vecs.DictionaryVector<T["valueType"], T["indices"]>
    : vecs.BaseVector<T>;
  [Type.FixedSizeList]: T extends type.FixedSizeList
    ? vecs.FixedSizeListVector<T["valueType"]>
    : vecs.BaseVector<T>;
}[T["TType"]];
/** @ignore */
export declare type TypeToDataType<T extends Type> = {
  [key: number]: type.DataType;
  [Type.Null]: type.Null;
  [Type.Bool]: type.Bool;
  [Type.Int]: type.Int;
  [Type.Int16]: type.Int16;
  [Type.Int32]: type.Int32;
  [Type.Int64]: type.Int64;
  [Type.Uint8]: type.Uint8;
  [Type.Uint16]: type.Uint16;
  [Type.Uint32]: type.Uint32;
  [Type.Uint64]: type.Uint64;
  [Type.Int8]: type.Int8;
  [Type.Float16]: type.Float16;
  [Type.Float32]: type.Float32;
  [Type.Float64]: type.Float64;
  [Type.Float]: type.Float;
  [Type.Utf8]: type.Utf8;
  [Type.Binary]: type.Binary;
  [Type.FixedSizeBinary]: type.FixedSizeBinary;
  [Type.Date]: type.Date_;
  [Type.DateDay]: type.DateDay;
  [Type.DateMillisecond]: type.DateMillisecond;
  [Type.Timestamp]: type.Timestamp;
  [Type.TimestampSecond]: type.TimestampSecond;
  [Type.TimestampMillisecond]: type.TimestampMillisecond;
  [Type.TimestampMicrosecond]: type.TimestampMicrosecond;
  [Type.TimestampNanosecond]: type.TimestampNanosecond;
  [Type.Time]: type.Time;
  [Type.TimeSecond]: type.TimeSecond;
  [Type.TimeMillisecond]: type.TimeMillisecond;
  [Type.TimeMicrosecond]: type.TimeMicrosecond;
  [Type.TimeNanosecond]: type.TimeNanosecond;
  [Type.Decimal]: type.Decimal;
  [Type.Union]: type.Union;
  [Type.DenseUnion]: type.DenseUnion;
  [Type.SparseUnion]: type.SparseUnion;
  [Type.Interval]: type.Interval;
  [Type.IntervalDayTime]: type.IntervalDayTime;
  [Type.IntervalYearMonth]: type.IntervalYearMonth;
  [Type.Map]: type.Map_;
  [Type.List]: type.List;
  [Type.Struct]: type.Struct;
  [Type.Dictionary]: type.Dictionary;
  [Type.FixedSizeList]: type.FixedSizeList;
}[T];
/** @ignore */
declare type TypeToBuilder<T extends Type = any, TNull = any> = {
  [key: number]: builders.Builder;
  [Type.Null]: builders.NullBuilder<TNull>;
  [Type.Bool]: builders.BoolBuilder<TNull>;
  [Type.Int8]: builders.Int8Builder<TNull>;
  [Type.Int16]: builders.Int16Builder<TNull>;
  [Type.Int32]: builders.Int32Builder<TNull>;
  [Type.Int64]: builders.Int64Builder<TNull>;
  [Type.Uint8]: builders.Uint8Builder<TNull>;
  [Type.Uint16]: builders.Uint16Builder<TNull>;
  [Type.Uint32]: builders.Uint32Builder<TNull>;
  [Type.Uint64]: builders.Uint64Builder<TNull>;
  [Type.Int]: builders.IntBuilder<any, TNull>;
  [Type.Float16]: builders.Float16Builder<TNull>;
  [Type.Float32]: builders.Float32Builder<TNull>;
  [Type.Float64]: builders.Float64Builder<TNull>;
  [Type.Float]: builders.FloatBuilder<any, TNull>;
  [Type.Utf8]: builders.Utf8Builder<TNull>;
  [Type.Binary]: builders.BinaryBuilder<TNull>;
  [Type.FixedSizeBinary]: builders.FixedSizeBinaryBuilder<TNull>;
  [Type.Date]: builders.DateBuilder<any, TNull>;
  [Type.DateDay]: builders.DateDayBuilder<TNull>;
  [Type.DateMillisecond]: builders.DateMillisecondBuilder<TNull>;
  [Type.Timestamp]: builders.TimestampBuilder<any, TNull>;
  [Type.TimestampSecond]: builders.TimestampSecondBuilder<TNull>;
  [Type.TimestampMillisecond]: builders.TimestampMillisecondBuilder<TNull>;
  [Type.TimestampMicrosecond]: builders.TimestampMicrosecondBuilder<TNull>;
  [Type.TimestampNanosecond]: builders.TimestampNanosecondBuilder<TNull>;
  [Type.Time]: builders.TimeBuilder<any, TNull>;
  [Type.TimeSecond]: builders.TimeSecondBuilder<TNull>;
  [Type.TimeMillisecond]: builders.TimeMillisecondBuilder<TNull>;
  [Type.TimeMicrosecond]: builders.TimeMicrosecondBuilder<TNull>;
  [Type.TimeNanosecond]: builders.TimeNanosecondBuilder<TNull>;
  [Type.Decimal]: builders.DecimalBuilder<TNull>;
  [Type.Union]: builders.UnionBuilder<any, TNull>;
  [Type.DenseUnion]: builders.DenseUnionBuilder<any, TNull>;
  [Type.SparseUnion]: builders.SparseUnionBuilder<any, TNull>;
  [Type.Interval]: builders.IntervalBuilder<any, TNull>;
  [Type.IntervalDayTime]: builders.IntervalDayTimeBuilder<TNull>;
  [Type.IntervalYearMonth]: builders.IntervalYearMonthBuilder<TNull>;
  [Type.Map]: builders.MapBuilder<any, any, TNull>;
  [Type.List]: builders.ListBuilder<any, TNull>;
  [Type.Struct]: builders.StructBuilder<any, TNull>;
  [Type.Dictionary]: builders.DictionaryBuilder<any, TNull>;
  [Type.FixedSizeList]: builders.FixedSizeListBuilder<any, TNull>;
}[T];
/** @ignore */
declare type DataTypeToBuilder<T extends DataType = any, TNull = any> = {
  [key: number]: builders.Builder<any, TNull>;
  [Type.Null]: T extends type.Null
    ? builders.NullBuilder<TNull>
    : builders.Builder<any, TNull>;
  [Type.Bool]: T extends type.Bool
    ? builders.BoolBuilder<TNull>
    : builders.Builder<any, TNull>;
  [Type.Int8]: T extends type.Int8
    ? builders.Int8Builder<TNull>
    : builders.Builder<any, TNull>;
  [Type.Int16]: T extends type.Int16
    ? builders.Int16Builder<TNull>
    : builders.Builder<any, TNull>;
  [Type.Int32]: T extends type.Int32
    ? builders.Int32Builder<TNull>
    : builders.Builder<any, TNull>;
  [Type.Int64]: T extends type.Int64
    ? builders.Int64Builder<TNull>
    : builders.Builder<any, TNull>;
  [Type.Uint8]: T extends type.Uint8
    ? builders.Uint8Builder<TNull>
    : builders.Builder<any, TNull>;
  [Type.Uint16]: T extends type.Uint16
    ? builders.Uint16Builder<TNull>
    : builders.Builder<any, TNull>;
  [Type.Uint32]: T extends type.Uint32
    ? builders.Uint32Builder<TNull>
    : builders.Builder<any, TNull>;
  [Type.Uint64]: T extends type.Uint64
    ? builders.Uint64Builder<TNull>
    : builders.Builder<any, TNull>;
  [Type.Int]: T extends type.Int
    ? builders.IntBuilder<T, TNull>
    : builders.Builder<any, TNull>;
  [Type.Float16]: T extends type.Float16
    ? builders.Float16Builder<TNull>
    : builders.Builder<any, TNull>;
  [Type.Float32]: T extends type.Float32
    ? builders.Float32Builder<TNull>
    : builders.Builder<any, TNull>;
  [Type.Float64]: T extends type.Float64
    ? builders.Float64Builder<TNull>
    : builders.Builder<any, TNull>;
  [Type.Float]: T extends type.Float
    ? builders.FloatBuilder<T, TNull>
    : builders.Builder<any, TNull>;
  [Type.Utf8]: T extends type.Utf8
    ? builders.Utf8Builder<TNull>
    : builders.Builder<any, TNull>;
  [Type.Binary]: T extends type.Binary
    ? builders.BinaryBuilder<TNull>
    : builders.Builder<any, TNull>;
  [Type.FixedSizeBinary]: T extends type.FixedSizeBinary
    ? builders.FixedSizeBinaryBuilder<TNull>
    : builders.Builder<any, TNull>;
  [Type.Date]: T extends type.Date_
    ? builders.DateBuilder<T, TNull>
    : builders.Builder<any, TNull>;
  [Type.DateDay]: T extends type.DateDay
    ? builders.DateDayBuilder<TNull>
    : builders.Builder<any, TNull>;
  [Type.DateMillisecond]: T extends type.DateMillisecond
    ? builders.DateMillisecondBuilder<TNull>
    : builders.Builder<any, TNull>;
  [Type.Timestamp]: T extends type.Timestamp
    ? builders.TimestampBuilder<T, TNull>
    : builders.Builder<any, TNull>;
  [Type.TimestampSecond]: T extends type.TimestampSecond
    ? builders.TimestampSecondBuilder<TNull>
    : builders.Builder<any, TNull>;
  [Type.TimestampMillisecond]: T extends type.TimestampMillisecond
    ? builders.TimestampMillisecondBuilder<TNull>
    : builders.Builder<any, TNull>;
  [Type.TimestampMicrosecond]: T extends type.TimestampMicrosecond
    ? builders.TimestampMicrosecondBuilder<TNull>
    : builders.Builder<any, TNull>;
  [Type.TimestampNanosecond]: T extends type.TimestampNanosecond
    ? builders.TimestampNanosecondBuilder<TNull>
    : builders.Builder<any, TNull>;
  [Type.Time]: T extends type.Time
    ? builders.TimeBuilder<T, TNull>
    : builders.Builder<any, TNull>;
  [Type.TimeSecond]: T extends type.TimeSecond
    ? builders.TimeSecondBuilder<TNull>
    : builders.Builder<any, TNull>;
  [Type.TimeMillisecond]: T extends type.TimeMillisecond
    ? builders.TimeMillisecondBuilder<TNull>
    : builders.Builder<any, TNull>;
  [Type.TimeMicrosecond]: T extends type.TimeMicrosecond
    ? builders.TimeMicrosecondBuilder<TNull>
    : builders.Builder<any, TNull>;
  [Type.TimeNanosecond]: T extends type.TimeNanosecond
    ? builders.TimeNanosecondBuilder<TNull>
    : builders.Builder<any, TNull>;
  [Type.Decimal]: T extends type.Decimal
    ? builders.DecimalBuilder<TNull>
    : builders.Builder<any, TNull>;
  [Type.Union]: T extends type.Union
    ? builders.UnionBuilder<T, TNull>
    : builders.Builder<any, TNull>;
  [Type.DenseUnion]: T extends type.DenseUnion
    ? builders.DenseUnionBuilder<T, TNull>
    : builders.Builder<any, TNull>;
  [Type.SparseUnion]: T extends type.SparseUnion
    ? builders.SparseUnionBuilder<T, TNull>
    : builders.Builder<any, TNull>;
  [Type.Interval]: T extends type.Interval
    ? builders.IntervalBuilder<T, TNull>
    : builders.Builder<any, TNull>;
  [Type.IntervalDayTime]: T extends type.IntervalDayTime
    ? builders.IntervalDayTimeBuilder<TNull>
    : builders.Builder<any, TNull>;
  [Type.IntervalYearMonth]: T extends type.IntervalYearMonth
    ? builders.IntervalYearMonthBuilder<TNull>
    : builders.Builder<any, TNull>;
  [Type.Map]: T extends type.Map_
    ? builders.MapBuilder<T["keyType"], T["valueType"], TNull>
    : builders.Builder<any, TNull>;
  [Type.List]: T extends type.List
    ? builders.ListBuilder<T["valueType"], TNull>
    : builders.Builder<any, TNull>;
  [Type.Struct]: T extends type.Struct
    ? builders.StructBuilder<T["dataTypes"], TNull>
    : builders.Builder<any, TNull>;
  [Type.Dictionary]: T extends type.Dictionary
    ? builders.DictionaryBuilder<T, TNull>
    : builders.Builder<any, TNull>;
  [Type.FixedSizeList]: T extends type.FixedSizeList
    ? builders.FixedSizeListBuilder<T["valueType"], TNull>
    : builders.Builder<any, TNull>;
}[T["TType"]];
export {};
