"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const visitor_1 = require("../visitor");
const binary_1 = require("../builder/binary");
const bool_1 = require("../builder/bool");
const date_1 = require("../builder/date");
const decimal_1 = require("../builder/decimal");
const dictionary_1 = require("../builder/dictionary");
const fixedsizebinary_1 = require("../builder/fixedsizebinary");
const fixedsizelist_1 = require("../builder/fixedsizelist");
const float_1 = require("../builder/float");
const interval_1 = require("../builder/interval");
const int_1 = require("../builder/int");
const list_1 = require("../builder/list");
const map_1 = require("../builder/map");
const null_1 = require("../builder/null");
const struct_1 = require("../builder/struct");
const timestamp_1 = require("../builder/timestamp");
const time_1 = require("../builder/time");
const union_1 = require("../builder/union");
const utf8_1 = require("../builder/utf8");
/** @ignore */
class GetBuilderCtor extends visitor_1.Visitor {
  visitNull() {
    return null_1.NullBuilder;
  }
  visitBool() {
    return bool_1.BoolBuilder;
  }
  visitInt() {
    return int_1.IntBuilder;
  }
  visitInt8() {
    return int_1.Int8Builder;
  }
  visitInt16() {
    return int_1.Int16Builder;
  }
  visitInt32() {
    return int_1.Int32Builder;
  }
  visitInt64() {
    return int_1.Int64Builder;
  }
  visitUint8() {
    return int_1.Uint8Builder;
  }
  visitUint16() {
    return int_1.Uint16Builder;
  }
  visitUint32() {
    return int_1.Uint32Builder;
  }
  visitUint64() {
    return int_1.Uint64Builder;
  }
  visitFloat() {
    return float_1.FloatBuilder;
  }
  visitFloat16() {
    return float_1.Float16Builder;
  }
  visitFloat32() {
    return float_1.Float32Builder;
  }
  visitFloat64() {
    return float_1.Float64Builder;
  }
  visitUtf8() {
    return utf8_1.Utf8Builder;
  }
  visitBinary() {
    return binary_1.BinaryBuilder;
  }
  visitFixedSizeBinary() {
    return fixedsizebinary_1.FixedSizeBinaryBuilder;
  }
  visitDate() {
    return date_1.DateBuilder;
  }
  visitDateDay() {
    return date_1.DateDayBuilder;
  }
  visitDateMillisecond() {
    return date_1.DateMillisecondBuilder;
  }
  visitTimestamp() {
    return timestamp_1.TimestampBuilder;
  }
  visitTimestampSecond() {
    return timestamp_1.TimestampSecondBuilder;
  }
  visitTimestampMillisecond() {
    return timestamp_1.TimestampMillisecondBuilder;
  }
  visitTimestampMicrosecond() {
    return timestamp_1.TimestampMicrosecondBuilder;
  }
  visitTimestampNanosecond() {
    return timestamp_1.TimestampNanosecondBuilder;
  }
  visitTime() {
    return time_1.TimeBuilder;
  }
  visitTimeSecond() {
    return time_1.TimeSecondBuilder;
  }
  visitTimeMillisecond() {
    return time_1.TimeMillisecondBuilder;
  }
  visitTimeMicrosecond() {
    return time_1.TimeMicrosecondBuilder;
  }
  visitTimeNanosecond() {
    return time_1.TimeNanosecondBuilder;
  }
  visitDecimal() {
    return decimal_1.DecimalBuilder;
  }
  visitList() {
    return list_1.ListBuilder;
  }
  visitStruct() {
    return struct_1.StructBuilder;
  }
  visitUnion() {
    return union_1.UnionBuilder;
  }
  visitDenseUnion() {
    return union_1.DenseUnionBuilder;
  }
  visitSparseUnion() {
    return union_1.SparseUnionBuilder;
  }
  visitDictionary() {
    return dictionary_1.DictionaryBuilder;
  }
  visitInterval() {
    return interval_1.IntervalBuilder;
  }
  visitIntervalDayTime() {
    return interval_1.IntervalDayTimeBuilder;
  }
  visitIntervalYearMonth() {
    return interval_1.IntervalYearMonthBuilder;
  }
  visitFixedSizeList() {
    return fixedsizelist_1.FixedSizeListBuilder;
  }
  visitMap() {
    return map_1.MapBuilder;
  }
}
exports.GetBuilderCtor = GetBuilderCtor;
/** @ignore */
exports.instance = new GetBuilderCtor();

//# sourceMappingURL=builderctor.js.map
