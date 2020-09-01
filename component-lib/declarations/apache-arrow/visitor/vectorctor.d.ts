import { Data } from "../data";
import { Type } from "../enum";
import { DataType } from "../type";
import { Visitor } from "../visitor";
import { VectorType, VectorCtor } from "../interfaces";
import { BinaryVector } from "../vector/binary";
import { BoolVector } from "../vector/bool";
import {
  DateVector,
  DateDayVector,
  DateMillisecondVector
} from "../vector/date";
import { DecimalVector } from "../vector/decimal";
import { DictionaryVector } from "../vector/dictionary";
import { FixedSizeBinaryVector } from "../vector/fixedsizebinary";
import { FixedSizeListVector } from "../vector/fixedsizelist";
import {
  FloatVector,
  Float16Vector,
  Float32Vector,
  Float64Vector
} from "../vector/float";
import {
  IntervalVector,
  IntervalDayTimeVector,
  IntervalYearMonthVector
} from "../vector/interval";
import {
  IntVector,
  Int8Vector,
  Int16Vector,
  Int32Vector,
  Int64Vector,
  Uint8Vector,
  Uint16Vector,
  Uint32Vector,
  Uint64Vector
} from "../vector/int";
import { ListVector } from "../vector/list";
import { MapVector } from "../vector/map";
import { NullVector } from "../vector/null";
import { StructVector } from "../vector/struct";
import {
  TimestampVector,
  TimestampSecondVector,
  TimestampMillisecondVector,
  TimestampMicrosecondVector,
  TimestampNanosecondVector
} from "../vector/timestamp";
import {
  TimeVector,
  TimeSecondVector,
  TimeMillisecondVector,
  TimeMicrosecondVector,
  TimeNanosecondVector
} from "../vector/time";
import {
  UnionVector,
  DenseUnionVector,
  SparseUnionVector
} from "../vector/union";
import { Utf8Vector } from "../vector/utf8";
/** @ignore */
export interface GetVectorConstructor extends Visitor {
  visit<T extends Type>(node: T): VectorCtor<T>;
  visitMany<T extends Type>(nodes: T[]): VectorCtor<T>[];
  getVisitFn<T extends Type>(node: T): () => VectorCtor<T>;
  getVisitFn<T extends DataType>(
    node: VectorType<T> | Data<T> | T
  ): () => VectorCtor<T>;
}
/** @ignore */
export declare class GetVectorConstructor extends Visitor {
  visitNull(): typeof NullVector;
  visitBool(): typeof BoolVector;
  visitInt(): typeof IntVector;
  visitInt8(): typeof Int8Vector;
  visitInt16(): typeof Int16Vector;
  visitInt32(): typeof Int32Vector;
  visitInt64(): typeof Int64Vector;
  visitUint8(): typeof Uint8Vector;
  visitUint16(): typeof Uint16Vector;
  visitUint32(): typeof Uint32Vector;
  visitUint64(): typeof Uint64Vector;
  visitFloat(): typeof FloatVector;
  visitFloat16(): typeof Float16Vector;
  visitFloat32(): typeof Float32Vector;
  visitFloat64(): typeof Float64Vector;
  visitUtf8(): typeof Utf8Vector;
  visitBinary(): typeof BinaryVector;
  visitFixedSizeBinary(): typeof FixedSizeBinaryVector;
  visitDate(): typeof DateVector;
  visitDateDay(): typeof DateDayVector;
  visitDateMillisecond(): typeof DateMillisecondVector;
  visitTimestamp(): typeof TimestampVector;
  visitTimestampSecond(): typeof TimestampSecondVector;
  visitTimestampMillisecond(): typeof TimestampMillisecondVector;
  visitTimestampMicrosecond(): typeof TimestampMicrosecondVector;
  visitTimestampNanosecond(): typeof TimestampNanosecondVector;
  visitTime(): typeof TimeVector;
  visitTimeSecond(): typeof TimeSecondVector;
  visitTimeMillisecond(): typeof TimeMillisecondVector;
  visitTimeMicrosecond(): typeof TimeMicrosecondVector;
  visitTimeNanosecond(): typeof TimeNanosecondVector;
  visitDecimal(): typeof DecimalVector;
  visitList(): typeof ListVector;
  visitStruct(): typeof StructVector;
  visitUnion(): typeof UnionVector;
  visitDenseUnion(): typeof DenseUnionVector;
  visitSparseUnion(): typeof SparseUnionVector;
  visitDictionary(): typeof DictionaryVector;
  visitInterval(): typeof IntervalVector;
  visitIntervalDayTime(): typeof IntervalDayTimeVector;
  visitIntervalYearMonth(): typeof IntervalYearMonthVector;
  visitFixedSizeList(): typeof FixedSizeListVector;
  visitMap(): typeof MapVector;
}
/** @ignore */
export declare const instance: GetVectorConstructor;
