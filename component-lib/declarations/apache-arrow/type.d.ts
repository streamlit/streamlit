import { Field } from "./schema";
import { flatbuffers } from "flatbuffers";
import { TypedArrayConstructor } from "./interfaces";
import { VectorType as V, TypeToDataType } from "./interfaces";
import Long = flatbuffers.Long;
import {
  Type,
  Precision,
  UnionMode,
  DateUnit,
  TimeUnit,
  IntervalUnit
} from "./enum";
/** @ignore */
export declare type TimeBitWidth = 32 | 64;
/** @ignore */
export declare type IntBitWidth = 8 | 16 | 32 | 64;
/** @ignore */
export declare type IsSigned = {
  true: true;
  false: false;
};
/** @ignore */
export declare type RowLike<
  T extends {
    [key: string]: DataType;
  }
> = Iterable<[string, T[keyof T]["TValue"] | null]> &
  {
    [P in keyof T]: T[P]["TValue"] | null;
  } & {
    get<K extends keyof T>(key: K): T[K]["TValue"] | null;
  } & {
    set<K extends keyof T>(key: K, val: T[K]["TValue"] | null): void;
  };
/** @ignore */
export declare type MapLike<
  K extends DataType = any,
  V extends DataType = any
> = {
  [P in K["TValue"]]: V["TValue"] | null;
} &
  Map<K["TValue"], V["TValue"] | null>;
export interface DataType<
  TType extends Type = Type,
  TChildren extends {
    [key: string]: DataType;
  } = any
> {
  readonly TType: TType;
  readonly TArray: any;
  readonly TValue: any;
  readonly ArrayType: any;
  readonly children: Field<TChildren[keyof TChildren]>[];
}
/**
 * An abstract base class for classes that encapsulate metadata about each of
 * the logical types that Arrow can represent.
 */
export declare abstract class DataType<
  TType extends Type = Type,
  TChildren extends {
    [key: string]: DataType;
  } = any
> {
  [Symbol.toStringTag]: string;
  /** @nocollapse */ static isNull(x: any): x is Null;
  /** @nocollapse */ static isInt(x: any): x is Int_;
  /** @nocollapse */ static isFloat(x: any): x is Float;
  /** @nocollapse */ static isBinary(x: any): x is Binary;
  /** @nocollapse */ static isUtf8(x: any): x is Utf8;
  /** @nocollapse */ static isBool(x: any): x is Bool;
  /** @nocollapse */ static isDecimal(x: any): x is Decimal;
  /** @nocollapse */ static isDate(x: any): x is Date_;
  /** @nocollapse */ static isTime(x: any): x is Time_;
  /** @nocollapse */ static isTimestamp(x: any): x is Timestamp_;
  /** @nocollapse */ static isInterval(x: any): x is Interval_;
  /** @nocollapse */ static isList(x: any): x is List;
  /** @nocollapse */ static isStruct(x: any): x is Struct;
  /** @nocollapse */ static isUnion(x: any): x is Union_;
  /** @nocollapse */ static isFixedSizeBinary(x: any): x is FixedSizeBinary;
  /** @nocollapse */ static isFixedSizeList(x: any): x is FixedSizeList;
  /** @nocollapse */ static isMap(x: any): x is Map_;
  /** @nocollapse */ static isDictionary(x: any): x is Dictionary;
  readonly typeId: TType;
  compareTo(other: DataType): other is TypeToDataType<TType>;
  protected static [Symbol.toStringTag]: string;
}
/** @ignore */
export interface Null extends DataType<Type.Null> {
  TArray: void;
  TValue: null;
}
/** @ignore */
export declare class Null extends DataType<Type.Null> {
  toString(): string;
  readonly typeId: Type.Null;
  protected static [Symbol.toStringTag]: string;
}
/** @ignore */
declare type Ints =
  | Type.Int
  | Type.Int8
  | Type.Int16
  | Type.Int32
  | Type.Int64
  | Type.Uint8
  | Type.Uint16
  | Type.Uint32
  | Type.Uint64;
