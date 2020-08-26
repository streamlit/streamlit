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
import { BN } from "../util/bn"
import { Visitor } from "../visitor"
import { decodeUtf8 } from "../util/utf8"
import { uint16ToFloat64 } from "../util/math"
import {
  UnionMode,
  Precision,
  DateUnit,
  TimeUnit,
  IntervalUnit,
} from "../enum"
/** @ignore */
export class GetVisitor extends Visitor {}
/** @ignore */ const epochDaysToMs = (data, index) => 86400000 * data[index]
/** @ignore */ const epochMillisecondsLongToMs = (data, index) =>
  4294967296 * data[index + 1] + (data[index] >>> 0)
/** @ignore */ const epochMicrosecondsLongToMs = (data, index) =>
  4294967296 * (data[index + 1] / 1000) + (data[index] >>> 0) / 1000
/** @ignore */ const epochNanosecondsLongToMs = (data, index) =>
  4294967296 * (data[index + 1] / 1000000) + (data[index] >>> 0) / 1000000
/** @ignore */ const epochMillisecondsToDate = epochMs => new Date(epochMs)
/** @ignore */ const epochDaysToDate = (data, index) =>
  epochMillisecondsToDate(epochDaysToMs(data, index))
/** @ignore */ const epochMillisecondsLongToDate = (data, index) =>
  epochMillisecondsToDate(epochMillisecondsLongToMs(data, index))
/** @ignore */
const getNull = (_vector, _index) => null
/** @ignore */
const getVariableWidthBytes = (values, valueOffsets, index) => {
  const { [index]: x, [index + 1]: y } = valueOffsets
  return x != null && y != null ? values.subarray(x, y) : null
}
/** @ignore */
const getBool = ({ offset, values }, index) => {
  const idx = offset + index
  const byte = values[idx >> 3]
  return (byte & (1 << idx % 8)) !== 0
}
/** @ignore */
const getDateDay = ({ values }, index) => epochDaysToDate(values, index)
/** @ignore */
const getDateMillisecond = ({ values }, index) =>
  epochMillisecondsLongToDate(values, index * 2)
/** @ignore */
const getNumeric = ({ stride, values }, index) => values[stride * index]
/** @ignore */
const getFloat16 = ({ stride, values }, index) =>
  uint16ToFloat64(values[stride * index])
/** @ignore */
const getBigInts = ({ stride, values, type }, index) =>
  BN.new(values.subarray(stride * index, stride * (index + 1)), type.isSigned)
/** @ignore */
const getFixedSizeBinary = ({ stride, values }, index) =>
  values.subarray(stride * index, stride * (index + 1))
/** @ignore */
const getBinary = ({ values, valueOffsets }, index) =>
  getVariableWidthBytes(values, valueOffsets, index)
/** @ignore */
const getUtf8 = ({ values, valueOffsets }, index) => {
  const bytes = getVariableWidthBytes(values, valueOffsets, index)
  return bytes !== null ? decodeUtf8(bytes) : null
}
/* istanbul ignore next */
/** @ignore */
const getInt = (vector, index) =>
  vector.type.bitWidth < 64
    ? getNumeric(vector, index)
    : getBigInts(vector, index)
/* istanbul ignore next */
/** @ignore */
const getFloat = (vector, index) =>
  vector.type.precision !== Precision.HALF
    ? getNumeric(vector, index)
    : getFloat16(vector, index)
/* istanbul ignore next */
/** @ignore */
const getDate = (vector, index) =>
  vector.type.unit === DateUnit.DAY
    ? getDateDay(vector, index)
    : getDateMillisecond(vector, index)
/** @ignore */
const getTimestampSecond = ({ values }, index) =>
  1000 * epochMillisecondsLongToMs(values, index * 2)
/** @ignore */
const getTimestampMillisecond = ({ values }, index) =>
  epochMillisecondsLongToMs(values, index * 2)
/** @ignore */
const getTimestampMicrosecond = ({ values }, index) =>
  epochMicrosecondsLongToMs(values, index * 2)
/** @ignore */
const getTimestampNanosecond = ({ values }, index) =>
  epochNanosecondsLongToMs(values, index * 2)
/* istanbul ignore next */
/** @ignore */
const getTimestamp = (vector, index) => {
  switch (vector.type.unit) {
    case TimeUnit.SECOND:
      return getTimestampSecond(vector, index)
    case TimeUnit.MILLISECOND:
      return getTimestampMillisecond(vector, index)
    case TimeUnit.MICROSECOND:
      return getTimestampMicrosecond(vector, index)
    case TimeUnit.NANOSECOND:
      return getTimestampNanosecond(vector, index)
  }
}
/** @ignore */
const getTimeSecond = ({ values, stride }, index) => values[stride * index]
/** @ignore */
const getTimeMillisecond = ({ values, stride }, index) =>
  values[stride * index]
/** @ignore */
const getTimeMicrosecond = ({ values }, index) =>
  BN.signed(values.subarray(2 * index, 2 * (index + 1)))
/** @ignore */
const getTimeNanosecond = ({ values }, index) =>
  BN.signed(values.subarray(2 * index, 2 * (index + 1)))
