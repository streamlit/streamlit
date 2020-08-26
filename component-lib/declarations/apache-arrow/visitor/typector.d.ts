import { Data } from "../data";
import { Type } from "../enum";
import * as type from "../type";
import { DataType } from "../type";
import { Visitor } from "../visitor";
import { VectorType } from "../interfaces";
import { DataTypeCtor } from "../interfaces";
/** @ignore */
export interface GetDataTypeConstructor extends Visitor {
  visit<T extends Type>(node: T): DataTypeCtor<T>;
  visitMany<T extends Type>(nodes: T[]): DataTypeCtor<T>[];
  getVisitFn<T extends Type>(node: T): () => DataTypeCtor<T>;
  getVisitFn<T extends DataType>(
    node: VectorType<T> | Data<T> | T
  ): () => DataTypeCtor<T>;
}
/** @ignore */
export declare class GetDataTypeConstructor extends Visitor {
  visitNull(): typeof type.Null;
  visitBool(): typeof type.Bool;
  visitInt(): typeof type.Int;
  visitInt8(): typeof type.Int8;
  visitInt16(): typeof type.Int16;
  visitInt32(): typeof type.Int32;
  visitInt64(): typeof type.Int64;
  visitUint8(): typeof type.Uint8;
  visitUint16(): typeof type.Uint16;
  visitUint32(): typeof type.Uint32;
  visitUint64(): typeof type.Uint64;
  visitFloat(): typeof type.Float;
  visitFloat16(): typeof type.Float16;
  visitFloat32(): typeof type.Float32;
  visitFloat64(): typeof type.Float64;
  visitUtf8(): typeof type.Utf8;
  visitBinary(): typeof type.Binary;
  visitFixedSizeBinary(): typeof type.FixedSizeBinary;
  visitDate(): typeof type.Date_;
  visitDateDay(): typeof type.DateDay;
  visitDateMillisecond(): typeof type.DateMillisecond;
  visitTimestamp(): typeof type.Timestamp;
  visitTimestampSecond(): typeof type.TimestampSecond;
  visitTimestampMillisecond(): typeof type.TimestampMillisecond;
  visitTimestampMicrosecond(): typeof type.TimestampMicrosecond;
  visitTimestampNanosecond(): typeof type.TimestampNanosecond;
  visitTime(): typeof type.Time;
  visitTimeSecond(): typeof type.TimeSecond;
  visitTimeMillisecond(): typeof type.TimeMillisecond;
  visitTimeMicrosecond(): typeof type.TimeMicrosecond;
  visitTimeNanosecond(): typeof type.TimeNanosecond;
  visitDecimal(): typeof type.Decimal;
  visitList(): typeof type.List;
  visitStruct(): typeof type.Struct;
  visitUnion(): typeof type.Union;
  visitDenseUnion(): typeof type.DenseUnion;
  visitSparseUnion(): typeof type.SparseUnion;
  visitDictionary(): typeof type.Dictionary;
  visitInterval(): typeof type.Interval;
  visitIntervalDayTime(): typeof type.IntervalDayTime;
  visitIntervalYearMonth(): typeof type.IntervalYearMonth;
  visitFixedSizeList(): typeof type.FixedSizeList;
  visitMap(): typeof type.Map_;
}
/** @ignore */
export declare const instance: GetDataTypeConstructor;
