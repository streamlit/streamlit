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
const bit_1 = require("../util/bit")
const get_1 = require("./get")
/** @ignore */
class IteratorVisitor extends visitor_1.Visitor {}
exports.IteratorVisitor = IteratorVisitor
/** @ignore */
function nullableIterator(vector) {
  const getFn = get_1.instance.getVisitFn(vector)
  return bit_1.iterateBits(
    vector.nullBitmap,
    vector.offset,
    vector.length,
    vector,
    (vec, idx, nullByte, nullBit) =>
      (nullByte & (1 << nullBit)) !== 0 ? getFn(vec, idx) : null
  )
}
/** @ignore */
function vectorIterator(vector) {
  // If nullable, iterate manually
  if (vector.nullCount > 0) {
    return nullableIterator(vector)
  }
  const { type, typeId, length } = vector
  // Fast case, defer to native iterators if possible
  if (
    vector.stride === 1 &&
    (typeId === enum_1.Type.Timestamp ||
      (typeId === enum_1.Type.Int && type.bitWidth !== 64) ||
      (typeId === enum_1.Type.Time && type.bitWidth !== 64) ||
      (typeId === enum_1.Type.Float &&
        type.precision > 0) /* Precision.HALF */)
  ) {
    return vector.values.subarray(0, length)[Symbol.iterator]()
  }
  // Otherwise, iterate manually
  return (function*(getFn) {
    for (let index = -1; ++index < length; ) {
      yield getFn(vector, index)
    }
  })(get_1.instance.getVisitFn(vector))
}
IteratorVisitor.prototype.visitNull = vectorIterator
IteratorVisitor.prototype.visitBool = vectorIterator
IteratorVisitor.prototype.visitInt = vectorIterator
IteratorVisitor.prototype.visitInt8 = vectorIterator
IteratorVisitor.prototype.visitInt16 = vectorIterator
IteratorVisitor.prototype.visitInt32 = vectorIterator
IteratorVisitor.prototype.visitInt64 = vectorIterator
IteratorVisitor.prototype.visitUint8 = vectorIterator
IteratorVisitor.prototype.visitUint16 = vectorIterator
IteratorVisitor.prototype.visitUint32 = vectorIterator
IteratorVisitor.prototype.visitUint64 = vectorIterator
IteratorVisitor.prototype.visitFloat = vectorIterator
IteratorVisitor.prototype.visitFloat16 = vectorIterator
IteratorVisitor.prototype.visitFloat32 = vectorIterator
IteratorVisitor.prototype.visitFloat64 = vectorIterator
IteratorVisitor.prototype.visitUtf8 = vectorIterator
IteratorVisitor.prototype.visitBinary = vectorIterator
IteratorVisitor.prototype.visitFixedSizeBinary = vectorIterator
IteratorVisitor.prototype.visitDate = vectorIterator
IteratorVisitor.prototype.visitDateDay = vectorIterator
IteratorVisitor.prototype.visitDateMillisecond = vectorIterator
IteratorVisitor.prototype.visitTimestamp = vectorIterator
IteratorVisitor.prototype.visitTimestampSecond = vectorIterator
IteratorVisitor.prototype.visitTimestampMillisecond = vectorIterator
IteratorVisitor.prototype.visitTimestampMicrosecond = vectorIterator
IteratorVisitor.prototype.visitTimestampNanosecond = vectorIterator
IteratorVisitor.prototype.visitTime = vectorIterator
IteratorVisitor.prototype.visitTimeSecond = vectorIterator
IteratorVisitor.prototype.visitTimeMillisecond = vectorIterator
IteratorVisitor.prototype.visitTimeMicrosecond = vectorIterator
IteratorVisitor.prototype.visitTimeNanosecond = vectorIterator
IteratorVisitor.prototype.visitDecimal = vectorIterator
IteratorVisitor.prototype.visitList = vectorIterator
IteratorVisitor.prototype.visitStruct = vectorIterator
IteratorVisitor.prototype.visitUnion = vectorIterator
IteratorVisitor.prototype.visitDenseUnion = vectorIterator
IteratorVisitor.prototype.visitSparseUnion = vectorIterator
IteratorVisitor.prototype.visitDictionary = vectorIterator
IteratorVisitor.prototype.visitInterval = vectorIterator
IteratorVisitor.prototype.visitIntervalDayTime = vectorIterator
IteratorVisitor.prototype.visitIntervalYearMonth = vectorIterator
IteratorVisitor.prototype.visitFixedSizeList = vectorIterator
IteratorVisitor.prototype.visitMap = vectorIterator
/** @ignore */
exports.instance = new IteratorVisitor()

//# sourceMappingURL=iterator.js.map
