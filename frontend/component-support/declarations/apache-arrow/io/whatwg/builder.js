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
const index_1 = require("../../builder/index")
/** @ignore */
function builderThroughDOMStream(options) {
  return new BuilderTransform(options)
}
exports.builderThroughDOMStream = builderThroughDOMStream
/** @ignore */
class BuilderTransform {
  constructor(options) {
    // Access properties by string indexers to defeat closure compiler
    this._numChunks = 0
    this._finished = false
    this._bufferedSize = 0
    const {
      ["readableStrategy"]: readableStrategy,
      ["writableStrategy"]: writableStrategy,
      ["queueingStrategy"]: queueingStrategy = "count",
      ...builderOptions
    } = options
    this._controller = null
    this._builder = index_1.Builder.new(builderOptions)
    this._getSize =
      queueingStrategy !== "bytes" ? chunkLength : chunkByteLength
    const {
      ["highWaterMark"]: readableHighWaterMark = queueingStrategy === "bytes"
        ? 2 ** 14
        : 1000,
    } = { ...readableStrategy }
    const {
      ["highWaterMark"]: writableHighWaterMark = queueingStrategy === "bytes"
        ? 2 ** 14
        : 1000,
    } = { ...writableStrategy }
    this["readable"] = new ReadableStream(
      {
        ["cancel"]: () => {
          this._builder.clear()
        },
        ["pull"]: c => {
          this._maybeFlush(this._builder, (this._controller = c))
        },
        ["start"]: c => {
          this._maybeFlush(this._builder, (this._controller = c))
        },
      },
      {
        highWaterMark: readableHighWaterMark,
        size: queueingStrategy !== "bytes" ? chunkLength : chunkByteLength,
      }
    )
    this["writable"] = new WritableStream(
      {
        ["abort"]: () => {
          this._builder.clear()
        },
        ["write"]: () => {
          this._maybeFlush(this._builder, this._controller)
        },
        ["close"]: () => {
          this._maybeFlush(this._builder.finish(), this._controller)
        },
      },
      {
        highWaterMark: writableHighWaterMark,
        size: value => this._writeValueAndReturnChunkSize(value),
      }
    )
  }
  _writeValueAndReturnChunkSize(value) {
    const bufferedSize = this._bufferedSize
    this._bufferedSize = this._getSize(this._builder.append(value))
    return this._bufferedSize - bufferedSize
  }
  _maybeFlush(builder, controller) {
    if (controller === null) {
      return
    }
    if (this._bufferedSize >= controller.desiredSize) {
      ++this._numChunks && this._enqueue(controller, builder.toVector())
    }
    if (builder.finished) {
      if (builder.length > 0 || this._numChunks === 0) {
        ++this._numChunks && this._enqueue(controller, builder.toVector())
      }
      if (!this._finished && (this._finished = true)) {
        this._enqueue(controller, null)
      }
    }
  }
  _enqueue(controller, chunk) {
    this._bufferedSize = 0
    this._controller = null
    chunk === null ? controller.close() : controller.enqueue(chunk)
  }
}
exports.BuilderTransform = BuilderTransform
/** @ignore */ const chunkLength = chunk => chunk.length
/** @ignore */ const chunkByteLength = chunk => chunk.byteLength

//# sourceMappingURL=builder.js.map
