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
import { Data } from "../data"
import { Field } from "../schema"
import { DataType } from "../type"
import { Visitor } from "../visitor"
import { packBools } from "../util/bit"
import { encodeUtf8 } from "../util/utf8"
import { Int64, Int128 } from "../util/int"
import { UnionMode, DateUnit } from "../enum"
import { toArrayBufferView } from "../util/buffer"
/** @ignore */
export class VectorLoader extends Visitor {
  constructor(bytes, nodes, buffers, dictionaries) {
    super()
    this.nodesIndex = -1
    this.buffersIndex = -1
    this.bytes = bytes
    this.nodes = nodes
    this.buffers = buffers
    this.dictionaries = dictionaries
  }
  visit(node) {
    return super.visit(node instanceof Field ? node.type : node)
  }
  visitNull(type, { length } = this.nextFieldNode()) {
    return Data.Null(type, 0, length)
  }
  visitBool(type, { length, nullCount } = this.nextFieldNode()) {
    return Data.Bool(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readData(type)
    )
  }
  visitInt(type, { length, nullCount } = this.nextFieldNode()) {
    return Data.Int(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readData(type)
    )
  }
  visitFloat(type, { length, nullCount } = this.nextFieldNode()) {
    return Data.Float(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readData(type)
    )
  }
  visitUtf8(type, { length, nullCount } = this.nextFieldNode()) {
    return Data.Utf8(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readOffsets(type),
      this.readData(type)
    )
  }
  visitBinary(type, { length, nullCount } = this.nextFieldNode()) {
    return Data.Binary(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readOffsets(type),
      this.readData(type)
    )
  }
  visitFixedSizeBinary(type, { length, nullCount } = this.nextFieldNode()) {
    return Data.FixedSizeBinary(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readData(type)
    )
  }
  visitDate(type, { length, nullCount } = this.nextFieldNode()) {
    return Data.Date(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readData(type)
    )
  }
  visitTimestamp(type, { length, nullCount } = this.nextFieldNode()) {
    return Data.Timestamp(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readData(type)
    )
  }
  visitTime(type, { length, nullCount } = this.nextFieldNode()) {
    return Data.Time(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readData(type)
    )
  }
  visitDecimal(type, { length, nullCount } = this.nextFieldNode()) {
    return Data.Decimal(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readData(type)
    )
  }
  visitList(type, { length, nullCount } = this.nextFieldNode()) {
    return Data.List(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readOffsets(type),
      this.visit(type.children[0])
    )
  }
  visitStruct(type, { length, nullCount } = this.nextFieldNode()) {
    return Data.Struct(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.visitMany(type.children)
    )
  }
  visitUnion(type) {
    return type.mode === UnionMode.Sparse
      ? this.visitSparseUnion(type)
      : this.visitDenseUnion(type)
  }
  visitDenseUnion(type, { length, nullCount } = this.nextFieldNode()) {
    return Data.Union(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readTypeIds(type),
      this.readOffsets(type),
      this.visitMany(type.children)
    )
  }
  visitSparseUnion(type, { length, nullCount } = this.nextFieldNode()) {
    return Data.Union(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readTypeIds(type),
      this.visitMany(type.children)
    )
  }
  visitDictionary(type, { length, nullCount } = this.nextFieldNode()) {
    return Data.Dictionary(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readData(type.indices),
      this.readDictionary(type)
    )
  }
  visitInterval(type, { length, nullCount } = this.nextFieldNode()) {
    return Data.Interval(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readData(type)
    )
  }
  visitFixedSizeList(type, { length, nullCount } = this.nextFieldNode()) {
    return Data.FixedSizeList(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.visit(type.children[0])
    )
  }
  visitMap(type, { length, nullCount } = this.nextFieldNode()) {
    return Data.Map(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readOffsets(type),
      this.visit(type.children[0])
    )
  }
  nextFieldNode() {
    return this.nodes[++this.nodesIndex]
  }
  nextBufferRange() {
    return this.buffers[++this.buffersIndex]
  }
  readNullBitmap(type, nullCount, buffer = this.nextBufferRange()) {
    return (nullCount > 0 && this.readData(type, buffer)) || new Uint8Array(0)
  }
  readOffsets(type, buffer) {
    return this.readData(type, buffer)
  }
  readTypeIds(type, buffer) {
    return this.readData(type, buffer)
  }
  readData(_type, { length, offset } = this.nextBufferRange()) {
    return this.bytes.subarray(offset, offset + length)
  }
  readDictionary(type) {
    return this.dictionaries.get(type.id)
  }
}
/** @ignore */
export class JSONVectorLoader extends VectorLoader {
  constructor(sources, nodes, buffers, dictionaries) {
    super(new Uint8Array(0), nodes, buffers, dictionaries)
    this.sources = sources
  }
  readNullBitmap(_type, nullCount, { offset } = this.nextBufferRange()) {
    return nullCount <= 0 ? new Uint8Array(0) : packBools(this.sources[offset])
  }
  readOffsets(_type, { offset } = this.nextBufferRange()) {
    return toArrayBufferView(
      Uint8Array,
      toArrayBufferView(Int32Array, this.sources[offset])
    )
  }
  readTypeIds(type, { offset } = this.nextBufferRange()) {
    return toArrayBufferView(
      Uint8Array,
      toArrayBufferView(type.ArrayType, this.sources[offset])
    )
  }
  readData(type, { offset } = this.nextBufferRange()) {
    const { sources } = this
    if (DataType.isTimestamp(type)) {
      return toArrayBufferView(Uint8Array, Int64.convertArray(sources[offset]))
    } else if (
      (DataType.isInt(type) || DataType.isTime(type)) &&
      type.bitWidth === 64
    ) {
      return toArrayBufferView(Uint8Array, Int64.convertArray(sources[offset]))
    } else if (DataType.isDate(type) && type.unit === DateUnit.MILLISECOND) {
      return toArrayBufferView(Uint8Array, Int64.convertArray(sources[offset]))
    } else if (DataType.isDecimal(type)) {
      return toArrayBufferView(
        Uint8Array,
        Int128.convertArray(sources[offset])
      )
    } else if (DataType.isBinary(type) || DataType.isFixedSizeBinary(type)) {
      return binaryDataFromJSON(sources[offset])
    } else if (DataType.isBool(type)) {
      return packBools(sources[offset])
    } else if (DataType.isUtf8(type)) {
      return encodeUtf8(sources[offset].join(""))
    }
    return toArrayBufferView(
      Uint8Array,
      toArrayBufferView(type.ArrayType, sources[offset].map(x => +x))
    )
  }
}
/** @ignore */
function binaryDataFromJSON(values) {
  // "DATA": ["49BC7D5B6C47D2","3F5FB6D9322026"]
  // There are definitely more efficient ways to do this... but it gets the
  // job done.
  const joined = values.join("")
  const data = new Uint8Array(joined.length / 2)
  for (let i = 0; i < joined.length; i += 2) {
    data[i >> 1] = parseInt(joined.substr(i, 2), 16)
  }
  return data
}

//# sourceMappingURL=vectorloader.mjs.map
