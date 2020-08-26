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
import { MessageHeader } from "../enum";
import { flatbuffers } from "flatbuffers";
var ByteBuffer = flatbuffers.ByteBuffer;
import { Message } from "./metadata/message";
import { isFileHandle } from "../util/compat";
import { AsyncRandomAccessFile } from "../io/file";
import { toUint8Array } from "../util/buffer";
import { ByteStream, AsyncByteStream } from "../io/stream";
import { ArrowJSON, ITERATOR_DONE } from "../io/interfaces";
/** @ignore */ const invalidMessageType = type =>
  `Expected ${MessageHeader[type]} Message in stream, but was null or length 0.`;
/** @ignore */ const nullMessage = type =>
  `Header pointer of flatbuffer-encoded ${MessageHeader[type]} Message is null or length 0.`;
/** @ignore */ const invalidMessageMetadata = (expected, actual) =>
  `Expected to read ${expected} metadata bytes, but only read ${actual}.`;
/** @ignore */ const invalidMessageBodyLength = (expected, actual) =>
  `Expected to read ${expected} bytes for message body, but only read ${actual}.`;
/** @ignore */
export class MessageReader {
  constructor(source) {
    this.source =
      source instanceof ByteStream ? source : new ByteStream(source);
  }
  [Symbol.iterator]() {
    return this;
  }
  next() {
    let r;
    if ((r = this.readMetadataLength()).done) {
      return ITERATOR_DONE;
    }
    // ARROW-6313: If the first 4 bytes are continuation indicator (-1), read
    // the next 4 for the 32-bit metadata length. Otherwise, assume this is a
    // pre-v0.15 message, where the first 4 bytes are the metadata length.
    if (r.value === -1 && (r = this.readMetadataLength()).done) {
      return ITERATOR_DONE;
    }
    if ((r = this.readMetadata(r.value)).done) {
      return ITERATOR_DONE;
    }
    return r;
  }
  throw(value) {
    return this.source.throw(value);
  }
  return(value) {
    return this.source.return(value);
  }
  readMessage(type) {
    let r;
    if ((r = this.next()).done) {
      return null;
    }
    if (type != null && r.value.headerType !== type) {
      throw new Error(invalidMessageType(type));
    }
    return r.value;
  }
  readMessageBody(bodyLength) {
    if (bodyLength <= 0) {
      return new Uint8Array(0);
    }
    const buf = toUint8Array(this.source.read(bodyLength));
    if (buf.byteLength < bodyLength) {
      throw new Error(invalidMessageBodyLength(bodyLength, buf.byteLength));
    }
    // 1. Work around bugs in fs.ReadStream's internal Buffer pooling, see: https://github.com/nodejs/node/issues/24817
    // 2. Work around https://github.com/whatwg/streams/blob/0ebe4b042e467d9876d80ae045de3843092ad797/reference-implementation/lib/helpers.js#L126
    return /* 1. */ buf.byteOffset % 8 === 0 &&
      /* 2. */ buf.byteOffset + buf.byteLength <= buf.buffer.byteLength
      ? buf
      : buf.slice();
  }
  readSchema(throwIfNull = false) {
    const type = MessageHeader.Schema;
    const message = this.readMessage(type);
    const schema = message && message.header();
    if (throwIfNull && !schema) {
      throw new Error(nullMessage(type));
    }
    return schema;
  }
  readMetadataLength() {
    const buf = this.source.read(PADDING);
    const bb = buf && new ByteBuffer(buf);
    const len = (bb && bb.readInt32(0)) || 0;
    return { done: len === 0, value: len };
  }
  readMetadata(metadataLength) {
    const buf = this.source.read(metadataLength);
    if (!buf) {
      return ITERATOR_DONE;
    }
    if (buf.byteLength < metadataLength) {
      throw new Error(invalidMessageMetadata(metadataLength, buf.byteLength));
    }
    return { done: false, value: Message.decode(buf) };
  }
}
/** @ignore */
export class AsyncMessageReader {
  constructor(source, byteLength) {
    this.source =
      source instanceof AsyncByteStream
        ? source
        : isFileHandle(source)
        ? new AsyncRandomAccessFile(source, byteLength)
        : new AsyncByteStream(source);
  }
  [Symbol.asyncIterator]() {
    return this;
  }
  async next() {
    let r;
    if ((r = await this.readMetadataLength()).done) {
      return ITERATOR_DONE;
    }
    // ARROW-6313: If the first 4 bytes are continuation indicator (-1), read
    // the next 4 for the 32-bit metadata length. Otherwise, assume this is a
    // pre-v0.15 message, where the first 4 bytes are the metadata length.
    if (r.value === -1 && (r = await this.readMetadataLength()).done) {
      return ITERATOR_DONE;
    }
    if ((r = await this.readMetadata(r.value)).done) {
      return ITERATOR_DONE;
    }
    return r;
  }
  async throw(value) {
    return await this.source.throw(value);
  }
  async return(value) {
    return await this.source.return(value);
  }
  async readMessage(type) {
    let r;
    if ((r = await this.next()).done) {
      return null;
    }
    if (type != null && r.value.headerType !== type) {
      throw new Error(invalidMessageType(type));
    }
    return r.value;
  }
  async readMessageBody(bodyLength) {
    if (bodyLength <= 0) {
      return new Uint8Array(0);
    }
    const buf = toUint8Array(await this.source.read(bodyLength));
    if (buf.byteLength < bodyLength) {
      throw new Error(invalidMessageBodyLength(bodyLength, buf.byteLength));
    }
    // 1. Work around bugs in fs.ReadStream's internal Buffer pooling, see: https://github.com/nodejs/node/issues/24817
    // 2. Work around https://github.com/whatwg/streams/blob/0ebe4b042e467d9876d80ae045de3843092ad797/reference-implementation/lib/helpers.js#L126
    return /* 1. */ buf.byteOffset % 8 === 0 &&
      /* 2. */ buf.byteOffset + buf.byteLength <= buf.buffer.byteLength
      ? buf
      : buf.slice();
  }
  async readSchema(throwIfNull = false) {
    const type = MessageHeader.Schema;
    const message = await this.readMessage(type);
    const schema = message && message.header();
    if (throwIfNull && !schema) {
      throw new Error(nullMessage(type));
    }
    return schema;
  }
  async readMetadataLength() {
    const buf = await this.source.read(PADDING);
    const bb = buf && new ByteBuffer(buf);
    const len = (bb && bb.readInt32(0)) || 0;
    return { done: len === 0, value: len };
  }
  async readMetadata(metadataLength) {
    const buf = await this.source.read(metadataLength);
    if (!buf) {
      return ITERATOR_DONE;
    }
    if (buf.byteLength < metadataLength) {
      throw new Error(invalidMessageMetadata(metadataLength, buf.byteLength));
    }
    return { done: false, value: Message.decode(buf) };
  }
}
/** @ignore */
export class JSONMessageReader extends MessageReader {
  constructor(source) {
    super(new Uint8Array(0));
    this._schema = false;
    this._body = [];
    this._batchIndex = 0;
    this._dictionaryIndex = 0;
    this._json = source instanceof ArrowJSON ? source : new ArrowJSON(source);
  }
  next() {
    const { _json } = this;
    if (!this._schema) {
      this._schema = true;
      const message = Message.fromJSON(_json.schema, MessageHeader.Schema);
      return { done: false, value: message };
    }
    if (this._dictionaryIndex < _json.dictionaries.length) {
      const batch = _json.dictionaries[this._dictionaryIndex++];
      this._body = batch["data"]["columns"];
      const message = Message.fromJSON(batch, MessageHeader.DictionaryBatch);
      return { done: false, value: message };
    }
    if (this._batchIndex < _json.batches.length) {
      const batch = _json.batches[this._batchIndex++];
      this._body = batch["columns"];
      const message = Message.fromJSON(batch, MessageHeader.RecordBatch);
      return { done: false, value: message };
    }
    this._body = [];
    return ITERATOR_DONE;
  }
  readMessageBody(_bodyLength) {
    return flattenDataSources(this._body);
    function flattenDataSources(xs) {
      return (xs || []).reduce(
        (buffers, column) => [
          ...buffers,
          ...((column["VALIDITY"] && [column["VALIDITY"]]) || []),
          ...((column["TYPE"] && [column["TYPE"]]) || []),
          ...((column["OFFSET"] && [column["OFFSET"]]) || []),
          ...((column["DATA"] && [column["DATA"]]) || []),
          ...flattenDataSources(column["children"])
        ],
        []
      );
    }
  }
  readMessage(type) {
    let r;
    if ((r = this.next()).done) {
      return null;
    }
    if (type != null && r.value.headerType !== type) {
      throw new Error(invalidMessageType(type));
    }
    return r.value;
  }
  readSchema() {
    const type = MessageHeader.Schema;
    const message = this.readMessage(type);
    const schema = message && message.header();
    if (!message || !schema) {
      throw new Error(nullMessage(type));
    }
    return schema;
  }
}
/** @ignore */
export const PADDING = 4;
/** @ignore */
export const MAGIC_STR = "ARROW1";
/** @ignore */
export const MAGIC = new Uint8Array(MAGIC_STR.length);
for (let i = 0; i < MAGIC_STR.length; i += 1 | 0) {
  MAGIC[i] = MAGIC_STR.charCodeAt(i);
}
/** @ignore */
export function checkForMagicArrowString(buffer, index = 0) {
  for (let i = -1, n = MAGIC.length; ++i < n; ) {
    if (MAGIC[i] !== buffer[index + i]) {
      return false;
    }
  }
  return true;
}
/** @ignore */
export const magicLength = MAGIC.length;
/** @ignore */
export const magicAndPadding = magicLength + PADDING;
/** @ignore */
export const magicX2AndPadding = magicLength * 2 + PADDING;

//# sourceMappingURL=message.mjs.map
