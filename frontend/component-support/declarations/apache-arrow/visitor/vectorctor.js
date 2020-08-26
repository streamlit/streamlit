"use strict"
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
Object.defineProperty(exports, "__esModule", { value: true })
const visitor_1 = require("../visitor")
const binary_1 = require("../vector/binary")
const bool_1 = require("../vector/bool")
const date_1 = require("../vector/date")
const decimal_1 = require("../vector/decimal")
const dictionary_1 = require("../vector/dictionary")
const fixedsizebinary_1 = require("../vector/fixedsizebinary")
const fixedsizelist_1 = require("../vector/fixedsizelist")
const float_1 = require("../vector/float")
const interval_1 = require("../vector/interval")
const int_1 = require("../vector/int")
const list_1 = require("../vector/list")
const map_1 = require("../vector/map")
const null_1 = require("../vector/null")
const struct_1 = require("../vector/struct")
const timestamp_1 = require("../vector/timestamp")
const time_1 = require("../vector/time")
const union_1 = require("../vector/union")
const utf8_1 = require("../vector/utf8")
/** @ignore */
class GetVectorConstructor extends visitor_1.Visitor {
  visitNull() {
    return null_1.NullVector
  }
  visitBool() {
    return bool_1.BoolVector
  }
  visitInt() {
    return int_1.IntVector
  }
  visitInt8() {
    return int_1.Int8Vector
  }
  visitInt16() {
    return int_1.Int16Vector
  }
  visitInt32() {
    return int_1.Int32Vector
  }
  visitInt64() {
    return int_1.Int64Vector
  }
  visitUint8() {
    return int_1.Uint8Vector
  }
  visitUint16() {
    return int_1.Uint16Vector
  }
  visitUint32() {
    return int_1.Uint32Vector
  }
  visitUint64() {
    return int_1.Uint64Vector
  }
  visitFloat() {
    return float_1.FloatVector
  }
  visitFloat16() {
    return float_1.Float16Vector
  }
  visitFloat32() {
    return float_1.Float32Vector
  }
  visitFloat64() {
    return float_1.Float64Vector
  }
  visitUtf8() {
    return utf8_1.Utf8Vector
  }
  visitBinary() {
    return binary_1.BinaryVector
  }
  visitFixedSizeBinary() {
    return fixedsizebinary_1.FixedSizeBinaryVector
  }
  visitDate() {
    return date_1.DateVector
  }
  visitDateDay() {
    return date_1.DateDayVector
  }
  visitDateMillisecond() {
    return date_1.DateMillisecondVector
  }
  visitTimestamp() {
    return timestamp_1.TimestampVector
  }
  visitTimestampSecond() {
    return timestamp_1.TimestampSecondVector
  }
  visitTimestampMillisecond() {
    return timestamp_1.TimestampMillisecondVector
  }
  visitTimestampMicrosecond() {
    return timestamp_1.TimestampMicrosecondVector
  }
  visitTimestampNanosecond() {
    return timestamp_1.TimestampNanosecondVector
  }
  visitTime() {
    return time_1.TimeVector
  }
  visitTimeSecond() {
    return time_1.TimeSecondVector
  }
  visitTimeMillisecond() {
    return time_1.TimeMillisecondVector
  }
  visitTimeMicrosecond() {
    return time_1.TimeMicrosecondVector
  }
  visitTimeNanosecond() {
    return time_1.TimeNanosecondVector
  }
  visitDecimal() {
    return decimal_1.DecimalVector
  }
  visitList() {
    return list_1.ListVector
  }
  visitStruct() {
    return struct_1.StructVector
  }
  visitUnion() {
    return union_1.UnionVector
  }
  visitDenseUnion() {
    return union_1.DenseUnionVector
  }
  visitSparseUnion() {
    return union_1.SparseUnionVector
  }
  visitDictionary() {
    return dictionary_1.DictionaryVector
  }
  visitInterval() {
    return interval_1.IntervalVector
  }
  visitIntervalDayTime() {
    return interval_1.IntervalDayTimeVector
  }
  visitIntervalYearMonth() {
    return interval_1.IntervalYearMonthVector
  }
  visitFixedSizeList() {
    return fixedsizelist_1.FixedSizeListVector
  }
  visitMap() {
    return map_1.MapVector
  }
}
exports.GetVectorConstructor = GetVectorConstructor
/** @ignore */
exports.instance = new GetVectorConstructor()

//# sourceMappingURL=vectorctor.js.map
