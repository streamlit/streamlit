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
export interface ToArrayVisitor extends Visitor {
  visit<T extends VectorType>(node: T): T["TArray"];
  visitMany<T extends VectorType>(nodes: T[]): T["TArray"][];
  getVisitFn<T extends Type>(
    node: T
  ): (vector: VectorType<T>) => VectorType<T>["TArray"];
  getVisitFn<T extends DataType>(
    node: VectorType<T> | Data<T> | T
  ): (vector: VectorType<T>) => VectorType<T>["TArray"];
  visitNull<T extends Null>(vector: VectorType<T>): VectorType<T>["TArray"];
  visitBool<T extends Bool>(vector: VectorType<T>): VectorType<T>["TArray"];
  visitInt<T extends Int>(vector: VectorType<T>): VectorType<T>["TArray"];
  visitInt8<T extends Int8>(vector: VectorType<T>): VectorType<T>["TArray"];
  visitInt16<T extends Int16>(vector: VectorType<T>): VectorType<T>["TArray"];
  visitInt32<T extends Int32>(vector: VectorType<T>): VectorType<T>["TArray"];
  visitInt64<T extends Int64>(vector: VectorType<T>): VectorType<T>["TArray"];
  visitUint8<T extends Uint8>(vector: VectorType<T>): VectorType<T>["TArray"];
  visitUint16<T extends Uint16>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitUint32<T extends Uint32>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitUint64<T extends Uint64>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitFloat<T extends Float>(vector: VectorType<T>): VectorType<T>["TArray"];
  visitFloat16<T extends Float16>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitFloat32<T extends Float32>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitFloat64<T extends Float64>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitUtf8<T extends Utf8>(vector: VectorType<T>): VectorType<T>["TArray"];
  visitBinary<T extends Binary>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitFixedSizeBinary<T extends FixedSizeBinary>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitDate<T extends Date_>(vector: VectorType<T>): VectorType<T>["TArray"];
  visitDateDay<T extends DateDay>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitDateMillisecond<T extends DateMillisecond>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitTimestamp<T extends Timestamp>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitTimestampSecond<T extends TimestampSecond>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitTimestampMillisecond<T extends TimestampMillisecond>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitTimestampMicrosecond<T extends TimestampMicrosecond>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitTimestampNanosecond<T extends TimestampNanosecond>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitTime<T extends Time>(vector: VectorType<T>): VectorType<T>["TArray"];
  visitTimeSecond<T extends TimeSecond>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitTimeMillisecond<T extends TimeMillisecond>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitTimeMicrosecond<T extends TimeMicrosecond>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitTimeNanosecond<T extends TimeNanosecond>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitDecimal<T extends Decimal>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitList<R extends DataType, T extends List<R>>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitStruct<T extends Struct>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitUnion<T extends Union>(vector: VectorType<T>): VectorType<T>["TArray"];
  visitDenseUnion<T extends DenseUnion>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitSparseUnion<T extends SparseUnion>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitDictionary<R extends DataType, T extends Dictionary<R>>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitInterval<T extends Interval>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitIntervalDayTime<T extends IntervalDayTime>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitIntervalYearMonth<T extends IntervalYearMonth>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitFixedSizeList<R extends DataType, T extends FixedSizeList<R>>(
    vector: VectorType<T>
  ): VectorType<T>["TArray"];
  visitMap<T extends Map_>(vector: VectorType<T>): VectorType<T>["TArray"];
}
/** @ignore */
export declare class ToArrayVisitor extends Visitor {}
/** @ignore */
export declare const instance: ToArrayVisitor;
