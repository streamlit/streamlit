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
import { Vector } from "../vector";
import { Visitor } from "../visitor";
import { encodeUtf8 } from "../util/utf8";
import { float64ToUint16 } from "../util/math";
import { toArrayBufferView } from "../util/buffer";
import {
  UnionMode,
  Precision,
  DateUnit,
  TimeUnit,
  IntervalUnit
} from "../enum";
/** @ignore */
export class SetVisitor extends Visitor {}
/** @ignore */
const setEpochMsToDays = (data, index, epochMs) => {
  data[index] = (epochMs / 86400000) | 0;
};
/** @ignore */
const setEpochMsToMillisecondsLong = (data, index, epochMs) => {
  data[index] = epochMs % 4294967296 | 0;
  data[index + 1] = (epochMs / 4294967296) | 0;
};
/** @ignore */
const setEpochMsToMicrosecondsLong = (data, index, epochMs) => {
  data[index] = (epochMs * 1000) % 4294967296 | 0;
  data[index + 1] = ((epochMs * 1000) / 4294967296) | 0;
};
/** @ignore */
const setEpochMsToNanosecondsLong = (data, index, epochMs) => {
  data[index] = (epochMs * 1000000) % 4294967296 | 0;
  data[index + 1] = ((epochMs * 1000000) / 4294967296) | 0;
};
/** @ignore */
const setVariableWidthBytes = (values, valueOffsets, index, value) => {
  const { [index]: x, [index + 1]: y } = valueOffsets;
  if (x != null && y != null) {
    values.set(value.subarray(0, y - x), x);
  }
};
/** @ignore */
const setBool = ({ offset, values }, index, val) => {
  const idx = offset + index;
  val
    ? (values[idx >> 3] |= 1 << idx % 8) // true
    : (values[idx >> 3] &= ~(1 << idx % 8)); // false
};
/** @ignore */
const setDateDay = ({ values }, index, value) => {
  setEpochMsToDays(values, index, value.valueOf());
};
/** @ignore */
const setDateMillisecond = ({ values }, index, value) => {
  setEpochMsToMillisecondsLong(values, index * 2, value.valueOf());
};
/** @ignore */
const setNumeric = ({ stride, values }, index, value) => {
  values[stride * index] = value;
};
/** @ignore */
const setFloat16 = ({ stride, values }, index, value) => {
  values[stride * index] = float64ToUint16(value);
};
/** @ignore */
const setNumericX2 = (vector, index, value) => {
  switch (typeof value) {
    case "bigint":
      vector.values64[index] = value;
      break;
    case "number":
      vector.values[index * vector.stride] = value;
      break;
    default:
      const val = value;
      const { stride, ArrayType } = vector;
      const long = toArrayBufferView(ArrayType, val);
      vector.values.set(long.subarray(0, stride), stride * index);
  }
};
/** @ignore */
const setFixedSizeBinary = ({ stride, values }, index, value) => {
  values.set(value.subarray(0, stride), stride * index);
};
/** @ignore */
const setBinary = ({ values, valueOffsets }, index, value) =>
  setVariableWidthBytes(values, valueOffsets, index, value);
/** @ignore */
const setUtf8 = ({ values, valueOffsets }, index, value) => {
  setVariableWidthBytes(values, valueOffsets, index, encodeUtf8(value));
};
/* istanbul ignore next */
/** @ignore */
const setInt = (vector, index, value) => {
  vector.type.bitWidth < 64
    ? setNumeric(vector, index, value)
    : setNumericX2(vector, index, value);
};
/* istanbul ignore next */
/** @ignore */
const setFloat = (vector, index, value) => {
  vector.type.precision !== Precision.HALF
    ? setNumeric(vector, index, value)
    : setFloat16(vector, index, value);
};
/* istanbul ignore next */
const setDate = (vector, index, value) => {
  vector.type.unit === DateUnit.DAY
    ? setDateDay(vector, index, value)
    : setDateMillisecond(vector, index, value);
};
/** @ignore */
const setTimestampSecond = ({ values }, index, value) =>
  setEpochMsToMillisecondsLong(values, index * 2, value / 1000);
/** @ignore */
const setTimestampMillisecond = ({ values }, index, value) =>
  setEpochMsToMillisecondsLong(values, index * 2, value);