/** @ignore */
declare type IType = {
  [Type.Int]: {
    bitWidth: IntBitWidth;
    isSigned: true | false;
    TArray: IntArray;
    TValue: number | bigint | Int32Array | Uint32Array;
  };
  [Type.Int8]: {
    bitWidth: 8;
    isSigned: true;
    TArray: Int8Array;
    TValue: number;
  };
  [Type.Int16]: {
    bitWidth: 16;
    isSigned: true;
    TArray: Int16Array;
    TValue: number;
  };
  [Type.Int32]: {
    bitWidth: 32;
    isSigned: true;
    TArray: Int32Array;
    TValue: number;
  };
  [Type.Int64]: {
    bitWidth: 64;
    isSigned: true;
    TArray: Int32Array;
    TValue: bigint | Int32Array | Uint32Array;
  };
  [Type.Uint8]: {
    bitWidth: 8;
    isSigned: false;
    TArray: Uint8Array;
    TValue: number;
  };
  [Type.Uint16]: {
    bitWidth: 16;
    isSigned: false;
    TArray: Uint16Array;
    TValue: number;
  };
  [Type.Uint32]: {
    bitWidth: 32;
    isSigned: false;
    TArray: Uint32Array;
    TValue: number;
  };
  [Type.Uint64]: {
    bitWidth: 64;
    isSigned: false;
    TArray: Uint32Array;
    TValue: bigint | Int32Array | Uint32Array;
  };
};
/** @ignore */
interface Int_<T extends Ints = Ints> extends DataType<T> {
  TArray: IType[T]["TArray"];
  TValue: IType[T]["TValue"];
}
/** @ignore */
declare class Int_<T extends Ints = Ints> extends DataType<T> {
  readonly isSigned: IType[T]["isSigned"];
  readonly bitWidth: IType[T]["bitWidth"];
  constructor(isSigned: IType[T]["isSigned"], bitWidth: IType[T]["bitWidth"]);
  readonly typeId: T;
  readonly ArrayType: TypedArrayConstructor<IType[T]["TArray"]>;
  toString(): string;
  protected static [Symbol.toStringTag]: string;
}
export { Int_ as Int };
/** @ignore */
export declare class Int8 extends Int_<Type.Int8> {
  constructor();
}
/** @ignore */
export declare class Int16 extends Int_<Type.Int16> {
  constructor();
}
/** @ignore */
export declare class Int32 extends Int_<Type.Int32> {
  constructor();
}
/** @ignore */
export declare class Int64 extends Int_<Type.Int64> {
  constructor();
}
/** @ignore */
export declare class Uint8 extends Int_<Type.Uint8> {
  constructor();
}
/** @ignore */
export declare class Uint16 extends Int_<Type.Uint16> {
  constructor();
}
/** @ignore */
export declare class Uint32 extends Int_<Type.Uint32> {
  constructor();
}
/** @ignore */
export declare class Uint64 extends Int_<Type.Uint64> {
  constructor();
}
/** @ignore */
declare type Floats = Type.Float | Type.Float16 | Type.Float32 | Type.Float64;
/** @ignore */
declare type FType = {
  [Type.Float]: {
    precision: Precision;
    TArray: FloatArray;
    TValue: number;
  };
  [Type.Float16]: {
    precision: Precision.HALF;
    TArray: Uint16Array;
    TValue: number;
  };
  [Type.Float32]: {
    precision: Precision.SINGLE;
    TArray: Float32Array;
    TValue: number;
  };
  [Type.Float64]: {
    precision: Precision.DOUBLE;
    TArray: Float64Array;
    TValue: number;
  };
};
/** @ignore */
export interface Float<T extends Floats = Floats> extends DataType<T> {
  TArray: FType[T]["TArray"];
  TValue: number;
}
/** @ignore */
export declare class Float<T extends Floats = Floats> extends DataType<T> {
  readonly precision: Precision;
  constructor(precision: Precision);
  readonly typeId: T;
  readonly ArrayType: TypedArrayConstructor<FType[T]["TArray"]>;
  toString(): string;
  protected static [Symbol.toStringTag]: string;
}
/** @ignore */
export declare class Float16 extends Float<Type.Float16> {
  constructor();
}
/** @ignore */
export declare class Float32 extends Float<Type.Float32> {
  constructor();
}
/** @ignore */
export declare class Float64 extends Float<Type.Float64> {
  constructor();
}
/** @ignore */
export interface Binary extends DataType<Type.Binary> {
  TArray: Uint8Array;
  TValue: Uint8Array;
  ArrayType: TypedArrayConstructor<Uint8Array>;
}
/** @ignore */
export declare class Binary extends DataType<Type.Binary> {
  constructor();
  readonly typeId: Type.Binary;
  toString(): string;
  protected static [Symbol.toStringTag]: string;
}
/** @ignore */
export interface Utf8 extends DataType<Type.Utf8> {
  TArray: Uint8Array;
  TValue: string;
  ArrayType: TypedArrayConstructor<Uint8Array>;
}
/** @ignore */
export declare class Utf8 extends DataType<Type.Utf8> {
  constructor();
  readonly typeId: Type.Utf8;
  toString(): string;
  protected static [Symbol.toStringTag]: string;
}
/** @ignore */
export interface Bool extends DataType<Type.Bool> {
  TArray: Uint8Array;
  TValue: boolean;
  ArrayType: TypedArrayConstructor<Uint8Array>;
}
/** @ignore */
export declare class Bool extends DataType<Type.Bool> {
  constructor();
  readonly typeId: Type.Bool;
  toString(): string;
  protected static [Symbol.toStringTag]: string;
}
/** @ignore */
export interface Decimal extends DataType<Type.Decimal> {
  TArray: Uint32Array;
  TValue: Uint32Array;
  ArrayType: TypedArrayConstructor<Uint32Array>;
}
/** @ignore */
export declare class Decimal extends DataType<Type.Decimal> {
  readonly scale: number;
  readonly precision: number;
  constructor(scale: number, precision: number);
  readonly typeId: Type.Decimal;
  toString(): string;
  protected static [Symbol.toStringTag]: string;
}
/** @ignore */
export declare type Dates = Type.Date | Type.DateDay | Type.DateMillisecond;
/** @ignore */
export interface Date_<T extends Dates = Dates> extends DataType<T> {
  TArray: Int32Array;
  TValue: Date;
  ArrayType: TypedArrayConstructor<Int32Array>;
}
/** @ignore */
export declare class Date_<T extends Dates = Dates> extends DataType<T> {
  readonly unit: DateUnit;
  constructor(unit: DateUnit);
  readonly typeId: T;
  toString(): string;
  protected static [Symbol.toStringTag]: string;
}
/** @ignore */
export declare class DateDay extends Date_<Type.DateDay> {
  constructor();
}
/** @ignore */
export declare class DateMillisecond extends Date_<Type.DateMillisecond> {
  constructor();
}
/** @ignore */
declare type Times =
  | Type.Time
  | Type.TimeSecond
  | Type.TimeMillisecond
  | Type.TimeMicrosecond
  | Type.TimeNanosecond;
