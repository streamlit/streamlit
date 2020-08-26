// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.
import { Visitor } from "../visitor"
import { BinaryBuilder } from "../builder/binary"
import { BoolBuilder } from "../builder/bool"
import {
  DateBuilder,
  DateDayBuilder,
  DateMillisecondBuilder,
} from "../builder/date"
import { DecimalBuilder } from "../builder/decimal"
import { DictionaryBuilder } from "../builder/dictionary"
import { FixedSizeBinaryBuilder } from "../builder/fixedsizebinary"
import { FixedSizeListBuilder } from "../builder/fixedsizelist"
import {
  FloatBuilder,
  Float16Builder,
  Float32Builder,
  Float64Builder,
} from "../builder/float"
import {
  IntervalBuilder,
  IntervalDayTimeBuilder,
  IntervalYearMonthBuilder,
} from "../builder/interval"
import {
  IntBuilder,
  Int8Builder,
  Int16Builder,
  Int32Builder,
  Int64Builder,
  Uint8Builder,
  Uint16Builder,
  Uint32Builder,
  Uint64Builder,
} from "../builder/int"
import { ListBuilder } from "../builder/list"
import { MapBuilder } from "../builder/map"
import { NullBuilder } from "../builder/null"
import { StructBuilder } from "../builder/struct"
import {
  TimestampBuilder,
  TimestampSecondBuilder,
  TimestampMillisecondBuilder,
  TimestampMicrosecondBuilder,
  TimestampNanosecondBuilder,
} from "../builder/timestamp"
import {
  TimeBuilder,
  TimeSecondBuilder,
  TimeMillisecondBuilder,
  TimeMicrosecondBuilder,
  TimeNanosecondBuilder,
} from "../builder/time"
import {
  UnionBuilder,
  DenseUnionBuilder,
  SparseUnionBuilder,
} from "../builder/union"
import { Utf8Builder } from "../builder/utf8"
/** @ignore */
export class GetBuilderCtor extends Visitor {
  visitNull() {
    return NullBuilder
  }
  visitBool() {
    return BoolBuilder
  }
  visitInt() {
    return IntBuilder
  }
  visitInt8() {
    return Int8Builder
  }
  visitInt16() {
    return Int16Builder
  }
  visitInt32() {
    return Int32Builder
  }
  visitInt64() {
    return Int64Builder
  }
  visitUint8() {
    return Uint8Builder
  }
  visitUint16() {
    return Uint16Builder
  }
  visitUint32() {
    return Uint32Builder
  }
  visitUint64() {
    return Uint64Builder
  }
  visitFloat() {
    return FloatBuilder
  }
  visitFloat16() {
    return Float16Builder
  }
  visitFloat32() {
    return Float32Builder
  }
  visitFloat64() {
    return Float64Builder
  }
  visitUtf8() {
    return Utf8Builder
  }
  visitBinary() {
    return BinaryBuilder
  }
  visitFixedSizeBinary() {
    return FixedSizeBinaryBuilder
  }
  visitDate() {
    return DateBuilder
  }
  visitDateDay() {
    return DateDayBuilder
  }
  visitDateMillisecond() {
    return DateMillisecondBuilder
  }
  visitTimestamp() {
    return TimestampBuilder
  }
  visitTimestampSecond() {
    return TimestampSecondBuilder
  }
  visitTimestampMillisecond() {
    return TimestampMillisecondBuilder
  }
  visitTimestampMicrosecond() {
    return TimestampMicrosecondBuilder
  }
  visitTimestampNanosecond() {
    return TimestampNanosecondBuilder
  }
  visitTime() {
    return TimeBuilder
  }
  visitTimeSecond() {
    return TimeSecondBuilder
  }
  visitTimeMillisecond() {
    return TimeMillisecondBuilder
  }
  visitTimeMicrosecond() {
    return TimeMicrosecondBuilder
  }
  visitTimeNanosecond() {
    return TimeNanosecondBuilder
  }
  visitDecimal() {
    return DecimalBuilder
  }
  visitList() {
    return ListBuilder
  }
  visitStruct() {
    return StructBuilder
  }
  visitUnion() {
    return UnionBuilder
  }
  visitDenseUnion() {
    return DenseUnionBuilder
  }
  visitSparseUnion() {
    return SparseUnionBuilder
  }
  visitDictionary() {
    return DictionaryBuilder
  }
  visitInterval() {
    return IntervalBuilder
  }
  visitIntervalDayTime() {
    return IntervalDayTimeBuilder
  }
  visitIntervalYearMonth() {
    return IntervalYearMonthBuilder
  }
  visitFixedSizeList() {
    return FixedSizeListBuilder
  }
  visitMap() {
    return MapBuilder
  }
}
/** @ignore */
export const instance = new GetBuilderCtor()

//# sourceMappingURL=builderctor.mjs.map
