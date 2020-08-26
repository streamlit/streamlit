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
import { flatbuffers } from "flatbuffers";
var Long = flatbuffers.Long;
import * as Schema_ from "../fb/Schema";
import { Visitor } from "../visitor";
var Null = Schema_.org.apache.arrow.flatbuf.Null;
var Int = Schema_.org.apache.arrow.flatbuf.Int;
var FloatingPoint = Schema_.org.apache.arrow.flatbuf.FloatingPoint;
var Binary = Schema_.org.apache.arrow.flatbuf.Binary;
var Bool = Schema_.org.apache.arrow.flatbuf.Bool;
var Utf8 = Schema_.org.apache.arrow.flatbuf.Utf8;
var Decimal = Schema_.org.apache.arrow.flatbuf.Decimal;
var Date = Schema_.org.apache.arrow.flatbuf.Date;
var Time = Schema_.org.apache.arrow.flatbuf.Time;
var Timestamp = Schema_.org.apache.arrow.flatbuf.Timestamp;
var Interval = Schema_.org.apache.arrow.flatbuf.Interval;
var List = Schema_.org.apache.arrow.flatbuf.List;
var Struct = Schema_.org.apache.arrow.flatbuf.Struct_;
var Union = Schema_.org.apache.arrow.flatbuf.Union;
var DictionaryEncoding = Schema_.org.apache.arrow.flatbuf.DictionaryEncoding;
var FixedSizeBinary = Schema_.org.apache.arrow.flatbuf.FixedSizeBinary;
var FixedSizeList = Schema_.org.apache.arrow.flatbuf.FixedSizeList;
var Map_ = Schema_.org.apache.arrow.flatbuf.Map;
/** @ignore */
export class TypeAssembler extends Visitor {
  visit(node, builder) {
    return node == null || builder == null
      ? undefined
      : super.visit(node, builder);
  }
  visitNull(_node, b) {
    Null.startNull(b);
    return Null.endNull(b);
  }
  visitInt(node, b) {
    Int.startInt(b);
    Int.addBitWidth(b, node.bitWidth);
    Int.addIsSigned(b, node.isSigned);
    return Int.endInt(b);
  }
  visitFloat(node, b) {
    FloatingPoint.startFloatingPoint(b);
    FloatingPoint.addPrecision(b, node.precision);
    return FloatingPoint.endFloatingPoint(b);
  }
  visitBinary(_node, b) {
    Binary.startBinary(b);
    return Binary.endBinary(b);
  }
  visitBool(_node, b) {
    Bool.startBool(b);
    return Bool.endBool(b);
  }
  visitUtf8(_node, b) {
    Utf8.startUtf8(b);
    return Utf8.endUtf8(b);
  }
  visitDecimal(node, b) {
    Decimal.startDecimal(b);
    Decimal.addScale(b, node.scale);
    Decimal.addPrecision(b, node.precision);
    return Decimal.endDecimal(b);
  }
  visitDate(node, b) {
    Date.startDate(b);
    Date.addUnit(b, node.unit);
    return Date.endDate(b);
  }
  visitTime(node, b) {
    Time.startTime(b);
    Time.addUnit(b, node.unit);
    Time.addBitWidth(b, node.bitWidth);
    return Time.endTime(b);
  }
  visitTimestamp(node, b) {
    const timezone =
      (node.timezone && b.createString(node.timezone)) || undefined;
    Timestamp.startTimestamp(b);
    Timestamp.addUnit(b, node.unit);
    if (timezone !== undefined) {
      Timestamp.addTimezone(b, timezone);
    }
    return Timestamp.endTimestamp(b);
  }
  visitInterval(node, b) {
    Interval.startInterval(b);
    Interval.addUnit(b, node.unit);
    return Interval.endInterval(b);
  }
  visitList(_node, b) {
    List.startList(b);
    return List.endList(b);
  }
  visitStruct(_node, b) {
    Struct.startStruct_(b);
    return Struct.endStruct_(b);
  }
  visitUnion(node, b) {
    Union.startTypeIdsVector(b, node.typeIds.length);
    const typeIds = Union.createTypeIdsVector(b, node.typeIds);
    Union.startUnion(b);
    Union.addMode(b, node.mode);
    Union.addTypeIds(b, typeIds);
    return Union.endUnion(b);
  }
  visitDictionary(node, b) {
    const indexType = this.visit(node.indices, b);
    DictionaryEncoding.startDictionaryEncoding(b);
    DictionaryEncoding.addId(b, new Long(node.id, 0));
    DictionaryEncoding.addIsOrdered(b, node.isOrdered);
    if (indexType !== undefined) {
      DictionaryEncoding.addIndexType(b, indexType);
    }
    return DictionaryEncoding.endDictionaryEncoding(b);
  }
  visitFixedSizeBinary(node, b) {
    FixedSizeBinary.startFixedSizeBinary(b);
    FixedSizeBinary.addByteWidth(b, node.byteWidth);
    return FixedSizeBinary.endFixedSizeBinary(b);
  }
  visitFixedSizeList(node, b) {
    FixedSizeList.startFixedSizeList(b);
    FixedSizeList.addListSize(b, node.listSize);
    return FixedSizeList.endFixedSizeList(b);
  }
  visitMap(node, b) {
    Map_.startMap(b);
    Map_.addKeysSorted(b, node.keysSorted);
    return Map_.endMap(b);
  }
}
/** @ignore */
export const instance = new TypeAssembler();

//# sourceMappingURL=typeassembler.mjs.map
