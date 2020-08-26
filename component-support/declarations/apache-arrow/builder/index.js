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
/** @ignore */
var builder_1 = require("../builder");
exports.Builder = builder_1.Builder;
var bool_1 = require("./bool");
exports.BoolBuilder = bool_1.BoolBuilder;
var null_1 = require("./null");
exports.NullBuilder = null_1.NullBuilder;
var date_1 = require("./date");
exports.DateBuilder = date_1.DateBuilder;
exports.DateDayBuilder = date_1.DateDayBuilder;
exports.DateMillisecondBuilder = date_1.DateMillisecondBuilder;
var decimal_1 = require("./decimal");
exports.DecimalBuilder = decimal_1.DecimalBuilder;
var dictionary_1 = require("./dictionary");
exports.DictionaryBuilder = dictionary_1.DictionaryBuilder;
var fixedsizebinary_1 = require("./fixedsizebinary");
exports.FixedSizeBinaryBuilder = fixedsizebinary_1.FixedSizeBinaryBuilder;
var float_1 = require("./float");
exports.FloatBuilder = float_1.FloatBuilder;
exports.Float16Builder = float_1.Float16Builder;
exports.Float32Builder = float_1.Float32Builder;
exports.Float64Builder = float_1.Float64Builder;
var int_1 = require("./int");
exports.IntBuilder = int_1.IntBuilder;
exports.Int8Builder = int_1.Int8Builder;
exports.Int16Builder = int_1.Int16Builder;
exports.Int32Builder = int_1.Int32Builder;
exports.Int64Builder = int_1.Int64Builder;
exports.Uint8Builder = int_1.Uint8Builder;
exports.Uint16Builder = int_1.Uint16Builder;
exports.Uint32Builder = int_1.Uint32Builder;
exports.Uint64Builder = int_1.Uint64Builder;
var time_1 = require("./time");
exports.TimeBuilder = time_1.TimeBuilder;
exports.TimeSecondBuilder = time_1.TimeSecondBuilder;
exports.TimeMillisecondBuilder = time_1.TimeMillisecondBuilder;
exports.TimeMicrosecondBuilder = time_1.TimeMicrosecondBuilder;
exports.TimeNanosecondBuilder = time_1.TimeNanosecondBuilder;
var timestamp_1 = require("./timestamp");
exports.TimestampBuilder = timestamp_1.TimestampBuilder;
exports.TimestampSecondBuilder = timestamp_1.TimestampSecondBuilder;
exports.TimestampMillisecondBuilder = timestamp_1.TimestampMillisecondBuilder;
exports.TimestampMicrosecondBuilder = timestamp_1.TimestampMicrosecondBuilder;
exports.TimestampNanosecondBuilder = timestamp_1.TimestampNanosecondBuilder;
var interval_1 = require("./interval");
exports.IntervalBuilder = interval_1.IntervalBuilder;
exports.IntervalDayTimeBuilder = interval_1.IntervalDayTimeBuilder;
exports.IntervalYearMonthBuilder = interval_1.IntervalYearMonthBuilder;
var utf8_1 = require("./utf8");
exports.Utf8Builder = utf8_1.Utf8Builder;
var binary_1 = require("./binary");
exports.BinaryBuilder = binary_1.BinaryBuilder;
var list_1 = require("./list");
exports.ListBuilder = list_1.ListBuilder;
var fixedsizelist_1 = require("./fixedsizelist");
exports.FixedSizeListBuilder = fixedsizelist_1.FixedSizeListBuilder;
var map_1 = require("./map");
exports.MapBuilder = map_1.MapBuilder;
var struct_1 = require("./struct");
exports.StructBuilder = struct_1.StructBuilder;
var union_1 = require("./union");
exports.UnionBuilder = union_1.UnionBuilder;
exports.SparseUnionBuilder = union_1.SparseUnionBuilder;
exports.DenseUnionBuilder = union_1.DenseUnionBuilder;
const enum_1 = require("../enum");
const utf8_2 = require("./utf8");
const builder_2 = require("../builder");
const set_1 = require("../visitor/set");
const builderctor_1 = require("../visitor/builderctor");
/** @nocollapse */
builder_2.Builder.new = newBuilder;
function newBuilder(options) {
  const type = options.type;
  const builder = new (builderctor_1.instance.getVisitFn(type)())(options);
  if (type.children && type.children.length > 0) {
    const children = options["children"] || [];
    const defaultOptions = { nullValues: options["nullValues"] };
    const getChildOptions = Array.isArray(children)
      ? (_, i) => children[i] || defaultOptions
      : ({ name }) => children[name] || defaultOptions;
    type.children.forEach((field, index) => {
      const { type } = field;
      const opts = getChildOptions(field, index);
      builder.children.push(newBuilder({ ...opts, type }));
    });
  }
  return builder;
}
Object.keys(enum_1.Type)
  .map(T => enum_1.Type[T])
  .filter(T => typeof T === "number" && T !== enum_1.Type.NONE)
  .forEach(typeId => {
    const BuilderCtor = builderctor_1.instance.visit(typeId);
    BuilderCtor.prototype._setValue = set_1.instance.getVisitFn(typeId);
  });
utf8_2.Utf8Builder.prototype._setValue = set_1.instance.visitBinary;

//# sourceMappingURL=index.js.map
