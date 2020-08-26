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
const enum_1 = require("../enum")
const visitor_1 = require("../visitor")
const iterator_1 = require("./iterator")
/** @ignore */
class ToArrayVisitor extends visitor_1.Visitor {}
exports.ToArrayVisitor = ToArrayVisitor
/** @ignore */
function arrayOfVector(vector) {
  const { type, length, stride } = vector
  // Fast case, return subarray if possible
  switch (type.typeId) {
    case enum_1.Type.Int:
    case enum_1.Type.Float:
    case enum_1.Type.Decimal:
    case enum_1.Type.Time:
    case enum_1.Type.Timestamp:
      return vector.values.subarray(0, length * stride)
  }
  // Otherwise if not primitive, slow copy
  return [...iterator_1.instance.visit(vector)]
}
ToArrayVisitor.prototype.visitNull = arrayOfVector
ToArrayVisitor.prototype.visitBool = arrayOfVector
ToArrayVisitor.prototype.visitInt = arrayOfVector
ToArrayVisitor.prototype.visitInt8 = arrayOfVector
ToArrayVisitor.prototype.visitInt16 = arrayOfVector
ToArrayVisitor.prototype.visitInt32 = arrayOfVector
ToArrayVisitor.prototype.visitInt64 = arrayOfVector
ToArrayVisitor.prototype.visitUint8 = arrayOfVector
ToArrayVisitor.prototype.visitUint16 = arrayOfVector
ToArrayVisitor.prototype.visitUint32 = arrayOfVector
ToArrayVisitor.prototype.visitUint64 = arrayOfVector
ToArrayVisitor.prototype.visitFloat = arrayOfVector
ToArrayVisitor.prototype.visitFloat16 = arrayOfVector
ToArrayVisitor.prototype.visitFloat32 = arrayOfVector
ToArrayVisitor.prototype.visitFloat64 = arrayOfVector
ToArrayVisitor.prototype.visitUtf8 = arrayOfVector
ToArrayVisitor.prototype.visitBinary = arrayOfVector
ToArrayVisitor.prototype.visitFixedSizeBinary = arrayOfVector
ToArrayVisitor.prototype.visitDate = arrayOfVector
ToArrayVisitor.prototype.visitDateDay = arrayOfVector
ToArrayVisitor.prototype.visitDateMillisecond = arrayOfVector
ToArrayVisitor.prototype.visitTimestamp = arrayOfVector
ToArrayVisitor.prototype.visitTimestampSecond = arrayOfVector
ToArrayVisitor.prototype.visitTimestampMillisecond = arrayOfVector
ToArrayVisitor.prototype.visitTimestampMicrosecond = arrayOfVector
ToArrayVisitor.prototype.visitTimestampNanosecond = arrayOfVector
ToArrayVisitor.prototype.visitTime = arrayOfVector
ToArrayVisitor.prototype.visitTimeSecond = arrayOfVector
ToArrayVisitor.prototype.visitTimeMillisecond = arrayOfVector
ToArrayVisitor.prototype.visitTimeMicrosecond = arrayOfVector
ToArrayVisitor.prototype.visitTimeNanosecond = arrayOfVector
ToArrayVisitor.prototype.visitDecimal = arrayOfVector
ToArrayVisitor.prototype.visitList = arrayOfVector
ToArrayVisitor.prototype.visitStruct = arrayOfVector
ToArrayVisitor.prototype.visitUnion = arrayOfVector
ToArrayVisitor.prototype.visitDenseUnion = arrayOfVector
ToArrayVisitor.prototype.visitSparseUnion = arrayOfVector
ToArrayVisitor.prototype.visitDictionary = arrayOfVector
ToArrayVisitor.prototype.visitInterval = arrayOfVector
ToArrayVisitor.prototype.visitIntervalDayTime = arrayOfVector
ToArrayVisitor.prototype.visitIntervalYearMonth = arrayOfVector
ToArrayVisitor.prototype.visitFixedSizeList = arrayOfVector
ToArrayVisitor.prototype.visitMap = arrayOfVector
/** @ignore */
exports.instance = new ToArrayVisitor()

//# sourceMappingURL=toarray.js.map
