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
const data_1 = require("./data");
const vector_1 = require("./vector");
const enum_1 = require("./enum");
const type_1 = require("./type");
class Visitor {
  visitMany(nodes, ...args) {
    return nodes.map((node, i) => this.visit(node, ...args.map(x => x[i])));
  }
  visit(...args) {
    return this.getVisitFn(args[0], false).apply(this, args);
  }
  getVisitFn(node, throwIfNotFound = true) {
    return getVisitFn(this, node, throwIfNotFound);
  }
  visitNull(_node, ..._args) {
    return null;
  }
  visitBool(_node, ..._args) {
    return null;
  }
  visitInt(_node, ..._args) {
    return null;
  }
  visitFloat(_node, ..._args) {
    return null;
  }
  visitUtf8(_node, ..._args) {
    return null;
  }
  visitBinary(_node, ..._args) {
    return null;
  }
  visitFixedSizeBinary(_node, ..._args) {
    return null;
  }
  visitDate(_node, ..._args) {
    return null;
  }
  visitTimestamp(_node, ..._args) {
    return null;
  }
  visitTime(_node, ..._args) {
    return null;
  }
  visitDecimal(_node, ..._args) {
    return null;
  }
  visitList(_node, ..._args) {
    return null;
  }
  visitStruct(_node, ..._args) {
    return null;
  }
  visitUnion(_node, ..._args) {
    return null;
  }
  visitDictionary(_node, ..._args) {
    return null;
  }
  visitInterval(_node, ..._args) {
    return null;
  }
  visitFixedSizeList(_node, ..._args) {
    return null;
  }
  visitMap(_node, ..._args) {
    return null;
  }
}
exports.Visitor = Visitor;
/** @ignore */
function getVisitFn(visitor, node, throwIfNotFound = true) {
  let fn = null;
  let dtype = enum_1.Type.NONE;
  // tslint:disable
  if (node instanceof data_1.Data) {
    dtype = inferDType(node.type);
  } else if (node instanceof vector_1.Vector) {
    dtype = inferDType(node.type);
  } else if (node instanceof type_1.DataType) {
    dtype = inferDType(node);
  } else if (typeof (dtype = node) !== "number") {
    dtype = enum_1.Type[node];
  }
  switch (dtype) {
    case enum_1.Type.Null:
      fn = visitor.visitNull;
      break;
    case enum_1.Type.Bool:
      fn = visitor.visitBool;
      break;
    case enum_1.Type.Int:
      fn = visitor.visitInt;
      break;
    case enum_1.Type.Int8:
      fn = visitor.visitInt8 || visitor.visitInt;
      break;
    case enum_1.Type.Int16:
      fn = visitor.visitInt16 || visitor.visitInt;
      break;
    case enum_1.Type.Int32:
      fn = visitor.visitInt32 || visitor.visitInt;
      break;
    case enum_1.Type.Int64:
      fn = visitor.visitInt64 || visitor.visitInt;
      break;
    case enum_1.Type.Uint8:
      fn = visitor.visitUint8 || visitor.visitInt;
      break;
    case enum_1.Type.Uint16:
      fn = visitor.visitUint16 || visitor.visitInt;
      break;
    case enum_1.Type.Uint32:
      fn = visitor.visitUint32 || visitor.visitInt;
      break;
    case enum_1.Type.Uint64:
      fn = visitor.visitUint64 || visitor.visitInt;
      break;
    case enum_1.Type.Float:
      fn = visitor.visitFloat;
      break;
    case enum_1.Type.Float16:
      fn = visitor.visitFloat16 || visitor.visitFloat;
      break;
    case enum_1.Type.Float32:
      fn = visitor.visitFloat32 || visitor.visitFloat;
      break;
    case enum_1.Type.Float64:
      fn = visitor.visitFloat64 || visitor.visitFloat;
      break;
    case enum_1.Type.Utf8:
      fn = visitor.visitUtf8;
      break;
    case enum_1.Type.Binary:
      fn = visitor.visitBinary;
      break;
    case enum_1.Type.FixedSizeBinary:
      fn = visitor.visitFixedSizeBinary;
      break;
    case enum_1.Type.Date:
      fn = visitor.visitDate;
      break;
    case enum_1.Type.DateDay:
      fn = visitor.visitDateDay || visitor.visitDate;
      break;
    case enum_1.Type.DateMillisecond:
      fn = visitor.visitDateMillisecond || visitor.visitDate;
      break;
    case enum_1.Type.Timestamp:
      fn = visitor.visitTimestamp;
      break;
    case enum_1.Type.TimestampSecond:
      fn = visitor.visitTimestampSecond || visitor.visitTimestamp;
      break;
    case enum_1.Type.TimestampMillisecond:
      fn = visitor.visitTimestampMillisecond || visitor.visitTimestamp;
      break;
    case enum_1.Type.TimestampMicrosecond:
      fn = visitor.visitTimestampMicrosecond || visitor.visitTimestamp;
      break;
    case enum_1.Type.TimestampNanosecond:
      fn = visitor.visitTimestampNanosecond || visitor.visitTimestamp;
      break;
    case enum_1.Type.Time:
      fn = visitor.visitTime;
      break;
    case enum_1.Type.TimeSecond:
      fn = visitor.visitTimeSecond || visitor.visitTime;
      break;
    case enum_1.Type.TimeMillisecond:
      fn = visitor.visitTimeMillisecond || visitor.visitTime;
      break;
    case enum_1.Type.TimeMicrosecond:
      fn = visitor.visitTimeMicrosecond || visitor.visitTime;
      break;
    case enum_1.Type.TimeNanosecond:
      fn = visitor.visitTimeNanosecond || visitor.visitTime;
      break;
    case enum_1.Type.Decimal:
      fn = visitor.visitDecimal;
      break;
    case enum_1.Type.List:
      fn = visitor.visitList;
      break;
    case enum_1.Type.Struct:
      fn = visitor.visitStruct;
      break;
    case enum_1.Type.Union:
      fn = visitor.visitUnion;
      break;
    case enum_1.Type.DenseUnion:
      fn = visitor.visitDenseUnion || visitor.visitUnion;
      break;
    case enum_1.Type.SparseUnion:
      fn = visitor.visitSparseUnion || visitor.visitUnion;
      break;
    case enum_1.Type.Dictionary:
      fn = visitor.visitDictionary;
      break;
    case enum_1.Type.Interval:
      fn = visitor.visitInterval;
      break;
    case enum_1.Type.IntervalDayTime:
      fn = visitor.visitIntervalDayTime || visitor.visitInterval;
      break;
    case enum_1.Type.IntervalYearMonth:
      fn = visitor.visitIntervalYearMonth || visitor.visitInterval;
      break;
    case enum_1.Type.FixedSizeList:
      fn = visitor.visitFixedSizeList;
      break;
    case enum_1.Type.Map:
      fn = visitor.visitMap;
      break;
  }
  if (typeof fn === "function") return fn;
  if (!throwIfNotFound) return () => null;
  throw new Error(`Unrecognized type '${enum_1.Type[dtype]}'`);
}
/** @ignore */
function inferDType(type) {
  switch (type.typeId) {
    case enum_1.Type.Null:
      return enum_1.Type.Null;
    case enum_1.Type.Int:
      const { bitWidth, isSigned } = type;
      switch (bitWidth) {
        case 8:
          return isSigned ? enum_1.Type.Int8 : enum_1.Type.Uint8;
        case 16:
          return isSigned ? enum_1.Type.Int16 : enum_1.Type.Uint16;
        case 32:
          return isSigned ? enum_1.Type.Int32 : enum_1.Type.Uint32;
        case 64:
          return isSigned ? enum_1.Type.Int64 : enum_1.Type.Uint64;
      }
      return enum_1.Type.Int;
    case enum_1.Type.Float:
      switch (type.precision) {
        case enum_1.Precision.HALF:
          return enum_1.Type.Float16;
        case enum_1.Precision.SINGLE:
          return enum_1.Type.Float32;
        case enum_1.Precision.DOUBLE:
          return enum_1.Type.Float64;
      }
      return enum_1.Type.Float;
    case enum_1.Type.Binary:
      return enum_1.Type.Binary;
    case enum_1.Type.Utf8:
      return enum_1.Type.Utf8;
    case enum_1.Type.Bool:
      return enum_1.Type.Bool;
    case enum_1.Type.Decimal:
      return enum_1.Type.Decimal;
    case enum_1.Type.Time:
      switch (type.unit) {
        case enum_1.TimeUnit.SECOND:
          return enum_1.Type.TimeSecond;
        case enum_1.TimeUnit.MILLISECOND:
          return enum_1.Type.TimeMillisecond;
        case enum_1.TimeUnit.MICROSECOND:
          return enum_1.Type.TimeMicrosecond;
        case enum_1.TimeUnit.NANOSECOND:
          return enum_1.Type.TimeNanosecond;
      }
      return enum_1.Type.Time;
    case enum_1.Type.Timestamp:
      switch (type.unit) {
        case enum_1.TimeUnit.SECOND:
          return enum_1.Type.TimestampSecond;
        case enum_1.TimeUnit.MILLISECOND:
          return enum_1.Type.TimestampMillisecond;
        case enum_1.TimeUnit.MICROSECOND:
          return enum_1.Type.TimestampMicrosecond;
        case enum_1.TimeUnit.NANOSECOND:
          return enum_1.Type.TimestampNanosecond;
      }
      return enum_1.Type.Timestamp;
    case enum_1.Type.Date:
      switch (type.unit) {
        case enum_1.DateUnit.DAY:
          return enum_1.Type.DateDay;
        case enum_1.DateUnit.MILLISECOND:
          return enum_1.Type.DateMillisecond;
      }
      return enum_1.Type.Date;
    case enum_1.Type.Interval:
      switch (type.unit) {
        case enum_1.IntervalUnit.DAY_TIME:
          return enum_1.Type.IntervalDayTime;
        case enum_1.IntervalUnit.YEAR_MONTH:
          return enum_1.Type.IntervalYearMonth;
      }
      return enum_1.Type.Interval;
    case enum_1.Type.Map:
      return enum_1.Type.Map;
    case enum_1.Type.List:
      return enum_1.Type.List;
    case enum_1.Type.Struct:
      return enum_1.Type.Struct;
    case enum_1.Type.Union:
      switch (type.mode) {
        case enum_1.UnionMode.Dense:
          return enum_1.Type.DenseUnion;
        case enum_1.UnionMode.Sparse:
          return enum_1.Type.SparseUnion;
      }
      return enum_1.Type.Union;
    case enum_1.Type.FixedSizeBinary:
      return enum_1.Type.FixedSizeBinary;
    case enum_1.Type.FixedSizeList:
      return enum_1.Type.FixedSizeList;
    case enum_1.Type.Dictionary:
      return enum_1.Type.Dictionary;
  }
  throw new Error(`Unrecognized type '${enum_1.Type[type.typeId]}'`);
}
// Add these here so they're picked up by the externs creator
// in the build, and closure-compiler doesn't minify them away
Visitor.prototype.visitInt8 = null;
Visitor.prototype.visitInt16 = null;
Visitor.prototype.visitInt32 = null;
Visitor.prototype.visitInt64 = null;
Visitor.prototype.visitUint8 = null;
Visitor.prototype.visitUint16 = null;
Visitor.prototype.visitUint32 = null;
Visitor.prototype.visitUint64 = null;
Visitor.prototype.visitFloat16 = null;
Visitor.prototype.visitFloat32 = null;
Visitor.prototype.visitFloat64 = null;
Visitor.prototype.visitDateDay = null;
Visitor.prototype.visitDateMillisecond = null;
Visitor.prototype.visitTimestampSecond = null;
Visitor.prototype.visitTimestampMillisecond = null;
Visitor.prototype.visitTimestampMicrosecond = null;
Visitor.prototype.visitTimestampNanosecond = null;
Visitor.prototype.visitTimeSecond = null;
Visitor.prototype.visitTimeMillisecond = null;
Visitor.prototype.visitTimeMicrosecond = null;
Visitor.prototype.visitTimeNanosecond = null;
Visitor.prototype.visitDenseUnion = null;
Visitor.prototype.visitSparseUnion = null;
Visitor.prototype.visitIntervalDayTime = null;
Visitor.prototype.visitIntervalYearMonth = null;

//# sourceMappingURL=visitor.js.map
