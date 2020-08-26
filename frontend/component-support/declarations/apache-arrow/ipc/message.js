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
const enum_1 = require("../enum")
const flatbuffers_1 = require("flatbuffers")
var ByteBuffer = flatbuffers_1.flatbuffers.ByteBuffer
const message_1 = require("./metadata/message")
const compat_1 = require("../util/compat")
const file_1 = require("../io/file")
const buffer_1 = require("../util/buffer")
const stream_1 = require("../io/stream")
const interfaces_1 = require("../io/interfaces")
/** @ignore */ const invalidMessageType = type =>
  `Expected ${enum_1.MessageHeader[type]} Message in stream, but was null or length 0.`
/** @ignore */ const nullMessage = type =>
  `Header pointer of flatbuffer-encoded ${enum_1.MessageHeader[type]} Message is null or length 0.`
/** @ignore */ const invalidMessageMetadata = (expected, actual) =>
  `Expected to read ${expected} metadata bytes, but only read ${actual}.`
/** @ignore */ const invalidMessageBodyLength = (expected, actual) =>
  `Expected to read ${expected} bytes for message body, but only read ${actual}.`
/** @ignore */
class MessageReader {
  constructor(source) {
    this.source =
      source instanceof stream_1.ByteStream
        ? source
        : new stream_1.ByteStream(source)
  }
  [Symbol.iterator]() {
    return this
  }
  next() {
    let r
    if ((r = this.readMetadataLength()).done) {
      return interfaces_1.ITERATOR_DONE
    }
    // ARROW-6313: If the first 4 bytes are continuation indicator (-1), read
    // the next 4 for the 32-bit metadata length. Otherwise, assume this is a
    // pre-v0.15 message, where the first 4 bytes are the metadata length.
    if (r.value === -1 && (r = this.readMetadataLength()).done) {
      return interfaces_1.ITERATOR_DONE
    }
    if ((r = this.readMetadata(r.value)).done) {
      return interfaces_1.ITERATOR_DONE
    }
    return r
  }
  throw(value) {
    return this.source.throw(value)
  }
  return(value) {
    return this.source.return(value)
  }
  readMessage(type) {
    let r
    if ((r = this.next()).done) {
      return null
    }
    if (type != null && r.value.headerType !== type) {
      throw new Error(invalidMessageType(type))
    }
    return r.value
  }
  readMessageBody(bodyLength) {
    if (bodyLength <= 0) {
      return new Uint8Array(0)
    }
    const buf = buffer_1.toUint8Array(this.source.read(bodyLength))
    if (buf.byteLength < bodyLength) {
      throw new Error(invalidMessageBodyLength(bodyLength, buf.byteLength))
    }
    // 1. Work around bugs in fs.ReadStream's internal Buffer pooling, see: https://github.com/nodejs/node/issues/24817
    // 2. Work around https://github.com/whatwg/streams/blob/0ebe4b042e467d9876d80ae045de3843092ad797/reference-implementation/lib/helpers.js#L126
    return /* 1. */ buf.byteOffset % 8 === 0 &&
      /* 2. */ buf.byteOffset + buf.byteLength <= buf.buffer.byteLength
      ? buf
      : buf.slice()
  }
  readSchema(throwIfNull = false) {
    const type = enum_1.MessageHeader.Schema
    const message = this.readMessage(type)
    const schema = message && message.header()
    if (throwIfNull && !schema) {
      throw new Error(nullMessage(type))
    }
    return schema
  }
  readMetadataLength() {
    const buf = this.source.read(exports.PADDING)
    const bb = buf && new ByteBuffer(buf)
    const len = (bb && bb.readInt32(0)) || 0
    return { done: len === 0, value: len }
  }
  readMetadata(metadataLength) {
    const buf = this.source.read(metadataLength)
    if (!buf) {
      return interfaces_1.ITERATOR_DONE
    }
    if (buf.byteLength < metadataLength) {
      throw new Error(invalidMessageMetadata(metadataLength, buf.byteLength))
    }
    return { done: false, value: message_1.Message.decode(buf) }
  }
}
exports.MessageReader = MessageReader
/** @ignore */
class AsyncMessageReader {
  constructor(source, byteLength) {
    this.source =
      source instanceof stream_1.AsyncByteStream
        ? source
        : compat_1.isFileHandle(source)
        ? new file_1.AsyncRandomAccessFile(source, byteLength)
        : new stream_1.AsyncByteStream(source)
  }
  [Symbol.asyncIterator]() {
    return this
  }
  async next() {
    let r
    if ((r = await this.readMetadataLength()).done) {
      return interfaces_1.ITERATOR_DONE
    }
    // ARROW-6313: If the first 4 bytes are continuation indicator (-1), read
    // the next 4 for the 32-bit metadata length. Otherwise, assume this is a
    // pre-v0.15 message, where the first 4 bytes are the metadata length.
    if (r.value === -1 && (r = await this.readMetadataLength()).done) {
      return interfaces_1.ITERATOR_DONE
    }
    if ((r = await this.readMetadata(r.value)).done) {
      return interfaces_1.ITERATOR_DONE
    }
    return r
  }
  async throw(value) {
    return await this.source.throw(value)
  }
  async return(value) {
    return await this.source.return(value)
  }
  async readMessage(type) {
    let r
    if ((r = await this.next()).done) {
      return null
    }
    if (type != null && r.value.headerType !== type) {
      throw new Error(invalidMessageType(type))
    }
    return r.value
  }
  async readMessageBody(bodyLength) {
    if (bodyLength <= 0) {
      return new Uint8Array(0)
    }
    const buf = buffer_1.toUint8Array(await this.source.read(bodyLength))
    if (buf.byteLength < bodyLength) {
      throw new Error(invalidMessageBodyLength(bodyLength, buf.byteLength))
    }
    // 1. Work around bugs in fs.ReadStream's internal Buffer pooling, see: https://github.com/nodejs/node/issues/24817
    // 2. Work around https://github.com/whatwg/streams/blob/0ebe4b042e467d9876d80ae045de3843092ad797/reference-implementation/lib/helpers.js#L126
    return /* 1. */ buf.byteOffset % 8 === 0 &&
      /* 2. */ buf.byteOffset + buf.byteLength <= buf.buffer.byteLength
      ? buf
      : buf.slice()
  }
  async readSchema(throwIfNull = false) {
    const type = enum_1.MessageHeader.Schema
    const message = await this.readMessage(type)
    const schema = message && message.header()
    if (throwIfNull && !schema) {
      throw new Error(nullMessage(type))
    }
    return schema
  }
  async readMetadataLength() {
    const buf = await this.source.read(exports.PADDING)
    const bb = buf && new ByteBuffer(buf)
    const len = (bb && bb.readInt32(0)) || 0
    return { done: len === 0, value: len }
  }
  async readMetadata(metadataLength) {
    const buf = await this.source.read(metadataLength)
    if (!buf) {
      return interfaces_1.ITERATOR_DONE
    }
    if (buf.byteLength < metadataLength) {
      throw new Error(invalidMessageMetadata(metadataLength, buf.byteLength))
    }
    return { done: false, value: message_1.Message.decode(buf) }
  }
}
exports.AsyncMessageReader = AsyncMessageReader
/** @ignore */
class JSONMessageReader extends MessageReader {
  constructor(source) {
    super(new Uint8Array(0))
    this._schema = false
    this._body = []
    this._batchIndex = 0
    this._dictionaryIndex = 0
    this._json =
      source instanceof interfaces_1.ArrowJSON
        ? source
        : new interfaces_1.ArrowJSON(source)
  }
  next() {
    const { _json } = this
    if (!this._schema) {
      this._schema = true
      const message = message_1.Message.fromJSON(
        _json.schema,
        enum_1.MessageHeader.Schema
      )
      return { done: false, value: message }
    }
    if (this._dictionaryIndex < _json.dictionaries.length) {
      const batch = _json.dictionaries[this._dictionaryIndex++]
      this._body = batch["data"]["columns"]
      const message = message_1.Message.fromJSON(
        batch,
        enum_1.MessageHeader.DictionaryBatch
      )
      return { done: false, value: message }
    }
    if (this._batchIndex < _json.batches.length) {
      const batch = _json.batches[this._batchIndex++]
      this._body = batch["columns"]
      const message = message_1.Message.fromJSON(
        batch,
        enum_1.MessageHeader.RecordBatch
      )
      return { done: false, value: message }
    }
    this._body = []
    return interfaces_1.ITERATOR_DONE
  }
  readMessageBody(_bodyLength) {
    return flattenDataSources(this._body)
    function flattenDataSources(xs) {
      return (xs || []).reduce(
        (buffers, column) => [
          ...buffers,
          ...((column["VALIDITY"] && [column["VALIDITY"]]) || []),
          ...((column["TYPE"] && [column["TYPE"]]) || []),
          ...((column["OFFSET"] && [column["OFFSET"]]) || []),
          ...((column["DATA"] && [column["DATA"]]) || []),
          ...flattenDataSources(column["children"]),
        ],
        []
      )
    }
  }
  readMessage(type) {
    let r
    if ((r = this.next()).done) {
      return null
    }
    if (type != null && r.value.headerType !== type) {
      throw new Error(invalidMessageType(type))
    }
    return r.value
  }
  readSchema() {
    const type = enum_1.MessageHeader.Schema
    const message = this.readMessage(type)
    const schema = message && message.header()
    if (!message || !schema) {
      throw new Error(nullMessage(type))
    }
    return schema
  }
}
exports.JSONMessageReader = JSONMessageReader
/** @ignore */
exports.PADDING = 4
/** @ignore */
exports.MAGIC_STR = "ARROW1"
/** @ignore */
exports.MAGIC = new Uint8Array(exports.MAGIC_STR.length)
for (let i = 0; i < exports.MAGIC_STR.length; i += 1 | 0) {
  exports.MAGIC[i] = exports.MAGIC_STR.charCodeAt(i)
}
/** @ignore */
function checkForMagicArrowString(buffer, index = 0) {
  for (let i = -1, n = exports.MAGIC.length; ++i < n; ) {
    if (exports.MAGIC[i] !== buffer[index + i]) {
      return false
    }
  }
  return true
}
exports.checkForMagicArrowString = checkForMagicArrowString
/** @ignore */
exports.magicLength = exports.MAGIC.length
/** @ignore */
exports.magicAndPadding = exports.magicLength + exports.PADDING
/** @ignore */
exports.magicX2AndPadding = exports.magicLength * 2 + exports.PADDING

//# sourceMappingURL=message.js.map
