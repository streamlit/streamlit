import { Data } from "../data";
import { Visitor } from "../visitor";
import { VectorType } from "../interfaces";
import { Schema, Field } from "../schema";
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
export interface TypeComparator extends Visitor {
  visit<T extends DataType>(type: T, other?: DataType | null): other is T;
  visitMany<T extends DataType>(
    nodes: T[],
    others?: DataType[] | null
  ): boolean[];
  getVisitFn<T extends DataType>(
    node: VectorType<T> | Data<T> | T
  ): (other?: DataType | null) => other is T;
  visitNull<T extends Null>(type: T, other?: DataType | null): other is T;
  visitBool<T extends Bool>(type: T, other?: DataType | null): other is T;
  visitInt<T extends Int>(type: T, other?: DataType | null): other is T;
  visitInt8<T extends Int8>(type: T, other?: DataType | null): other is T;
  visitInt16<T extends Int16>(type: T, other?: DataType | null): other is T;
  visitInt32<T extends Int32>(type: T, other?: DataType | null): other is T;
  visitInt64<T extends Int64>(type: T, other?: DataType | null): other is T;
  visitUint8<T extends Uint8>(type: T, other?: DataType | null): other is T;
  visitUint16<T extends Uint16>(type: T, other?: DataType | null): other is T;
  visitUint32<T extends Uint32>(type: T, other?: DataType | null): other is T;
  visitUint64<T extends Uint64>(type: T, other?: DataType | null): other is T;
  visitFloat<T extends Float>(type: T, other?: DataType | null): other is T;
  visitFloat16<T extends Float16>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitFloat32<T extends Float32>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitFloat64<T extends Float64>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitUtf8<T extends Utf8>(type: T, other?: DataType | null): other is T;
  visitBinary<T extends Binary>(type: T, other?: DataType | null): other is T;
  visitFixedSizeBinary<T extends FixedSizeBinary>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitDate<T extends Date_>(type: T, other?: DataType | null): other is T;
  visitDateDay<T extends DateDay>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitDateMillisecond<T extends DateMillisecond>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitTimestamp<T extends Timestamp>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitTimestampSecond<T extends TimestampSecond>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitTimestampMillisecond<T extends TimestampMillisecond>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitTimestampMicrosecond<T extends TimestampMicrosecond>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitTimestampNanosecond<T extends TimestampNanosecond>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitTime<T extends Time>(type: T, other?: DataType | null): other is T;
  visitTimeSecond<T extends TimeSecond>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitTimeMillisecond<T extends TimeMillisecond>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitTimeMicrosecond<T extends TimeMicrosecond>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitTimeNanosecond<T extends TimeNanosecond>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitDecimal<T extends Decimal>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitList<T extends List>(type: T, other?: DataType | null): other is T;
  visitStruct<T extends Struct>(type: T, other?: DataType | null): other is T;
  visitUnion<T extends Union>(type: T, other?: DataType | null): other is T;
  visitDenseUnion<T extends DenseUnion>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitSparseUnion<T extends SparseUnion>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitDictionary<T extends Dictionary>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitInterval<T extends Interval>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitIntervalDayTime<T extends IntervalDayTime>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitIntervalYearMonth<T extends IntervalYearMonth>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitFixedSizeList<T extends FixedSizeList>(
    type: T,
    other?: DataType | null
  ): other is T;
  visitMap<T extends Map_>(type: T, other?: DataType | null): other is T;
}
/** @ignore */
export declare class TypeComparator extends Visitor {
  compareSchemas<
    T extends {
      [key: string]: DataType;
    }
  >(schema: Schema<T>, other?: Schema | null): other is Schema<T>;
  compareFields<
    T extends {
      [key: string]: DataType;
    }
  >(
    fields: Field<T[keyof T]>[],
    others?: Field[] | null
  ): others is Field<T[keyof T]>[];
  compareField<T extends DataType = any>(
    field: Field<T>,
    other?: Field | null
  ): other is Field<T>;
}
/** @ignore */
export declare const instance: TypeComparator;
