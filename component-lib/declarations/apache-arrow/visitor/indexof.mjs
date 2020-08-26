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
import { getBool, iterateBits } from "../util/bit";
import { createElementComparator } from "../util/vector";
/** @ignore */
export class IndexOfVisitor extends Visitor {}
/** @ignore */
function nullIndexOf(vector, searchElement) {
  // if you're looking for nulls and the vector isn't empty, we've got 'em!
  return searchElement === null && vector.length > 0 ? 0 : -1;
}
/** @ignore */
function indexOfNull(vector, fromIndex) {
  const { nullBitmap } = vector;
  if (!nullBitmap || vector.nullCount <= 0) {
    return -1;
  }
  let i = 0;
  for (const isValid of iterateBits(
    nullBitmap,
    vector.data.offset + (fromIndex || 0),
    vector.length,
    nullBitmap,
    getBool
  )) {
    if (!isValid) {
      return i;
    }
    ++i;
  }
  return -1;
}
/** @ignore */
function indexOfValue(vector, searchElement, fromIndex) {
  if (searchElement === undefined) {
    return -1;
  }
  if (searchElement === null) {
    return indexOfNull(vector, fromIndex);
  }
  const compare = createElementComparator(searchElement);
  for (let i = (fromIndex || 0) - 1, n = vector.length; ++i < n; ) {
    if (compare(vector.get(i))) {
      return i;
    }
  }
  return -1;
}
/** @ignore */
function indexOfUnion(vector, searchElement, fromIndex) {
  // Unions are special -- they do have a nullBitmap, but so can their children.
  // If the searchElement is null, we don't know whether it came from the Union's
  // bitmap or one of its childrens'. So we don't interrogate the Union's bitmap,
  // since that will report the wrong index if a child has a null before the Union.
  const compare = createElementComparator(searchElement);
  for (let i = (fromIndex || 0) - 1, n = vector.length; ++i < n; ) {
    if (compare(vector.get(i))) {
      return i;
    }
  }
  return -1;
}
IndexOfVisitor.prototype.visitNull = nullIndexOf;
IndexOfVisitor.prototype.visitBool = indexOfValue;
IndexOfVisitor.prototype.visitInt = indexOfValue;
IndexOfVisitor.prototype.visitInt8 = indexOfValue;
IndexOfVisitor.prototype.visitInt16 = indexOfValue;
IndexOfVisitor.prototype.visitInt32 = indexOfValue;
IndexOfVisitor.prototype.visitInt64 = indexOfValue;
IndexOfVisitor.prototype.visitUint8 = indexOfValue;
IndexOfVisitor.prototype.visitUint16 = indexOfValue;
IndexOfVisitor.prototype.visitUint32 = indexOfValue;
IndexOfVisitor.prototype.visitUint64 = indexOfValue;
IndexOfVisitor.prototype.visitFloat = indexOfValue;
IndexOfVisitor.prototype.visitFloat16 = indexOfValue;
IndexOfVisitor.prototype.visitFloat32 = indexOfValue;
IndexOfVisitor.prototype.visitFloat64 = indexOfValue;
IndexOfVisitor.prototype.visitUtf8 = indexOfValue;
IndexOfVisitor.prototype.visitBinary = indexOfValue;
IndexOfVisitor.prototype.visitFixedSizeBinary = indexOfValue;
IndexOfVisitor.prototype.visitDate = indexOfValue;
IndexOfVisitor.prototype.visitDateDay = indexOfValue;
IndexOfVisitor.prototype.visitDateMillisecond = indexOfValue;
IndexOfVisitor.prototype.visitTimestamp = indexOfValue;
IndexOfVisitor.prototype.visitTimestampSecond = indexOfValue;
IndexOfVisitor.prototype.visitTimestampMillisecond = indexOfValue;
IndexOfVisitor.prototype.visitTimestampMicrosecond = indexOfValue;
IndexOfVisitor.prototype.visitTimestampNanosecond = indexOfValue;
IndexOfVisitor.prototype.visitTime = indexOfValue;
IndexOfVisitor.prototype.visitTimeSecond = indexOfValue;
IndexOfVisitor.prototype.visitTimeMillisecond = indexOfValue;
IndexOfVisitor.prototype.visitTimeMicrosecond = indexOfValue;
IndexOfVisitor.prototype.visitTimeNanosecond = indexOfValue;
IndexOfVisitor.prototype.visitDecimal = indexOfValue;
IndexOfVisitor.prototype.visitList = indexOfValue;
IndexOfVisitor.prototype.visitStruct = indexOfValue;
IndexOfVisitor.prototype.visitUnion = indexOfValue;
IndexOfVisitor.prototype.visitDenseUnion = indexOfUnion;
IndexOfVisitor.prototype.visitSparseUnion = indexOfUnion;
IndexOfVisitor.prototype.visitDictionary = indexOfValue;
IndexOfVisitor.prototype.visitInterval = indexOfValue;
IndexOfVisitor.prototype.visitIntervalDayTime = indexOfValue;
IndexOfVisitor.prototype.visitIntervalYearMonth = indexOfValue;
IndexOfVisitor.prototype.visitFixedSizeList = indexOfValue;
IndexOfVisitor.prototype.visitMap = indexOfValue;
/** @ignore */
export const instance = new IndexOfVisitor();

//# sourceMappingURL=indexof.mjs.map
