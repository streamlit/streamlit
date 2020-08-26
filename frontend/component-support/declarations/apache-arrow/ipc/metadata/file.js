"use strict"
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
Object.defineProperty(exports, "__esModule", { value: true })
/* tslint:disable:class-name */
const File_ = require("../../fb/File")
const flatbuffers_1 = require("flatbuffers")
var Long = flatbuffers_1.flatbuffers.Long
var Builder = flatbuffers_1.flatbuffers.Builder
var ByteBuffer = flatbuffers_1.flatbuffers.ByteBuffer
var _Block = File_.org.apache.arrow.flatbuf.Block
var _Footer = File_.org.apache.arrow.flatbuf.Footer
const schema_1 = require("../../schema")
const enum_1 = require("../../enum")
const buffer_1 = require("../../util/buffer")
/** @ignore */
class Footer_ {
  constructor(
    schema,
    version = enum_1.MetadataVersion.V4,
    recordBatches,
    dictionaryBatches
  ) {
    this.schema = schema
    this.version = version
    recordBatches && (this._recordBatches = recordBatches)
    dictionaryBatches && (this._dictionaryBatches = dictionaryBatches)
  }
  /** @nocollapse */
  static decode(buf) {
    buf = new ByteBuffer(buffer_1.toUint8Array(buf))
    const footer = _Footer.getRootAsFooter(buf)
    const schema = schema_1.Schema.decode(footer.schema())
    return new OffHeapFooter(schema, footer)
  }
  /** @nocollapse */
  static encode(footer) {
    const b = new Builder()
    const schemaOffset = schema_1.Schema.encode(b, footer.schema)
    _Footer.startRecordBatchesVector(b, footer.numRecordBatches)
    ;[...footer.recordBatches()]
      .slice()
      .reverse()
      .forEach(rb => FileBlock.encode(b, rb))
    const recordBatchesOffset = b.endVector()
    _Footer.startDictionariesVector(b, footer.numDictionaries)
    ;[...footer.dictionaryBatches()]
      .slice()
      .reverse()
      .forEach(db => FileBlock.encode(b, db))
    const dictionaryBatchesOffset = b.endVector()
    _Footer.startFooter(b)
    _Footer.addSchema(b, schemaOffset)
    _Footer.addVersion(b, enum_1.MetadataVersion.V4)
    _Footer.addRecordBatches(b, recordBatchesOffset)
    _Footer.addDictionaries(b, dictionaryBatchesOffset)
    _Footer.finishFooterBuffer(b, _Footer.endFooter(b))
    return b.asUint8Array()
  }
  get numRecordBatches() {
    return this._recordBatches.length
  }
  get numDictionaries() {
    return this._dictionaryBatches.length
  }
  *recordBatches() {
    for (let block, i = -1, n = this.numRecordBatches; ++i < n; ) {
      if ((block = this.getRecordBatch(i))) {
        yield block
      }
    }
  }
  *dictionaryBatches() {
    for (let block, i = -1, n = this.numDictionaries; ++i < n; ) {
      if ((block = this.getDictionaryBatch(i))) {
        yield block
      }
    }
  }
  getRecordBatch(index) {
    return (
      (index >= 0 &&
        index < this.numRecordBatches &&
        this._recordBatches[index]) ||
      null
    )
  }
  getDictionaryBatch(index) {
    return (
      (index >= 0 &&
        index < this.numDictionaries &&
        this._dictionaryBatches[index]) ||
      null
    )
  }
}
exports.Footer = Footer_
/** @ignore */
class OffHeapFooter extends Footer_ {
  constructor(schema, _footer) {
    super(schema, _footer.version())
    this._footer = _footer
  }
  get numRecordBatches() {
    return this._footer.recordBatchesLength()
  }
  get numDictionaries() {
    return this._footer.dictionariesLength()
  }
  getRecordBatch(index) {
    if (index >= 0 && index < this.numRecordBatches) {
      const fileBlock = this._footer.recordBatches(index)
      if (fileBlock) {
        return FileBlock.decode(fileBlock)
      }
    }
    return null
  }
  getDictionaryBatch(index) {
    if (index >= 0 && index < this.numDictionaries) {
      const fileBlock = this._footer.dictionaries(index)
      if (fileBlock) {
        return FileBlock.decode(fileBlock)
      }
    }
    return null
  }
}
/** @ignore */
class FileBlock {
  /** @nocollapse */
  static decode(block) {
    return new FileBlock(
      block.metaDataLength(),
      block.bodyLength(),
      block.offset()
    )
  }
  /** @nocollapse */
  static encode(b, fileBlock) {
    const { metaDataLength } = fileBlock
    const offset = new Long(fileBlock.offset, 0)
    const bodyLength = new Long(fileBlock.bodyLength, 0)
    return _Block.createBlock(b, offset, metaDataLength, bodyLength)
  }
  constructor(metaDataLength, bodyLength, offset) {
    this.metaDataLength = metaDataLength
    this.offset = typeof offset === "number" ? offset : offset.low
    this.bodyLength =
      typeof bodyLength === "number" ? bodyLength : bodyLength.low
  }
}
exports.FileBlock = FileBlock

//# sourceMappingURL=file.js.map