/** @ignore */
const setTimestampMicrosecond = ({ values }, index, value) =>
  setEpochMsToMicrosecondsLong(values, index * 2, value);
/** @ignore */
const setTimestampNanosecond = ({ values }, index, value) =>
  setEpochMsToNanosecondsLong(values, index * 2, value);
/* istanbul ignore next */
/** @ignore */
const setTimestamp = (vector, index, value) => {
  switch (vector.type.unit) {
    case TimeUnit.SECOND:
      return setTimestampSecond(vector, index, value);
    case TimeUnit.MILLISECOND:
      return setTimestampMillisecond(vector, index, value);
    case TimeUnit.MICROSECOND:
      return setTimestampMicrosecond(vector, index, value);
    case TimeUnit.NANOSECOND:
      return setTimestampNanosecond(vector, index, value);
  }
};
/** @ignore */
const setTimeSecond = ({ values, stride }, index, value) => {
  values[stride * index] = value;
};
/** @ignore */
const setTimeMillisecond = ({ values, stride }, index, value) => {
  values[stride * index] = value;
};
/** @ignore */
const setTimeMicrosecond = ({ values }, index, value) => {
  values.set(value.subarray(0, 2), 2 * index);
};
/** @ignore */
const setTimeNanosecond = ({ values }, index, value) => {
  values.set(value.subarray(0, 2), 2 * index);
};
/* istanbul ignore next */
/** @ignore */
const setTime = (vector, index, value) => {
  switch (vector.type.unit) {
    case TimeUnit.SECOND:
      return setTimeSecond(vector, index, value);
    case TimeUnit.MILLISECOND:
      return setTimeMillisecond(vector, index, value);
    case TimeUnit.MICROSECOND:
      return setTimeMicrosecond(vector, index, value);
    case TimeUnit.NANOSECOND:
      return setTimeNanosecond(vector, index, value);
  }
};
/** @ignore */
const setDecimal = ({ values }, index, value) => {
  values.set(value.subarray(0, 4), 4 * index);
};
/** @ignore */
const setList = (vector, index, value) => {
  const values = vector.getChildAt(0),
    valueOffsets = vector.valueOffsets;
  for (
    let idx = -1, itr = valueOffsets[index], end = valueOffsets[index + 1];
    itr < end;

  ) {
    values.set(itr++, value.get(++idx));
  }
};
/** @ignore */
const setMap = (vector, index, value) => {
  const values = vector.getChildAt(0),
    valueOffsets = vector.valueOffsets;
  const entries = value instanceof Map ? [...value] : Object.entries(value);
  for (
    let idx = -1, itr = valueOffsets[index], end = valueOffsets[index + 1];
    itr < end;

  ) {
    values.set(itr++, entries[++idx]);
  }
};
/** @ignore */ const _setStructArrayValue = (o, v) => (c, _, i) =>
  c && c.set(o, v[i]);
/** @ignore */ const _setStructVectorValue = (o, v) => (c, _, i) =>
  c && c.set(o, v.get(i));
/** @ignore */ const _setStructMapValue = (o, v) => (c, f, _) =>
  c && c.set(o, v.get(f.name));
/** @ignore */ const _setStructObjectValue = (o, v) => (c, f, _) =>
  c && c.set(o, v[f.name]);
