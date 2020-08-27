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
export interface IteratorVisitor extends Visitor {
  visit<T extends VectorType>(node: T): IterableIterator<T["TValue"] | null>;
  visitMany<T extends VectorType>(
    nodes: T[]
  ): IterableIterator<T["TValue"] | null>[];
  getVisitFn<T extends Type>(
    node: T
  ): (
    vector: VectorType<T>
  ) => IterableIterator<VectorType<T>["TValue"] | null>;
  getVisitFn<T extends DataType>(
    node: VectorType<T> | Data<T> | T
  ): (
    vector: VectorType<T>
  ) => IterableIterator<VectorType<T>["TValue"] | null>;
  visitNull<T extends Null>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitBool<T extends Bool>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitInt<T extends Int>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitInt8<T extends Int8>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitInt16<T extends Int16>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitInt32<T extends Int32>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitInt64<T extends Int64>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitUint8<T extends Uint8>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitUint16<T extends Uint16>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitUint32<T extends Uint32>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitUint64<T extends Uint64>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitFloat<T extends Float>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitFloat16<T extends Float16>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitFloat32<T extends Float32>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitFloat64<T extends Float64>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitUtf8<T extends Utf8>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitBinary<T extends Binary>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitFixedSizeBinary<T extends FixedSizeBinary>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitDate<T extends Date_>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitDateDay<T extends DateDay>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitDateMillisecond<T extends DateMillisecond>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitTimestamp<T extends Timestamp>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitTimestampSecond<T extends TimestampSecond>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitTimestampMillisecond<T extends TimestampMillisecond>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitTimestampMicrosecond<T extends TimestampMicrosecond>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitTimestampNanosecond<T extends TimestampNanosecond>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitTime<T extends Time>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitTimeSecond<T extends TimeSecond>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitTimeMillisecond<T extends TimeMillisecond>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitTimeMicrosecond<T extends TimeMicrosecond>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitTimeNanosecond<T extends TimeNanosecond>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitDecimal<T extends Decimal>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitList<T extends List>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitStruct<T extends Struct>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitUnion<T extends Union>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitDenseUnion<T extends DenseUnion>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitSparseUnion<T extends SparseUnion>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitDictionary<T extends Dictionary>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitInterval<T extends Interval>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitIntervalDayTime<T extends IntervalDayTime>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitIntervalYearMonth<T extends IntervalYearMonth>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitFixedSizeList<T extends FixedSizeList>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
  visitMap<T extends Map_>(
    vector: VectorType<T>
  ): IterableIterator<T["TValue"] | null>;
}
/** @ignore */
export declare class IteratorVisitor extends Visitor {}
/** @ignore */
export declare const instance: IteratorVisitor;
