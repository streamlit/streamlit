import { Vector } from "./vector";
import { BufferType } from "./enum";
import { DataType, SparseUnion, DenseUnion } from "./type";
import {
  Dictionary,
  Null,
  Int,
  Float,
  Binary,
  Bool,
  Utf8,
  Decimal,
  Date_,
  Time,
  Timestamp,
  Interval,
  List,
  Struct,
  Union,
  FixedSizeBinary,
  FixedSizeList,
  Map_
} from "./type";
/** @ignore */ export declare type kUnknownNullCount = -1;
/** @ignore */ export declare const kUnknownNullCount = -1;
/** @ignore */ export declare type NullBuffer = Uint8Array | null | undefined;
/** @ignore */ export declare type TypeIdsBuffer =
  | Int8Array
  | ArrayLike<number>
  | Iterable<number>
  | undefined;
/** @ignore */ export declare type ValueOffsetsBuffer =
  | Int32Array
  | ArrayLike<number>
  | Iterable<number>
  | undefined;
/** @ignore */ export declare type DataBuffer<T extends DataType> =
  | T["TArray"]
  | ArrayLike<number>
  | Iterable<number>
  | undefined;
/** @ignore */
export interface Buffers<T extends DataType> {
  [BufferType.OFFSET]: Int32Array;
  [BufferType.DATA]: T["TArray"];
  [BufferType.VALIDITY]: Uint8Array;
  [BufferType.TYPE]: T["TArray"];
}
/** @ignore */
export interface Data<T extends DataType = DataType> {
  readonly TType: T["TType"];
  readonly TArray: T["TArray"];
  readonly TValue: T["TValue"];
}
/** @ignore */
export declare class Data<T extends DataType = DataType> {
  readonly type: T;
  readonly length: number;
  readonly offset: number;
  readonly stride: number;
  readonly childData: Data[];
  /**
   * The dictionary for this Vector, if any. Only used for Dictionary type.
   */
  dictionary?: Vector;
  readonly values: Buffers<T>[BufferType.DATA];
  readonly typeIds: Buffers<T>[BufferType.TYPE];
  readonly nullBitmap: Buffers<T>[BufferType.VALIDITY];
  readonly valueOffsets: Buffers<T>[BufferType.OFFSET];
  readonly typeId: T["TType"];
  readonly ArrayType: T["ArrayType"];
  readonly buffers: Buffers<T>;
  readonly byteLength: number;
  protected _nullCount: number | kUnknownNullCount;
  readonly nullCount: number;
  constructor(
    type: T,
    offset: number,
    length: number,
    nullCount?: number,
    buffers?: Partial<Buffers<T>> | Data<T>,
    childData?: (Data | Vector)[],
    dictionary?: Vector
  );
  clone<R extends DataType>(
    type: R,
    offset?: number,
    length?: number,
    nullCount?: number,
    buffers?: Buffers<R>,
    childData?: (Data | Vector)[]
  ): Data<R>;
  slice(offset: number, length: number): Data<T>;
  _changeLengthAndBackfillNullBitmap(newLength: number): Data<T>;
  protected _sliceBuffers(
    offset: number,
    length: number,
    stride: number,
    typeId: T["TType"]
  ): Buffers<T>;
  protected _sliceChildren(
    childData: Data[],
    offset: number,
    length: number
  ): Data[];
  /** @nocollapse */
  static new<T extends DataType>(
    type: T,
    offset: number,
    length: number,
    nullCount?: number,
    buffers?: Partial<Buffers<T>> | Data<T>,
    childData?: (Data | Vector)[],
    dictionary?: Vector
  ): Data<T>;
  /** @nocollapse */
  static Null<T extends Null>(
    type: T,
    offset: number,
    length: number
  ): Data<T>;
  /** @nocollapse */
  static Int<T extends Int>(
    type: T,
    offset: number,
    length: number,
    nullCount: number,
    nullBitmap: NullBuffer,
    data: DataBuffer<T>
  ): Data<T>;
  /** @nocollapse */
  static Dictionary<T extends Dictionary>(
    type: T,
    offset: number,
    length: number,
    nullCount: number,
    nullBitmap: NullBuffer,
    data: DataBuffer<T>,
    dictionary: Vector<T["dictionary"]>
  ): Data<T>;
  /** @nocollapse */
  static Float<T extends Float>(
    type: T,
    offset: number,
    length: number,
    nullCount: number,
    nullBitmap: NullBuffer,
    data: DataBuffer<T>
  ): Data<T>;
  /** @nocollapse */
  static Bool<T extends Bool>(
    type: T,
    offset: number,
    length: number,
    nullCount: number,
    nullBitmap: NullBuffer,
    data: DataBuffer<T>
  ): Data<T>;
  /** @nocollapse */
  static Decimal<T extends Decimal>(
    type: T,
    offset: number,
    length: number,
    nullCount: number,
    nullBitmap: NullBuffer,
    data: DataBuffer<T>
  ): Data<T>;
  /** @nocollapse */
  static Date<T extends Date_>(
    type: T,
    offset: number,
    length: number,
    nullCount: number,
    nullBitmap: NullBuffer,
    data: DataBuffer<T>
  ): Data<T>;
  /** @nocollapse */
  static Time<T extends Time>(
    type: T,
    offset: number,
    length: number,
    nullCount: number,
    nullBitmap: NullBuffer,
    data: DataBuffer<T>
  ): Data<T>;
  /** @nocollapse */
  static Timestamp<T extends Timestamp>(
    type: T,
    offset: number,
    length: number,
    nullCount: number,
    nullBitmap: NullBuffer,
    data: DataBuffer<T>
  ): Data<T>;
  /** @nocollapse */
  static Interval<T extends Interval>(
    type: T,
    offset: number,
    length: number,
    nullCount: number,
    nullBitmap: NullBuffer,
    data: DataBuffer<T>
  ): Data<T>;
  /** @nocollapse */
  static FixedSizeBinary<T extends FixedSizeBinary>(
    type: T,
    offset: number,
    length: number,
    nullCount: number,
    nullBitmap: NullBuffer,
    data: DataBuffer<T>
  ): Data<T>;
  /** @nocollapse */
  static Binary<T extends Binary>(
    type: T,
    offset: number,
    length: number,
    nullCount: number,
    nullBitmap: NullBuffer,
    valueOffsets: ValueOffsetsBuffer,
    data: Uint8Array
  ): Data<T>;
  /** @nocollapse */
  static Utf8<T extends Utf8>(
    type: T,
    offset: number,
    length: number,
    nullCount: number,
    nullBitmap: NullBuffer,
    valueOffsets: ValueOffsetsBuffer,
    data: Uint8Array
  ): Data<T>;
  /** @nocollapse */
  static List<T extends List>(
    type: T,
    offset: number,
    length: number,
    nullCount: number,
    nullBitmap: NullBuffer,
    valueOffsets: ValueOffsetsBuffer,
    child: Data<T["valueType"]> | Vector<T["valueType"]>
  ): Data<T>;
  /** @nocollapse */
  static FixedSizeList<T extends FixedSizeList>(
    type: T,
    offset: number,
    length: number,
    nullCount: number,
    nullBitmap: NullBuffer,
    child: Data<T["valueType"]> | Vector<T["valueType"]>
  ): Data<T>;
  /** @nocollapse */
  static Struct<T extends Struct>(
    type: T,
    offset: number,
    length: number,
    nullCount: number,
    nullBitmap: NullBuffer,
    children: (Data | Vector)[]
  ): Data<T>;
  /** @nocollapse */
  static Map<T extends Map_>(
    type: T,
    offset: number,
    length: number,
    nullCount: number,
    nullBitmap: NullBuffer,
    valueOffsets: ValueOffsetsBuffer,
    child: Data | Vector
  ): Data<T>;
  static Union<T extends SparseUnion>(
    type: T,
    offset: number,
    length: number,
    nullCount: number,
    nullBitmap: NullBuffer,
    typeIds: TypeIdsBuffer,
    children: (Data | Vector)[],
    _?: any
  ): Data<T>;
  static Union<T extends DenseUnion>(
    type: T,
    offset: number,
    length: number,
    nullCount: number,
    nullBitmap: NullBuffer,
    typeIds: TypeIdsBuffer,
    valueOffsets: ValueOffsetsBuffer,
    children: (Data | Vector)[]
  ): Data<T>;
  static Union<T extends Union>(
    type: T,
    offset: number,
    length: number,
    nullCount: number,
    nullBitmap: NullBuffer,
    typeIds: TypeIdsBuffer,
    valueOffsetsOrChildren: ValueOffsetsBuffer | (Data | Vector)[],
    children?: (Data | Vector)[]
  ): Data<T>;
}
