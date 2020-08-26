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
import { Data } from "./data";
import { Vector } from "./vector";
import {
  Type,
  Precision,
  DateUnit,
  TimeUnit,
  IntervalUnit,
  UnionMode
} from "./enum";
import { DataType } from "./type";
export class Visitor {
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
/** @ignore */
function getVisitFn(visitor, node, throwIfNotFound = true) {
  let fn = null;
  let dtype = Type.NONE;
  // tslint:disable
  if (node instanceof Data) {
    dtype = inferDType(node.type);
  } else if (node instanceof Vector) {
    dtype = inferDType(node.type);
  } else if (node instanceof DataType) {
    dtype = inferDType(node);
  } else if (typeof (dtype = node) !== "number") {
    dtype = Type[node];
  }
  switch (dtype) {
    case Type.Null:
      fn = visitor.visitNull;
      break;
    case Type.Bool:
      fn = visitor.visitBool;
      break;
    case Type.Int:
      fn = visitor.visitInt;
      break;
    case Type.Int8:
      fn = visitor.visitInt8 || visitor.visitInt;
      break;
    case Type.Int16:
      fn = visitor.visitInt16 || visitor.visitInt;
      break;
    case Type.Int32:
      fn = visitor.visitInt32 || visitor.visitInt;
      break;
    case Type.Int64:
      fn = visitor.visitInt64 || visitor.visitInt;
      break;
    case Type.Uint8:
      fn = visitor.visitUint8 || visitor.visitInt;
      break;
    case Type.Uint16:
      fn = visitor.visitUint16 || visitor.visitInt;
      break;
    case Type.Uint32:
      fn = visitor.visitUint32 || visitor.visitInt;
      break;
    case Type.Uint64:
      fn = visitor.visitUint64 || visitor.visitInt;
      break;
    case Type.Float:
      fn = visitor.visitFloat;
      break;
    case Type.Float16:
      fn = visitor.visitFloat16 || visitor.visitFloat;
      break;
    case Type.Float32:
      fn = visitor.visitFloat32 || visitor.visitFloat;
      break;
    case Type.Float64:
      fn = visitor.visitFloat64 || visitor.visitFloat;
      break;
    case Type.Utf8:
      fn = visitor.visitUtf8;
      break;
    case Type.Binary:
      fn = visitor.visitBinary;
      break;
    case Type.FixedSizeBinary:
      fn = visitor.visitFixedSizeBinary;
      break;
    case Type.Date:
      fn = visitor.visitDate;
      break;
    case Type.DateDay:
      fn = visitor.visitDateDay || visitor.visitDate;
      break;
    case Type.DateMillisecond:
      fn = visitor.visitDateMillisecond || visitor.visitDate;
      break;
    case Type.Timestamp:
      fn = visitor.visitTimestamp;
      break;
    case Type.TimestampSecond:
      fn = visitor.visitTimestampSecond || visitor.visitTimestamp;
      break;
    case Type.TimestampMillisecond:
      fn = visitor.visitTimestampMillisecond || visitor.visitTimestamp;
      break;
    case Type.TimestampMicrosecond:
      fn = visitor.visitTimestampMicrosecond || visitor.visitTimestamp;
      break;
    case Type.TimestampNanosecond:
      fn = visitor.visitTimestampNanosecond || visitor.visitTimestamp;
      break;
    case Type.Time:
      fn = visitor.visitTime;
      break;
    case Type.TimeSecond:
      fn = visitor.visitTimeSecond || visitor.visitTime;
      break;
    case Type.TimeMillisecond:
      fn = visitor.visitTimeMillisecond || visitor.visitTime;
      break;
    case Type.TimeMicrosecond:
      fn = visitor.visitTimeMicrosecond || visitor.visitTime;
      break;
    case Type.TimeNanosecond:
      fn = visitor.visitTimeNanosecond || visitor.visitTime;
      break;
    case Type.Decimal:
      fn = visitor.visitDecimal;
      break;
    case Type.List:
      fn = visitor.visitList;
      break;
    case Type.Struct:
      fn = visitor.visitStruct;
      break;
    case Type.Union:
      fn = visitor.visitUnion;
      break;
    case Type.DenseUnion:
      fn = visitor.visitDenseUnion || visitor.visitUnion;
      break;
    case Type.SparseUnion:
      fn = visitor.visitSparseUnion || visitor.visitUnion;
      break;
    case Type.Dictionary:
      fn = visitor.visitDictionary;
      break;
    case Type.Interval:
      fn = visitor.visitInterval;
      break;
    case Type.IntervalDayTime:
      fn = visitor.visitIntervalDayTime || visitor.visitInterval;
      break;
    case Type.IntervalYearMonth:
      fn = visitor.visitIntervalYearMonth || visitor.visitInterval;
      break;
    case Type.FixedSizeList:
      fn = visitor.visitFixedSizeList;
      break;
    case Type.Map:
      fn = visitor.visitMap;
      break;
  }
  if (typeof fn === "function") return fn;
  if (!throwIfNotFound) return () => null;
  throw new Error(`Unrecognized type '${Type[dtype]}'`);
}
/** @ignore */
function inferDType(type) {
  switch (type.typeId) {
    case Type.Null:
      return Type.Null;
    case Type.Int:
      const { bitWidth, isSigned } = type;
      switch (bitWidth) {
        case 8:
          return isSigned ? Type.Int8 : Type.Uint8;
        case 16:
          return isSigned ? Type.Int16 : Type.Uint16;
        case 32:
          return isSigned ? Type.Int32 : Type.Uint32;
        case 64:
          return isSigned ? Type.Int64 : Type.Uint64;
      }
      return Type.Int;
    case Type.Float:
      switch (type.precision) {
        case Precision.HALF:
          return Type.Float16;
        case Precision.SINGLE:
          return Type.Float32;
        case Precision.DOUBLE:
          return Type.Float64;
      }
      return Type.Float;
    case Type.Binary:
      return Type.Binary;
    case Type.Utf8:
      return Type.Utf8;
    case Type.Bool:
      return Type.Bool;
    case Type.Decimal:
      return Type.Decimal;
    case Type.Time:
      switch (type.unit) {
        case TimeUnit.SECOND:
          return Type.TimeSecond;
        case TimeUnit.MILLISECOND:
          return Type.TimeMillisecond;
        case TimeUnit.MICROSECOND:
          return Type.TimeMicrosecond;
        case TimeUnit.NANOSECOND:
          return Type.TimeNanosecond;
      }
      return Type.Time;
    case Type.Timestamp:
      switch (type.unit) {
        case TimeUnit.SECOND:
          return Type.TimestampSecond;
        case TimeUnit.MILLISECOND:
          return Type.TimestampMillisecond;
        case TimeUnit.MICROSECOND:
          return Type.TimestampMicrosecond;
        case TimeUnit.NANOSECOND:
          return Type.TimestampNanosecond;
      }
      return Type.Timestamp;
    case Type.Date:
      switch (type.unit) {
        case DateUnit.DAY:
          return Type.DateDay;
        case DateUnit.MILLISECOND:
          return Type.DateMillisecond;
      }
      return Type.Date;
    case Type.Interval:
      switch (type.unit) {
        case IntervalUnit.DAY_TIME:
          return Type.IntervalDayTime;
        case IntervalUnit.YEAR_MONTH:
          return Type.IntervalYearMonth;
      }
      return Type.Interval;
    case Type.Map:
      return Type.Map;
    case Type.List:
      return Type.List;
    case Type.Struct:
      return Type.Struct;
    case Type.Union:
      switch (type.mode) {
        case UnionMode.Dense:
          return Type.DenseUnion;
        case UnionMode.Sparse:
          return Type.SparseUnion;
      }
      return Type.Union;
    case Type.FixedSizeBinary:
      return Type.FixedSizeBinary;
    case Type.FixedSizeList:
      return Type.FixedSizeList;
    case Type.Dictionary:
      return Type.Dictionary;
  }
  throw new Error(`Unrecognized type '${Type[type.typeId]}'`);
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

//# sourceMappingURL=visitor.mjs.map
