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
import { Column } from "../column"
import { Vector } from "../vector"
import { Visitor } from "../visitor"
import { BufferType } from "../enum"
import { RecordBatch } from "../recordbatch"
import { UnionMode, DateUnit, TimeUnit } from "../enum"
import { iterateBits, getBit, getBool } from "../util/bit"
import { selectColumnChildrenArgs } from "../util/args"
import { DataType } from "../type"
/** @ignore */
export class JSONVectorAssembler extends Visitor {
  /** @nocollapse */
  static assemble(...args) {
    return new JSONVectorAssembler().visitMany(
      selectColumnChildrenArgs(RecordBatch, args)
    )
  }
  visit(column) {
    const { data, name, length } = column
    const { offset, nullCount, nullBitmap } = data
    const type = DataType.isDictionary(column.type)
      ? column.type.indices
      : column.type
    const buffers = Object.assign([], data.buffers, {
      [BufferType.VALIDITY]: undefined,
    })
    return {
      name: name,
      count: length,
      VALIDITY: DataType.isNull(type)
        ? undefined
        : nullCount <= 0
        ? Array.from({ length }, () => 1)
        : [...iterateBits(nullBitmap, offset, length, null, getBit)],
      ...super.visit(Vector.new(data.clone(type, offset, length, 0, buffers))),
    }
  }
  visitNull() {
    return {}
  }
  visitBool({ values, offset, length }) {
    return { DATA: [...iterateBits(values, offset, length, null, getBool)] }
  }
  visitInt(vector) {
    return {
      DATA:
        vector.type.bitWidth < 64
          ? [...vector.values]
          : [...bigNumsToStrings(vector.values, 2)],
    }
  }
  visitFloat(vector) {
    return { DATA: [...vector.values] }
  }
  visitUtf8(vector) {
    return { DATA: [...vector], OFFSET: [...vector.valueOffsets] }
  }
  visitBinary(vector) {
    return {
      DATA: [...binaryToString(vector)],
      OFFSET: [...vector.valueOffsets],
    }
  }
  visitFixedSizeBinary(vector) {
    return { DATA: [...binaryToString(vector)] }
  }
  visitDate(vector) {
    return {
      DATA:
        vector.type.unit === DateUnit.DAY
          ? [...vector.values]
          : [...bigNumsToStrings(vector.values, 2)],
    }
  }
  visitTimestamp(vector) {
    return { DATA: [...bigNumsToStrings(vector.values, 2)] }
  }
  visitTime(vector) {
    return {
      DATA:
        vector.type.unit < TimeUnit.MICROSECOND
          ? [...vector.values]
          : [...bigNumsToStrings(vector.values, 2)],
    }
  }
  visitDecimal(vector) {
    return { DATA: [...bigNumsToStrings(vector.values, 4)] }
  }
  visitList(vector) {
    return {
      OFFSET: [...vector.valueOffsets],
      children: vector.type.children.map((f, i) =>
        this.visit(new Column(f, [vector.getChildAt(i)]))
      ),
    }
  }
  visitStruct(vector) {
    return {
      children: vector.type.children.map((f, i) =>
        this.visit(new Column(f, [vector.getChildAt(i)]))
      ),
    }
  }
  visitUnion(vector) {
    return {
      TYPE: [...vector.typeIds],
      OFFSET:
        vector.type.mode === UnionMode.Dense
          ? [...vector.valueOffsets]
          : undefined,
      children: vector.type.children.map((f, i) =>
        this.visit(new Column(f, [vector.getChildAt(i)]))
      ),
    }
  }
  visitInterval(vector) {
    return { DATA: [...vector.values] }
  }
  visitFixedSizeList(vector) {
    return {
      children: vector.type.children.map((f, i) =>
        this.visit(new Column(f, [vector.getChildAt(i)]))
      ),
    }
  }
  visitMap(vector) {
    return {
      OFFSET: [...vector.valueOffsets],
      children: vector.type.children.map((f, i) =>
        this.visit(new Column(f, [vector.getChildAt(i)]))
      ),
    }
  }
}
/** @ignore */
function* binaryToString(vector) {
  for (const octets of vector) {
    yield octets
      .reduce((str, byte) => {
        return `${str}${("0" + (byte & 0xff).toString(16)).slice(-2)}`
      }, "")
      .toUpperCase()
  }
}
/** @ignore */
function* bigNumsToStrings(values, stride) {
  for (let i = -1, n = values.length / stride; ++i < n; ) {
    yield `${BN.new(
      values.subarray((i + 0) * stride, (i + 1) * stride),
      false
    )}`
  }
}

//# sourceMappingURL=jsonvectorassembler.mjs.map
