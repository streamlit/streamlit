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
import * as type from "../type"
import { Visitor } from "../visitor"
/** @ignore */
export class GetDataTypeConstructor extends Visitor {
  visitNull() {
    return type.Null
  }
  visitBool() {
    return type.Bool
  }
  visitInt() {
    return type.Int
  }
  visitInt8() {
    return type.Int8
  }
  visitInt16() {
    return type.Int16
  }
  visitInt32() {
    return type.Int32
  }
  visitInt64() {
    return type.Int64
  }
  visitUint8() {
    return type.Uint8
  }
  visitUint16() {
    return type.Uint16
  }
  visitUint32() {
    return type.Uint32
  }
  visitUint64() {
    return type.Uint64
  }
  visitFloat() {
    return type.Float
  }
  visitFloat16() {
    return type.Float16
  }
  visitFloat32() {
    return type.Float32
  }
  visitFloat64() {
    return type.Float64
  }
  visitUtf8() {
    return type.Utf8
  }
  visitBinary() {
    return type.Binary
  }
  visitFixedSizeBinary() {
    return type.FixedSizeBinary
  }
  visitDate() {
    return type.Date_
  }
  visitDateDay() {
    return type.DateDay
  }
  visitDateMillisecond() {
    return type.DateMillisecond
  }
  visitTimestamp() {
    return type.Timestamp
  }
  visitTimestampSecond() {
    return type.TimestampSecond
  }
  visitTimestampMillisecond() {
    return type.TimestampMillisecond
  }
  visitTimestampMicrosecond() {
    return type.TimestampMicrosecond
  }
  visitTimestampNanosecond() {
    return type.TimestampNanosecond
  }
  visitTime() {
    return type.Time
  }
  visitTimeSecond() {
    return type.TimeSecond
  }
  visitTimeMillisecond() {
    return type.TimeMillisecond
  }
  visitTimeMicrosecond() {
    return type.TimeMicrosecond
  }
  visitTimeNanosecond() {
    return type.TimeNanosecond
  }
  visitDecimal() {
    return type.Decimal
  }
  visitList() {
    return type.List
  }
  visitStruct() {
    return type.Struct
  }
  visitUnion() {
    return type.Union
  }
  visitDenseUnion() {
    return type.DenseUnion
  }
  visitSparseUnion() {
    return type.SparseUnion
  }
  visitDictionary() {
    return type.Dictionary
  }
  visitInterval() {
    return type.Interval
  }
  visitIntervalDayTime() {
    return type.IntervalDayTime
  }
  visitIntervalYearMonth() {
    return type.IntervalYearMonth
  }
  visitFixedSizeList() {
    return type.FixedSizeList
  }
  visitMap() {
    return type.Map_
  }
}
/** @ignore */
export const instance = new GetDataTypeConstructor()

//# sourceMappingURL=typector.mjs.map