/** @ignore */
declare type TimesType = {
  [Type.Time]: {
    unit: TimeUnit;
    TValue: number | Int32Array;
  };
  [Type.TimeSecond]: {
    unit: TimeUnit.SECOND;
    TValue: number;
  };
  [Type.TimeMillisecond]: {
    unit: TimeUnit.MILLISECOND;
    TValue: number;
  };
  [Type.TimeMicrosecond]: {
    unit: TimeUnit.MICROSECOND;
    TValue: Int32Array;
  };
  [Type.TimeNanosecond]: {
    unit: TimeUnit.NANOSECOND;
    TValue: Int32Array;
  };
};
/** @ignore */
interface Time_<T extends Times = Times> extends DataType<T> {
  TArray: Int32Array;
  TValue: TimesType[T]["TValue"];
  ArrayType: TypedArrayConstructor<Int32Array>;
}
/** @ignore */
declare class Time_<T extends Times = Times> extends DataType<T> {
  readonly unit: TimesType[T]["unit"];
  readonly bitWidth: TimeBitWidth;
  constructor(unit: TimesType[T]["unit"], bitWidth: TimeBitWidth);
  readonly typeId: T;
  toString(): string;
  protected static [Symbol.toStringTag]: string;
}
export { Time_ as Time };
/** @ignore */
export declare class TimeSecond extends Time_<Type.TimeSecond> {
  constructor();
}
/** @ignore */
export declare class TimeMillisecond extends Time_<Type.TimeMillisecond> {
  constructor();
}
/** @ignore */
export declare class TimeMicrosecond extends Time_<Type.TimeMicrosecond> {
  constructor();
}
/** @ignore */
export declare class TimeNanosecond extends Time_<Type.TimeNanosecond> {
  constructor();
}
/** @ignore */
declare type Timestamps =
  | Type.Timestamp
  | Type.TimestampSecond
  | Type.TimestampMillisecond
  | Type.TimestampMicrosecond
  | Type.TimestampNanosecond;
