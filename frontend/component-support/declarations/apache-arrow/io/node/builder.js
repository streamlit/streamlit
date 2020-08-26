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
const stream_1 = require("stream")
const index_1 = require("../../builder/index")
/** @ignore */
function builderThroughNodeStream(options) {
  return new BuilderDuplex(index_1.Builder.new(options), options)
}
exports.builderThroughNodeStream = builderThroughNodeStream
/** @ignore */
class BuilderDuplex extends stream_1.Duplex {
  constructor(builder, options) {
    const { queueingStrategy = "count", autoDestroy = true } = options
    const {
      highWaterMark = queueingStrategy !== "bytes" ? 1000 : 2 ** 14,
    } = options
    super({
      autoDestroy,
      highWaterMark: 1,
      allowHalfOpen: true,
      writableObjectMode: true,
      readableObjectMode: true,
    })
    this._numChunks = 0
    this._finished = false
    this._builder = builder
    this._desiredSize = highWaterMark
    this._getSize =
      queueingStrategy !== "bytes" ? builderLength : builderByteLength
  }
  _read(size) {
    this._maybeFlush(this._builder, (this._desiredSize = size))
  }
  _final(cb) {
    this._maybeFlush(this._builder.finish(), this._desiredSize)
    cb && cb()
  }
  _write(value, _, cb) {
    const result = this._maybeFlush(
      this._builder.append(value),
      this._desiredSize
    )
    cb && cb()
    return result
  }
  _destroy(err, cb) {
    this._builder.clear()
    cb && cb(err)
  }
  _maybeFlush(builder, size) {
    if (this._getSize(builder) >= size) {
      ++this._numChunks && this.push(builder.toVector())
    }
    if (builder.finished) {
      if (builder.length > 0 || this._numChunks === 0) {
        ++this._numChunks && this.push(builder.toVector())
      }
      if (!this._finished && (this._finished = true)) {
        this.push(null)
      }
      return false
    }
    return this._getSize(builder) < this.writableHighWaterMark
  }
}
/** @ignore */ const builderLength = builder => builder.length
/** @ignore */ const builderByteLength = builder => builder.byteLength

//# sourceMappingURL=builder.js.map
