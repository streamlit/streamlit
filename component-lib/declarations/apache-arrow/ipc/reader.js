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
const vector_1 = require("../vector");
const enum_1 = require("../enum");
const file_1 = require("./metadata/file");
const adapters_1 = require("../io/adapters");
const stream_1 = require("../io/stream");
const file_2 = require("../io/file");
const vectorloader_1 = require("../visitor/vectorloader");
const recordbatch_1 = require("../recordbatch");
const interfaces_1 = require("../io/interfaces");
const message_1 = require("./message");
const compat_1 = require("../util/compat");
class RecordBatchReader extends interfaces_1.ReadableInterop {
  constructor(impl) {
    super();
    this._impl = impl;
  }
  get closed() {
    return this._impl.closed;
  }
  get schema() {
    return this._impl.schema;
  }
  get autoDestroy() {
    return this._impl.autoDestroy;
  }
  get dictionaries() {
    return this._impl.dictionaries;
  }
  get numDictionaries() {
    return this._impl.numDictionaries;
  }
  get numRecordBatches() {
    return this._impl.numRecordBatches;
  }
  get footer() {
    return this._impl.isFile() ? this._impl.footer : null;
  }
  isSync() {
    return this._impl.isSync();
  }
  isAsync() {
    return this._impl.isAsync();
  }
  isFile() {
    return this._impl.isFile();
  }
  isStream() {
    return this._impl.isStream();
  }
  next() {
    return this._impl.next();
  }
  throw(value) {
    return this._impl.throw(value);
  }
  return(value) {
    return this._impl.return(value);
  }
  cancel() {
    return this._impl.cancel();
  }
  reset(schema) {
    this._impl.reset(schema);
    this._DOMStream = undefined;
    this._nodeStream = undefined;
    return this;
  }
  open(options) {
    const opening = this._impl.open(options);
    return compat_1.isPromise(opening) ? opening.then(() => this) : this;
  }
  readRecordBatch(index) {
    return this._impl.isFile() ? this._impl.readRecordBatch(index) : null;
  }
  [Symbol.iterator]() {
    return this._impl[Symbol.iterator]();
  }
  [Symbol.asyncIterator]() {
    return this._impl[Symbol.asyncIterator]();
  }
  toDOMStream() {
    return adapters_1.default.toDOMStream(
      this.isSync()
        ? { [Symbol.iterator]: () => this }
        : { [Symbol.asyncIterator]: () => this }
    );
  }
  toNodeStream() {
    return adapters_1.default.toNodeStream(
      this.isSync()
        ? { [Symbol.iterator]: () => this }
        : { [Symbol.asyncIterator]: () => this },
      { objectMode: true }
    );
  }
  /** @nocollapse */
  // @ts-ignore
  static throughNode(options) {
    throw new Error(`"throughNode" not available in this environment`);
  }
  /** @nocollapse */
  static throughDOM(
    // @ts-ignore
    writableStrategy,
    // @ts-ignore
    readableStrategy
  ) {
    throw new Error(`"throughDOM" not available in this environment`);
  }
  /** @nocollapse */
  static from(source) {
    if (source instanceof RecordBatchReader) {
      return source;
    } else if (compat_1.isArrowJSON(source)) {
      return fromArrowJSON(source);
    } else if (compat_1.isFileHandle(source)) {
      return fromFileHandle(source);
    } else if (compat_1.isPromise(source)) {
      return (async () => await RecordBatchReader.from(await source))();
    } else if (
      compat_1.isFetchResponse(source) ||
      compat_1.isReadableDOMStream(source) ||
      compat_1.isReadableNodeStream(source) ||
      compat_1.isAsyncIterable(source)
    ) {
      return fromAsyncByteStream(new stream_1.AsyncByteStream(source));
    }
    return fromByteStream(new stream_1.ByteStream(source));
  }
  /** @nocollapse */
  static readAll(source) {
    if (source instanceof RecordBatchReader) {
      return source.isSync() ? readAllSync(source) : readAllAsync(source);
    } else if (
      compat_1.isArrowJSON(source) ||
      ArrayBuffer.isView(source) ||
      compat_1.isIterable(source) ||
      compat_1.isIteratorResult(source)
    ) {
      return readAllSync(source);
    }
    return readAllAsync(source);
  }
}
exports.RecordBatchReader = RecordBatchReader;
//
// Since TS is a structural type system, we define the following subclass stubs
// so that concrete types exist to associate with with the interfaces below.
//
// The implementation for each RecordBatchReader is hidden away in the set of
// `RecordBatchReaderImpl` classes in the second half of this file. This allows
// us to export a single RecordBatchReader class, and swap out the impl based
// on the io primitives or underlying arrow (JSON, file, or stream) at runtime.
//
// Async/await makes our job a bit harder, since it forces everything to be
// either fully sync or fully async. This is why the logic for the reader impls
// has been duplicated into both sync and async variants. Since the RBR
// delegates to its impl, an RBR with an AsyncRecordBatchFileReaderImpl for
// example will return async/await-friendly Promises, but one with a (sync)
// RecordBatchStreamReaderImpl will always return values. Nothing should be
// different about their logic, aside from the async handling. This is also why
// this code looks highly structured, as it should be nearly identical and easy
// to follow.
//
/** @ignore */
class RecordBatchStreamReader extends RecordBatchReader {
  constructor(_impl) {
    super(_impl);
    this._impl = _impl;
  }
  [Symbol.iterator]() {
    return this._impl[Symbol.iterator]();
  }
  async *[Symbol.asyncIterator]() {
    yield* this[Symbol.iterator]();
  }
}
exports.RecordBatchStreamReader = RecordBatchStreamReader;
/** @ignore */
class AsyncRecordBatchStreamReader extends RecordBatchReader {
  constructor(_impl) {
    super(_impl);
    this._impl = _impl;
  }
  [Symbol.iterator]() {
    throw new Error(`AsyncRecordBatchStreamReader is not Iterable`);
  }
  [Symbol.asyncIterator]() {
    return this._impl[Symbol.asyncIterator]();
  }
}
exports.AsyncRecordBatchStreamReader = AsyncRecordBatchStreamReader;
/** @ignore */
class RecordBatchFileReader extends RecordBatchStreamReader {
  constructor(_impl) {
    super(_impl);
    this._impl = _impl;
  }
}
exports.RecordBatchFileReader = RecordBatchFileReader;
/** @ignore */
class AsyncRecordBatchFileReader extends AsyncRecordBatchStreamReader {
  constructor(_impl) {
    super(_impl);
    this._impl = _impl;
  }
}
exports.AsyncRecordBatchFileReader = AsyncRecordBatchFileReader;
/** @ignore */
class RecordBatchReaderImpl {
  constructor(dictionaries = new Map()) {
    this.closed = false;
    this.autoDestroy = true;
    this._dictionaryIndex = 0;
    this._recordBatchIndex = 0;
    this.dictionaries = dictionaries;
  }
  get numDictionaries() {
    return this._dictionaryIndex;
  }
  get numRecordBatches() {
    return this._recordBatchIndex;
  }
  isSync() {
    return false;
  }
  isAsync() {
    return false;
  }
  isFile() {
    return false;
  }
  isStream() {
    return false;
  }
  reset(schema) {
    this._dictionaryIndex = 0;
    this._recordBatchIndex = 0;
    this.schema = schema;
    this.dictionaries = new Map();
    return this;
  }
  _loadRecordBatch(header, body) {
    return new recordbatch_1.RecordBatch(
      this.schema,
      header.length,
      this._loadVectors(header, body, this.schema.fields)
    );
  }
  _loadDictionaryBatch(header, body) {
    const { id, isDelta, data } = header;
    const { dictionaries, schema } = this;
    const dictionary = dictionaries.get(id);
    if (isDelta || !dictionary) {
      const type = schema.dictionaries.get(id);
      return dictionary && isDelta
        ? dictionary.concat(
            vector_1.Vector.new(this._loadVectors(data, body, [type])[0])
          )
        : vector_1.Vector.new(this._loadVectors(data, body, [type])[0]);
    }
    return dictionary;
  }
  _loadVectors(header, body, types) {
    return new vectorloader_1.VectorLoader(
      body,
      header.nodes,
      header.buffers,
      this.dictionaries
    ).visitMany(types);
  }
}
/** @ignore */
class RecordBatchStreamReaderImpl extends RecordBatchReaderImpl {
  constructor(source, dictionaries) {
    super(dictionaries);
    this._reader = !compat_1.isArrowJSON(source)
      ? new message_1.MessageReader((this._handle = source))
      : new message_1.JSONMessageReader((this._handle = source));
  }
  isSync() {
    return true;
  }
  isStream() {
    return true;
  }
  [Symbol.iterator]() {
    return this;
  }
  cancel() {
    if (!this.closed && (this.closed = true)) {
      this.reset()._reader.return();
      this._reader = null;
      this.dictionaries = null;
    }
  }
  open(options) {
    if (!this.closed) {
      this.autoDestroy = shouldAutoDestroy(this, options);
      if (!(this.schema || (this.schema = this._reader.readSchema()))) {
        this.cancel();
      }
    }
    return this;
  }
  throw(value) {
    if (!this.closed && this.autoDestroy && (this.closed = true)) {
      return this.reset()._reader.throw(value);
    }
    return interfaces_1.ITERATOR_DONE;
  }
  return(value) {
    if (!this.closed && this.autoDestroy && (this.closed = true)) {
      return this.reset()._reader.return(value);
    }
    return interfaces_1.ITERATOR_DONE;
  }
  next() {
    if (this.closed) {
      return interfaces_1.ITERATOR_DONE;
    }
    let message,
      { _reader: reader } = this;
    while ((message = this._readNextMessageAndValidate())) {
      if (message.isSchema()) {
        this.reset(message.header());
      } else if (message.isRecordBatch()) {
        this._recordBatchIndex++;
        const header = message.header();
        const buffer = reader.readMessageBody(message.bodyLength);
        const recordBatch = this._loadRecordBatch(header, buffer);
        return { done: false, value: recordBatch };
      } else if (message.isDictionaryBatch()) {
        this._dictionaryIndex++;
        const header = message.header();
        const buffer = reader.readMessageBody(message.bodyLength);
        const vector = this._loadDictionaryBatch(header, buffer);
        this.dictionaries.set(header.id, vector);
      }
    }
    if (this.schema && this._recordBatchIndex === 0) {
      this._recordBatchIndex++;
      return {
        done: false,
        value: new recordbatch_1._InternalEmptyPlaceholderRecordBatch(
          this.schema
        )
      };
    }
    return this.return();
  }
  _readNextMessageAndValidate(type) {
    return this._reader.readMessage(type);
  }
}
/** @ignore */
class AsyncRecordBatchStreamReaderImpl extends RecordBatchReaderImpl {
  constructor(source, dictionaries) {
    super(dictionaries);
    this._reader = new message_1.AsyncMessageReader((this._handle = source));
  }
  isAsync() {
    return true;
  }
  isStream() {
    return true;
  }
  [Symbol.asyncIterator]() {
    return this;
  }
  async cancel() {
    if (!this.closed && (this.closed = true)) {
      await this.reset()._reader.return();
      this._reader = null;
      this.dictionaries = null;
    }
  }
  async open(options) {
    if (!this.closed) {
      this.autoDestroy = shouldAutoDestroy(this, options);
      if (!(this.schema || (this.schema = await this._reader.readSchema()))) {
        await this.cancel();
      }
    }
    return this;
  }
  async throw(value) {
    if (!this.closed && this.autoDestroy && (this.closed = true)) {
      return await this.reset()._reader.throw(value);
    }
    return interfaces_1.ITERATOR_DONE;
  }
  async return(value) {
    if (!this.closed && this.autoDestroy && (this.closed = true)) {
      return await this.reset()._reader.return(value);
    }
    return interfaces_1.ITERATOR_DONE;
  }
  async next() {
    if (this.closed) {
      return interfaces_1.ITERATOR_DONE;
    }
    let message,
      { _reader: reader } = this;
    while ((message = await this._readNextMessageAndValidate())) {
      if (message.isSchema()) {
        await this.reset(message.header());
      } else if (message.isRecordBatch()) {
        this._recordBatchIndex++;
        const header = message.header();
        const buffer = await reader.readMessageBody(message.bodyLength);
        const recordBatch = this._loadRecordBatch(header, buffer);
        return { done: false, value: recordBatch };
      } else if (message.isDictionaryBatch()) {
        this._dictionaryIndex++;
        const header = message.header();
        const buffer = await reader.readMessageBody(message.bodyLength);
        const vector = this._loadDictionaryBatch(header, buffer);
        this.dictionaries.set(header.id, vector);
      }
    }
    if (this.schema && this._recordBatchIndex === 0) {
      this._recordBatchIndex++;
      return {
        done: false,
        value: new recordbatch_1._InternalEmptyPlaceholderRecordBatch(
          this.schema
        )
      };
    }
    return await this.return();
  }
  async _readNextMessageAndValidate(type) {
    return await this._reader.readMessage(type);
  }
}
/** @ignore */
class RecordBatchFileReaderImpl extends RecordBatchStreamReaderImpl {
  constructor(source, dictionaries) {
    super(
      source instanceof file_2.RandomAccessFile
        ? source
        : new file_2.RandomAccessFile(source),
      dictionaries
    );
  }
  get footer() {
    return this._footer;
  }
  get numDictionaries() {
    return this._footer ? this._footer.numDictionaries : 0;
  }
  get numRecordBatches() {
    return this._footer ? this._footer.numRecordBatches : 0;
  }
  isSync() {
    return true;
  }
  isFile() {
    return true;
  }
  open(options) {
    if (!this.closed && !this._footer) {
      this.schema = (this._footer = this._readFooter()).schema;
      for (const block of this._footer.dictionaryBatches()) {
        block && this._readDictionaryBatch(this._dictionaryIndex++);
      }
    }
    return super.open(options);
  }
  readRecordBatch(index) {
    if (this.closed) {
      return null;
    }
    if (!this._footer) {
      this.open();
    }
    const block = this._footer && this._footer.getRecordBatch(index);
    if (block && this._handle.seek(block.offset)) {
      const message = this._reader.readMessage(
        enum_1.MessageHeader.RecordBatch
      );
      if (message && message.isRecordBatch()) {
        const header = message.header();
        const buffer = this._reader.readMessageBody(message.bodyLength);
        const recordBatch = this._loadRecordBatch(header, buffer);
        return recordBatch;
      }
    }
    return null;
  }
  _readDictionaryBatch(index) {
    const block = this._footer && this._footer.getDictionaryBatch(index);
    if (block && this._handle.seek(block.offset)) {
      const message = this._reader.readMessage(
        enum_1.MessageHeader.DictionaryBatch
      );
      if (message && message.isDictionaryBatch()) {
        const header = message.header();
        const buffer = this._reader.readMessageBody(message.bodyLength);
        const vector = this._loadDictionaryBatch(header, buffer);
        this.dictionaries.set(header.id, vector);
      }
    }
  }
  _readFooter() {
    const { _handle } = this;
    const offset = _handle.size - message_1.magicAndPadding;
    const length = _handle.readInt32(offset);
    const buffer = _handle.readAt(offset - length, length);
    return file_1.Footer.decode(buffer);
  }
  _readNextMessageAndValidate(type) {
    if (!this._footer) {
      this.open();
    }
    if (this._footer && this._recordBatchIndex < this.numRecordBatches) {
      const block =
        this._footer && this._footer.getRecordBatch(this._recordBatchIndex);
      if (block && this._handle.seek(block.offset)) {
        return this._reader.readMessage(type);
      }
    }
    return null;
  }
}
/** @ignore */
class AsyncRecordBatchFileReaderImpl extends AsyncRecordBatchStreamReaderImpl {
  constructor(source, ...rest) {
    const byteLength = typeof rest[0] !== "number" ? rest.shift() : undefined;
    const dictionaries = rest[0] instanceof Map ? rest.shift() : undefined;
    super(
      source instanceof file_2.AsyncRandomAccessFile
        ? source
        : new file_2.AsyncRandomAccessFile(source, byteLength),
      dictionaries
    );
  }
  get footer() {
    return this._footer;
  }
  get numDictionaries() {
    return this._footer ? this._footer.numDictionaries : 0;
  }
  get numRecordBatches() {
    return this._footer ? this._footer.numRecordBatches : 0;
  }
  isFile() {
    return true;
  }
  isAsync() {
    return true;
  }
  async open(options) {
    if (!this.closed && !this._footer) {
      this.schema = (this._footer = await this._readFooter()).schema;
      for (const block of this._footer.dictionaryBatches()) {
        block && (await this._readDictionaryBatch(this._dictionaryIndex++));
      }
    }
    return await super.open(options);
  }
  async readRecordBatch(index) {
    if (this.closed) {
      return null;
    }
    if (!this._footer) {
      await this.open();
    }
    const block = this._footer && this._footer.getRecordBatch(index);
    if (block && (await this._handle.seek(block.offset))) {
      const message = await this._reader.readMessage(
        enum_1.MessageHeader.RecordBatch
      );
      if (message && message.isRecordBatch()) {
        const header = message.header();
        const buffer = await this._reader.readMessageBody(message.bodyLength);
        const recordBatch = this._loadRecordBatch(header, buffer);
        return recordBatch;
      }
    }
    return null;
  }
  async _readDictionaryBatch(index) {
    const block = this._footer && this._footer.getDictionaryBatch(index);
    if (block && (await this._handle.seek(block.offset))) {
      const message = await this._reader.readMessage(
        enum_1.MessageHeader.DictionaryBatch
      );
      if (message && message.isDictionaryBatch()) {
        const header = message.header();
        const buffer = await this._reader.readMessageBody(message.bodyLength);
        const vector = this._loadDictionaryBatch(header, buffer);
        this.dictionaries.set(header.id, vector);
      }
    }
  }
  async _readFooter() {
    const { _handle } = this;
    _handle._pending && (await _handle._pending);
    const offset = _handle.size - message_1.magicAndPadding;
    const length = await _handle.readInt32(offset);
    const buffer = await _handle.readAt(offset - length, length);
    return file_1.Footer.decode(buffer);
  }
  async _readNextMessageAndValidate(type) {
    if (!this._footer) {
      await this.open();
    }
    if (this._footer && this._recordBatchIndex < this.numRecordBatches) {
      const block = this._footer.getRecordBatch(this._recordBatchIndex);
      if (block && (await this._handle.seek(block.offset))) {
        return await this._reader.readMessage(type);
      }
    }
    return null;
  }
}
/** @ignore */
class RecordBatchJSONReaderImpl extends RecordBatchStreamReaderImpl {
  constructor(source, dictionaries) {
    super(source, dictionaries);
  }
  _loadVectors(header, body, types) {
    return new vectorloader_1.JSONVectorLoader(
      body,
      header.nodes,
      header.buffers,
      this.dictionaries
    ).visitMany(types);
  }
}
//
// Define some helper functions and static implementations down here. There's
// a bit of branching in the static methods that can lead to the same routines
// being executed, so we've broken those out here for readability.
//
/** @ignore */
function shouldAutoDestroy(self, options) {
  return options && typeof options["autoDestroy"] === "boolean"
    ? options["autoDestroy"]
    : self["autoDestroy"];
}
/** @ignore */
function* readAllSync(source) {
  const reader = RecordBatchReader.from(source);
  try {
    if (!reader.open({ autoDestroy: false }).closed) {
      do {
        yield reader;
      } while (!reader.reset().open().closed);
    }
  } finally {
    reader.cancel();
  }
}
/** @ignore */
async function* readAllAsync(source) {
  const reader = await RecordBatchReader.from(source);
  try {
    if (!(await reader.open({ autoDestroy: false })).closed) {
      do {
        yield reader;
      } while (!(await reader.reset().open()).closed);
    }
  } finally {
    await reader.cancel();
  }
}
/** @ignore */
function fromArrowJSON(source) {
  return new RecordBatchStreamReader(new RecordBatchJSONReaderImpl(source));
}
/** @ignore */
function fromByteStream(source) {
  const bytes = source.peek((message_1.magicLength + 7) & ~7);
  return bytes && bytes.byteLength >= 4
    ? !message_1.checkForMagicArrowString(bytes)
      ? new RecordBatchStreamReader(new RecordBatchStreamReaderImpl(source))
      : new RecordBatchFileReader(new RecordBatchFileReaderImpl(source.read()))
    : new RecordBatchStreamReader(
        new RecordBatchStreamReaderImpl((function*() {})())
      );
}
/** @ignore */
async function fromAsyncByteStream(source) {
  const bytes = await source.peek((message_1.magicLength + 7) & ~7);
  return bytes && bytes.byteLength >= 4
    ? !message_1.checkForMagicArrowString(bytes)
      ? new AsyncRecordBatchStreamReader(
          new AsyncRecordBatchStreamReaderImpl(source)
        )
      : new RecordBatchFileReader(
          new RecordBatchFileReaderImpl(await source.read())
        )
    : new AsyncRecordBatchStreamReader(
        new AsyncRecordBatchStreamReaderImpl((async function*() {})())
      );
}
/** @ignore */
async function fromFileHandle(source) {
  const { size } = await source.stat();
  const file = new file_2.AsyncRandomAccessFile(source, size);
  if (size >= message_1.magicX2AndPadding) {
    if (
      message_1.checkForMagicArrowString(
        await file.readAt(0, (message_1.magicLength + 7) & ~7)
      )
    ) {
      return new AsyncRecordBatchFileReader(
        new AsyncRecordBatchFileReaderImpl(file)
      );
    }
  }
  return new AsyncRecordBatchStreamReader(
    new AsyncRecordBatchStreamReaderImpl(file)
  );
}

//# sourceMappingURL=reader.js.map