/** @ignore */
interface Timestamp_<T extends Timestamps = Timestamps> extends DataType<T> {
  TArray: Int32Array;
  TValue: number;
  ArrayType: TypedArrayConstructor<Int32Array>;
}
/** @ignore */
declare class Timestamp_<T extends Timestamps = Timestamps> extends DataType<
  T
> {
  readonly unit: TimeUnit;
  readonly timezone?: string | null | undefined;
  constructor(unit: TimeUnit, timezone?: string | null | undefined);
  readonly typeId: T;
  toString(): string;
  protected static [Symbol.toStringTag]: string;
}
export { Timestamp_ as Timestamp };
/** @ignore */
export declare class TimestampSecond extends Timestamp_<Type.TimestampSecond> {
  constructor(timezone?: string | null);
}
/** @ignore */
export declare class TimestampMillisecond extends Timestamp_<
  Type.TimestampMillisecond
> {
  constructor(timezone?: string | null);
}
/** @ignore */
export declare class TimestampMicrosecond extends Timestamp_<
  Type.TimestampMicrosecond
> {
  constructor(timezone?: string | null);
}
/** @ignore */
export declare class TimestampNanosecond extends Timestamp_<
  Type.TimestampNanosecond
> {
  constructor(timezone?: string | null);
}
/** @ignore */
declare type Intervals =
  | Type.Interval
  | Type.IntervalDayTime
  | Type.IntervalYearMonth;
/** @ignore */
interface Interval_<T extends Intervals = Intervals> extends DataType<T> {
  TArray: Int32Array;
  TValue: Int32Array;
  ArrayType: TypedArrayConstructor<Int32Array>;
}
/** @ignore */
declare class Interval_<T extends Intervals = Intervals> extends DataType<T> {
  readonly unit: IntervalUnit;
  constructor(unit: IntervalUnit);
  readonly typeId: T;
  toString(): string;
  protected static [Symbol.toStringTag]: string;
}
export { Interval_ as Interval };
/** @ignore */
export declare class IntervalDayTime extends Interval_<Type.IntervalDayTime> {
  constructor();
}
/** @ignore */
export declare class IntervalYearMonth extends Interval_<
  Type.IntervalYearMonth
> {
  constructor();
}
/** @ignore */
export interface List<T extends DataType = any>
  extends DataType<
    Type.List,
    {
      [0]: T;
    }
  > {
  TArray: IterableArrayLike<T>;
  TValue: V<T>;
}
/** @ignore */
export declare class List<T extends DataType = any> extends DataType<
  Type.List,
  {
    [0]: T;
  }
> {
  constructor(child: Field<T>);
  readonly children: Field<T>[];
  readonly typeId: Type.List;
  toString(): string;
  readonly valueType: T;
  readonly valueField: Field<T>;
  readonly ArrayType: T["ArrayType"];
  protected static [Symbol.toStringTag]: string;
}
/** @ignore */
export interface Struct<
  T extends {
    [key: string]: DataType;
  } = any
> extends DataType<Type.Struct> {
  TArray: IterableArrayLike<RowLike<T>>;
  TValue: RowLike<T>;
  dataTypes: T;
}
/** @ignore */
export declare class Struct<
  T extends {
    [key: string]: DataType;
  } = any
