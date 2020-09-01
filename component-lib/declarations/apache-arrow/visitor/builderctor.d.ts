import { Data } from "../data";
import { Type } from "../enum";
import { DataType } from "../type";
import { Visitor } from "../visitor";
import { VectorType, BuilderCtor } from "../interfaces";
import { BinaryBuilder } from "../builder/binary";
import { BoolBuilder } from "../builder/bool";
import {
  DateBuilder,
  DateDayBuilder,
  DateMillisecondBuilder
} from "../builder/date";
import { DecimalBuilder } from "../builder/decimal";
import { DictionaryBuilder } from "../builder/dictionary";
import { FixedSizeBinaryBuilder } from "../builder/fixedsizebinary";
import { FixedSizeListBuilder } from "../builder/fixedsizelist";
import {
  FloatBuilder,
  Float16Builder,
  Float32Builder,
  Float64Builder
} from "../builder/float";
import {
  IntervalBuilder,
  IntervalDayTimeBuilder,
  IntervalYearMonthBuilder
} from "../builder/interval";
import {
  IntBuilder,
  Int8Builder,
  Int16Builder,
  Int32Builder,
  Int64Builder,
  Uint8Builder,
  Uint16Builder,
  Uint32Builder,
  Uint64Builder
} from "../builder/int";
import { ListBuilder } from "../builder/list";
import { MapBuilder } from "../builder/map";
import { NullBuilder } from "../builder/null";
import { StructBuilder } from "../builder/struct";
import {
  TimestampBuilder,
  TimestampSecondBuilder,
  TimestampMillisecondBuilder,
  TimestampMicrosecondBuilder,
  TimestampNanosecondBuilder
} from "../builder/timestamp";
import {
  TimeBuilder,
  TimeSecondBuilder,
  TimeMillisecondBuilder,
  TimeMicrosecondBuilder,
  TimeNanosecondBuilder
} from "../builder/time";
import {
  UnionBuilder,
  DenseUnionBuilder,
  SparseUnionBuilder
} from "../builder/union";
import { Utf8Builder } from "../builder/utf8";
/** @ignore */
export interface GetBuilderCtor extends Visitor {
  visit<T extends Type>(type: T): BuilderCtor<T>;
  visitMany<T extends Type>(types: T[]): BuilderCtor<T>[];
  getVisitFn<T extends Type>(type: T): () => BuilderCtor<T>;
  getVisitFn<T extends DataType>(
    node: VectorType<T> | Data<T> | T
  ): () => BuilderCtor<T>;
}
/** @ignore */
export declare class GetBuilderCtor extends Visitor {
  visitNull(): typeof NullBuilder;
  visitBool(): typeof BoolBuilder;
  visitInt(): typeof IntBuilder;
  visitInt8(): typeof Int8Builder;
  visitInt16(): typeof Int16Builder;
  visitInt32(): typeof Int32Builder;
  visitInt64(): typeof Int64Builder;
  visitUint8(): typeof Uint8Builder;
  visitUint16(): typeof Uint16Builder;
  visitUint32(): typeof Uint32Builder;
  visitUint64(): typeof Uint64Builder;
  visitFloat(): typeof FloatBuilder;
  visitFloat16(): typeof Float16Builder;
  visitFloat32(): typeof Float32Builder;
  visitFloat64(): typeof Float64Builder;
  visitUtf8(): typeof Utf8Builder;
  visitBinary(): typeof BinaryBuilder;
  visitFixedSizeBinary(): typeof FixedSizeBinaryBuilder;
  visitDate(): typeof DateBuilder;
  visitDateDay(): typeof DateDayBuilder;
  visitDateMillisecond(): typeof DateMillisecondBuilder;
  visitTimestamp(): typeof TimestampBuilder;
  visitTimestampSecond(): typeof TimestampSecondBuilder;
  visitTimestampMillisecond(): typeof TimestampMillisecondBuilder;
  visitTimestampMicrosecond(): typeof TimestampMicrosecondBuilder;
  visitTimestampNanosecond(): typeof TimestampNanosecondBuilder;
  visitTime(): typeof TimeBuilder;
  visitTimeSecond(): typeof TimeSecondBuilder;
  visitTimeMillisecond(): typeof TimeMillisecondBuilder;
  visitTimeMicrosecond(): typeof TimeMicrosecondBuilder;
  visitTimeNanosecond(): typeof TimeNanosecondBuilder;
  visitDecimal(): typeof DecimalBuilder;
  visitList(): typeof ListBuilder;
  visitStruct(): typeof StructBuilder;
  visitUnion(): typeof UnionBuilder;
  visitDenseUnion(): typeof DenseUnionBuilder;
  visitSparseUnion(): typeof SparseUnionBuilder;
  visitDictionary(): typeof DictionaryBuilder;
  visitInterval(): typeof IntervalBuilder;
  visitIntervalDayTime(): typeof IntervalDayTimeBuilder;
  visitIntervalYearMonth(): typeof IntervalYearMonthBuilder;
  visitFixedSizeList(): typeof FixedSizeListBuilder;
  visitMap(): typeof MapBuilder;
}
/** @ignore */
export declare const instance: GetBuilderCtor;