/* istanbul ignore next */
/** @ignore */
const getTime = (vector, index) => {
  switch (vector.type.unit) {
    case TimeUnit.SECOND:
      return getTimeSecond(vector, index)
    case TimeUnit.MILLISECOND:
      return getTimeMillisecond(vector, index)
    case TimeUnit.MICROSECOND:
      return getTimeMicrosecond(vector, index)
    case TimeUnit.NANOSECOND:
      return getTimeNanosecond(vector, index)
  }
}
/** @ignore */
const getDecimal = ({ values }, index) =>
  BN.decimal(values.subarray(4 * index, 4 * (index + 1)))
/** @ignore */
const getList = (vector, index) => {
  const child = vector.getChildAt(0),
    { valueOffsets, stride } = vector
  return child.slice(
    valueOffsets[index * stride],
    valueOffsets[index * stride + 1]
  )
}
/** @ignore */
const getMap = (vector, index) => {
  return vector.bind(index)
}
/** @ignore */
const getStruct = (vector, index) => {
  return vector.bind(index)
}
/* istanbul ignore next */
/** @ignore */
const getUnion = (vector, index) => {
  return vector.type.mode === UnionMode.Dense
    ? getDenseUnion(vector, index)
    : getSparseUnion(vector, index)
}
/** @ignore */
const getDenseUnion = (vector, index) => {
  const childIndex = vector.typeIdToChildIndex[vector.typeIds[index]]
  const child = vector.getChildAt(childIndex)
  return child ? child.get(vector.valueOffsets[index]) : null
}
/** @ignore */
const getSparseUnion = (vector, index) => {
  const childIndex = vector.typeIdToChildIndex[vector.typeIds[index]]
  const child = vector.getChildAt(childIndex)
  return child ? child.get(index) : null
}
/** @ignore */
const getDictionary = (vector, index) => {
  return vector.getValue(vector.getKey(index))
}
/* istanbul ignore next */
/** @ignore */
const getInterval = (vector, index) =>
  vector.type.unit === IntervalUnit.DAY_TIME
    ? getIntervalDayTime(vector, index)
    : getIntervalYearMonth(vector, index)
/** @ignore */
const getIntervalDayTime = ({ values }, index) =>
  values.subarray(2 * index, 2 * (index + 1))
/** @ignore */
const getIntervalYearMonth = ({ values }, index) => {
  const interval = values[index]
  const int32s = new Int32Array(2)
  int32s[0] = (interval / 12) | 0 /* years */
  int32s[1] = interval % 12 | 0 /* months */
  return int32s
}
/** @ignore */
const getFixedSizeList = (vector, index) => {
  const child = vector.getChildAt(0),
    { stride } = vector
  return child.slice(index * stride, (index + 1) * stride)
}
GetVisitor.prototype.visitNull = getNull
GetVisitor.prototype.visitBool = getBool
GetVisitor.prototype.visitInt = getInt
GetVisitor.prototype.visitInt8 = getNumeric
GetVisitor.prototype.visitInt16 = getNumeric
GetVisitor.prototype.visitInt32 = getNumeric
GetVisitor.prototype.visitInt64 = getBigInts
GetVisitor.prototype.visitUint8 = getNumeric
GetVisitor.prototype.visitUint16 = getNumeric
GetVisitor.prototype.visitUint32 = getNumeric
GetVisitor.prototype.visitUint64 = getBigInts
GetVisitor.prototype.visitFloat = getFloat
GetVisitor.prototype.visitFloat16 = getFloat16
GetVisitor.prototype.visitFloat32 = getNumeric
GetVisitor.prototype.visitFloat64 = getNumeric
GetVisitor.prototype.visitUtf8 = getUtf8
GetVisitor.prototype.visitBinary = getBinary
GetVisitor.prototype.visitFixedSizeBinary = getFixedSizeBinary
GetVisitor.prototype.visitDate = getDate
GetVisitor.prototype.visitDateDay = getDateDay
GetVisitor.prototype.visitDateMillisecond = getDateMillisecond
GetVisitor.prototype.visitTimestamp = getTimestamp
GetVisitor.prototype.visitTimestampSecond = getTimestampSecond
GetVisitor.prototype.visitTimestampMillisecond = getTimestampMillisecond
GetVisitor.prototype.visitTimestampMicrosecond = getTimestampMicrosecond
GetVisitor.prototype.visitTimestampNanosecond = getTimestampNanosecond
GetVisitor.prototype.visitTime = getTime
GetVisitor.prototype.visitTimeSecond = getTimeSecond
GetVisitor.prototype.visitTimeMillisecond = getTimeMillisecond
GetVisitor.prototype.visitTimeMicrosecond = getTimeMicrosecond
GetVisitor.prototype.visitTimeNanosecond = getTimeNanosecond
GetVisitor.prototype.visitDecimal = getDecimal
GetVisitor.prototype.visitList = getList
GetVisitor.prototype.visitStruct = getStruct
GetVisitor.prototype.visitUnion = getUnion
GetVisitor.prototype.visitDenseUnion = getDenseUnion
GetVisitor.prototype.visitSparseUnion = getSparseUnion
GetVisitor.prototype.visitDictionary = getDictionary
GetVisitor.prototype.visitInterval = getInterval
GetVisitor.prototype.visitIntervalDayTime = getIntervalDayTime
GetVisitor.prototype.visitIntervalYearMonth = getIntervalYearMonth
GetVisitor.prototype.visitFixedSizeList = getFixedSizeList
GetVisitor.prototype.visitMap = getMap
/** @ignore */
export const instance = new GetVisitor()

//# sourceMappingURL=get.mjs.map