/** @ignore */
const setStruct = (vector, index, value) => {
  const setValue =
    value instanceof Map
      ? _setStructMapValue(index, value)
      : value instanceof Vector
      ? _setStructVectorValue(index, value)
      : Array.isArray(value)
      ? _setStructArrayValue(index, value)
      : _setStructObjectValue(index, value);
  vector.type.children.forEach((f, i) => setValue(vector.getChildAt(i), f, i));
};
/* istanbul ignore next */
/** @ignore */
const setUnion = (vector, index, value) => {
  vector.type.mode === UnionMode.Dense
    ? setDenseUnion(vector, index, value)
    : setSparseUnion(vector, index, value);
};
/** @ignore */
const setDenseUnion = (vector, index, value) => {
  const childIndex = vector.typeIdToChildIndex[vector.typeIds[index]];
  const child = vector.getChildAt(childIndex);
  child && child.set(vector.valueOffsets[index], value);
};
/** @ignore */
const setSparseUnion = (vector, index, value) => {
  const childIndex = vector.typeIdToChildIndex[vector.typeIds[index]];
  const child = vector.getChildAt(childIndex);
  child && child.set(index, value);
};
/** @ignore */
const setDictionary = (vector, index, value) => {
  const key = vector.getKey(index);
  if (key !== null) {
    vector.setValue(key, value);
  }
};
/* istanbul ignore next */
/** @ignore */
const setIntervalValue = (vector, index, value) => {
  vector.type.unit === IntervalUnit.DAY_TIME
    ? setIntervalDayTime(vector, index, value)
    : setIntervalYearMonth(vector, index, value);
};
/** @ignore */
const setIntervalDayTime = ({ values }, index, value) => {
  values.set(value.subarray(0, 2), 2 * index);
};
/** @ignore */
const setIntervalYearMonth = ({ values }, index, value) => {
  values[index] = value[0] * 12 + (value[1] % 12);
};
/** @ignore */
const setFixedSizeList = (vector, index, value) => {
  const child = vector.getChildAt(0),
    { stride } = vector;
  for (let idx = -1, offset = index * stride; ++idx < stride; ) {
    child.set(offset + idx, value.get(idx));
  }
};
SetVisitor.prototype.visitBool = setBool;
SetVisitor.prototype.visitInt = setInt;
SetVisitor.prototype.visitInt8 = setNumeric;
SetVisitor.prototype.visitInt16 = setNumeric;
SetVisitor.prototype.visitInt32 = setNumeric;
SetVisitor.prototype.visitInt64 = setNumericX2;
SetVisitor.prototype.visitUint8 = setNumeric;
SetVisitor.prototype.visitUint16 = setNumeric;
SetVisitor.prototype.visitUint32 = setNumeric;
SetVisitor.prototype.visitUint64 = setNumericX2;
SetVisitor.prototype.visitFloat = setFloat;
SetVisitor.prototype.visitFloat16 = setFloat16;
SetVisitor.prototype.visitFloat32 = setNumeric;
SetVisitor.prototype.visitFloat64 = setNumeric;
SetVisitor.prototype.visitUtf8 = setUtf8;
SetVisitor.prototype.visitBinary = setBinary;
SetVisitor.prototype.visitFixedSizeBinary = setFixedSizeBinary;
SetVisitor.prototype.visitDate = setDate;
SetVisitor.prototype.visitDateDay = setDateDay;
SetVisitor.prototype.visitDateMillisecond = setDateMillisecond;
SetVisitor.prototype.visitTimestamp = setTimestamp;
SetVisitor.prototype.visitTimestampSecond = setTimestampSecond;
SetVisitor.prototype.visitTimestampMillisecond = setTimestampMillisecond;
SetVisitor.prototype.visitTimestampMicrosecond = setTimestampMicrosecond;
SetVisitor.prototype.visitTimestampNanosecond = setTimestampNanosecond;
SetVisitor.prototype.visitTime = setTime;
SetVisitor.prototype.visitTimeSecond = setTimeSecond;
SetVisitor.prototype.visitTimeMillisecond = setTimeMillisecond;
SetVisitor.prototype.visitTimeMicrosecond = setTimeMicrosecond;
SetVisitor.prototype.visitTimeNanosecond = setTimeNanosecond;
SetVisitor.prototype.visitDecimal = setDecimal;
SetVisitor.prototype.visitList = setList;
SetVisitor.prototype.visitStruct = setStruct;
SetVisitor.prototype.visitUnion = setUnion;
SetVisitor.prototype.visitDenseUnion = setDenseUnion;
SetVisitor.prototype.visitSparseUnion = setSparseUnion;
SetVisitor.prototype.visitDictionary = setDictionary;
SetVisitor.prototype.visitInterval = setIntervalValue;
SetVisitor.prototype.visitIntervalDayTime = setIntervalDayTime;
SetVisitor.prototype.visitIntervalYearMonth = setIntervalYearMonth;
SetVisitor.prototype.visitFixedSizeList = setFixedSizeList;
SetVisitor.prototype.visitMap = setMap;
/** @ignore */
export const instance = new SetVisitor();

//# sourceMappingURL=set.mjs.map
