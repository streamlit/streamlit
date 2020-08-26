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
import { Visitor } from "../visitor"
/** @ignore */
export class TypeComparator extends Visitor {
  compareSchemas(schema, other) {
    return (
      schema === other ||
      (other instanceof schema.constructor &&
        instance.compareFields(schema.fields, other.fields))
    )
  }
  compareFields(fields, others) {
    return (
      fields === others ||
      (Array.isArray(fields) &&
        Array.isArray(others) &&
        fields.length === others.length &&
        fields.every((f, i) => instance.compareField(f, others[i])))
    )
  }
  compareField(field, other) {
    return (
      field === other ||
      (other instanceof field.constructor &&
        field.name === other.name &&
        field.nullable === other.nullable &&
        instance.visit(field.type, other.type))
    )
  }
}
function compareConstructor(type, other) {
  return other instanceof type.constructor
}
function compareAny(type, other) {
  return type === other || compareConstructor(type, other)
}
function compareInt(type, other) {
  return (
    type === other ||
    (compareConstructor(type, other) &&
      type.bitWidth === other.bitWidth &&
      type.isSigned === other.isSigned)
  )
}
function compareFloat(type, other) {
  return (
    type === other ||
    (compareConstructor(type, other) && type.precision === other.precision)
  )
}
function compareFixedSizeBinary(type, other) {
  return (
    type === other ||
    (compareConstructor(type, other) && type.byteWidth === other.byteWidth)
  )
}
function compareDate(type, other) {
  return (
    type === other ||
    (compareConstructor(type, other) && type.unit === other.unit)
  )
}
function compareTimestamp(type, other) {
  return (
    type === other ||
    (compareConstructor(type, other) &&
      type.unit === other.unit &&
      type.timezone === other.timezone)
  )
}
function compareTime(type, other) {
  return (
    type === other ||
    (compareConstructor(type, other) &&
      type.unit === other.unit &&
      type.bitWidth === other.bitWidth)
  )
}
function compareList(type, other) {
  return (
    type === other ||
    (compareConstructor(type, other) &&
      type.children.length === other.children.length &&
      instance.compareFields(type.children, other.children))
  )
}
function compareStruct(type, other) {
  return (
    type === other ||
    (compareConstructor(type, other) &&
      type.children.length === other.children.length &&
      instance.compareFields(type.children, other.children))
  )
}
function compareUnion(type, other) {
  return (
    type === other ||
    (compareConstructor(type, other) &&
      type.mode === other.mode &&
      type.typeIds.every((x, i) => x === other.typeIds[i]) &&
      instance.compareFields(type.children, other.children))
  )
}
function compareDictionary(type, other) {
  return (
    type === other ||
    (compareConstructor(type, other) &&
      type.id === other.id &&
      type.isOrdered === other.isOrdered &&
      instance.visit(type.indices, other.indices) &&
      instance.visit(type.dictionary, other.dictionary))
  )
}
function compareInterval(type, other) {
  return (
    type === other ||
    (compareConstructor(type, other) && type.unit === other.unit)
  )
}
function compareFixedSizeList(type, other) {
  return (
    type === other ||
    (compareConstructor(type, other) &&
      type.listSize === other.listSize &&
      type.children.length === other.children.length &&
      instance.compareFields(type.children, other.children))
  )
}
function compareMap(type, other) {
  return (
    type === other ||
    (compareConstructor(type, other) &&
      type.keysSorted === other.keysSorted &&
      type.children.length === other.children.length &&
      instance.compareFields(type.children, other.children))
  )
}
TypeComparator.prototype.visitNull = compareAny
TypeComparator.prototype.visitBool = compareAny
TypeComparator.prototype.visitInt = compareInt
TypeComparator.prototype.visitInt8 = compareInt
TypeComparator.prototype.visitInt16 = compareInt
TypeComparator.prototype.visitInt32 = compareInt
TypeComparator.prototype.visitInt64 = compareInt
TypeComparator.prototype.visitUint8 = compareInt
TypeComparator.prototype.visitUint16 = compareInt
TypeComparator.prototype.visitUint32 = compareInt
TypeComparator.prototype.visitUint64 = compareInt
TypeComparator.prototype.visitFloat = compareFloat
TypeComparator.prototype.visitFloat16 = compareFloat
TypeComparator.prototype.visitFloat32 = compareFloat
TypeComparator.prototype.visitFloat64 = compareFloat
TypeComparator.prototype.visitUtf8 = compareAny
TypeComparator.prototype.visitBinary = compareAny
TypeComparator.prototype.visitFixedSizeBinary = compareFixedSizeBinary
TypeComparator.prototype.visitDate = compareDate
TypeComparator.prototype.visitDateDay = compareDate
TypeComparator.prototype.visitDateMillisecond = compareDate
TypeComparator.prototype.visitTimestamp = compareTimestamp
TypeComparator.prototype.visitTimestampSecond = compareTimestamp
TypeComparator.prototype.visitTimestampMillisecond = compareTimestamp
TypeComparator.prototype.visitTimestampMicrosecond = compareTimestamp
TypeComparator.prototype.visitTimestampNanosecond = compareTimestamp
TypeComparator.prototype.visitTime = compareTime
TypeComparator.prototype.visitTimeSecond = compareTime
TypeComparator.prototype.visitTimeMillisecond = compareTime
TypeComparator.prototype.visitTimeMicrosecond = compareTime
TypeComparator.prototype.visitTimeNanosecond = compareTime
TypeComparator.prototype.visitDecimal = compareAny
TypeComparator.prototype.visitList = compareList
TypeComparator.prototype.visitStruct = compareStruct
TypeComparator.prototype.visitUnion = compareUnion
TypeComparator.prototype.visitDenseUnion = compareUnion
TypeComparator.prototype.visitSparseUnion = compareUnion
TypeComparator.prototype.visitDictionary = compareDictionary
TypeComparator.prototype.visitInterval = compareInterval
TypeComparator.prototype.visitIntervalDayTime = compareInterval
TypeComparator.prototype.visitIntervalYearMonth = compareInterval
TypeComparator.prototype.visitFixedSizeList = compareFixedSizeList
TypeComparator.prototype.visitMap = compareMap
/** @ignore */
export const instance = new TypeComparator()

//# sourceMappingURL=typecomparator.mjs.map