> extends DataType<Type.Struct, T> {
  readonly children: Field<T[keyof T]>[];
  constructor(children: Field<T[keyof T]>[]);
  readonly typeId: Type.Struct;
  toString(): string;
  protected static [Symbol.toStringTag]: string;
}
/** @ignore */
declare type Unions = Type.Union | Type.DenseUnion | Type.SparseUnion;
/** @ignore */
interface Union_<T extends Unions = Unions> extends DataType<T> {
  TArray: Int8Array;
  TValue: any;
  ArrayType: TypedArrayConstructor<Int8Array>;
}
/** @ignore */
declare class Union_<T extends Unions = Unions> extends DataType<T> {
  readonly mode: UnionMode;
  readonly typeIds: Int32Array;
  readonly children: Field<any>[];
  readonly typeIdToChildIndex: {
    [key: number]: number;
  };
  constructor(
    mode: UnionMode,
    typeIds: number[] | Int32Array,
    children: Field<any>[]
  );
  readonly typeId: T;
  toString(): string;
  protected static [Symbol.toStringTag]: string;
}
export { Union_ as Union };
/** @ignore */
export declare class DenseUnion extends Union_<Type.DenseUnion> {
  constructor(typeIds: number[] | Int32Array, children: Field[]);
}
/** @ignore */
export declare class SparseUnion extends Union_<Type.SparseUnion> {
  constructor(typeIds: number[] | Int32Array, children: Field[]);
}
/** @ignore */
export interface FixedSizeBinary extends DataType<Type.FixedSizeBinary> {
  TArray: Uint8Array;
  TValue: Uint8Array;
  ArrayType: TypedArrayConstructor<Uint8Array>;
}
/** @ignore */
export declare class FixedSizeBinary extends DataType<Type.FixedSizeBinary> {
  readonly byteWidth: number;
  constructor(byteWidth: number);
  readonly typeId: Type.FixedSizeBinary;
  toString(): string;
  protected static [Symbol.toStringTag]: string;
}
/** @ignore */
export interface FixedSizeList<T extends DataType = any>
  extends DataType<Type.FixedSizeList> {
  TArray: IterableArrayLike<T["TArray"]>;
  TValue: V<T>;
}
/** @ignore */
export declare class FixedSizeList<T extends DataType = any> extends DataType<
  Type.FixedSizeList,
  {
    [0]: T;
  }
> {
  readonly listSize: number;
  readonly children: Field<T>[];
  constructor(listSize: number, child: Field<T>);
  readonly typeId: Type.FixedSizeList;
  readonly valueType: T;
  readonly valueField: Field<T>;
  readonly ArrayType: T["ArrayType"];
  toString(): string;
  protected static [Symbol.toStringTag]: string;
}
/** @ignore */
export interface Map_<
  TKey extends DataType = any,
  TValue extends DataType = any
> extends DataType<Type.Map> {
  TArray: IterableArrayLike<Map<TKey["TValue"], TValue["TValue"] | null>>;
  TChild: Struct<{
    key: TKey;
    value: TValue;
  }>;
  TValue: MapLike<TKey, TValue>;
}
/** @ignore */
export declare class Map_<
  TKey extends DataType = any,
  TValue extends DataType = any
> extends DataType<Type.Map> {
  constructor(
    child: Field<
      Struct<{
        key: TKey;
        value: TValue;
      }>
    >,
    keysSorted?: boolean
  );
  readonly keysSorted: boolean;
  readonly children: Field<
    Struct<{
      key: TKey;
      value: TValue;
    }>
  >[];
  readonly typeId: Type.Map;
  readonly keyType: TKey;
  readonly valueType: TValue;
  toString(): string;
  protected static [Symbol.toStringTag]: string;
}
/** @ignore */
export declare type TKeys = Int8 | Int16 | Int32 | Uint8 | Uint16 | Uint32;
/** @ignore */
export interface Dictionary<
  T extends DataType = any,
  TKey extends TKeys = TKeys
> extends DataType<Type.Dictionary> {
  TArray: TKey["TArray"];
  TValue: T["TValue"];
}
/** @ignore */
export declare class Dictionary<
  T extends DataType = any,
  TKey extends TKeys = TKeys
> extends DataType<Type.Dictionary> {
  readonly id: number;
  readonly indices: TKey;
  readonly dictionary: T;
  readonly isOrdered: boolean;
  constructor(
    dictionary: T,
    indices: TKey,
    id?: Long | number | null,
    isOrdered?: boolean | null
  );
  readonly typeId: Type.Dictionary;
  readonly children: Field<any>[];
  readonly valueType: T;
  readonly ArrayType: T["ArrayType"];
  toString(): string;
  protected static [Symbol.toStringTag]: string;
}
/** @ignore */
export interface IterableArrayLike<T = any>
  extends ArrayLike<T>,
    Iterable<T> {}
/** @ignore */
export declare type FloatArray = Uint16Array | Float32Array | Float64Array;
/** @ignore */
export declare type IntArray =
  | Int8Array
  | Int16Array
  | Int32Array
  | Uint8Array
  | Uint16Array
  | Uint32Array;
/** @ignore */
export declare function strideForType(type: DataType): number;
