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
const table_1 = require("../table")
const message_1 = require("./message")
const column_1 = require("../column")
const type_1 = require("../type")
const schema_1 = require("../schema")
const message_2 = require("./metadata/message")
const metadata = require("./metadata/message")
const file_1 = require("./metadata/file")
const enum_1 = require("../enum")
const stream_1 = require("../io/stream")
const vectorassembler_1 = require("../visitor/vectorassembler")
const jsontypeassembler_1 = require("../visitor/jsontypeassembler")
const jsonvectorassembler_1 = require("../visitor/jsonvectorassembler")
const buffer_1 = require("../util/buffer")
const recordbatch_1 = require("../recordbatch")
const interfaces_1 = require("../io/interfaces")
const compat_1 = require("../util/compat")
class RecordBatchWriter extends interfaces_1.ReadableInterop {
  constructor(options) {
    super()
    this._position = 0
    this._started = false
    // @ts-ignore
    this._sink = new stream_1.AsyncByteQueue()
    this._schema = null
    this._dictionaryBlocks = []
    this._recordBatchBlocks = []
    this._dictionaryDeltaOffsets = new Map()
    compat_1.isObject(options) ||
      (options = { autoDestroy: true, writeLegacyIpcFormat: false })
    this._autoDestroy =
      typeof options.autoDestroy === "boolean" ? options.autoDestroy : true
    this._writeLegacyIpcFormat =
      typeof options.writeLegacyIpcFormat === "boolean"
        ? options.writeLegacyIpcFormat
        : false
  }
  /** @nocollapse */
  // @ts-ignore
  static throughNode(options) {
    throw new Error(`"throughNode" not available in this environment`)
  }
  /** @nocollapse */
  static throughDOM(
    // @ts-ignore
    writableStrategy,
    // @ts-ignore
    readableStrategy
  ) {
    throw new Error(`"throughDOM" not available in this environment`)
  }
  toString(sync = false) {
    return this._sink.toString(sync)
  }
  toUint8Array(sync = false) {
    return this._sink.toUint8Array(sync)
  }
  writeAll(input) {
    if (compat_1.isPromise(input)) {
      return input.then(x => this.writeAll(x))
    } else if (compat_1.isAsyncIterable(input)) {
      return writeAllAsync(this, input)
    }
    return writeAll(this, input)
  }
  get closed() {
    return this._sink.closed
  }
  [Symbol.asyncIterator]() {
    return this._sink[Symbol.asyncIterator]()
  }
  toDOMStream(options) {
    return this._sink.toDOMStream(options)
  }
  toNodeStream(options) {
    return this._sink.toNodeStream(options)
  }
  close() {
    return this.reset()._sink.close()
  }
  abort(reason) {
    return this.reset()._sink.abort(reason)
  }
  finish() {
    this._autoDestroy ? this.close() : this.reset(this._sink, this._schema)
    return this
  }
  reset(sink = this._sink, schema = null) {
    if (sink === this._sink || sink instanceof stream_1.AsyncByteQueue) {
      this._sink = sink
    } else {
      this._sink = new stream_1.AsyncByteQueue()
      if (sink && compat_1.isWritableDOMStream(sink)) {
        this.toDOMStream({ type: "bytes" }).pipeTo(sink)
      } else if (sink && compat_1.isWritableNodeStream(sink)) {
        this.toNodeStream({ objectMode: false }).pipe(sink)
      }
    }
    if (this._started && this._schema) {
      this._writeFooter(this._schema)
    }
    this._started = false
    this._dictionaryBlocks = []
    this._recordBatchBlocks = []
    this._dictionaryDeltaOffsets = new Map()
    if (!schema || !schema.compareTo(this._schema)) {
      if (schema === null) {
        this._position = 0
        this._schema = null
      } else {
        this._started = true
        this._schema = schema
        this._writeSchema(schema)
      }
    }
    return this
  }
  write(payload) {
    let schema = null
    if (!this._sink) {
      throw new Error(`RecordBatchWriter is closed`)
    } else if (payload === null || payload === undefined) {
      return this.finish() && undefined
    } else if (
      payload instanceof table_1.Table &&
      !(schema = payload.schema)
    ) {
      return this.finish() && undefined
    } else if (
      payload instanceof recordbatch_1.RecordBatch &&
      !(schema = payload.schema)
    ) {
      return this.finish() && undefined
    }
    if (schema && !schema.compareTo(this._schema)) {
      if (this._started && this._autoDestroy) {
        return this.close()
      }
      this.reset(this._sink, schema)
    }
    if (payload instanceof recordbatch_1.RecordBatch) {
      if (
        !(
          payload instanceof recordbatch_1._InternalEmptyPlaceholderRecordBatch
        )
      ) {
        this._writeRecordBatch(payload)
      }
    } else if (payload instanceof table_1.Table) {
      this.writeAll(payload.chunks)
    } else if (compat_1.isIterable(payload)) {
      this.writeAll(payload)
    }
  }
  _writeMessage(message, alignment = 8) {
    const a = alignment - 1
    const buffer = message_2.Message.encode(message)
    const flatbufferSize = buffer.byteLength
    const prefixSize = !this._writeLegacyIpcFormat ? 8 : 4
    const alignedSize = (flatbufferSize + prefixSize + a) & ~a
    const nPaddingBytes = alignedSize - flatbufferSize - prefixSize
    if (message.headerType === enum_1.MessageHeader.RecordBatch) {
      this._recordBatchBlocks.push(
        new file_1.FileBlock(alignedSize, message.bodyLength, this._position)
      )
    } else if (message.headerType === enum_1.MessageHeader.DictionaryBatch) {
      this._dictionaryBlocks.push(
        new file_1.FileBlock(alignedSize, message.bodyLength, this._position)
      )
    }
    // If not in legacy pre-0.15.0 mode, write the stream continuation indicator
    if (!this._writeLegacyIpcFormat) {
      this._write(Int32Array.of(-1))
    }
    // Write the flatbuffer size prefix including padding
    this._write(Int32Array.of(alignedSize - prefixSize))
    // Write the flatbuffer
    if (flatbufferSize > 0) {
      this._write(buffer)
    }
    // Write any padding
    return this._writePadding(nPaddingBytes)
  }
  _write(chunk) {
    if (this._started) {
      const buffer = buffer_1.toUint8Array(chunk)
      if (buffer && buffer.byteLength > 0) {
        this._sink.write(buffer)
        this._position += buffer.byteLength
      }
    }
    return this
  }
  _writeSchema(schema) {
    return this._writeMessage(message_2.Message.from(schema))
  }
  // @ts-ignore
  _writeFooter(schema) {
    // eos bytes
    return this._writeLegacyIpcFormat
      ? this._write(Int32Array.of(0))
      : this._write(Int32Array.of(-1, 0))
  }
  _writeMagic() {
    return this._write(message_1.MAGIC)
  }
  _writePadding(nBytes) {
    return nBytes > 0 ? this._write(new Uint8Array(nBytes)) : this
  }
  _writeRecordBatch(batch) {
    const {
      byteLength,
      nodes,
      bufferRegions,
      buffers,
    } = vectorassembler_1.VectorAssembler.assemble(batch)
    const recordBatch = new metadata.RecordBatch(
      batch.length,
      nodes,
      bufferRegions
    )
    const message = message_2.Message.from(recordBatch, byteLength)
    return this._writeDictionaries(batch)
      ._writeMessage(message)
      ._writeBodyBuffers(buffers)
  }
  _writeDictionaryBatch(dictionary, id, isDelta = false) {
    this._dictionaryDeltaOffsets.set(
      id,
      dictionary.length + (this._dictionaryDeltaOffsets.get(id) || 0)
    )
    const {
      byteLength,
      nodes,
      bufferRegions,
      buffers,
    } = vectorassembler_1.VectorAssembler.assemble(dictionary)
    const recordBatch = new metadata.RecordBatch(
      dictionary.length,
      nodes,
      bufferRegions
    )
    const dictionaryBatch = new metadata.DictionaryBatch(
      recordBatch,
      id,
      isDelta
    )
    const message = message_2.Message.from(dictionaryBatch, byteLength)
    return this._writeMessage(message)._writeBodyBuffers(buffers)
  }
  _writeBodyBuffers(buffers) {
    let buffer
    let size, padding
    for (let i = -1, n = buffers.length; ++i < n; ) {
      if ((buffer = buffers[i]) && (size = buffer.byteLength) > 0) {
        this._write(buffer)
        if ((padding = ((size + 7) & ~7) - size) > 0) {
          this._writePadding(padding)
        }
      }
    }
    return this
  }
  _writeDictionaries(batch) {
    for (let [id, dictionary] of batch.dictionaries) {
      let offset = this._dictionaryDeltaOffsets.get(id) || 0
      if (offset === 0 || (dictionary = dictionary.slice(offset)).length > 0) {
        const chunks =
          "chunks" in dictionary ? dictionary.chunks : [dictionary]
        for (const chunk of chunks) {
          this._writeDictionaryBatch(chunk, id, offset > 0)
          offset += chunk.length
        }
      }
    }
    return this
  }
}
exports.RecordBatchWriter = RecordBatchWriter
/** @ignore */
class RecordBatchStreamWriter extends RecordBatchWriter {
  /** @nocollapse */
  static writeAll(input, options) {
    const writer = new RecordBatchStreamWriter(options)
    if (compat_1.isPromise(input)) {
      return input.then(x => writer.writeAll(x))
    } else if (compat_1.isAsyncIterable(input)) {
      return writeAllAsync(writer, input)
    }
    return writeAll(writer, input)
  }
}
exports.RecordBatchStreamWriter = RecordBatchStreamWriter
/** @ignore */
class RecordBatchFileWriter extends RecordBatchWriter {
  constructor() {
    super()
    this._autoDestroy = true
  }
  /** @nocollapse */
  static writeAll(input) {
    const writer = new RecordBatchFileWriter()
    if (compat_1.isPromise(input)) {
      return input.then(x => writer.writeAll(x))
    } else if (compat_1.isAsyncIterable(input)) {
      return writeAllAsync(writer, input)
    }
    return writeAll(writer, input)
  }
  // @ts-ignore
  _writeSchema(schema) {
    return this._writeMagic()._writePadding(2)
  }
  _writeFooter(schema) {
    const buffer = file_1.Footer.encode(
      new file_1.Footer(
        schema,
        enum_1.MetadataVersion.V4,
        this._recordBatchBlocks,
        this._dictionaryBlocks
      )
    )
    return super
      ._writeFooter(schema) // EOS bytes for sequential readers
      ._write(buffer) // Write the flatbuffer
      ._write(Int32Array.of(buffer.byteLength)) // then the footer size suffix
      ._writeMagic() // then the magic suffix
  }
}
exports.RecordBatchFileWriter = RecordBatchFileWriter
/** @ignore */
class RecordBatchJSONWriter extends RecordBatchWriter {
  constructor() {
    super()
    this._autoDestroy = true
    this._recordBatches = []
    this._dictionaries = []
  }
  /** @nocollapse */
  static writeAll(input) {
    return new RecordBatchJSONWriter().writeAll(input)
  }
  _writeMessage() {
    return this
  }
  // @ts-ignore
  _writeFooter(schema) {
    return this
  }
  _writeSchema(schema) {
    return this._write(
      `{\n  "schema": ${JSON.stringify(
        { fields: schema.fields.map(fieldToJSON) },
        null,
        2
      )}`
    )
  }
  _writeDictionaries(batch) {
    if (batch.dictionaries.size > 0) {
      this._dictionaries.push(batch)
    }
    return this
  }
  _writeDictionaryBatch(dictionary, id, isDelta = false) {
    this._dictionaryDeltaOffsets.set(
      id,
      dictionary.length + (this._dictionaryDeltaOffsets.get(id) || 0)
    )
    this._write(this._dictionaryBlocks.length === 0 ? `    ` : `,\n    `)
    this._write(`${dictionaryBatchToJSON(dictionary, id, isDelta)}`)
    this._dictionaryBlocks.push(new file_1.FileBlock(0, 0, 0))
    return this
  }
  _writeRecordBatch(batch) {
    this._writeDictionaries(batch)
    this._recordBatches.push(batch)
    return this
  }
  close() {
    if (this._dictionaries.length > 0) {
      this._write(`,\n  "dictionaries": [\n`)
      for (const batch of this._dictionaries) {
        super._writeDictionaries(batch)
      }
      this._write(`\n  ]`)
    }
    if (this._recordBatches.length > 0) {
      for (let i = -1, n = this._recordBatches.length; ++i < n; ) {
        this._write(i === 0 ? `,\n  "batches": [\n    ` : `,\n    `)
        this._write(`${recordBatchToJSON(this._recordBatches[i])}`)
        this._recordBatchBlocks.push(new file_1.FileBlock(0, 0, 0))
      }
      this._write(`\n  ]`)
    }
    if (this._schema) {
      this._write(`\n}`)
    }
    this._dictionaries = []
    this._recordBatches = []
    return super.close()
  }
}
exports.RecordBatchJSONWriter = RecordBatchJSONWriter
/** @ignore */
function writeAll(writer, input) {
  let chunks = input
  if (input instanceof table_1.Table) {
    chunks = input.chunks
    writer.reset(undefined, input.schema)
  }
  for (const batch of chunks) {
    writer.write(batch)
  }
  return writer.finish()
}
/** @ignore */
async function writeAllAsync(writer, batches) {
  for await (const batch of batches) {
    writer.write(batch)
  }
  return writer.finish()
}
/** @ignore */
function fieldToJSON({ name, type, nullable }) {
  const assembler = new jsontypeassembler_1.JSONTypeAssembler()
  return {
    name: name,
    nullable: nullable,
    type: assembler.visit(type),
    children: (type.children || []).map(fieldToJSON),
    dictionary: !type_1.DataType.isDictionary(type)
      ? undefined
      : {
          id: type.id,
          isOrdered: type.isOrdered,
          indexType: assembler.visit(type.indices),
        },
  }
}
/** @ignore */
function dictionaryBatchToJSON(dictionary, id, isDelta = false) {
  const field = new schema_1.Field(
    `${id}`,
    dictionary.type,
    dictionary.nullCount > 0
  )
  const columns = jsonvectorassembler_1.JSONVectorAssembler.assemble(
    new column_1.Column(field, [dictionary])
  )
  return JSON.stringify(
    {
      id: id,
      isDelta: isDelta,
      data: {
        count: dictionary.length,
        columns: columns,
      },
    },
    null,
    2
  )
}
/** @ignore */
function recordBatchToJSON(records) {
  return JSON.stringify(
    {
      count: records.length,
      columns: jsonvectorassembler_1.JSONVectorAssembler.assemble(records),
    },
    null,
    2
  )
}

//# sourceMappingURL=writer.js.map
