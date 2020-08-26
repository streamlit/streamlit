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
const data_1 = require("../data");
const schema_1 = require("../schema");
const type_1 = require("../type");
const visitor_1 = require("../visitor");
const bit_1 = require("../util/bit");
const utf8_1 = require("../util/utf8");
const int_1 = require("../util/int");
const enum_1 = require("../enum");
const buffer_1 = require("../util/buffer");
/** @ignore */
class VectorLoader extends visitor_1.Visitor {
  constructor(bytes, nodes, buffers, dictionaries) {
    super();
    this.nodesIndex = -1;
    this.buffersIndex = -1;
    this.bytes = bytes;
    this.nodes = nodes;
    this.buffers = buffers;
    this.dictionaries = dictionaries;
  }
  visit(node) {
    return super.visit(node instanceof schema_1.Field ? node.type : node);
  }
  visitNull(type, { length } = this.nextFieldNode()) {
    return data_1.Data.Null(type, 0, length);
  }
  visitBool(type, { length, nullCount } = this.nextFieldNode()) {
    return data_1.Data.Bool(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readData(type)
    );
  }
  visitInt(type, { length, nullCount } = this.nextFieldNode()) {
    return data_1.Data.Int(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readData(type)
    );
  }
  visitFloat(type, { length, nullCount } = this.nextFieldNode()) {
    return data_1.Data.Float(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readData(type)
    );
  }
  visitUtf8(type, { length, nullCount } = this.nextFieldNode()) {
    return data_1.Data.Utf8(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readOffsets(type),
      this.readData(type)
    );
  }
  visitBinary(type, { length, nullCount } = this.nextFieldNode()) {
    return data_1.Data.Binary(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readOffsets(type),
      this.readData(type)
    );
  }
  visitFixedSizeBinary(type, { length, nullCount } = this.nextFieldNode()) {
    return data_1.Data.FixedSizeBinary(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readData(type)
    );
  }
  visitDate(type, { length, nullCount } = this.nextFieldNode()) {
    return data_1.Data.Date(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readData(type)
    );
  }
  visitTimestamp(type, { length, nullCount } = this.nextFieldNode()) {
    return data_1.Data.Timestamp(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readData(type)
    );
  }
  visitTime(type, { length, nullCount } = this.nextFieldNode()) {
    return data_1.Data.Time(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readData(type)
    );
  }
  visitDecimal(type, { length, nullCount } = this.nextFieldNode()) {
    return data_1.Data.Decimal(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readData(type)
    );
  }
  visitList(type, { length, nullCount } = this.nextFieldNode()) {
    return data_1.Data.List(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readOffsets(type),
      this.visit(type.children[0])
    );
  }
  visitStruct(type, { length, nullCount } = this.nextFieldNode()) {
    return data_1.Data.Struct(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.visitMany(type.children)
    );
  }
  visitUnion(type) {
    return type.mode === enum_1.UnionMode.Sparse
      ? this.visitSparseUnion(type)
      : this.visitDenseUnion(type);
  }
  visitDenseUnion(type, { length, nullCount } = this.nextFieldNode()) {
    return data_1.Data.Union(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readTypeIds(type),
      this.readOffsets(type),
      this.visitMany(type.children)
    );
  }
  visitSparseUnion(type, { length, nullCount } = this.nextFieldNode()) {
    return data_1.Data.Union(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readTypeIds(type),
      this.visitMany(type.children)
    );
  }
  visitDictionary(type, { length, nullCount } = this.nextFieldNode()) {
    return data_1.Data.Dictionary(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readData(type.indices),
      this.readDictionary(type)
    );
  }
  visitInterval(type, { length, nullCount } = this.nextFieldNode()) {
    return data_1.Data.Interval(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readData(type)
    );
  }
  visitFixedSizeList(type, { length, nullCount } = this.nextFieldNode()) {
    return data_1.Data.FixedSizeList(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.visit(type.children[0])
    );
  }
  visitMap(type, { length, nullCount } = this.nextFieldNode()) {
    return data_1.Data.Map(
      type,
      0,
      length,
      nullCount,
      this.readNullBitmap(type, nullCount),
      this.readOffsets(type),
      this.visit(type.children[0])
    );
  }
  nextFieldNode() {
    return this.nodes[++this.nodesIndex];
  }
  nextBufferRange() {
    return this.buffers[++this.buffersIndex];
  }
  readNullBitmap(type, nullCount, buffer = this.nextBufferRange()) {
    return (nullCount > 0 && this.readData(type, buffer)) || new Uint8Array(0);
  }
  readOffsets(type, buffer) {
    return this.readData(type, buffer);
  }
  readTypeIds(type, buffer) {
    return this.readData(type, buffer);
  }
  readData(_type, { length, offset } = this.nextBufferRange()) {
    return this.bytes.subarray(offset, offset + length);
  }
  readDictionary(type) {
    return this.dictionaries.get(type.id);
  }
}
exports.VectorLoader = VectorLoader;
/** @ignore */
class JSONVectorLoader extends VectorLoader {
  constructor(sources, nodes, buffers, dictionaries) {
    super(new Uint8Array(0), nodes, buffers, dictionaries);
    this.sources = sources;
  }
  readNullBitmap(_type, nullCount, { offset } = this.nextBufferRange()) {
    return nullCount <= 0
      ? new Uint8Array(0)
      : bit_1.packBools(this.sources[offset]);
  }
  readOffsets(_type, { offset } = this.nextBufferRange()) {
    return buffer_1.toArrayBufferView(
      Uint8Array,
      buffer_1.toArrayBufferView(Int32Array, this.sources[offset])
    );
  }
  readTypeIds(type, { offset } = this.nextBufferRange()) {
    return buffer_1.toArrayBufferView(
      Uint8Array,
      buffer_1.toArrayBufferView(type.ArrayType, this.sources[offset])
    );
  }
  readData(type, { offset } = this.nextBufferRange()) {
    const { sources } = this;
    if (type_1.DataType.isTimestamp(type)) {
      return buffer_1.toArrayBufferView(
        Uint8Array,
        int_1.Int64.convertArray(sources[offset])
      );
    } else if (
      (type_1.DataType.isInt(type) || type_1.DataType.isTime(type)) &&
      type.bitWidth === 64
    ) {
      return buffer_1.toArrayBufferView(
        Uint8Array,
        int_1.Int64.convertArray(sources[offset])
      );
    } else if (
      type_1.DataType.isDate(type) &&
      type.unit === enum_1.DateUnit.MILLISECOND
    ) {
      return buffer_1.toArrayBufferView(
        Uint8Array,
        int_1.Int64.convertArray(sources[offset])
      );
    } else if (type_1.DataType.isDecimal(type)) {
      return buffer_1.toArrayBufferView(
        Uint8Array,
        int_1.Int128.convertArray(sources[offset])
      );
    } else if (
      type_1.DataType.isBinary(type) ||
      type_1.DataType.isFixedSizeBinary(type)
    ) {
      return binaryDataFromJSON(sources[offset]);
    } else if (type_1.DataType.isBool(type)) {
      return bit_1.packBools(sources[offset]);
    } else if (type_1.DataType.isUtf8(type)) {
      return utf8_1.encodeUtf8(sources[offset].join(""));
    }
    return buffer_1.toArrayBufferView(
      Uint8Array,
      buffer_1.toArrayBufferView(type.ArrayType, sources[offset].map(x => +x))
    );
  }
}
exports.JSONVectorLoader = JSONVectorLoader;
/** @ignore */
function binaryDataFromJSON(values) {
  // "DATA": ["49BC7D5B6C47D2","3F5FB6D9322026"]
  // There are definitely more efficient ways to do this... but it gets the
  // job done.
  const joined = values.join("");
  const data = new Uint8Array(joined.length / 2);
  for (let i = 0; i < joined.length; i += 2) {
    data[i >> 1] = parseInt(joined.substr(i, 2), 16);
  }
  return data;
}

//# sourceMappingURL=vectorloader.js.map
