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
import { Visitor } from "../visitor";
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
export class GetVectorConstructor extends Visitor {
  visitNull() {
    return NullVector;
  }
  visitBool() {
    return BoolVector;
  }
  visitInt() {
    return IntVector;
  }
  visitInt8() {
    return Int8Vector;
  }
  visitInt16() {
    return Int16Vector;
  }
  visitInt32() {
    return Int32Vector;
  }
  visitInt64() {
    return Int64Vector;
  }
  visitUint8() {
    return Uint8Vector;
  }
  visitUint16() {
    return Uint16Vector;
  }
  visitUint32() {
    return Uint32Vector;
  }
  visitUint64() {
    return Uint64Vector;
  }
  visitFloat() {
    return FloatVector;
  }
  visitFloat16() {
    return Float16Vector;
  }
  visitFloat32() {
    return Float32Vector;
  }
  visitFloat64() {
    return Float64Vector;
  }
  visitUtf8() {
    return Utf8Vector;
  }
  visitBinary() {
    return BinaryVector;
  }
  visitFixedSizeBinary() {
    return FixedSizeBinaryVector;
  }
  visitDate() {
    return DateVector;
  }
  visitDateDay() {
    return DateDayVector;
  }
  visitDateMillisecond() {
    return DateMillisecondVector;
  }
  visitTimestamp() {
    return TimestampVector;
  }
  visitTimestampSecond() {
    return TimestampSecondVector;
  }
  visitTimestampMillisecond() {
    return TimestampMillisecondVector;
  }
  visitTimestampMicrosecond() {
    return TimestampMicrosecondVector;
  }
  visitTimestampNanosecond() {
    return TimestampNanosecondVector;
  }
  visitTime() {
    return TimeVector;
  }
  visitTimeSecond() {
    return TimeSecondVector;
  }
  visitTimeMillisecond() {
    return TimeMillisecondVector;
  }
  visitTimeMicrosecond() {
    return TimeMicrosecondVector;
  }
  visitTimeNanosecond() {
    return TimeNanosecondVector;
  }
  visitDecimal() {
    return DecimalVector;
  }
  visitList() {
    return ListVector;
  }
  visitStruct() {
    return StructVector;
  }
  visitUnion() {
    return UnionVector;
  }
  visitDenseUnion() {
    return DenseUnionVector;
  }
  visitSparseUnion() {
    return SparseUnionVector;
  }
  visitDictionary() {
    return DictionaryVector;
  }
  visitInterval() {
    return IntervalVector;
  }
  visitIntervalDayTime() {
    return IntervalDayTimeVector;
  }
  visitIntervalYearMonth() {
    return IntervalYearMonthVector;
  }
  visitFixedSizeList() {
    return FixedSizeListVector;
  }
  visitMap() {
    return MapVector;
  }
}
/** @ignore */
export const instance = new GetVectorConstructor();

//# sourceMappingURL=vectorctor.mjs.map
