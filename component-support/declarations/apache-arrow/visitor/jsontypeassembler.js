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
const visitor_1 = require("../visitor");
const enum_1 = require("../enum");
/** @ignore */
class JSONTypeAssembler extends visitor_1.Visitor {
  visit(node) {
    return node == null ? undefined : super.visit(node);
  }
  visitNull({ typeId }) {
    return { name: enum_1.ArrowType[typeId].toLowerCase() };
  }
  visitInt({ typeId, bitWidth, isSigned }) {
    return {
      name: enum_1.ArrowType[typeId].toLowerCase(),
      bitWidth: bitWidth,
      isSigned: isSigned
    };
  }
  visitFloat({ typeId, precision }) {
    return {
      name: enum_1.ArrowType[typeId].toLowerCase(),
      precision: enum_1.Precision[precision]
    };
  }
  visitBinary({ typeId }) {
    return { name: enum_1.ArrowType[typeId].toLowerCase() };
  }
  visitBool({ typeId }) {
    return { name: enum_1.ArrowType[typeId].toLowerCase() };
  }
  visitUtf8({ typeId }) {
    return { name: enum_1.ArrowType[typeId].toLowerCase() };
  }
  visitDecimal({ typeId, scale, precision }) {
    return {
      name: enum_1.ArrowType[typeId].toLowerCase(),
      scale: scale,
      precision: precision
    };
  }
  visitDate({ typeId, unit }) {
    return {
      name: enum_1.ArrowType[typeId].toLowerCase(),
      unit: enum_1.DateUnit[unit]
    };
  }
  visitTime({ typeId, unit, bitWidth }) {
    return {
      name: enum_1.ArrowType[typeId].toLowerCase(),
      unit: enum_1.TimeUnit[unit],
      bitWidth
    };
  }
  visitTimestamp({ typeId, timezone, unit }) {
    return {
      name: enum_1.ArrowType[typeId].toLowerCase(),
      unit: enum_1.TimeUnit[unit],
      timezone
    };
  }
  visitInterval({ typeId, unit }) {
    return {
      name: enum_1.ArrowType[typeId].toLowerCase(),
      unit: enum_1.IntervalUnit[unit]
    };
  }
  visitList({ typeId }) {
    return { name: enum_1.ArrowType[typeId].toLowerCase() };
  }
  visitStruct({ typeId }) {
    return { name: enum_1.ArrowType[typeId].toLowerCase() };
  }
  visitUnion({ typeId, mode, typeIds }) {
    return {
      name: enum_1.ArrowType[typeId].toLowerCase(),
      mode: enum_1.UnionMode[mode],
      typeIds: [...typeIds]
    };
  }
  visitDictionary(node) {
    return this.visit(node.dictionary);
  }
  visitFixedSizeBinary({ typeId, byteWidth }) {
    return {
      name: enum_1.ArrowType[typeId].toLowerCase(),
      byteWidth: byteWidth
    };
  }
  visitFixedSizeList({ typeId, listSize }) {
    return {
      name: enum_1.ArrowType[typeId].toLowerCase(),
      listSize: listSize
    };
  }
  visitMap({ typeId, keysSorted }) {
    return {
      name: enum_1.ArrowType[typeId].toLowerCase(),
      keysSorted: keysSorted
    };
  }
}
exports.JSONTypeAssembler = JSONTypeAssembler;

//# sourceMappingURL=jsontypeassembler.js.map
