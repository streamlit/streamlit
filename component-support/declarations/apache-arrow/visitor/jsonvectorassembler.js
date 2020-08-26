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
const bn_1 = require("../util/bn");
const column_1 = require("../column");
const vector_1 = require("../vector");
const visitor_1 = require("../visitor");
const enum_1 = require("../enum");
const recordbatch_1 = require("../recordbatch");
const enum_2 = require("../enum");
const bit_1 = require("../util/bit");
const args_1 = require("../util/args");
const type_1 = require("../type");
/** @ignore */
class JSONVectorAssembler extends visitor_1.Visitor {
  /** @nocollapse */
  static assemble(...args) {
    return new JSONVectorAssembler().visitMany(
      args_1.selectColumnChildrenArgs(recordbatch_1.RecordBatch, args)
    );
  }
  visit(column) {
    const { data, name, length } = column;
    const { offset, nullCount, nullBitmap } = data;
    const type = type_1.DataType.isDictionary(column.type)
      ? column.type.indices
      : column.type;
    const buffers = Object.assign([], data.buffers, {
      [enum_1.BufferType.VALIDITY]: undefined
    });
    return {
      name: name,
      count: length,
      VALIDITY: type_1.DataType.isNull(type)
        ? undefined
        : nullCount <= 0
        ? Array.from({ length }, () => 1)
        : [
            ...bit_1.iterateBits(
              nullBitmap,
              offset,
              length,
              null,
              bit_1.getBit
            )
          ],
      ...super.visit(
        vector_1.Vector.new(data.clone(type, offset, length, 0, buffers))
      )
    };
  }
  visitNull() {
    return {};
  }
  visitBool({ values, offset, length }) {
    return {
      DATA: [...bit_1.iterateBits(values, offset, length, null, bit_1.getBool)]
    };
  }
  visitInt(vector) {
    return {
      DATA:
        vector.type.bitWidth < 64
          ? [...vector.values]
          : [...bigNumsToStrings(vector.values, 2)]
    };
  }
  visitFloat(vector) {
    return { DATA: [...vector.values] };
  }
  visitUtf8(vector) {
    return { DATA: [...vector], OFFSET: [...vector.valueOffsets] };
  }
  visitBinary(vector) {
    return {
      DATA: [...binaryToString(vector)],
      OFFSET: [...vector.valueOffsets]
    };
  }
  visitFixedSizeBinary(vector) {
    return { DATA: [...binaryToString(vector)] };
  }
  visitDate(vector) {
    return {
      DATA:
        vector.type.unit === enum_2.DateUnit.DAY
          ? [...vector.values]
          : [...bigNumsToStrings(vector.values, 2)]
    };
  }
  visitTimestamp(vector) {
    return { DATA: [...bigNumsToStrings(vector.values, 2)] };
  }
  visitTime(vector) {
    return {
      DATA:
        vector.type.unit < enum_2.TimeUnit.MICROSECOND
          ? [...vector.values]
          : [...bigNumsToStrings(vector.values, 2)]
    };
  }
  visitDecimal(vector) {
    return { DATA: [...bigNumsToStrings(vector.values, 4)] };
  }
  visitList(vector) {
    return {
      OFFSET: [...vector.valueOffsets],
      children: vector.type.children.map((f, i) =>
        this.visit(new column_1.Column(f, [vector.getChildAt(i)]))
      )
    };
  }
  visitStruct(vector) {
    return {
      children: vector.type.children.map((f, i) =>
        this.visit(new column_1.Column(f, [vector.getChildAt(i)]))
      )
    };
  }
  visitUnion(vector) {
    return {
      TYPE: [...vector.typeIds],
      OFFSET:
        vector.type.mode === enum_2.UnionMode.Dense
          ? [...vector.valueOffsets]
          : undefined,
      children: vector.type.children.map((f, i) =>
        this.visit(new column_1.Column(f, [vector.getChildAt(i)]))
      )
    };
  }
  visitInterval(vector) {
    return { DATA: [...vector.values] };
  }
  visitFixedSizeList(vector) {
    return {
      children: vector.type.children.map((f, i) =>
        this.visit(new column_1.Column(f, [vector.getChildAt(i)]))
      )
    };
  }
  visitMap(vector) {
    return {
      OFFSET: [...vector.valueOffsets],
      children: vector.type.children.map((f, i) =>
        this.visit(new column_1.Column(f, [vector.getChildAt(i)]))
      )
    };
  }
}
exports.JSONVectorAssembler = JSONVectorAssembler;
/** @ignore */
function* binaryToString(vector) {
  for (const octets of vector) {
    yield octets
      .reduce((str, byte) => {
        return `${str}${("0" + (byte & 0xff).toString(16)).slice(-2)}`;
      }, "")
      .toUpperCase();
  }
}
/** @ignore */
function* bigNumsToStrings(values, stride) {
  for (let i = -1, n = values.length / stride; ++i < n; ) {
    yield `${bn_1.BN.new(
      values.subarray((i + 0) * stride, (i + 1) * stride),
      false
    )}`;
  }
}

//# sourceMappingURL=jsonvectorassembler.js.map
