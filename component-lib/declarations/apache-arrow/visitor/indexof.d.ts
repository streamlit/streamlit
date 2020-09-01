import { Data } from "../data";
import { Type } from "../enum";
import { Visitor } from "../visitor";
import { VectorType } from "../interfaces";
import {
  DataType,
  Dictionary,
  Bool,
  Null,
  Utf8,
  Binary,
  Decimal,
  FixedSizeBinary,
  List,
  FixedSizeList,
  Map_,
  Struct,
  Float,
  Float16,
  Float32,
  Float64,
  Int,
  Uint8,
  Uint16,
  Uint32,
  Uint64,
  Int8,
  Int16,
  Int32,
  Int64,
  Date_,
  DateDay,
  DateMillisecond,
  Interval,
  IntervalDayTime,
  IntervalYearMonth,
  Time,
  TimeSecond,
  TimeMillisecond,
  TimeMicrosecond,
  TimeNanosecond,
  Timestamp,
  TimestampSecond,
  TimestampMillisecond,
  TimestampMicrosecond,
  TimestampNanosecond,
  Union,
  DenseUnion,
  SparseUnion
} from "../type";
/** @ignore */
export interface IndexOfVisitor extends Visitor {
  visit<T extends VectorType>(
    node: T,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitMany<T extends VectorType>(
    nodes: T[],
    values: (T["TValue"] | null)[],
    indices: (number | undefined)[]
  ): number[];
  getVisitFn<T extends Type>(
    node: T
  ): (
    vector: VectorType<T>,
    value: VectorType<T>["TValue"] | null,
    index?: number
  ) => number;
  getVisitFn<T extends DataType>(
    node: VectorType<T> | Data<T> | T
  ): (
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ) => number;
  visitNull<T extends Null>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitBool<T extends Bool>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitInt<T extends Int>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitInt8<T extends Int8>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitInt16<T extends Int16>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitInt32<T extends Int32>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitInt64<T extends Int64>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitUint8<T extends Uint8>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitUint16<T extends Uint16>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitUint32<T extends Uint32>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitUint64<T extends Uint64>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitFloat<T extends Float>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitFloat16<T extends Float16>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitFloat32<T extends Float32>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitFloat64<T extends Float64>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitUtf8<T extends Utf8>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitBinary<T extends Binary>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitFixedSizeBinary<T extends FixedSizeBinary>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitDate<T extends Date_>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitDateDay<T extends DateDay>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitDateMillisecond<T extends DateMillisecond>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitTimestamp<T extends Timestamp>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitTimestampSecond<T extends TimestampSecond>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitTimestampMillisecond<T extends TimestampMillisecond>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitTimestampMicrosecond<T extends TimestampMicrosecond>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitTimestampNanosecond<T extends TimestampNanosecond>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitTime<T extends Time>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitTimeSecond<T extends TimeSecond>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitTimeMillisecond<T extends TimeMillisecond>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitTimeMicrosecond<T extends TimeMicrosecond>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitTimeNanosecond<T extends TimeNanosecond>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitDecimal<T extends Decimal>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitList<T extends List>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitStruct<T extends Struct>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitUnion<T extends Union>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitDenseUnion<T extends DenseUnion>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitSparseUnion<T extends SparseUnion>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitDictionary<T extends Dictionary>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitInterval<T extends Interval>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitIntervalDayTime<T extends IntervalDayTime>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitIntervalYearMonth<T extends IntervalYearMonth>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitFixedSizeList<T extends FixedSizeList>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
  visitMap<T extends Map_>(
    vector: VectorType<T>,
    value: T["TValue"] | null,
    index?: number
  ): number;
}
/** @ignore */
export declare class IndexOfVisitor extends Visitor {}
/** @ignore */
export declare const instance: IndexOfVisitor;
